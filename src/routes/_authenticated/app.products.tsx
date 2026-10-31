import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { money } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/products")({ component: Products });

const types = ["service", "software", "license", "consumable", "other"];
type P = { id?: string; name: string; product_type: string; sales_price: string; cost_price: string; notes: string };

function Products() {
  const { isAdmin, user } = useAuth();
  const { mode } = useMode();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [edit, setEdit] = useState<P | null>(null);
  const [variantsFor, setVariantsFor] = useState<{ id: string; name: string; sales_price: number } | null>(null);
  const list = useData<any[]>(["products", mode, q, status], () => {
    let r = mfrom(mode, "products").select(`*, ${rel(mode, "product_variants", "id")}`).order("name");
    if (status !== "all") r = r.eq("status", status);
    if (q) r = r.ilike("name", `%${q}%`);
    return r;
  });
  const save = useAction(
    (p: P) => {
      const sp = Number(p.sales_price), cp = Number(p.cost_price || 0);
      if (!(sp >= 0) || !(cp >= 0)) return Promise.resolve({ data: null, error: new Error("Prices must be zero or positive") });
      const row = { name: p.name.trim(), product_type: p.product_type, sales_price: sp, cost_price: cp, notes: p.notes || null };
      return p.id ? mfrom(mode, "products").update(row).eq("id", p.id) : mfrom(mode, "products").insert({ ...row, created_by: user?.id ?? null });
    },
    { success: "Product saved", invalidate: [["products"]], onDone: () => setEdit(null) },
  );
  const setSt = useAction((v: { id: string; status: string }) => mfrom(mode, "products").update({ status: v.status }).eq("id", v.id), { success: "Product updated", invalidate: [["products"]] });

  return (
    <>
      <PageHeader title="Products" description="Sellable items and their variant pricing." actions={isAdmin && <Button onClick={() => setEdit({ name: "", product_type: "service", sales_price: "", cost_price: "", notes: "" })}><Plus className="mr-1 h-4 w-4" />New product</Button>} />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
          </Select>
        </div>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No products" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Product</th><th className={th}>Type</th><th className={`${th} text-right`}>Sales price</th><th className={`${th} text-right`}>Cost</th><th className={th}>Variants</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">
              {list.data.map((p) => (
                <tr key={p.id}>
                  <td className={td}><div className="font-medium">{p.name}</div>{p.notes && <div className="max-w-xs truncate text-xs text-muted-foreground">{p.notes}</div>}</td>
                  <td className={`${td} capitalize`}>{p.product_type}</td>
                  <td className={`${td} num text-right`}>{money(p.sales_price)}</td>
                  <td className={`${td} num text-right`}>{money(p.cost_price)}</td>
                  <td className={td}><Button size="sm" variant="link" className="h-auto p-0" onClick={() => setVariantsFor({ id: p.id, name: p.name, sales_price: Number(p.sales_price) })}>{p.product_variants.length} variant(s)</Button></td>
                  <td className={td}><StatusBadge status={p.status} /></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {isAdmin && <>
                      <Button size="sm" variant="ghost" onClick={() => setEdit({ id: p.id, name: p.name, product_type: p.product_type, sales_price: String(p.sales_price), cost_price: String(p.cost_price), notes: p.notes ?? "" })}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSt.mutate({ id: p.id, status: p.status === "active" ? "archived" : "active" })}>{p.status === "active" ? "Archive" : "Restore"}</Button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="prod" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              <Field label="Name"><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Type">
                <Select value={edit.product_type} onValueChange={(v) => setEdit({ ...edit, product_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{types.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sales price"><Input required type="number" min="0" step="0.01" value={edit.sales_price} onChange={(e) => setEdit({ ...edit, sales_price: e.target.value })} /></Field>
                <Field label="Cost price"><Input type="number" min="0" step="0.01" value={edit.cost_price} onChange={(e) => setEdit({ ...edit, cost_price: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            </form>
          )}
          <DialogFooter><Button form="prod" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!variantsFor} onOpenChange={(o) => !o && setVariantsFor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Variants — {variantsFor?.name}</DialogTitle></DialogHeader>
          {variantsFor && <Variants product={variantsFor} canEdit={isAdmin} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Variants({ product, canEdit }: { product: { id: string; sales_price: number }; canEdit: boolean }) {
  const { mode } = useMode();
  const [attr, setAttr] = useState("Brand");
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const list = useData<any[]>(["variants", mode, product.id], () => mfrom(mode, "product_variants").select("*").eq("product_id", product.id).order("created_at"));
  const add = useAction(
    () => mfrom(mode, "product_variants").insert({ product_id: product.id, attribute: attr.trim(), value: value.trim(), extra_price: Number(extra || 0) }),
    { success: "Variant added", invalidate: [["variants"], ["products"]], onDone: () => { setValue(""); setExtra(""); } },
  );
  const del = useAction((id: string) => mfrom(mode, "product_variants").update({ active: false }).eq("id", id), { success: "Variant deactivated", invalidate: [["variants"]] });
  return (
    <div className="space-y-4">
      {list.isLoading ? <Loading /> : !list.data?.length ? <Empty title="No variants" /> : (
        <table className="w-full rounded border">
          <thead className="border-b bg-muted/40"><tr><th className={th}>Variant</th><th className={`${th} text-right`}>Extra</th><th className={`${th} text-right`}>Final price</th><th className={th}></th></tr></thead>
          <tbody className="divide-y">
            {list.data.map((v) => (
              <tr key={v.id} className={v.active ? "" : "opacity-50"}>
                <td className={td}>{v.attribute}: <span className="font-medium">{v.value}</span></td>
                <td className={`${td} num text-right`}>{money(v.extra_price)}</td>
                <td className={`${td} num text-right font-medium`}>{money(product.sales_price + Number(v.extra_price))}</td>
                <td className={`${td} text-right`}>{canEdit && v.active && <Button size="icon" variant="ghost" onClick={() => del.mutate(v.id)} aria-label="Deactivate"><Trash2 className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canEdit && (
        <form className="grid grid-cols-[1fr_1fr_110px_auto] items-end gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
          <Field label="Attribute"><Input value={attr} onChange={(e) => setAttr(e.target.value)} required /></Field>
          <Field label="Value"><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Odoo" required /></Field>
          <Field label="Extra price"><Input type="number" step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
          <Button disabled={add.isPending}>Add</Button>
        </form>
      )}
    </div>
  );
}
