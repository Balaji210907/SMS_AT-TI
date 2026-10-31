import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * App email via Resend. All sends are logged in email_logs with an idempotency
 * key so retries never duplicate. When RESEND_API_KEY is not configured the
 * send is logged as not_configured and reported honestly — never fake success.
 */

const SUBJECTS: Record<string, string> = {
  quotation_sent: "Your quotation from Brightloop",
  invoice_confirmed: "Your invoice from Brightloop",
  payment_received: "Payment received — Brightloop",
  subscription_confirmed: "Your subscription is confirmed — Brightloop",
};

function renderEmail(template: string, d: Record<string, string>): string {
  const row = (k: string, v: string) => `<tr><td style="padding:6px 12px;color:#666;font-size:14px">${k}</td><td style="padding:6px 12px;font-size:14px;font-weight:600">${v}</td></tr>`;
  const rows: Record<string, string> = {
    quotation_sent: `<p style="font-size:14px">Your quotation <b>${d["number"] ?? ""}</b> is ready. Please review it and let us know if you'd like to proceed.</p>${d["total"] ? row("Total", d["total"]) : ""}${d["validUntil"] ? row("Valid until", d["validUntil"]) : ""}`,
    invoice_confirmed: `<p style="font-size:14px">Invoice <b>${d["number"] ?? ""}</b> has been issued.</p>${row("Amount due", d["total"] ?? "")}${row("Due date", d["dueDate"] ?? "")}`,
    payment_received: `<p style="font-size:14px">We've received your payment. Thank you!</p>${row("Payment", d["number"] ?? "")}${row("Amount", d["total"] ?? "")}${row("Invoice", d["invoice"] ?? "")}`,
    subscription_confirmed: `<p style="font-size:14px">Your subscription <b>${d["number"] ?? ""}</b> is confirmed.</p>${row("Plan", d["plan"] ?? "")}${row("Start date", d["start"] ?? "")}`,
  };
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-size:18px;font-weight:700;margin-bottom:16px">Brightloop Software</div>
    ${rows[template] ?? `<p style="font-size:14px">${d["message"] ?? ""}</p>`}
    <p style="margin-top:24px;font-size:12px;color:#999">This is an automated message from Brightloop Subscription OS.</p>
  </div></body></html>`;
}

type SendInput = { to: string; template: string; subject?: string; idempotencyKey: string; data?: Record<string, string> };

export const sendAppEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SendInput) => d)
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only staff can trigger app emails");
    return sendEmailCore(data);
  });

export async function sendEmailCore(data: SendInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const subject = data.subject ?? SUBJECTS[data.template] ?? "Brightloop notification";

  // Idempotency: an existing log with this key means we already attempted it.
  const existing = await supabaseAdmin.from("email_logs").select("id, status").eq("idempotency_key", data.idempotencyKey).maybeSingle();
  if (existing.data) return { sent: existing.data.status === "sent", reason: "duplicate", logId: existing.data.id };

  const html = renderEmail(data.template, data.data ?? {});
  const log = await supabaseAdmin
    .from("email_logs")
    .insert({ recipient: data.to, template: data.template, subject, status: "pending", idempotency_key: data.idempotencyKey, meta: { data: data.data ?? {}, html } })
    .select("id")
    .single();
  const logId = log.data?.id as string | undefined;

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    if (logId) await supabaseAdmin.from("email_logs").update({ status: "not_configured", error: "RESEND_API_KEY is not configured" }).eq("id", logId);
    return { sent: false, reason: "not_configured", logId };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env["RESEND_FROM"] || "Brightloop <onboarding@resend.dev>",
        to: [data.to],
        subject,
        html,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      if (logId) await supabaseAdmin.from("email_logs").update({ status: "failed", error: `Resend ${res.status}: ${body.message ?? res.statusText}` }).eq("id", logId);
      return { sent: false, reason: "provider_error", logId };
    }
    if (logId) await supabaseAdmin.from("email_logs").update({ status: "sent", provider_id: body.id ?? null, sent_at: new Date().toISOString() }).eq("id", logId);
    return { sent: true, logId };
  } catch (e) {
    if (logId) await supabaseAdmin.from("email_logs").update({ status: "failed", error: e instanceof Error ? e.message : "Network error" }).eq("id", logId);
    return { sent: false, reason: "network_error", logId };
  }
}

export const retryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { logId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can retry emails");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log } = await supabaseAdmin.from("email_logs").select("*").eq("id", data.logId).single();
    if (!log) throw new Error("Email log entry not found");
    if (log.status === "sent") return { sent: true, reason: "already_sent" };
    // New attempt under a fresh idempotency key derived from the original.
    return sendEmailCore({
      to: log.recipient,
      template: log.template,
      subject: log.subject,
      idempotencyKey: `${log.idempotency_key}-retry-${Date.now()}`,
      data: (log.meta as { data?: Record<string, string> })?.data ?? {},
    });
  });

export const emailConfigStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env["RESEND_API_KEY"]),
  from: process.env["RESEND_FROM"] || null,
}));
