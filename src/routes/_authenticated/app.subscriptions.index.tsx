import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { date, money, today } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { LineEditor, linesPayload, type Line } from "@/components/app/LineEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/subscriptions/")({ component: Subs });

const statuses = ["all", "draft", "quotation", "confirmed", "active", "paused", "closed", "cancelled", "expired"];

function Subs() {
  const { isStaff } = useAuth();
  const { mode, isDemo } = useMode();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useData<any[]>(["subscriptions", mode, status], () => {
    let r = mfrom(mode, "subscriptions").select(`id, subscription_number, status, total, start_date, next_billing_date, billing_frequency, ${rel(mode, "customers", "name")}, ${rel(mode, "plans", "name")}`).order("created_at", { ascending: false });
    if (status !== "all") r = r.eq("status", status as never);
    return r;
  });
  const rows = (list.data ?? []).filter((s) => !q || `${s.subscription_number} ${s.customers?.name} ${s.plans?.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Subscriptions" description={isDemo ? "Demo Mode — sample subscriptions are read-only here." : "Lifecycle: Draft → Quotation → Confirmed → Active → Closed."} actions={isStaff && !isDemo && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New subscription</Button>} />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
        </div>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !rows.length ? <Empty title="No subscriptions" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Number</th><th className={th}>Customer</th><th className={th}>Plan</th><th className={th}>Start</th><th className={th}>Next billing</th><th className={th}>Status</th><th className={`${th} text-right`}>Per cycle</th></tr></thead>
            <tbody className="divide-y">{rows.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className={td}><Link to="/app/subscriptions/$id" params={{ id: s.id }} className="font-medium text-primary">{s.subscription_number}</Link></td>
                <td className={td}>{s.customers?.name}</td>
                <td className={td}>{s.plans?.name} <span className="text-xs capitalize text-muted-foreground">· {s.billing_frequency}</span></td>
                <td className={td}>{date(s.start_date)}</td>
                <td className={td}>{date(s.next_billing_date)}</td>
                <td className={td}><StatusBadge status={s.status} /></td>
                <td className={`${td} num text-right`}>{money(s.total)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
      {isStaff && !isDemo && <NewSub open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewSub({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("");
  const [start, setStart] = useState(today());
  const [expiry, setExpiry] = useState("");
  const [terms, setTerms] = useState(15);
  const [lines, setLines] = useState<Line[]>([]);
  const customers = useData<any[]>(["cust-opts"], () => supabase.from("customers").select("id, name, customer_number").eq("status", "active").order("name"));
  const plans = useData<any[]>(["plan-opts"], () => supabase.from("plans").select("id, name, billing_frequency, plan_product_lines(product_id, variant_id, quantity, unit_price)").eq("status", "active").order("name"));
  const create = useAction(
    () => supabase.rpc("create_subscription", { _customer: customer, _plan: plan, _start: start, _expiry: (expiry || null) as never, _payment_terms: terms, _lines: linesPayload(lines) as never }),
    { success: "Draft subscription created", invalidate: [["subscriptions"]], onDone: (id) => { onClose(); if (id) nav({ to: "/app/subscriptions/$id", params: { id: id as string } }); } },
  );
  function pickPlan(id: string) {
    setPlan(id);
    const p = plans.data?.find((x) => x.id === id);
    if (p) setLines(p.plan_product_lines.map((l: any) => ({ product_id: l.product_id, variant_id: l.variant_id ?? "", quantity: l.quantity, unit_price: String(l.unit_price) })));
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>New subscription</DialogTitle></DialogHeader>
        <form id="newsub" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer"><Select value={customer} onValueChange={setCustomer}><SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{customers.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.customer_number})</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Plan"><Select value={plan} onValueChange={pickPlan}><SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
              <SelectContent>{plans.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.billing_frequency}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start date"><Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Expiry date"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
            <Field label="Payment terms (days)"><Input type="number" min={0} max={365} value={terms} onChange={(e) => setTerms(parseInt(e.target.value) || 0)} /></Field>
          </div>
          <div className="text-sm font-medium">Product lines</div>
          <LineEditor lines={lines} onChange={setLines} />
        </form>
        <DialogFooter><Button form="newsub" disabled={create.isPending || !customer || !plan}>{create.isPending ? "Creating…" : "Create draft"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
