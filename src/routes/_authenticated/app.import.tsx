import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data";
import { dateTime } from "@/lib/format";
import { importRows, type ImportCategory, type ImportRow } from "@/lib/import.functions";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel, StatusBadge, td, th } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/import")({ component: ImportPage });

const HINTS: Record<ImportCategory, string> = {
  customers: "Columns: name, email (required), phone, company, address, tax_id",
  products: "Columns: name, sales_price (required), cost_price, product_type (product|service), notes",
  plans: "Columns: name, price, billing_frequency (daily|weekly|monthly|yearly), description",
};

async function parseFile(file: File): Promise<ImportRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const out = Papa.parse<ImportRow>(text, { header: true, skipEmptyLines: true });
    return out.data;
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    return XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
  }
  throw new Error("Unsupported file type — use .csv or .xlsx");
}

function ImportPage() {
  const runImport = useServerFn(importRows);
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ImportCategory>("customers");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number; results: { row: number; status: string; message?: string }[] } | null>(null);
  const batches = useData(["import-batches"], () => supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(20));

  async function pick(file: File | undefined) {
    if (!file) return;
    setResult(null);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
      setFileName(file.name);
      if (!parsed.length) toast.error("The file contains no data rows");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file");
    }
  }

  async function go() {
    setBusy(true);
    try {
      const res = await runImport({ data: { category, fileName, rows } });
      setResult(res);
      toast.success(`Import finished: ${res.imported} imported, ${res.skipped} skipped, ${res.failed} failed`);
      batches.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Import data" description="Load customers, products and plans from CSV or Excel into Real Business Mode. Existing records are skipped, never duplicated." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upload">
          <div className="space-y-4 p-5">
            <Field label="What are you importing?" hint={HINTS[category]}>
              <Select value={category} onValueChange={(v) => { setCategory(v as ImportCategory); setRows([]); setFileName(""); setResult(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="plans">Plans</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />{fileName || "Choose CSV or Excel file"}</Button>
            {rows.length > 0 && (
              <>
                <div className="text-sm text-muted-foreground">{rows.length} rows found. Preview of the first 5:</div>
                <div className="max-h-48 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-muted/40"><tr>{Object.keys(rows[0]!).slice(0, 6).map((k) => <th key={k} className="px-2 py-1.5 text-left font-medium">{k}</th>)}</tr></thead>
                    <tbody className="divide-y">{rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>{Object.keys(rows[0]!).slice(0, 6).map((k) => <td key={k} className="px-2 py-1.5">{String(r[k] ?? "")}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
                <Button onClick={go} disabled={busy}>{busy ? "Importing…" : `Import ${rows.length} rows`}</Button>
              </>
            )}
          </div>
        </Panel>
        <Panel title="Result">
          {!result ? <Empty title="No import run yet" hint="Choose a file and run the import to see per-row results here." /> : (
            <div className="p-5">
              <div className="mb-3 flex gap-4 text-sm">
                <span className="font-medium text-success">{result.imported} imported</span>
                <span className="font-medium text-muted-foreground">{result.skipped} skipped</span>
                <span className="font-medium text-destructive">{result.failed} failed</span>
              </div>
              {result.results.filter((r) => r.status !== "imported").length > 0 && (
                <ul className="max-h-64 space-y-1 overflow-auto text-xs">
                  {result.results.filter((r) => r.status !== "imported").map((r) => (
                    <li key={r.row} className={r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>Row {r.row}: {r.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Import history" className="mt-4">
        {batches.isLoading ? <Loading /> : batches.error ? <ErrorBox error={batches.error} /> : !batches.data?.length ? <Empty title="No imports yet" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b bg-muted/40"><tr><th className={th}>When</th><th className={th}>Category</th><th className={th}>File</th><th className={`${th} text-right`}>Rows</th><th className={`${th} text-right`}>Imported</th><th className={`${th} text-right`}>Skipped</th><th className={`${th} text-right`}>Failed</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y">{batches.data.map((b) => (
              <tr key={b.id}>
                <td className={`${td} whitespace-nowrap`}>{dateTime(b.created_at)}</td>
                <td className={`${td} capitalize`}>{b.category}</td>
                <td className={td}>{b.file_name}</td>
                <td className={`${td} num text-right`}>{b.total_rows}</td>
                <td className={`${td} num text-right`}>{b.imported}</td>
                <td className={`${td} num text-right`}>{b.skipped}</td>
                <td className={`${td} num text-right`}>{b.failed}</td>
                <td className={td}><StatusBadge status={b.status} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}
