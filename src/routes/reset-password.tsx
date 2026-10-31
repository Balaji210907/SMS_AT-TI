import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui";
import { isStrongPassword, passwordRules } from "@/lib/auth";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Brightloop" },
      { name: "description", content: "Choose a new password for your Brightloop account." },
      { property: "og:title", content: "Set a new password — Brightloop" },
      { property: "og:description", content: "Choose a new password for your Brightloop account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrongPassword(pw)) { toast.error("Password does not meet the requirements"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Password updated");
    nav({ to: "/app" });
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-card">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <Field label="New password" hint={passwordRules.map((r) => r.label).join(" · ")}>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  );
}
