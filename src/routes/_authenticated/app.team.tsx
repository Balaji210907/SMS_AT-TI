import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { isStrongPassword, passwordRules, useAuth } from "@/lib/auth";
import { createStaffAccount } from "@/lib/team.functions";
import { date } from "@/lib/format";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/team")({ component: Team });

function Team() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", password: "" });
  const create = useServerFn(createStaffAccount);
  const list = useData(["team"], async () => {
    const [p, r] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), supabase.from("user_roles").select("user_id, role")]);
    if (p.error || r.error) return { data: null, error: p.error ?? r.error };
    return { data: (p.data ?? []).map((x) => ({ ...x, role: r.data?.find((y) => y.user_id === x.id)?.role ?? "customer" })), error: null };
  });
  const add = useAction(async () => {
    if (!isStrongPassword(f.password)) return { data: null, error: new Error("Password does not meet the requirements") };
    try { return { data: await create({ data: f }), error: null }; } catch (e) { return { data: null, error: e }; }
  }, { success: "Staff account created", invalidate: [["team"]], onDone: () => { setOpen(false); setF({ full_name: "", email: "", password: "" }); } });
  const setRole = useAction((v: { id: string; role: "admin" | "staff" | "customer" }) => supabase.rpc("set_user_role", { _user_id: v.id, _role: v.role }), { success: "Role updated", invalidate: [["team"]] });

  return (
    <>
      <PageHeader title="Team & roles" description="Only administrators can create staff and change roles." actions={<Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New staff account</Button>} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="No users" /> : (
          <table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>User</th><th className={th}>Joined</th><th className={th}>Role</th></tr></thead>
            <tbody className="divide-y">{list.data.map((u) => (
              <tr key={u.id}>
                <td className={td}><div className="font-medium">{u.full_name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                <td className={td}>{date(u.created_at)}</td>
                <td className={td}>
                  {u.id === user?.id ? <span className="text-sm capitalize">{u.role} (you)</span> : (
                    <Select value={u.role} onValueChange={(v) => setRole.mutate({ id: u.id, role: v as "staff" })}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="customer">Customer</SelectItem></SelectContent>
                    </Select>
                  )}
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </Panel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New staff account</DialogTitle></DialogHeader>
          <form id="staff" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
            <Field label="Full name"><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
            <Field label="Email"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Temporary password" hint={passwordRules.map((r) => r.label).join(" · ")}><Input required type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          </form>
          <DialogFooter><Button form="staff" disabled={add.isPending}>{add.isPending ? "Creating…" : "Create account"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
