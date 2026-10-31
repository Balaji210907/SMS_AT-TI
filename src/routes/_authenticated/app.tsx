import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Boxes, CalendarSync, CreditCard, FileSpreadsheet, FileText, FlaskConical, LayoutDashboard, LogOut, Mail, Menu, Percent,
  Receipt, ScrollText, Tags, Upload, UserCog, Users, Layers, UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Role } from "@/lib/auth";
import { useMode, type AppMode } from "@/lib/mode";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { errMsg } from "@/lib/format";
import { useData } from "@/lib/data";
import { Loading } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — Brightloop Subscription OS" }] }),
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof Bell; roles: Role[] };
const nav: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "staff", "customer"] },
  ] },
  { group: "Sales", items: [
    { to: "/app/customers", label: "Customers", icon: Users, roles: ["admin", "staff"] },
    { to: "/app/quotations", label: "Quotations", icon: FileSpreadsheet, roles: ["admin", "staff"] },
    { to: "/app/templates", label: "Quote templates", icon: FileText, roles: ["admin", "staff"] },
    { to: "/app/subscriptions", label: "Subscriptions", icon: Layers, roles: ["admin", "staff", "customer"] },
  ] },
  { group: "Billing", items: [
    { to: "/app/invoices", label: "Invoices", icon: FileText, roles: ["admin", "staff", "customer"] },
    { to: "/app/payments", label: "Payments", icon: CreditCard, roles: ["admin", "staff", "customer"] },
    { to: "/app/billing", label: "Billing runs", icon: CalendarSync, roles: ["admin", "staff"] },
  ] },
  { group: "Catalog", items: [
    { to: "/app/products", label: "Products", icon: Boxes, roles: ["admin", "staff"] },
    { to: "/app/plans", label: "Plans", icon: Tags, roles: ["admin", "staff"] },
    { to: "/app/taxes", label: "Taxes", icon: Receipt, roles: ["admin"] },
    { to: "/app/discounts", label: "Discounts", icon: Percent, roles: ["admin"] },
  ] },
  { group: "Administration", items: [
    { to: "/app/import", label: "Import data", icon: Upload, roles: ["admin"] },
    { to: "/app/emails", label: "Email log", icon: Mail, roles: ["admin"] },
    { to: "/app/team", label: "Team & roles", icon: UserCog, roles: ["admin"] },
    { to: "/app/audit", label: "Audit log", icon: ScrollText, roles: ["admin"] },
  ] },
  { group: "Account", items: [
    { to: "/app/notifications", label: "Notifications", icon: Bell, roles: ["admin", "staff", "customer"] },
    { to: "/app/profile", label: "Profile", icon: UserCircle, roles: ["admin", "staff", "customer"] },
  ] },
];

function AppLayout() {
  const { user, role, loading, isAdmin, isStaff } = useAuth();
  const { mode, isDemo, switching, setMode } = useMode();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function switchMode(m: AppMode) {
    try {
      await setMode(m);
      toast.success(m === "demo" ? "Demo Mode active — sample data only" : "Real Business Mode active");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const unread = useData<number>(["unread", user?.id], async () => {
    const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    return { data: count ?? 0, error };
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !role) return <Loading />;

  const sidebar = (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 font-semibold text-sidebar-accent-foreground">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">B</div>
        <div className="leading-tight">Brightloop<div className="text-xs font-normal text-sidebar-foreground/70">Subscription OS</div></div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {nav.map((g) => {
          const items = g.items.filter((i) => i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">{g.group}</div>
              {items.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  activeOptions={{ exact: i.to === "/app" }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                >
                  <i.icon className="h-4 w-4" />
                  <span className="flex-1">{i.label}</span>
                  {i.to === "/app/notifications" && (unread.data ?? 0) > 0 && (
                    <span className="num rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">{unread.data}</span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-sidebar-border p-3">
        <div className="truncate px-2 text-xs text-sidebar-foreground/70">{user?.email}</div>
        <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-sidebar-primary">{role}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold">Brightloop</span>
        </header>
        {isStaff && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs font-medium",
              isDemo ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-success/10 text-success",
            )}
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <FlaskConical className="h-3.5 w-3.5" />
              {isDemo ? "Demo Mode — sample data only. No real emails or payments are sent." : "Real Business Mode — live business data"}
            </span>
            {isAdmin && (
              <Select value={mode} onValueChange={(v) => switchMode(v as AppMode)} disabled={switching}>
                <SelectTrigger className="h-6 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Real Business Mode</SelectItem>
                  <SelectItem value="demo">Demo Mode</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <main className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
