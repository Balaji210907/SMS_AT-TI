import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, useMode } from "@/lib/mode";
import { useServerFn } from "@tanstack/react-start";
import { sendAppEmail } from "@/lib/email.functions";
import { RazorpayPayButton } from "@/components/app/RazorpayPayButton";
import type { Tables } from "@/integrations/supabase/types";
type Inv = Tables<"invoices"> & { invoice_lines: Tables<"invoice_lines">[]; subscriptions: { id: string; subscription_number: string } | null };
import { date, humanize, money, today } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/invoices/$id")({ component: InvoiceDetail });

type Snap = { name?: string; email?: string; company?: string; address?: string; tax_id?: string; customer_number?: string };
const methods = ["upi", "cash", "bank_transfer", "card", "other"] as const;

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { isStaff } = useAuth();
  const { mode, isDemo } = useMode();
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const inv = useData<Inv | null>(["invoice", mode, id], () =>
    supabase
      .from(mt(mode, "invoices"))
      .select(`*, ${isDemo ? "invoice_lines:demo_invoice_lines(*), subscriptions:demo_subscriptions!demo_invoices_subscription_id_fkey(id, subscription_number)" : "invoice_lines(*), subscriptions!invoices_subscription_id_fkey(id, subscription_number)"}`)
      .eq("id", id)
      .maybeSingle() as never,
  );
  const pays = useData<any[]>(["invoice-payments", mode, id], () =>
    mfrom(mode, "payment_allocations")
      .select(`amount, ${isDemo ? "payments:demo_payments(id, payment_number, method, payment_date, reference, status)" : "payments(id, payment_number, method, payment_date, reference, status)"}`)
      .eq("invoice_id", id),
  );
  const sendEmail = useServerFn(sendAppEmail);
  const confirm = useAction(
    async () => {
      const res = await supabase.rpc("confirm_invoice", { _inv: id });
      if (!res.error && c?.email) {
        await sendEmail({ data: { to: c.email, template: "invoice_confirmed", idempotencyKey: `invoice-confirmed-${id}`, data: { number: i?.invoice_number ?? "", total: money(Number(i?.total ?? 0)), dueDate: date(i?.due_date ?? "") } } });
      }
      return res;
    },
    { success: "Invoice confirmed", invalidate: [["invoice", id], ["invoices"]] },
  );
  const cancel = useAction(() => supabase.rpc("cancel_invoice", { _inv: id, _reason: reason }), { success: "Invoice cancelled", invalidate: [["invoice", id], ["invoices"]], onDone: () => setCancelOpen(false) });

  if (inv.isLoading) return <Loading />;
  if (inv.error) return <ErrorBox error={inv.error} />;
  const i = inv.data;
  if (!i) return <Empty title="Invoice not found" />;
  const c = i.customer_snapshot as Snap;
  const outstanding = Number(i.total) - Number(i.amount_paid);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/app/invoices" className="text-sm text-muted-foreground hover:text-foreground">← Invoices</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / Save PDF</Button>
          {!isDemo && ["confirmed", "partially_paid", "overdue"].includes(i.status) && outstanding > 0 && (
            <RazorpayPayButton invoiceId={id} invoiceNumber={i.invoice_number} outstanding={outstanding} customerEmail={c.email ?? ""} customerName={c.name ?? ""} />
          )}
          {isStaff && !isDemo && i.status === "draft" && <Button onClick={() => confirm.mutate(undefined)} disabled={confirm.isPending}>Confirm</Button>}
          {isStaff && !isDemo && ["confirmed", "partially_paid", "overdue"].includes(i.status) && <Button onClick={() => setPayOpen(true)}>Record payment</Button>}
          {isStaff && !isDemo && !["paid", "cancelled"].includes(i.status) && Number(i.amount_paid) === 0 && <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancel invoice</Button>}
        </div>
      </div>

      <Panel className="p-8 print:border-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold"><div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">B</div>Brightloop Software</div>
            <div className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">Bill to</div>
            <div className="mt-1 text-sm"><div className="font-medium">{c.name}</div>{c.company && <div>{c.company}</div>}<div>{c.email}</div>{c.address && <div className="whitespace-pre-line">{c.address}</div>}{c.tax_id && <div>Tax ID: {c.tax_id}</div>}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-2xl font-semibold">Invoice</div>
            <div className="num mt-1 text-muted-foreground">{i.invoice_number}</div>
            <div className="mt-3"><StatusBadge status={i.status} /></div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-left">
              <dt className="text-muted-foreground">Invoice date</dt><dd>{date(i.invoice_date)}</dd>
              <dt className="text-muted-foreground">Due date</dt><dd>{date(i.due_date)}</dd>
              {i.period_start && <><dt className="text-muted-foreground">Period</dt><dd>{date(i.period_start)} – {date(i.period_end)}</dd></>}
              {i.subscriptions && <><dt className="text-muted-foreground">Subscription</dt><dd>{i.subscriptions.subscription_number}</dd></>}
            </dl>
          </div>
        </div>
        <table className="mt-8 w-full">
          <thead className="border-y bg-muted/40"><tr><th className={th}>Description</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Unit</th><th className={`${th} text-right`}>Discount</th><th className={`${th} text-right`}>Tax</th><th className={`${th} text-right`}>Amount</th></tr></thead>
          <tbody className="divide-y">{i.invoice_lines.map((l) => (
            <tr key={l.id}>
              <td className={td}>{l.description}</td>
              <td className={`${td} num text-right`}>{l.quantity}</td>
              <td className={`${td} num text-right`}>{money(l.unit_price)}</td>
              <td className={`${td} num text-right`}>{Number(l.discount_amount) ? `−${money(l.discount_amount)}` : "—"}</td>
              <td className={`${td} num text-right`}>{money(l.tax_amount)} <span className="text-xs text-muted-foreground">({Number(l.tax_rate)}%)</span></td>
              <td className={`${td} num text-right`}>{money(l.line_total)}</td>
            </tr>))}</tbody>
        </table>
        <dl className="num ml-auto mt-6 grid max-w-xs grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right">{money(i.subtotal)}</dd>
          <dt className="text-muted-foreground">Discount</dt><dd className="text-right">−{money(i.discount_amount)}</dd>
          <dt className="text-muted-foreground">Tax</dt><dd className="text-right">{money(i.tax_amount)}</dd>
          <dt className="border-t pt-1.5 font-semibold">Total</dt><dd className="border-t pt-1.5 text-right font-semibold">{money(i.total)}</dd>
          <dt className="text-muted-foreground">Paid</dt><dd className="text-right">{money(i.amount_paid)}</dd>
          <dt className="font-semibold">Outstanding</dt><dd className="text-right font-semibold">{i.status === "cancelled" ? "—" : money(outstanding)}</dd>
        </dl>
      </Panel>

      <Panel title="Payment history" className="mt-4 print:hidden">
        {!pays.data?.length ? <Empty title="No payments recorded" /> : (
          <table className="w-full"><tbody className="divide-y">{pays.data.map((a, k) => (
            <tr key={k}>
              <td className={`${td} font-medium`}>{a.payments?.payment_number}</td>
              <td className={td}>{date(a.payments?.payment_date)}</td>
              <td className={`${td} capitalize`}>{humanize(a.payments?.method)}{a.payments?.reference ? ` · ${a.payments.reference}` : ""}</td>
              <td className={td}><StatusBadge status={a.payments?.status} /></td>
              <td className={`${td} num text-right`}>{money(a.amount)}</td>
            </tr>))}</tbody></table>
        )}
      </Panel>

      {payOpen && <PaymentDialog invoiceId={id} invoiceNumber={i.invoice_number} customerEmail={c.email ?? ""} outstanding={outstanding} onClose={() => setPayOpen(false)} />}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel {i.invoice_number}?</DialogTitle><DialogDescription>The invoice is kept for audit purposes but no longer counts as receivable.</DialogDescription></DialogHeader>
          <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <DialogFooter><Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate(undefined)}>Cancel invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentDialog({ invoiceId, invoiceNumber, customerEmail, outstanding, onClose }: { invoiceId: string; invoiceNumber: string; customerEmail: string; outstanding: number; onClose: () => void }) {
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [method, setMethod] = useState<(typeof methods)[number]>("bank_transfer");
  const [d, setD] = useState(today());
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const sendEmail = useServerFn(sendAppEmail);
  const rec = useAction(
    async () => {
      const res = await supabase.rpc("record_payment", { _inv: invoiceId, _amount: Number(amount), _method: method, _date: d, _reference: ref, _notes: notes });
      if (!res.error && res.data && customerEmail) {
        await sendEmail({ data: { to: customerEmail, template: "payment_received", idempotencyKey: `payment-received-${res.data}`, data: { number: String(res.data).slice(0, 8), total: money(Number(amount)), invoice: invoiceNumber } } });
      }
      return res;
    },
    { success: "Payment recorded", invalidate: [["invoice", invoiceId], ["invoice-payments", invoiceId], ["invoices"], ["payments"]], onDone: onClose },
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>This records money already received. It does not charge the customer.</DialogDescription></DialogHeader>
        <form id="pay" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); rec.mutate(undefined); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" hint={`Outstanding ${money(outstanding)}`}><Input type="number" step="0.01" min="0.01" max={outstanding} required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Method"><Select value={method} onValueChange={(v) => setMethod(v as typeof method)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{methods.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment date"><Input type="date" max={today()} required value={d} onChange={(e) => setD(e.target.value)} /></Field>
            <Field label="Transaction reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </form>
        <DialogFooter><Button form="pay" disabled={rec.isPending}>{rec.isPending ? "Recording…" : "Record payment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
