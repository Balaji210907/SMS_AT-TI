import type { ReactNode } from "react";
import { Loader2, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("num mt-2 text-2xl font-semibold", tone === "danger" && "text-destructive", tone === "success" && "text-success")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center p-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/60" />
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="max-w-sm text-xs text-muted-foreground">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {(error as { message?: string })?.message ?? "Failed to load data"}
    </div>
  );
}

const tone: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  active: "success", paid: "success", accepted: "success", completed: "success", success: "success", recorded: "success", converted: "info",
  confirmed: "info", sent: "info", quotation: "info", running: "info",
  paused: "warning", partially_paid: "warning", draft: "muted", completed_with_errors: "warning", inactive: "muted",
  overdue: "danger", cancelled: "danger", failed: "danger", rejected: "danger", reversed: "danger",
  closed: "muted", expired: "muted", archived: "muted", skipped: "muted",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "";
  return <Badge variant={tone[s] ?? "muted"}>{humanize(s)}</Badge>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const td = "px-4 py-3 text-sm";
