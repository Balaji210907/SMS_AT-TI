import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useMode } from "@/lib/mode";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/templates")({ component: Templates });

type T = { id?: string; name: string; plan_id: string; validity_days: string; notes: string; active: boolean };
const blank: T = { name: "", plan_id: "", validity_days: "30", notes: "", active: true };

function Templates() {
  const { isAdmin } = useAuth();
  const { isDemo } = useMode();
  const [edit, setEdit] = useState<T | null>(null);
  const list = useData(["templates"], () => supabase.from("quotation_templates").select("*, plans(name)").order("created_at", { ascending: false }));
  const plans = useData(["plan-opts-tpl"], () => supabase.from("plans").select("id, name, billing_frequency, price").eq("status", "active").order("name"));
  const save = useAction(
    (t: T) => {
      const days = parseInt(t.validity_days) || 30;
      if (days < 1) return Promise.resolve({ data: null, error: new Error("Validity must be at least 1 day") });
      const row = { name: t.name.trim(), plan_id: t.plan_id, validity_days: days, notes: t.notes || null, active: t.active };
      return t.id ? supabase.from("quotation_templates").update(row).eq("id", t.id) : supabase.from("quotation_templates").insert(row);
    },
    { success: "Template saved", invalidate: [["templates"]], onDone: () => setEdit(null) },
  );
  const toggle = useAction((v: { id: string; active: boolean }) => supabase.from("quotation_templates").update({ active: v.active }).eq("id", v.id), { success: "Template updated", invalidate: [["templates"]] });

  return (
    <>
      <PageHeader
        title="Quotation templates"
        description={isDemo ? "Templates always apply to real plans — they are shared across modes." : "Reusable quotation presets built on your plans."}
        actions={isAdmin && <Button onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />New template</Button>}
      />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? (
          <Empty title="No templates yet" hint="Templates prefill a quotation's plan, lines and validity so staff can quote in seconds." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Template</th><th className={th}>Plan</th><th className={th}>Validity</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">{list.data.map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-medium`}>{t.name}{t.notes && <div className="text-xs font-normal text-muted-foreground">{t.notes}</div>}</td>
                <td className={td}>{t.plans?.name}</td>
                <td className={`${td} num`}>{t.validity_days} days</td>
                <td className={td}><StatusBadge status={t.active ? "active" : "inactive"} /></td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {!isDemo && t.active && <Button size="sm" asChild><Link to="/app/quotations" search={{ template: t.id }}>Use template</Link></Button>}
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => setEdit({ id: t.id, name: t.name, plan_id: t.plan_id, validity_days: String(t.validity_days), notes: t.notes ?? "", active: t.active })}>Edit</Button>}
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: t.id, active: !t.active })}>{t.active ? "Deactivate" : "Activate"}</Button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Standard onboarding quote" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan"><Select value={edit.plan_id} onValueChange={(v) => setEdit({ ...edit, plan_id: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{plans.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Validity (days)"><Input type="number" min={1} value={edit.validity_days} onChange={(e) => setEdit({ ...edit, validity_days: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} /></Field>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
            </div>
          )}
          <DialogFooter><Button disabled={!edit?.name.trim() || !edit?.plan_id || save.isPending} onClick={() => edit && save.mutate(edit)}>{save.isPending ? "Saving…" : "Save template"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
