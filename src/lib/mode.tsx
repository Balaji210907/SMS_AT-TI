import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type AppMode = "real" | "demo";

interface ModeState {
  mode: AppMode;
  isDemo: boolean;
  switching: boolean;
  setMode: (m: AppMode) => Promise<void>;
}

const Ctx = createContext<ModeState>({ mode: "real", isDemo: false, switching: false, setMode: async () => {} });

/**
 * Demo Mode vs Real Business Mode. Demo data lives in fully separate demo_*
 * tables (staff-only RLS); customers always operate on real data. Only admins
 * can switch modes (enforced again by the set_active_mode function).
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const { user, isStaff, isAdmin, loading } = useAuth();
  const [mode, setModeState] = useState<AppMode>("real");
  const [switching, setSwitching] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!user || !isStaff) {
      setModeState("real");
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("active_mode")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (active) setModeState((data?.active_mode as AppMode) ?? "real");
      });
    return () => {
      active = false;
    };
  }, [user, isStaff, loading]);

  async function setMode(m: AppMode) {
    if (!isAdmin || m === mode) return;
    setSwitching(true);
    const { error } = await supabase.rpc("set_active_mode", { _mode: m });
    setSwitching(false);
    if (error) throw error;
    setModeState(m);
    qc.clear(); // drop every cached query so no cross-mode data lingers
  }

  return <Ctx.Provider value={{ mode, isDemo: mode === "demo", switching, setMode }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);

/**
 * Mode-aware table name. Returns a loosely-typed name because the union of
 * real/demo table names cannot be resolved to one table type by the client;
 * demo tables mirror the real schema column-for-column.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mt = (mode: AppMode, table: string): any => (mode === "demo" ? `demo_${table}` : table);

/**
 * Mode-aware query builder. Untyped on purpose: the real/demo table-name union
 * cannot resolve to one table type, and demo tables mirror the real schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mfrom = (mode: AppMode, table: string): any => supabase.from(mt(mode, table) as never);

/**
 * Mode-aware embedded relation for select strings. Aliases the embed to the
 * base table name so result shapes are identical in both modes.
 */
export const rel = (mode: AppMode, table: string, cols: string) => `${table}:${mode === "demo" ? `demo_${table}` : table}(${cols})`;
