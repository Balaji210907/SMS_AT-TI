import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().email().max(255),
  full_name: z.string().trim().min(2).max(100),
  password: z.string().min(9).regex(/[A-Z]/).regex(/[a-z]/).regex(/[^A-Za-z0-9]/),
});

/** Admin-only: creates a staff login. Role is assigned by the signup trigger from app metadata, which users cannot edit. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Only administrators can create staff accounts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
      app_metadata: { invited_role: "staff" },
    });
    if (res.error) throw new Error(res.error.message);
    await supabaseAdmin.from("audit_logs").insert({ actor: context.userId, action: "staff_created", entity_type: "user", entity_id: res.data.user.id, metadata: { email: data.email } });
    return { id: res.data.user.id };
  });
