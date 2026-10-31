import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { date, money } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { LineEditor, defaultPrice, useCatalog, type Line } from "@/components/app/LineEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/plans")({ component: Plans });

type Freq = "daily" | "weekly" | "monthly" | "yearly";
type PlanForm = {
  id?: string; name: string; description: string; billing_frequency: Freq; price: string; min_quantity: number;
  available_from: string; available_until: string; auto_close: boolean; auto_close_cycles: string;
  allow_early_close: boolean; allow_pause: boolean; allow_renew: boolean; lines: Line[];
};
const blank: PlanForm = { name: "", description: "", billing_frequency: "monthly", price: "0", min_quantity: 1, available_from: "", available_until: "", auto_close: false, auto_close_cycles: "", allow_early_close: true, allow_pause: true, allow_renew: true, lines: [] };

function Plans() {
  const { isAdmin, user } = useAuth();
  const { mode } = useMode();
  const cat = useCatalog();
  const [edit, setEdit] = useState<PlanForm | null>(null);
  const list = useData<any[]>(["plans", mode], () => mfrom(mode, "plans").select(`*, ${rel(mode, "plan_product_lines", `id, product_id, variant_id, quantity, unit_price, ${rel(mode, "products", "name")}`)}`).order("created_at", { ascending: false }));

  const save = useAction(
    async (f: PlanForm) => {
      if (f.available_from && f.available_until && f.available_until < f.available_from) return { data: null, error: new Error("Available-until must be after available-from") };
      const row = {
        name: f.name.trim(), description: f.description || null, billing_frequency: f.billing_frequency, price: Number(f.price || 0), min_quantity: f.min_quantity,
        available_from: f.available_from || null, available_until: f.available_until || null, auto_close: f.auto_close,
        auto_close_cycles: f.auto_close && f.auto_close_cycles ? Number(f.auto_close_cycles) : null,
        allow_early_close: f.allow_early_close, allow_pause: f.allow_pause, allow_renew: f.allow_renew,
      };
      const res = f.id ? await mfrom(mode, "plans").update(row).eq("id", f.id).select("id").single() : await mfrom(mode, "plans").insert({ ...row, created_by: user?.id ?? null }).select("id").single();
      if (res.error) return res;
      const id = res.data.id;
      const del = await mfrom(mode, "plan_product_lines").delete().eq("plan_id", id);
      if (del.error) return del;
      const lines = f.lines.filter((l) => l.product_id).map((l) => ({
        plan_id: id, product_id: l.product_id, variant_id: l.variant_id || null, quantity: l.quantity,
        unit_price: l.unit_price === "" ? defaultPrice(cat.data, l.product_id, l.variant_id) : Number(l.unit_price),
      }));
      if (lines.length) return mfrom(mode, "plan_product_lines").insert(lines);
      return { data: null, error: null };
    },
    { success: "Plan saved", invalidate: [["plans"]], onDone: () => setEdit(null) },
  );
  const setSt = useAction((v: { id: string; status: string }) => mfrom(mode, "plans").update({ status: v.status }).eq("id", v.id), { success: "Plan updated", invalidate: [["plans"]] });

  return (
    <>
      <PageHeader title="Subscription plans" description="Billing frequency, rules and default product lines." actions={isAdmin && <Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />New plan</Button>} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No plans yet" hint="Create a plan to start selling subscriptions." /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Plan</th><th className={th}>Frequency</th><th className={`${th} text-right`}>Plan fee</th><th className={th}>Availability</th><th className={th}>Rules</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">
              {list.data.map((p) => (
                <tr key={p.id}>
                  <td className={td}><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.plan_product_lines.map((l: any) => `${l.quantity}× ${l.products?.name}`).join(", ") || "No default lines"}</div></td>
                  <td className={`${td} capitalize`}>{p.billing_frequency}</td>
                  <td className={`${td} num text-right`}>{money(p.price)}</td>
                  <td className={`${td} text-xs`}>{p.available_from || p.available_until ? `${date(p.available_from)} → ${date(p.available_until)}` : "Always"}</td>
                  <td className={`${td} text-xs text-muted-foreground`}>Min qty {p.min_quantity}{p.allow_pause ? " · pause" : ""}{p.allow_renew ? " · renew" : ""}{p.allow_early_close ? " · early close" : ""}{p.auto_close ? ` · auto-close ${p.auto_close_cycles ?? ""}` : ""}</td>
                  <td className={td}><StatusBadge status={p.status} /></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {isAdmin && <>
                      <Button size="sm" variant="ghost" onClick={() => setEdit({
                        id: p.id, name: p.name, description: p.description ?? "", billing_frequency: p.billing_frequency, price: String(p.price), min_quantity: p.min_quantity,
                        available_from: p.available_from ?? "", available_until: p.available_until ?? "", auto_close: p.auto_close, auto_close_cycles: p.auto_close_cycles ? String(p.auto_close_cycles) : "",
                        allow_early_close: p.allow_early_close, allow_pause: p.allow_pause, allow_renew: p.allow_renew,
                        lines: p.plan_product_lines.map((l: any) => ({ product_id: l.product_id, variant_id: l.variant_id ?? "", quantity: l.quantity, unit_price: String(l.unit_price) })),
                      })}>Edit</Button>
                      <Select value={p.status} onValueChange={(v) => setSt.mutate({ id: p.id, status: v })}>
                        <SelectTrigger className="inline-flex h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
                      </Select>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="plan" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label="Billing frequency">
                  <Select value={edit.billing_frequency} onValueChange={(v) => setEdit({ ...edit, billing_frequency: v as Freq })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["daily", "weekly", "monthly", "yearly"].map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Description"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Plan fee / cycle" hint="Added on top of product lines"><Input type="number" min="0" step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
                <Field label="Min quantity"><Input type="number" min={1} value={edit.min_quantity} onChange={(e) => setEdit({ ...edit, min_quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
                <Field label="Available from"><Input type="date" value={edit.available_from} onChange={(e) => setEdit({ ...edit, available_from: e.target.value })} /></Field>
                <Field label="Available until"><Input type="date" value={edit.available_until} onChange={(e) => setEdit({ ...edit, available_until: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm sm:grid-cols-4">
                <label className="flex items-center gap-2"><Switch checked={edit.allow_pause} onCheckedChange={(v) => setEdit({ ...edit, allow_pause: v })} />Allow pause</label>
                <label className="flex items-center gap-2"><Switch checked={edit.allow_renew} onCheckedChange={(v) => setEdit({ ...edit, allow_renew: v })} />Allow renewal</label>
                <label className="flex items-center gap-2"><Switch checked={edit.allow_early_close} onCheckedChange={(v) => setEdit({ ...edit, allow_early_close: v })} />Early closure</label>
                <label className="flex items-center gap-2"><Switch checked={edit.auto_close} onCheckedChange={(v) => setEdit({ ...edit, auto_close: v })} />Auto-close</label>
              </div>
              {edit.auto_close && <Field label="Close automatically after N billing cycles"><Input type="number" min={1} value={edit.auto_close_cycles} onChange={(e) => setEdit({ ...edit, auto_close_cycles: e.target.value })} required /></Field>}
              <div className="text-sm font-medium">Default product lines</div>
              <LineEditor lines={edit.lines} onChange={(lines) => setEdit({ ...edit, lines })} />
            </form>
          )}
          <DialogFooter><Button form="plan" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save plan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
