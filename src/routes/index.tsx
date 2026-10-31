import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, FileText, LineChart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brightloop Subscription OS — Billing & subscription management" },
      { name: "description", content: "Manage customers, plans, subscriptions, recurring invoices and payments in one place." },
      { property: "og:title", content: "Brightloop Subscription OS" },
      { property: "og:description", content: "Manage customers, plans, subscriptions, recurring invoices and payments in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CalendarClock, title: "Recurring billing", text: "Scheduled, idempotent invoice runs for daily, weekly, monthly and yearly plans." },
  { icon: FileText, title: "Invoices & payments", text: "Tax and discount snapshots, partial payments, reversals and full history." },
  { icon: LineChart, title: "Revenue analytics", text: "MRR, ARR, invoiced, collected and outstanding — straight from your records." },
  { icon: ShieldCheck, title: "Role-based access", text: "Admin, staff and customer portals, enforced by the database itself." },
];

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">B</div>
          Brightloop <span className="font-normal text-muted-foreground">Subscription OS</span>
        </div>
        <Button asChild variant={user ? "default" : "outline"}>
          <Link to={user ? "/app" : "/auth"}>{user ? "Open dashboard" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Brightloop Software</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">The operating system for your subscription business.</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            From customer sign-up and product setup to recurring invoices, payments and revenue reporting — every record lives in one secure system.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/app" : "/auth"}>
                {user ? "Go to dashboard" : "Get started"} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5 shadow-card">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
