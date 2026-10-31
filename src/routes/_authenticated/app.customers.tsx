import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { mfrom, mt, useMode } from "@/lib/mode";
import { date } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/customers")({ component: Customers });

type C = { id?: string; name: string; email: string; phone: string | null; company: string | null; address: string | null; tax_id: string | null; status?: string };
const blank: C = { name: "", email: "", phone: "", company: "", address: "", tax_id: "" };

function Customers() {
  const { user } = useAuth();
  const { mode } = useMode();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<C | null>(null);
  const list = useData<any[]>(["customers", mode, q], () => {
    let r = mfrom(mode, "customers").select("*").order("created_at", { ascending: false });
    if (q) r = r.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,customer_number.ilike.%${q}%`);
    return r;
  });
  const save = useAction(
    (c: C) => {
      const row = { name: c.name.trim(), email: c.email.trim().toLowerCase(), phone: c.phone || null, company: c.company || null, address: c.address || null, tax_id: c.tax_id || null };
      return c.id ? mfrom(mode, "customers").update(row).eq("id", c.id) : mfrom(mode, "customers").insert({ ...row, created_by: user?.id ?? null });
    },
    { success: "Customer saved", invalidate: [["customers"]], onDone: () => setEdit(null) },
  );
  const archive = useAction(
    (c: { id: string; status: string }) => mfrom(mode, "customers").update({ status: c.status }).eq("id", c.id),
    { success: "Customer updated", invalidate: [["customers"]] },
  );

  return (
    <>
      <PageHeader title="Customers" description="Accounts that hold subscriptions and receive invoices." actions={<Button onClick={() => setEdit(blank)}><Plus className="mr-1 h-4 w-4" />New customer</Button>} />
      <Panel>
        <div className="border-b p-3"><Input placeholder="Search name, email, company or number…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" /></div>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? (
          <Empty title="No customers found" hint="Customers are created when people register, or you can add one here." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>Customer</th><th className={th}>Company</th><th className={th}>Portal</th><th className={th}>Since</th><th className={th}>Status</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">
              {list.data.map((c) => (
                <tr key={c.id}>
                  <td className={td}><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.customer_number} · {c.email}</div></td>
                  <td className={td}>{c.company ?? "—"}</td>
                  <td className={td}>{c.user_id ? "Registered" : <span className="text-muted-foreground">Not registered</span>}</td>
                  <td className={td}>{date(c.created_at)}</td>
                  <td className={td}><StatusBadge status={c.status} /></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => archive.mutate({ id: c.id, status: c.status === "active" ? "archived" : "active" })}>{c.status === "active" ? "Archive" : "Restore"}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="cust" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              <Field label="Name"><Input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Email"><Input required type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
                <Field label="Company"><Input value={edit.company ?? ""} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></Field>
              </div>
              <Field label="Tax ID (GSTIN)"><Input value={edit.tax_id ?? ""} onChange={(e) => setEdit({ ...edit, tax_id: e.target.value })} /></Field>
              <Field label="Billing address"><Textarea value={edit.address ?? ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            </form>
          )}
          <DialogFooter><Button form="cust" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
