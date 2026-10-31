import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, useMode } from "@/lib/mode";
import { date, dateTime, humanize, money } from "@/lib/format";
import { Empty, ErrorBox, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/subscriptions/$id")({ component: SubDetail });

const actionsFor: Record<string, string[]> = {
  draft: ["send_quotation", "confirm", "cancel"], quotation: ["confirm", "cancel"], confirmed: ["activate", "cancel"],
  active: ["pause", "renew", "close", "cancel"], paused: ["resume", "close", "cancel"], expired: ["renew"], closed: [], cancelled: [],
};
const labels: Record<string, string> = { send_quotation: "Mark as quotation", confirm: "Confirm", activate: "Activate", pause: "Pause", resume: "Resume", renew: "Renew", close: "Close", cancel: "Cancel" };
const destructive = ["cancel", "close"];

function SubDetail() {
  const { id } = Route.useParams();
  const { isStaff } = useAuth();
  const { mode, isDemo } = useMode();
  const [pending, setPending] = useState<string | null>(null);
  const sub = useData<any>(["subscription", mode, id], () =>
    supabase
      .from(mt(mode, "subscriptions"))
      .select(`*, ${isDemo ? "customers:demo_customers(name, email, customer_number), plans:demo_plans(*), subscription_lines:demo_subscription_lines(*)" : "customers(name, email, customer_number), plans(*), subscription_lines(*)"}`)
      .eq("id", id)
      .maybeSingle(),
  );
  const events = useData<any[]>(["sub-events", id], () => supabase.from("subscription_events").select("*").eq("subscription_id", id).order("created_at", { ascending: false }), );
  const invoices = useData<any[]>(["sub-invoices", mode, id], () => mfrom(mode, "invoices").select("id, invoice_number, period_start, period_end, total, status").eq("subscription_id", id).order("period_start", { ascending: false }));
  const act = useAction((a: string) => supabase.rpc("transition_subscription", { _sub: id, _action: a }), {
    success: "Subscription updated", invalidate: [["subscription", id], ["sub-events", id], ["subscriptions"]], onDone: () => setPending(null),
  });

  if (sub.isLoading) return <Loading />;
  if (sub.error) return <ErrorBox error={sub.error} />;
  const s = sub.data;
  if (!s) return <Empty title="Subscription not found" />;
  const p = s.plans!;
  let actions = isDemo ? [] : (actionsFor[s.status] ?? []);
  if (!isStaff) actions = actions.filter((a) => (a === "pause" && p.allow_pause) || a === "resume" || (a === "renew" && p.allow_renew && s.expiry_date));
  else actions = actions.filter((a) => !(a === "pause" && !p.allow_pause) && !(a === "renew" && (!p.allow_renew || !s.expiry_date)));

  return (
    <>
      <PageHeader
        title={s.subscription_number}
        description={`${s.customers?.name} · ${p.name}`}
        actions={actions.map((a) => (
          <Button key={a} variant={destructive.includes(a) ? "outline" : a === actions[0] ? "default" : "secondary"} onClick={() => setPending(a)}>{labels[a]}</Button>
        ))}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Details" className="lg:col-span-1">
          <dl className="grid grid-cols-2 gap-y-3 p-5 text-sm">
            <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={s.status} /></dd>
            <dt className="text-muted-foreground">Frequency</dt><dd className="capitalize">{s.billing_frequency}</dd>
            <dt className="text-muted-foreground">Start</dt><dd>{date(s.start_date)}</dd>
            <dt className="text-muted-foreground">Expiry</dt><dd>{date(s.expiry_date)}</dd>
            <dt className="text-muted-foreground">Next billing</dt><dd>{date(s.next_billing_date)}</dd>
            <dt className="text-muted-foreground">Cycles billed</dt><dd className="num">{s.cycles_billed}</dd>
            <dt className="text-muted-foreground">Payment terms</dt><dd>{s.payment_terms_days} days</dd>
            <dt className="text-muted-foreground">Per cycle (pre-tax)</dt><dd className="num font-semibold">{money(s.total)}</dd>
          </dl>
        </Panel>
        <Panel title="Product lines" className="lg:col-span-2">
          <table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Description</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Unit price</th><th className={`${th} text-right`}>Amount</th></tr></thead>
            <tbody className="divide-y">
              {Number(p.price) > 0 && <tr><td className={td}>Plan fee: {p.name}</td><td className={`${td} num text-right`}>1</td><td className={`${td} num text-right`}>{money(p.price)}</td><td className={`${td} num text-right`}>{money(p.price)}</td></tr>}
              {s.subscription_lines.map((l: any) => (
                <tr key={l.id}><td className={td}>{l.description}</td><td className={`${td} num text-right`}>{l.quantity}</td><td className={`${td} num text-right`}>{money(l.unit_price)}</td><td className={`${td} num text-right`}>{money(Number(l.unit_price) * l.quantity)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">Taxes and eligible discounts are applied when each invoice is generated.</p>
        </Panel>
        <Panel title="Invoices" className="lg:col-span-2">
          {!invoices.data?.length ? <Empty title="No invoices yet" hint="Invoices are created by billing runs once the subscription is active and due." /> : (
            <table className="w-full"><tbody className="divide-y">
              {invoices.data.map((i) => (
                <tr key={i.id}>
                  <td className={td}><Link to="/app/invoices/$id" params={{ id: i.id }} className="font-medium text-primary">{i.invoice_number}</Link></td>
                  <td className={td}>{date(i.period_start)} – {date(i.period_end)}</td>
                  <td className={td}><StatusBadge status={i.status} /></td>
                  <td className={`${td} num text-right`}>{money(i.total)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
        {!isDemo && (
          <Panel title="History">
            <ol className="space-y-3 p-5">
              {events.data?.map((e) => (
                <li key={e.id} className="text-sm">
                  <div className="font-medium capitalize">{humanize(e.event_type)}{e.to_status && <span className="font-normal text-muted-foreground"> → {humanize(e.to_status)}</span>}</div>
                  <div className="text-xs text-muted-foreground">{dateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</div>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending && labels[pending]} subscription?</AlertDialogTitle>
            <AlertDialogDescription>{pending && destructive.includes(pending) ? "This cannot be undone. Billing will stop for this subscription." : "The status change is recorded in the subscription history."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction disabled={act.isPending} onClick={(e) => { e.preventDefault(); if (pending) act.mutate(pending); }}>{act.isPending ? "Working…" : "Confirm"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
