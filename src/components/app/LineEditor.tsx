import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data";
import { money } from "@/lib/format";
import { mfrom, mt, rel, useMode } from "@/lib/mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Line = { product_id: string; variant_id: string; quantity: number; unit_price: string };
export const emptyLine: Line = { product_id: "", variant_id: "", quantity: 1, unit_price: "" };

type Prod = { id: string; name: string; sales_price: number; product_variants: { id: string; attribute: string; value: string; extra_price: number; active: boolean }[] };

export function useCatalog() {
  const { mode } = useMode();
  return useData<Prod[]>(["catalog", mode], () =>
    mfrom(mode, "products").select(`id, name, sales_price, ${rel(mode, "product_variants", "id, attribute, value, extra_price, active")}`).eq("status", "active").order("name") as never,
  );
}

export function defaultPrice(products: Prod[] | undefined, productId: string, variantId: string) {
  const p = products?.find((x) => x.id === productId);
  if (!p) return 0;
  const v = p.product_variants.find((x) => x.id === variantId);
  return Math.round((Number(p.sales_price) + Number(v?.extra_price ?? 0)) * 100) / 100;
}

/** Lines editor. Prices shown are previews; the backend recalculates and validates. */
export function LineEditor({ lines, onChange, allowPriceOverride = true }: { lines: Line[]; onChange: (l: Line[]) => void; allowPriceOverride?: boolean }) {
  const cat = useCatalog();
  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((a, l) => a + (l.unit_price !== "" ? Number(l.unit_price) : defaultPrice(cat.data, l.product_id, l.variant_id)) * l.quantity, 0);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const p = cat.data?.find((x) => x.id === l.product_id);
        const variants = p?.product_variants.filter((v) => v.active) ?? [];
        return (
          <div key={i} className="grid grid-cols-[1fr_1fr_70px_100px_auto] gap-2">
            <Select value={l.product_id} onValueChange={(v) => set(i, { product_id: v, variant_id: "", unit_price: "" })}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>{cat.data?.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={l.variant_id || "none"} onValueChange={(v) => set(i, { variant_id: v === "none" ? "" : v, unit_price: "" })} disabled={!variants.length}>
              <SelectTrigger><SelectValue placeholder="No variant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No variant</SelectItem>
                {variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extra_price)})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" min={1} value={l.quantity} onChange={(e) => set(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} aria-label="Quantity" />
            <Input
              type="number" step="0.01" min="0" disabled={!allowPriceOverride}
              placeholder={String(defaultPrice(cat.data, l.product_id, l.variant_id))}
              value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} aria-label="Unit price"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 className="h-4 w-4" /></Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { ...emptyLine }])}><Plus className="mr-1 h-3.5 w-3.5" />Add line</Button>
        <span className="num text-sm text-muted-foreground">Lines subtotal (preview): <span className="font-medium text-foreground">{money(total)}</span></span>
      </div>
    </div>
  );
}

export function linesPayload(lines: Line[]) {
  return lines.filter((l) => l.product_id).map((l) => ({
    product_id: l.product_id,
    variant_id: l.variant_id || null,
    quantity: l.quantity,
    unit_price: l.unit_price === "" ? null : Number(l.unit_price),
  }));
}
