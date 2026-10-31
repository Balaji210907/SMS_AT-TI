import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { date, money, today } from "@/lib/format";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { sendAppEmail } from "@/lib/email.functions";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { LineEditor, linesPayload, type Line } from "@/components/app/LineEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/quotations")({
  component: Quotations,
  validateSearch: (s: Record<string, unknown>) => ({ template: typeof s["template"] === "string" ? s["template"] : undefined }),
});

const plus = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

function Quotations() {
  const nav = useNavigate();
  const { mode, isDemo } = useMode();
  const { template } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [convert, setConvert] = useState<{ id: string; number: string } | null>(null);
  const [start, setStart] = useState(today());
  const [expiry, setExpiry] = useState("");
  const sendEmail = useServerFn(sendAppEmail);
  const list = useData<any[]>(["quotations", mode], () =>
    mfrom(mode, "quotations").select(`*, ${rel(mode, "customers", "name, email")}, ${rel(mode, "plans", "name")}`).order("created_at", { ascending: false }),
  );
  const setStatus = useAction(
    async (v: { id: string; status: "sent" | "accepted" | "rejected" | "expired"; email?: string | null; number?: string }) => {
      const res = await supabase.rpc("set_quotation_status", { _q: v.id, _status: v.status });
      if (!res.error && v.status === "sent" && v.email) {
        // Fire-and-log: delivery outcome is tracked in the Email log, never faked here.
        await sendEmail({
          data: {
            to: v.email,
            template: "quotation_sent",
            subject: `Quotation ${v.number} from Brightloop`,
            idempotencyKey: `quotation-sent-${v.id}`,
            data: { number: v.number ?? "" },
          },
        });
      }
      return res;
    },
    { success: "Quotation updated", invalidate: [["quotations"]] },
  );
  const conv = useAction(() => supabase.rpc("convert_quotation", { _q: convert!.id, _start: start, _expiry: (expiry || null) as never, _payment_terms: 15 }), {
    success: "Subscription created from quotation", invalidate: [["quotations"], ["subscriptions"]],
    onDone: (id) => { setConvert(null); if (id) nav({ to: "/app/subscriptions/$id", params: { id: id as string } }); },
  });

  useEffect(() => {
    if (template && !isDemo) setOpen(true);
  }, [template, isDemo]);

  return (
    <>
      <PageHeader
        title="Quotations"
        description={isDemo ? "Demo Mode — sample quotations are read-only here." : "Draft → Sent → Accepted → Converted into a subscription."}
        actions={!isDemo && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New quotation</Button>}
      />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No quotations yet" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Quotation</th><th className={th}>Customer</th><th className={th}>Plan</th><th className={th}>Valid until</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">{list.data.map((q) => (
              <tr key={q.id}>
                <td className={`${td} font-medium`}>{q.quotation_number}</td>
                <td className={td}>{q.customers?.name}</td>
                <td className={td}>{q.plans?.name}</td>
                <td className={td}>{date(q.valid_until)}</td>
                <td className={td}><StatusBadge status={q.status} /></td>
                <td className={`${td} num text-right`}>{money(q.total)}<div className="text-xs text-muted-foreground">incl. {money(q.tax_amount)} tax</div></td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {!isDemo && q.status === "draft" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: q.id, status: "sent", email: q.customers?.email, number: q.quotation_number })}>Mark sent</Button>}
                  {!isDemo && ["draft", "sent"].includes(q.status) && <>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: q.id, status: "accepted" })}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: q.id, status: "rejected" })}>Reject</Button>
                  </>}
                  {!isDemo && q.status === "accepted" && <Button size="sm" onClick={() => setConvert({ id: q.id, number: q.quotation_number })}>Convert</Button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
      {open && !isDemo && <NewQuote templateId={template} onClose={() => setOpen(false)} />}
      <Dialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert {convert?.number}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Expiry date"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
          </div>
          <DialogFooter><Button disabled={conv.isPending} onClick={() => conv.mutate(undefined)}>{conv.isPending ? "Converting…" : "Create subscription"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewQuote({ templateId, onClose }: { templateId?: string | undefined; onClose: () => void }) {
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("");
  const [valid, setValid] = useState(plus(30));
  const [lines, setLines] = useState<Line[]>([]);
  const customers = useData<any[]>(["cust-opts"], () => supabase.from("customers").select("id, name, customer_number").eq("status", "active").order("name"));
  const plans = useData<any[]>(["plan-opts"], () => supabase.from("plans").select("id, name, billing_frequency, plan_product_lines(product_id, variant_id, quantity, unit_price)").eq("status", "active").order("name"));
  const tpl = useData<any>(["template", templateId], () =>
    templateId
      ? supabase.from("quotation_templates").select("*, plans(id, plan_product_lines(product_id, variant_id, quantity, unit_price))").eq("id", templateId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  );
  const create = useAction(() => supabase.rpc("create_quotation", { _customer: customer, _plan: plan, _template: (templateId ?? null) as never, _valid_until: valid, _lines: linesPayload(lines) as never }), {
    success: "Quotation created", invalidate: [["quotations"]], onDone: onClose,
  });
  function pickPlan(id: string) {
    setPlan(id);
    const p = plans.data?.find((x) => x.id === id);
    if (p) setLines(p.plan_product_lines.map((l: any) => ({ product_id: l.product_id, variant_id: l.variant_id ?? "", quantity: l.quantity, unit_price: String(l.unit_price) })));
  }
  useEffect(() => {
    const t = tpl.data;
    if (t?.plans) {
      setPlan(t.plan_id);
      setValid(plus(t.validity_days));
      setLines(t.plans.plan_product_lines.map((l: any) => ({ product_id: l.product_id, variant_id: l.variant_id ?? "", quantity: l.quantity, unit_price: String(l.unit_price) })));
    }
  }, [tpl.data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{templateId ? `New quotation from template${tpl.data?.name ? `: ${tpl.data.name}` : ""}` : "New quotation"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Customer"><Select value={customer} onValueChange={setCustomer}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{customers.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Plan"><Select value={plan} onValueChange={pickPlan}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{plans.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Valid until"><Input type="date" value={valid} onChange={(e) => setValid(e.target.value)} /></Field>
          </div>
          <LineEditor lines={lines} onChange={setLines} />
        </div>
        <DialogFooter><Button disabled={!customer || !plan || create.isPending} onClick={() => create.mutate(undefined)}>{create.isPending ? "Saving…" : "Create quotation"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
