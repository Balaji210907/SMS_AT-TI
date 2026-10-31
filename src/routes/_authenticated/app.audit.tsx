import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data";
import { dateTime, humanize } from "@/lib/format";
import { mfrom, mt, useMode } from "@/lib/mode";
import { Empty, ErrorBox, Loading, PageHeader, Panel, td, th } from "@/components/app/ui";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/audit")({ component: Audit });

function Audit() {
  const { mode, isDemo } = useMode();
  const [q, setQ] = useState("");
  const list = useData<any[]>(["audit", mode], () => mfrom(mode, "audit_logs").select("*").order("created_at", { ascending: false }).limit(300));
  const people = useData<any[]>(["audit-people"], () => supabase.from("profiles").select("id, email"));
  const who = (id: string | null) => (id ? people.data?.find((p) => p.id === id)?.email ?? id.slice(0, 8) : "System");
  const rows = (list.data ?? []).filter((r) => !q || `${r.action} ${r.entity_type}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Audit log" description={isDemo ? "Demo Mode audit history — kept separate from real business records." : "Read-only record of important business operations (latest 300)."} />
      <Panel>
        <div className="border-b p-3"><Input placeholder="Filter by action or entity…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /></div>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !rows.length ? <Empty title="No entries" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>When</th><th className={th}>User</th><th className={th}>Action</th><th className={th}>Entity</th><th className={th}>Details</th></tr></thead>
            <tbody className="divide-y">{rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap`}>{dateTime(r.created_at)}</td>
                <td className={td}>{who(r.actor)}</td>
                <td className={`${td} capitalize`}>{humanize(r.action)}</td>
                <td className={`${td} capitalize`}>{humanize(r.entity_type)}</td>
                <td className={td}><code className="block max-w-md truncate text-xs text-muted-foreground">{JSON.stringify(r.metadata)}</code></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}
