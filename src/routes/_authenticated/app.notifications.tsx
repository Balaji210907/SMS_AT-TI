import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAction, useData } from "@/lib/data";
import { dateTime } from "@/lib/format";
import { Empty, ErrorBox, Loading, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/notifications")({ component: Notifications });

function Notifications() {
  const list = useData(["notifications"], () => supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100));
  const markAll = useAction(() => supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null), { invalidate: [["notifications"], ["unread"]] });
  const markOne = useAction((id: string) => supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id), { invalidate: [["notifications"], ["unread"]] });
  return (
    <>
      <PageHeader title="Notifications" description="Shown in the app only — email delivery is not configured yet." actions={<Button variant="outline" onClick={() => markAll.mutate(undefined)}>Mark all read</Button>} />
      <Panel>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty title="You're all caught up" /> : (
          <ul className="divide-y">{list.data.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 px-5 py-3", !n.read_at && "bg-accent/40")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
              <div className="flex-1">
                <div className="text-sm font-medium">{n.link ? <Link to={n.link} onClick={() => markOne.mutate(n.id)} className="hover:text-primary">{n.title}</Link> : n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                <div className="mt-0.5 text-xs text-muted-foreground">{dateTime(n.created_at)}</div>
              </div>
            </li>))}</ul>
        )}
      </Panel>
    </>
  );
}
