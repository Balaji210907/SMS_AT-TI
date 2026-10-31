import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Field, Loading, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/profile")({ component: Profile });

function Profile() {
  const { user, isStaff } = useAuth();
  const prof = useData<Tables<"profiles">>(["profile", user?.id], () => supabase.from("profiles").select("*").eq("id", user!.id).single() as never);
  const cust = useData<Tables<"customers"> | null>(["my-customer", user?.id], () => supabase.from("customers").select("*").eq("user_id", user!.id).maybeSingle() as never);
  const [p, setP] = useState({ full_name: "", phone: "" });
  const [c, setC] = useState({ company: "", address: "", tax_id: "" });
  useEffect(() => { if (prof.data) setP({ full_name: prof.data.full_name ?? "", phone: prof.data.phone ?? "" }); }, [prof.data]);
  useEffect(() => { if (cust.data) setC({ company: cust.data.company ?? "", address: cust.data.address ?? "", tax_id: cust.data.tax_id ?? "" }); }, [cust.data]);
  const save = useAction(async () => {
    const r = await supabase.from("profiles").update({ full_name: p.full_name.trim(), phone: p.phone || null }).eq("id", user!.id);
    if (r.error || !cust.data) return r;
    return supabase.from("customers").update({ name: p.full_name.trim(), phone: p.phone || null, company: c.company || null, address: c.address || null, tax_id: c.tax_id || null }).eq("id", cust.data.id);
  }, { success: "Profile saved", invalidate: [["profile"], ["my-customer"]] });
  if (prof.isLoading) return <Loading />;
  return (
    <>
      <PageHeader title="Profile" description={user?.email ?? ""} />
      <Panel className="max-w-2xl">
        <form className="grid gap-4 p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name"><Input required value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
          </div>
          {!isStaff && cust.data && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company"><Input value={c.company} onChange={(e) => setC({ ...c, company: e.target.value })} /></Field>
              <Field label="Tax ID"><Input value={c.tax_id} onChange={(e) => setC({ ...c, tax_id: e.target.value })} /></Field>
            </div>
            <Field label="Billing address"><Textarea value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
          </>}
          <div><Button disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </Panel>
    </>
  );
}
