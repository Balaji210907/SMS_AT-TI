import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authProvider } from "@/integrations/auth/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/app/ui";
import { isStrongPassword, passwordRules, useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Brightloop Subscription OS" },
      { name: "description", content: "Sign in or create your Brightloop customer account." },
      { property: "og:title", content: "Sign in — Brightloop Subscription OS" },
      { property: "og:description", content: "Sign in or create your Brightloop customer account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) nav({ to: "/app", replace: true });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!isStrongPassword(password)) throw new Error("Password does not meet the requirements");
        if (name.trim().length < 2) throw new Error("Enter your full name");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) setSent("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent("If that email is registered, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await authProvider.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(errMsg(r.error));
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">B</div>
          Brightloop Subscription OS
        </Link>
        <div className="rounded-lg border bg-card p-6 shadow-card">
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">{sent}</p>
              <Button variant="outline" onClick={() => { setSent(null); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="text-lg font-semibold">Reset your password</h1>
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Button className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>Back to sign in</button>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <form onSubmit={submit} className="mt-5 space-y-4">
                <TabsContent value="signup" className="m-0">
                  <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} required={mode === "signup"} /></Field>
                </TabsContent>
                <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                {mode === "signup" && (
                  <ul className="grid grid-cols-2 gap-1 text-xs">
                    {passwordRules.map((r) => {
                      const ok = r.test(password);
                      return (
                        <li key={r.label} className={ok ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-muted-foreground"}>
                          {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
                {mode === "signin" && (
                  <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>Forgot password?</button>
                )}
              </form>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
              <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
