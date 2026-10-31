import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { date, today } from "@/lib/format";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { useCatalog } from "@/components/app/LineEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/taxes")({ component: Taxes });

type T = { id?: string; name: string; rate: string; applies_to: "all" | "product"; product_id: string; effective_from: string; effective_to: string; active: boolean };

function Taxes() {
  const cat = useCatalog();
  const { mode } = useMode();
  const [edit, setEdit] = useState<T | null>(null);
  const list = useData<any[]>(["taxes", mode], () => mfrom(mode, "tax_rules").select(`*, ${rel(mode, "products", "name")}`).order("created_at", { ascending: false }));
  const save = useAction(
    (t: T) => {
      const rate = Number(t.rate);
      if (!(rate >= 0 && rate <= 100)) return Promise.resolve({ data: null, error: new Error("Rate must be between 0 and 100") });
      const row = { name: t.name.trim(), rate, applies_to: t.applies_to, product_id: t.applies_to === "product" ? t.product_id || null : null, effective_from: t.effective_from, effective_to: t.effective_to || null, active: t.active };
      return t.id ? mfrom(mode, "tax_rules").update(row).eq("id", t.id) : mfrom(mode, "tax_rules").insert(row);
    },
    { success: "Tax rule saved", invalidate: [["taxes"]], onDone: () => setEdit(null) },
  );
  return (
    <>
      <PageHeader title="Tax rules" description="Rates applied to invoice lines at billing time. Issued invoices keep their original rate." actions={<Button onClick={() => setEdit({ name: "", rate: "", applies_to: "all", product_id: "", effective_from: today(), effective_to: "", active: true })}><Plus className="mr-1 h-4 w-4" />New tax rule</Button>} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No tax rules" hint="Invoices will carry zero tax until a rule is added." /> : (
          <table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Name</th><th className={`${th} text-right`}>Rate</th><th className={th}>Applies to</th><th className={th}>Effective</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">
              {list.data.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} font-medium`}>{t.name}</td>
                  <td className={`${td} num text-right`}>{Number(t.rate)}%</td>
                  <td className={td}>{t.applies_to === "all" ? "All lines" : t.products?.name}</td>
                  <td className={`${td} text-xs`}>{date(t.effective_from)} → {t.effective_to ? date(t.effective_to) : "open"}</td>
                  <td className={td}><StatusBadge status={t.active ? "active" : "inactive"} /></td>
                  <td className={`${td} text-right`}><Button size="sm" variant="ghost" onClick={() => setEdit({ id: t.id, name: t.name, rate: String(t.rate), applies_to: t.applies_to as "all", product_id: t.product_id ?? "", effective_from: t.effective_from, effective_to: t.effective_to ?? "", active: t.active })}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit tax rule" : "New tax rule"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="tax" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="GST 18%" /></Field>
                <Field label="Rate (%)"><Input required type="number" step="0.001" min="0" max="100" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} /></Field>
              </div>
              <Field label="Applies to">
                <Select value={edit.applies_to} onValueChange={(v) => setEdit({ ...edit, applies_to: v as "all" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All invoice lines</SelectItem><SelectItem value="product">A specific product</SelectItem></SelectContent>
                </Select>
              </Field>
              {edit.applies_to === "product" && (
                <Field label="Product">
                  <Select value={edit.product_id} onValueChange={(v) => setEdit({ ...edit, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                    <SelectContent>{cat.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Effective from"><Input type="date" required value={edit.effective_from} onChange={(e) => setEdit({ ...edit, effective_from: e.target.value })} /></Field>
                <Field label="Effective to"><Input type="date" value={edit.effective_to} onChange={(e) => setEdit({ ...edit, effective_to: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
            </form>
          )}
          <DialogFooter><Button form="tax" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
