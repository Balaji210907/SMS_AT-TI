import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAction, useData } from "@/lib/data";
import { date, humanize, money } from "@/lib/format";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { Empty, ErrorBox, Loading, PageHeader, Panel, Stat, StatusBadge, td, th } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffDashboard /> : <CustomerDashboard />;
}

type Metrics = {
  customers: number; products: number; active_plans: number; active_subs: number; paused_subs: number; cancelled_subs: number;
  open_quotations: number; upcoming_renewals: number; mrr: number; arr: number; invoiced: number; collected: number; outstanding: number;
  overdue_count: number; pending_invoices: number; status_distribution: Record<string, number>;
  revenue_trend: { month: string; invoiced: number; collected: number; new_subs: number }[];
  product_performance: { name: string; revenue: number }[];
};

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

function StaffDashboard() {
  const { isAdmin } = useAuth();
  const { mode, isDemo } = useMode();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const m = useData<Metrics>(["metrics", mode, from, to], () =>
    supabase.rpc(isDemo ? "demo_dashboard_metrics" : "dashboard_metrics", { ...(from ? { _from: from } : {}), ...(to ? { _to: to } : {}) }) as never,
  );
  const recentPayments = useData<any[]>(["recent-payments", mode], () =>
    mfrom(mode, "payments").select(`id, payment_number, amount, method, payment_date, status, ${rel(mode, "customers", "name")}`).order("created_at", { ascending: false }).limit(6),
  );
  const recentSubs = useData<any[]>(["recent-subs", mode], () =>
    mfrom(mode, "subscriptions").select(`id, subscription_number, status, total, next_billing_date, ${rel(mode, "customers", "name")}, ${rel(mode, "plans", "name")}`).order("created_at", { ascending: false }).limit(6),
  );

  if (m.isLoading) return <Loading />;
  if (m.error) return <ErrorBox error={m.error} />;
  const d = m.data!;
  const dist = Object.entries(d.status_distribution).map(([name, value]) => ({ name: humanize(name), value }));

  return (
    <>
      <PageHeader
        title={isAdmin ? "Business overview" : "Operations"}
        description={isDemo ? "Demo Mode — all figures come from sample data only." : "All figures come directly from recorded data."}
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
          </div>
        }
      />
      {isDemo && isAdmin && <DemoDataPanel />}
      {!isDemo && d.active_subs === 0 && d.invoiced === 0 && (
        <Panel className="mb-6 border-dashed">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-sm font-medium">No real business data yet</div>
              <div className="text-sm text-muted-foreground">Import your customers, products and subscriptions, or switch to Demo Mode to explore with sample data.</div>
            </div>
            <Button variant="outline" asChild><Link to="/app/import"><Upload className="mr-1 h-4 w-4" />Import data</Link></Button>
          </div>
        </Panel>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={money(d.mrr)} hint="Normalized monthly value of active subscriptions" />
        <Stat label="ARR" value={money(d.arr)} hint="MRR × 12" />
        <Stat label="Invoiced" value={money(d.invoiced)} hint="Issued invoices, excl. draft & cancelled" />
        <Stat label="Collected" value={money(d.collected)} tone="success" hint="Recorded payments (not reversed)" />
        <Stat label="Outstanding" value={money(d.outstanding)} hint="Unpaid balance on open invoices" />
        <Stat label="Overdue invoices" value={d.overdue_count} tone={d.overdue_count ? "danger" : "default"} />
        <Stat label="Active subscriptions" value={d.active_subs} hint={`${d.paused_subs} paused · ${d.cancelled_subs} cancelled`} />
        <Stat label="Renewals in 7 days" value={d.upcoming_renewals} hint={`${d.customers} customers · ${d.open_quotations} open quotes`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue — last 12 months" className="lg:col-span-2">
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <AreaChart data={d.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="invoiced" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} name="Invoiced" />
                <Area type="monotone" dataKey="collected" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.12} name="Collected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Subscription status">
          {dist.length === 0 ? <Empty title="No subscriptions yet" /> : (
            <div className="h-64 p-4">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {dist.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="New subscriptions per month">
          <div className="h-56 p-4">
            <ResponsiveContainer>
              <BarChart data={d.revenue_trend}>
                <XAxis dataKey="month" fontSize={10} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Bar dataKey="new_subs" fill="var(--chart-2)" name="New" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Top products by invoiced revenue" className="lg:col-span-2">
          {d.product_performance.length === 0 ? <Empty title="No invoiced products yet" /> : (
            <div className="h-56 p-4">
              <ResponsiveContainer>
                <BarChart data={d.product_performance} layout="vertical">
                  <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="revenue" fill="var(--chart-1)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent subscriptions" actions={<Link to="/app/subscriptions" className="text-xs text-primary">View all</Link>}>
          {!recentSubs.data?.length ? <Empty title="No subscriptions yet" /> : (
            <table className="w-full"><tbody className="divide-y">
              {recentSubs.data.map((s) => (
                <tr key={s.id}>
                  <td className={td}><Link to="/app/subscriptions/$id" params={{ id: s.id }} className="font-medium hover:text-primary">{s.subscription_number}</Link><div className="text-xs text-muted-foreground">{s.customers?.name} · {s.plans?.name}</div></td>
                  <td className={td}><StatusBadge status={s.status} /></td>
                  <td className={`${td} num text-right`}>{money(s.total)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
        <Panel title="Recent payments" actions={<Link to="/app/payments" className="text-xs text-primary">View all</Link>}>
          {!recentPayments.data?.length ? <Empty title="No payments recorded yet" /> : (
            <table className="w-full"><tbody className="divide-y">
              {recentPayments.data.map((p) => (
                <tr key={p.id}>
                  <td className={td}><div className="font-medium">{p.payment_number}</div><div className="text-xs text-muted-foreground">{p.customers?.name} · {humanize(p.method)}</div></td>
                  <td className={td}>{date(p.payment_date)}</td>
                  <td className={`${td} num text-right`}>{money(p.amount)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
      </div>
    </>
  );
}

function DemoDataPanel() {
  const gen = useAction(() => supabase.rpc("generate_sample_data"), { success: "Sample data generated", invalidate: [[]] });
  const clear = useAction(() => supabase.rpc("clear_demo_data"), { success: "Demo data cleared", invalidate: [[]] });
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <Panel className="mb-6 border-amber-500/40 bg-amber-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <div className="text-sm font-medium">Demo data controls</div>
          <div className="text-sm text-muted-foreground">Sample data lives in separate demo tables and never touches real business records. Clearing is permanent.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => gen.mutate(undefined)} disabled={gen.isPending}><Sparkles className="mr-1 h-4 w-4" />{gen.isPending ? "Generating…" : "Generate sample data"}</Button>
          <Button variant="outline" onClick={() => setConfirmClear(true)} disabled={clear.isPending}><Trash2 className="mr-1 h-4 w-4" />Clear demo data</Button>
        </div>
      </div>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all demo data?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes every demo customer, product, subscription, invoice and payment. Real business data is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep demo data</AlertDialogCancel>
            <AlertDialogAction onClick={() => clear.mutate(undefined)}>Clear demo data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function CustomerDashboard() {
  const { user } = useAuth();
  const subs = useData<any[]>(["my-subs"], () =>
    supabase.from("subscriptions").select("id, subscription_number, status, total, next_billing_date, billing_frequency, plans(name)").order("created_at", { ascending: false }),
  );
  const invoices = useData<any[]>(["my-invoices"], () =>
    supabase.from("invoices").select("id, invoice_number, status, total, amount_paid, due_date").order("invoice_date", { ascending: false }).limit(8),
  );
  if (subs.isLoading || invoices.isLoading) return <Loading />;
  if (subs.error) return <ErrorBox error={subs.error} />;
  const active = (subs.data ?? []).filter((s) => s.status === "active");
  const outstanding = (invoices.data ?? []).filter((i) => !["paid", "cancelled"].includes(i.status)).reduce((a, i) => a + Number(i.total) - Number(i.amount_paid), 0);
  const next = active.map((s) => s.next_billing_date).filter(Boolean).sort()[0];

  return (
    <>
      <PageHeader title={`Welcome back${user?.user_metadata?.['full_name'] ? ", " + user.user_metadata['full_name'] : ""}`} description="Your subscriptions, invoices and payments at a glance." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={active.length} />
        <Stat label="Next billing date" value={date(next ?? null)} />
        <Stat label="Outstanding balance" value={money(outstanding)} tone={outstanding > 0 ? "danger" : "default"} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="My subscriptions">
          {!subs.data?.length ? <Empty title="No subscriptions yet" hint="Our team will set up your subscription after your quotation is accepted." /> : (
            <table className="w-full"><tbody className="divide-y">
              {subs.data.map((s) => (
                <tr key={s.id}>
                  <td className={td}><Link to="/app/subscriptions/$id" params={{ id: s.id }} className="font-medium hover:text-primary">{s.plans?.name}</Link><div className="text-xs text-muted-foreground">{s.subscription_number} · {s.billing_frequency}</div></td>
                  <td className={td}><StatusBadge status={s.status} /></td>
                  <td className={`${td} num text-right`}>{money(s.total)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
        <Panel title="Recent invoices">
          {!invoices.data?.length ? <Empty title="No invoices yet" /> : (
            <table className="w-full">
              <thead className="border-b"><tr><th className={th}>Invoice</th><th className={th}>Due</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th></tr></thead>
              <tbody className="divide-y">
                {invoices.data.map((i) => (
                  <tr key={i.id}>
                    <td className={td}><Link to="/app/invoices/$id" params={{ id: i.id }} className="font-medium hover:text-primary">{i.invoice_number}</Link></td>
                    <td className={td}>{date(i.due_date)}</td>
                    <td className={td}><StatusBadge status={i.status} /></td>
                    <td className={`${td} num text-right`}>{money(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
