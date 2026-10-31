import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook — public route, caller verified via X-Razorpay-Signature
 * against RAZORPAY_WEBHOOK_SECRET. Reconciles payment_transactions with
 * gateway outcomes; never trusts client-reported state. Duplicate deliveries
 * are ignored via last_event_id.
 */

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "webhook not configured" }, { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const expected = await hmacHex(secret, raw);
        if (signature !== expected) return Response.json({ error: "invalid signature" }, { status: 401 });

        const event = JSON.parse(raw) as {
          event: string;
          payload: { payment?: { entity: { id: string; order_id: string; status: string } } };
        };
        const payment = event.payload.payment?.entity;
        if (!payment) return Response.json({ ok: true, ignored: true });
        const eventId = request.headers.get("x-razorpay-event-id") ?? `${event.event}:${payment.id}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tx } = await supabaseAdmin.from("payment_transactions").select("*").eq("order_id", payment.order_id).maybeSingle();
        if (!tx) return Response.json({ ok: true, ignored: "unknown order" });
        if (tx.last_event_id === eventId) return Response.json({ ok: true, ignored: "duplicate delivery" });

        if (event.event === "payment.failed" && tx.status === "created") {
          await supabaseAdmin.from("payment_transactions").update({ status: "failed", payment_id: payment.id, last_event_id: eventId, raw: event as never }).eq("id", tx.id);
        }
        // payment.captured without a paid transaction means Checkout's
        // handler never ran; flag for manual reconciliation rather than
        // auto-recording, keeping a human in the loop for edge cases.
        if (event.event === "payment.captured" && tx.status === "created") {
          await supabaseAdmin.from("payment_transactions").update({ status: "failed", payment_id: payment.id, last_event_id: eventId, raw: { note: "Captured at gateway but not verified in app — needs manual reconciliation", event } as never }).eq("id", tx.id);
        }
        if (event.event === "refund.processed" && tx.status === "paid") {
          await supabaseAdmin.from("payment_transactions").update({ status: "refunded", last_event_id: eventId, raw: event as never }).eq("id", tx.id);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
