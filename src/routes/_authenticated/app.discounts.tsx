import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { date, money, today } from "@/lib/format";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { useCatalog } from "@/components/app/LineEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/discounts")({ component: Discounts });

type D = {
  id?: string; name: string; discount_type: "percentage" | "fixed"; value: string; scope: "subscription" | "product"; min_purchase: string; min_quantity: string;
  starts_on: string; ends_on: string; max_uses: string; active: boolean; products: string[];
};

function Discounts() {
  const cat = useCatalog();
  const { mode } = useMode();
  const [edit, setEdit] = useState<D | null>(null);
  const list = useData<any[]>(["discounts", mode], () => mfrom(mode, "discounts").select(`*, ${rel(mode, "discount_products", "product_id")}`).order("created_at", { ascending: false }));
  const save = useAction(
    async (d: D) => {
      const value = Number(d.value);
      if (!(value > 0) || (d.discount_type === "percentage" && value > 100)) return { data: null, error: new Error("Enter a valid discount value") };
      if (d.scope === "product" && !d.products.length) return { data: null, error: new Error("Choose at least one product") };
      const row = {
        name: d.name.trim(), discount_type: d.discount_type, value, scope: d.scope, min_purchase: Number(d.min_purchase || 0), min_quantity: Number(d.min_quantity || 0),
        starts_on: d.starts_on, ends_on: d.ends_on || null, max_uses: d.max_uses ? Number(d.max_uses) : null, active: d.active,
      };
      const res = d.id ? await mfrom(mode, "discounts").update(row).eq("id", d.id).select("id").single() : await mfrom(mode, "discounts").insert(row).select("id").single();
      if (res.error) return res;
      const del = await mfrom(mode, "discount_products").delete().eq("discount_id", res.data.id);
      if (del.error) return del;
      if (d.scope === "product") return mfrom(mode, "discount_products").insert(d.products.map((p) => ({ discount_id: res.data.id, product_id: p })));
      return { data: null, error: null };
    },
    { success: "Discount saved", invalidate: [["discounts"]], onDone: () => setEdit(null) },
  );
  return (
    <>
      <PageHeader title="Discounts" description="The single best eligible discount is applied automatically to each generated invoice." actions={<Button onClick={() => setEdit({ name: "", discount_type: "percentage", value: "", scope: "subscription", min_purchase: "0", min_quantity: "0", starts_on: today(), ends_on: "", max_uses: "", active: true, products: [] })}><Plus className="mr-1 h-4 w-4" />New discount</Button>} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No discounts" /> : (
          <table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Name</th><th className={th}>Value</th><th className={th}>Scope</th><th className={th}>Conditions</th><th className={th}>Window</th><th className={th}>Usage</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">
              {list.data.map((d) => (
                <tr key={d.id}>
                  <td className={`${td} font-medium`}>{d.name}</td>
                  <td className={`${td} num`}>{d.discount_type === "percentage" ? `${Number(d.value)}%` : money(d.value)}</td>
                  <td className={`${td} capitalize`}>{d.scope}{d.scope === "product" && ` (${d.discount_products.length})`}</td>
                  <td className={`${td} text-xs text-muted-foreground`}>Min {money(d.min_purchase)} · qty {d.min_quantity}</td>
                  <td className={`${td} text-xs`}>{date(d.starts_on)} → {d.ends_on ? date(d.ends_on) : "open"}</td>
                  <td className={`${td} num`}>{d.used_count}{d.max_uses ? ` / ${d.max_uses}` : ""}</td>
                  <td className={td}><StatusBadge status={d.active ? "active" : "inactive"} /></td>
                  <td className={`${td} text-right`}><Button size="sm" variant="ghost" onClick={() => setEdit({
                    id: d.id, name: d.name, discount_type: d.discount_type as "fixed", value: String(d.value), scope: d.scope as "product", min_purchase: String(d.min_purchase), min_quantity: String(d.min_quantity),
                    starts_on: d.starts_on, ends_on: d.ends_on ?? "", max_uses: d.max_uses ? String(d.max_uses) : "", active: d.active, products: d.discount_products.map((x: any) => x.product_id),
                  })}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit discount" : "New discount"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="disc" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              <Field label="Name"><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select value={edit.discount_type} onValueChange={(v) => setEdit({ ...edit, discount_type: v as "fixed" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed amount</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Value"><Input required type="number" step="0.01" min="0.01" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></Field>
              </div>
              <Field label="Scope">
                <Select value={edit.scope} onValueChange={(v) => setEdit({ ...edit, scope: v as "product" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="subscription">Whole subscription</SelectItem><SelectItem value="product">Specific products</SelectItem></SelectContent>
                </Select>
              </Field>
              {edit.scope === "product" && (
                <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 text-sm">
                  {cat.data?.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <Checkbox checked={edit.products.includes(p.id)} onCheckedChange={(c) => setEdit({ ...edit, products: c ? [...edit.products, p.id] : edit.products.filter((x) => x !== p.id) })} />{p.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Min purchase"><Input type="number" min="0" step="0.01" value={edit.min_purchase} onChange={(e) => setEdit({ ...edit, min_purchase: e.target.value })} /></Field>
                <Field label="Min quantity"><Input type="number" min="0" value={edit.min_quantity} onChange={(e) => setEdit({ ...edit, min_quantity: e.target.value })} /></Field>
                <Field label="Max uses"><Input type="number" min="1" value={edit.max_uses} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value })} placeholder="Unlimited" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts on"><Input type="date" required value={edit.starts_on} onChange={(e) => setEdit({ ...edit, starts_on: e.target.value })} /></Field>
                <Field label="Ends on"><Input type="date" value={edit.ends_on} onChange={(e) => setEdit({ ...edit, ends_on: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
            </form>
          )}
          <DialogFooter><Button form="disc" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
