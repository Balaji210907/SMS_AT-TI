import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { dateTime } from "@/lib/format";
import { emailConfigStatus, retryEmail } from "@/lib/email.functions";
import { Empty, ErrorBox, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/emails")({ component: EmailLog });

function EmailLog() {
  const getConfig = useServerFn(emailConfigStatus);
  const config = useQuery({ queryKey: ["email-config"], queryFn: () => getConfig() });
  const list = useData(["email-logs"], () => supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(200));
  const retry = useAction(async (logId: string) => ({ data: await retryEmail({ data: { logId } }), error: null }), { success: "Retry attempted — check the status column", invalidate: [["email-logs"]] });

  return (
    <>
      <PageHeader title="Email log" description="Every app email attempt is recorded here — nothing is sent without a log entry." />
      {config.data && !config.data.configured && (
        <Panel className="mb-4 border-amber-500/40 bg-amber-500/5">
          <div className="px-5 py-4 text-sm">
            <span className="font-medium">Email delivery is not configured.</span>{" "}
            <span className="text-muted-foreground">Add your Resend API key (RESEND_API_KEY) in project settings to start sending. Until then, sends are logged as “not configured” and nothing is delivered.</span>
          </div>
        </Panel>
      )}
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? (
          <Empty title="No emails yet" hint="Emails triggered by quotation, invoice and payment events will appear here." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>When</th><th className={th}>To</th><th className={th}>Subject</th><th className={th}>Status</th><th className={th}>Detail</th><th className={th}></th></tr></thead>
            <tbody className="divide-y">{list.data.map((e) => (
              <tr key={e.id}>
                <td className={`${td} whitespace-nowrap`}>{dateTime(e.created_at)}</td>
                <td className={td}>{e.recipient}</td>
                <td className={td}>{e.subject}</td>
                <td className={td}><StatusBadge status={e.status} /></td>
                <td className={`${td} max-w-64 truncate text-xs text-muted-foreground`}>{e.error ?? e.provider_id ?? "—"}</td>
                <td className={`${td} text-right`}>
                  {["failed", "not_configured"].includes(e.status) && (
                    <Button size="sm" variant="ghost" onClick={() => retry.mutate(e.id)} disabled={retry.isPending}><RefreshCw className="mr-1 h-3.5 w-3.5" />Retry</Button>
                  )}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}
