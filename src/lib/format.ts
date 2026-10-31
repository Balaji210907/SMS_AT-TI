export const CURRENCY = "INR";

export function money(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, maximumFractionDigits: 2 }).format(n);
}

export function date(v: string | null | undefined) {
  if (!v) return "—";
  const d = v.length <= 10 ? new Date(v + "T00:00:00") : new Date(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function humanize(s: string | null | undefined) {
  return (s ?? "").replace(/_/g, " ");
}

/** Turns a database error into a readable message. */
export function errMsg(e: unknown): string {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message;
  return m || "Something went wrong";
}
