import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "staff" | "customer";

interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean; // admin or staff
}

const Ctx = createContext<AuthState>({ user: null, role: null, loading: true, isAdmin: false, isStaff: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(u: User | null) {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
      if (!active) return;
      const roles = (data ?? []).map((r) => r.role as Role);
      setRole(roles.includes("admin") ? "admin" : roles.includes("staff") ? "staff" : roles[0] ?? "customer");
      setLoading(false);
    }
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setLoading(true);
        load(session?.user ?? null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{ user, role, loading, isAdmin: role === "admin", isStaff: role === "admin" || role === "staff" }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export const passwordRules = [
  { test: (p: string) => p.length > 8, label: "More than 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "A special character" },
];
export const isStrongPassword = (p: string) => passwordRules.every((r) => r.test(p));
