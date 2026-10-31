import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { createRazorpayOrder, razorpayConfigStatus, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

let checkoutLoading: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  checkoutLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(s);
  });
  return checkoutLoading;
}

/** Online payment via Razorpay. Hidden entirely when keys are not configured. */
export function RazorpayPayButton({ invoiceId, invoiceNumber, outstanding, customerEmail, customerName }: {
  invoiceId: string; invoiceNumber: string; outstanding: number; customerEmail: string; customerName: string;
}) {
  const qc = useQueryClient();
  const config = useServerFn(razorpayConfigStatus);
  const createOrder = useServerFn(createRazorpayOrder);
  const verify = useServerFn(verifyRazorpayPayment);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      const cfg = await config();
      if (!cfg.configured) {
        toast.info("Online payments are not configured yet. Ask an admin to add Razorpay keys.");
        return;
      }
      const order = await createOrder({ data: { invoiceId } });
      await loadCheckout();
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable");
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Brightloop Software",
        description: `Invoice ${invoiceNumber}`,
        order_id: order.orderId,
        prefill: { email: customerEmail, name: customerName },
        theme: { color: "#0f766e" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verify({ data: { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature } });
            toast.success("Payment verified and recorded");
            qc.invalidateQueries();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Payment verification failed");
          }
        },
        modal: { ondismiss: () => toast.info("Payment cancelled — nothing was charged or recorded") },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={pay} disabled={busy}>
      <CreditCard className="mr-1 h-4 w-4" />{busy ? "Starting…" : `Pay online ${money(outstanding)}`}
    </Button>
  );
}
