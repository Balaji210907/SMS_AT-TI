import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CSV/XLSX import into real business tables (admin only).
 * Idempotent per category: existing rows matched by unique business keys
 * (customer email, product name, plan name) are skipped, never duplicated.
 * Every row's outcome is reported; a batch record is always written.
 */

export type ImportCategory = "customers" | "products" | "plans";
export type ImportRow = Record<string, string>;

type RowResult = { row: number; status: "imported" | "skipped" | "failed"; message?: string };

const str = (r: ImportRow, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k]?.trim();
    if (v) return v;
  }
  return "";
};
const num = (r: ImportRow, ...keys: string[]) => {
  const v = str(r, ...keys);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const importRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { category: ImportCategory; fileName: string; rows: ImportRow[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can import data");
    if (!["customers", "products", "plans"].includes(data.category)) throw new Error("Unknown import category");
    if (data.rows.length === 0) throw new Error("The file contains no data rows");
    if (data.rows.length > 2000) throw new Error("Please import at most 2000 rows at a time");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: RowResult[] = [];

    if (data.category === "customers") {
      const emails = data.rows.map((r) => str(r, "email", "Email").toLowerCase()).filter(Boolean);
      const { data: existing } = await supabaseAdmin.from("customers").select("email").in("email", emails);
      const taken = new Set((existing ?? []).map((c) => c.email.toLowerCase()));
      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i]!;
        const name = str(r, "name", "Name", "customer", "Customer");
        const email = str(r, "email", "Email").toLowerCase();
        if (!name || !email) { results.push({ row: i + 1, status: "failed", message: "Missing name or email" }); continue; }
        if (taken.has(email)) { results.push({ row: i + 1, status: "skipped", message: `Customer with email ${email} already exists` }); continue; }
        const { error } = await supabaseAdmin.from("customers").insert({
          name, email,
          phone: str(r, "phone", "Phone") || null,
          company: str(r, "company", "Company") || null,
          address: str(r, "address", "Address") || null,
          tax_id: str(r, "tax_id", "Tax ID", "GST") || null,
          created_by: context.userId,
        });
        if (error) results.push({ row: i + 1, status: "failed", message: error.message });
        else { taken.add(email); results.push({ row: i + 1, status: "imported" }); }
      }
    }

    if (data.category === "products") {
      const names = data.rows.map((r) => str(r, "name", "Name", "product", "Product")).filter(Boolean);
      const { data: existing } = await supabaseAdmin.from("products").select("name").in("name", names);
      const taken = new Set((existing ?? []).map((p) => p.name));
      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i]!;
        const name = str(r, "name", "Name", "product", "Product");
        const price = num(r, "sales_price", "Sales Price", "price", "Price");
        if (!name || price === null || price < 0) { results.push({ row: i + 1, status: "failed", message: "Missing name or invalid sales price" }); continue; }
        if (taken.has(name)) { results.push({ row: i + 1, status: "skipped", message: `Product "${name}" already exists` }); continue; }
        const type = str(r, "product_type", "Type", "type").toLowerCase();
        const { error } = await supabaseAdmin.from("products").insert({
          name,
          product_type: ["product", "service"].includes(type) ? type : "service",
          sales_price: price,
          cost_price: num(r, "cost_price", "Cost Price", "cost") ?? 0,
          notes: str(r, "notes", "Notes") || null,
          created_by: context.userId,
        });
        if (error) results.push({ row: i + 1, status: "failed", message: error.message });
        else { taken.add(name); results.push({ row: i + 1, status: "imported" }); }
      }
    }

    if (data.category === "plans") {
      const names = data.rows.map((r) => str(r, "name", "Name", "plan", "Plan")).filter(Boolean);
      const { data: existing } = await supabaseAdmin.from("plans").select("name").in("name", names);
      const taken = new Set((existing ?? []).map((p) => p.name));
      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i]!;
        const name = str(r, "name", "Name", "plan", "Plan");
        const price = num(r, "price", "Price");
        const freq = str(r, "billing_frequency", "Frequency", "frequency").toLowerCase();
        if (!name || price === null || price < 0) { results.push({ row: i + 1, status: "failed", message: "Missing name or invalid price" }); continue; }
        if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) { results.push({ row: i + 1, status: "failed", message: "Frequency must be daily, weekly, monthly or yearly" }); continue; }
        if (taken.has(name)) { results.push({ row: i + 1, status: "skipped", message: `Plan "${name}" already exists` }); continue; }
        const { error } = await supabaseAdmin.from("plans").insert({
          name,
          description: str(r, "description", "Description") || null,
          billing_frequency: freq as "daily" | "weekly" | "monthly" | "yearly",
          price,
          created_by: context.userId,
        });
        if (error) results.push({ row: i + 1, status: "failed", message: error.message });
        else { taken.add(name); results.push({ row: i + 1, status: "imported" }); }
      }
    }

    const imported = results.filter((r) => r.status === "imported").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;
    await supabaseAdmin.from("import_batches").insert({
      category: data.category,
      file_name: data.fileName,
      total_rows: data.rows.length,
      imported,
      skipped,
      failed,
      status: failed === 0 ? "completed" : imported + skipped > 0 ? "completed_with_errors" : "failed",
      report: results.filter((r) => r.status !== "imported"),
      created_by: context.userId,
    });

    return { imported, skipped, failed, results };
  });
