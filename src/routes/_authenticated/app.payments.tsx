import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, useMode } from "@/lib/mode";
import { date, humanize, money } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/payments")({ component: Payments });

function Payments() {
  const { isAdmin } = useAuth();
  const { mode, isDemo } = useMode();
  const [rev, setRev] = useState<{ id: string; number: string } | null>(null);
  const [reason, setReason] = useState("");
  const allocEmbed = isDemo
    ? "payment_allocations:demo_payment_allocations(invoice_id, invoices:demo_invoices(invoice_number))"
    : "payment_allocations(invoice_id, invoices(invoice_number))";
  const list = useData<any[]>(["payments", mode], () => mfrom(mode, "payments").select(`*, ${isDemo ? "customers:demo_customers(name)" : "customers(name)"}, ${allocEmbed}`).order("created_at", { ascending: false }));
  const reverse = useAction(() => supabase.rpc("reverse_payment", { _pay: rev!.id, _reason: reason }), {
    success: "Payment reversed", invalidate: [["payments"], ["invoices"]], onDone: () => { setRev(null); setReason(""); },
  });
  return (
    <>
      <PageHeader title="Payments" description={isDemo ? "Demo Mode — sample payments are read-only here." : "Recorded payments are accounting entries; Razorpay collections appear here after verification."} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No payments yet" hint="Record payments from an invoice page." /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Payment</th><th className={th}>Customer</th><th className={th}>Invoice</th><th className={th}>Date</th><th className={th}>Method</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">{list.data.map((p) => (
              <tr key={p.id}>
                <td className={td}><div className="font-medium">{p.payment_number}</div>{p.reference && <div className="text-xs text-muted-foreground">Ref {p.reference}</div>}</td>
                <td className={td}>{p.customers?.name}</td>
                <td className={td}>{p.payment_allocations.map((a: any) => <Link key={a.invoice_id} to="/app/invoices/$id" params={{ id: a.invoice_id }} className="text-primary">{a.invoices?.invoice_number}</Link>)}</td>
                <td className={td}>{date(p.payment_date)}</td>
                <td className={`${td} capitalize`}>{humanize(p.method)}</td>
                <td className={td}><StatusBadge status={p.status} />{p.reversal_reason && <div className="text-xs text-muted-foreground">{p.reversal_reason}</div>}</td>
                <td className={`${td} num text-right`}>{money(p.amount)}</td>
                <td className={`${td} text-right`}>{isAdmin && !isDemo && p.status === "recorded" && <Button size="sm" variant="ghost" onClick={() => setRev({ id: p.id, number: p.payment_number })}>Reverse</Button>}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
      <Dialog open={!!rev} onOpenChange={(o) => !o && setRev(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reverse {rev?.number}?</DialogTitle><DialogDescription>The invoice balance is recalculated. The reversal is permanently logged.</DialogDescription></DialogHeader>
          <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <DialogFooter><Button variant="destructive" disabled={!reason.trim() || reverse.isPending} onClick={() => reverse.mutate(undefined)}>Reverse payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
