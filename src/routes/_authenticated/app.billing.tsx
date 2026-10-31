import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { date, dateTime } from "@/lib/format";
import { useMode } from "@/lib/mode";
import { Empty, ErrorBox, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/billing")({ component: Billing });

function Billing() {
  const { isDemo } = useMode();
  const [sel, setSel] = useState<string | null>(null);

  if (isDemo) {
    return (
      <>
        <PageHeader title="Recurring billing" description="Billing runs operate on real business data only." />
        <Panel><Empty title="Not available in Demo Mode" hint="Demo subscriptions never generate invoices. Switch to Real Business Mode to run billing." /></Panel>
      </>
    );
  }
  const due = useData(["due-subs"], () => supabase.from("subscriptions").select("id, subscription_number, next_billing_date, customers(name)").eq("status", "active").lte("next_billing_date", new Date().toISOString().slice(0, 10)).order("next_billing_date"));
  const runs = useData(["billing-runs"], () => supabase.from("billing_runs").select("*").order("started_at", { ascending: false }).limit(30));
  const items = useData(["run-items", sel], () => supabase.from("billing_run_items").select("*, subscriptions(subscription_number), invoices(invoice_number)").eq("billing_run_id", sel ?? "").order("created_at"));
  const run = useAction(() => supabase.rpc("run_billing", { _run_type: "manual" }), {
    success: "Billing run finished", invalidate: [["billing-runs"], ["due-subs"], ["invoices"], ["subscriptions"]], onDone: (id) => setSel(id as string),
  });
  return (
    <>
      <PageHeader
        title="Recurring billing"
        description="A scheduled run executes every day at 00:30 UTC. Runs are safe to repeat — a period is never invoiced twice."
        actions={<Button onClick={() => run.mutate(undefined)} disabled={run.isPending}><Play className="mr-1 h-4 w-4" />{run.isPending ? "Running…" : "Run billing now"}</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Due now (${due.data?.length ?? 0})`}>
          {due.isLoading ? <Loading /> : !due.data?.length ? <Empty title="Nothing due" /> : (
            <ul className="divide-y">{due.data.map((s) => (
              <li key={s.id} className="flex justify-between px-5 py-2.5 text-sm"><Link to="/app/subscriptions/$id" params={{ id: s.id }} className="text-primary">{s.subscription_number}</Link><span className="text-muted-foreground">{s.customers?.name} · {date(s.next_billing_date)}</span></li>
            ))}</ul>
          )}
        </Panel>
        <Panel title="Run history" className="lg:col-span-2">
          {runs.isLoading ? <Loading /> : runs.error ? <ErrorBox error={runs.error} /> : !runs.data?.length ? <Empty title="No billing runs yet" /> : (
            <table className="w-full">
              <thead className="border-b bg-muted/40"><tr><th className={th}>Started</th><th className={th}>Type</th><th className={th}>Status</th><th className={`${th} text-right`}>Invoiced</th><th className={`${th} text-right`}>Failed</th></tr></thead>
              <tbody className="divide-y">{runs.data.map((r) => (
                <tr key={r.id} onClick={() => setSel(r.id)} className={`cursor-pointer hover:bg-muted/30 ${sel === r.id ? "bg-accent/50" : ""}`}>
                  <td className={td}>{dateTime(r.started_at)}</td>
                  <td className={`${td} capitalize`}>{r.run_type}</td>
                  <td className={td}><StatusBadge status={r.status} /></td>
                  <td className={`${td} num text-right`}>{r.succeeded}</td>
                  <td className={`${td} num text-right`}>{r.failed}</td>
                </tr>))}</tbody>
            </table>
          )}
        </Panel>
      </div>
      {sel && (
        <Panel title="Run details" className="mt-4">
          {items.isLoading ? <Loading /> : !items.data?.length ? <Empty title="No subscriptions were due in this run" /> : (
            <table className="w-full"><tbody className="divide-y">{items.data.map((i) => (
              <tr key={i.id}>
                <td className={td}>{i.subscriptions?.subscription_number}</td>
                <td className={td}><StatusBadge status={i.status} /></td>
                <td className={td}>{i.invoice_id ? <Link to="/app/invoices/$id" params={{ id: i.invoice_id }} className="text-primary">{i.invoices?.invoice_number}</Link> : <span className="text-sm text-destructive">{i.message}</span>}</td>
              </tr>))}</tbody></table>
          )}
        </Panel>
      )}
    </>
  );
}
