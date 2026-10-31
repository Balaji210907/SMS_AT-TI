import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Razorpay payment flow.
 * 1. createRazorpayOrder: creates a Razorpay order + a pending payment_transactions row.
 * 2. Browser completes Checkout, then verifyRazorpayPayment verifies the HMAC
 *    signature server-side and records the payment via apply_verified_payment.
 * 3. The webhook (/api/public/razorpay/webhook) reconciles failures/refunds.
 * No payment is ever recorded without signature verification.
 */

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireKeys() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in project settings.");
  return { keyId, keySecret };
}

export const razorpayConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ configured: Boolean(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]), keyId: process.env["RAZORPAY_KEY_ID"] ?? null }));

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { keyId, keySecret } = await requireKeys();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load the invoice through the caller's client (RLS: staff or owning customer).
    const { data: inv, error } = await context.supabase.from("invoices").select("id, invoice_number, total, amount_paid, status, customer_id").eq("id", data.invoiceId).maybeSingle();
    if (error || !inv) throw new Error("Invoice not found or not accessible");
    if (!["confirmed", "partially_paid", "overdue"].includes(inv.status)) throw new Error(`Invoice ${inv.invoice_number} cannot be paid online in status ${inv.status}`);
    const outstanding = Number(inv.total) - Number(inv.amount_paid);
    if (outstanding <= 0) throw new Error("Invoice is already fully paid");

    // Reuse an open order for this invoice if one exists (idempotency).
    const { data: existing } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, order_id")
      .eq("invoice_id", inv.id)
      .eq("status", "created")
      .maybeSingle();
    if (existing?.order_id) return { orderId: existing.order_id, keyId, amount: Math.round(outstanding * 100), currency: "INR", invoiceNumber: inv.invoice_number };

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
      body: JSON.stringify({ amount: Math.round(outstanding * 100), currency: "INR", receipt: inv.invoice_number, notes: { invoice_id: inv.id } }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
    if (!res.ok || !body.id) throw new Error(`Razorpay order failed [${res.status}]: ${body.error?.description ?? res.statusText}`);

    await supabaseAdmin.from("payment_transactions").insert({
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      order_id: body.id,
      amount: outstanding,
      currency: "INR",
      status: "created",
    });
    return { orderId: body.id, keyId, amount: Math.round(outstanding * 100), currency: "INR", invoiceNumber: inv.invoice_number };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; paymentId: string; signature: string }) => d)
  .handler(async ({ data }) => {
    const { keySecret } = await requireKeys();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const expected = await hmacHex(keySecret, `${data.orderId}|${data.paymentId}`);
    if (expected !== data.signature) {
      await supabaseAdmin.from("payment_transactions").update({ status: "failed", signature_verified: false, payment_id: data.paymentId, raw: { reason: "signature_mismatch" } }).eq("order_id", data.orderId);
      throw new Error("Payment verification failed: signature mismatch. No payment was recorded.");
    }

    const { data: tx } = await supabaseAdmin.from("payment_transactions").select("*").eq("order_id", data.orderId).maybeSingle();
    if (!tx) throw new Error("Unknown payment order");
    if (tx.status === "paid") return { ok: true, paymentId: tx.payment_record_id, already: true };

    // Verified: record the accounting payment through the guarded function.
    const { data: paymentId, error } = await supabaseAdmin.rpc("apply_verified_payment", {
      _invoice: tx.invoice_id,
      _amount: tx.amount,
      _method: "card",
      _reference: `Razorpay ${data.paymentId}`,
      _notes: `Online payment via Razorpay order ${data.orderId}`,
    });
    if (error) {
      await supabaseAdmin.from("payment_transactions").update({ status: "failed", signature_verified: true, payment_id: data.paymentId, raw: { record_error: error.message } }).eq("id", tx.id);
      throw new Error(`Payment verified but recording failed: ${error.message}`);
    }
    await supabaseAdmin.from("payment_transactions").update({ status: "paid", signature_verified: true, payment_id: data.paymentId, payment_record_id: paymentId }).eq("id", tx.id);
    return { ok: true, paymentId };
  });
