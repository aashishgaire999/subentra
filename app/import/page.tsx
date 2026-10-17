"use client";

import { useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { Badge, Button, Card, PageHeader, Restricted, SignOffDialog } from "@/components/ui";
import { useStore } from "@/lib/store";
import { runRateByContract } from "@/lib/finance";
import { cellToString, CLOSED_THROUGH, COLUMNS, COMPANY_CODE, fileSha256, MAX_BYTES, parseCsv, sampleFile, validate, type ValidationResult } from "@/lib/importer";
import { fmtDateTime, usd } from "@/lib/format";
import { vendors } from "@/lib/seed";

const vendorName = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

interface Checked { fileName: string; hash: string; size: number; result: ValidationResult; batchId: string }

export default function ImportPage() {
  const { lines, batches, can, commitImport, rollbackImport } = useStore();
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"commit" | { rollback: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const existingDocs = useMemo(() => new Set(lines.map((l) => l.documentNumber)), [lines]);

  if (!can("import:commit") && !can("audit:view")) return <><PageHeader title="Import SAP actuals" /><Restricted what="Data import" /></>;

  async function handle(file: File) {
    setError("");
    setChecked(null);
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "xlsx") return setError("Only .csv or .xlsx files built from the SUBENTRA template are accepted.");
    if (file.size > MAX_BYTES) return setError("File is larger than 5 MB.");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const hash = await fileSha256(buf);
      if (batches.some((b) => b.fileHash === hash && b.status === "committed")) {
        setError("This exact file was already imported. Duplicate blocked.");
        return;
      }
      const table = ext === "csv"
        ? parseCsv(new TextDecoder().decode(buf))
        : (await readSheet(file)).map((r) => r.map(cellToString));
      const batchId = `b-${hash.slice(0, 8)}`;
      setChecked({ fileName: file.name, hash, size: file.size, result: validate(table, batchId, existingDocs), batchId });
    } catch {
      setError("Could not read the file. Make sure it is a valid CSV or Excel workbook.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const r = checked?.result;
  const passed = r && r.fileErrors.length === 0 && r.rowErrors.length === 0 && r.lines.length > 0;
  const total = r?.lines.reduce((s, l) => s + l.amount, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Import SAP actuals"
        description={`Strict template · all-or-nothing · periods through ${CLOSED_THROUGH} are locked · company code ${COMPANY_CODE} only`}
        actions={<>
          <Button variant="secondary" onClick={() => download("subentra_actuals_template.csv", COLUMNS.join(",") + "\n")}>Template</Button>
          <Button variant="secondary" onClick={() => download("sap_actuals_2026-10.csv", sampleFile(runRateByContract(lines)))}>Sample (valid)</Button>
          <Button variant="secondary" onClick={() => download("sap_actuals_2026-10_bad.csv", sampleFile(runRateByContract(lines), true))}>Sample (with errors)</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line-strong px-6 py-10 text-center hover:border-accent hover:bg-accent-soft/40 ${!can("import:commit") ? "pointer-events-none opacity-50" : ""}`}
            >
              <span className="text-sm font-medium">{busy ? "Checking file…" : "Drop a SAP export here, or click to choose"}</span>
              <span className="mt-1 text-xs text-muted">.csv or .xlsx · max 5 MB · 50,000 rows</span>
              <input ref={inputRef} type="file" accept=".csv,.xlsx" className="sr-only" disabled={!can("import:commit")} onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
            </label>
            {!can("import:commit") && <p className="mt-2 text-xs text-muted">Your role can view import history but not upload.</p>}
            {error && <p className="mt-3 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
          </Card>

          {checked && r && (
            <Card title={checked.fileName} action={passed ? <Badge tone="pos">Ready to import</Badge> : <Badge tone="neg">Rejected</Badge>}>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><div className="text-xs text-muted">Rows</div><div className="num font-semibold">{r.rowCount}</div></div>
                <div><div className="text-xs text-muted">Valid</div><div className="num font-semibold text-pos">{r.lines.length}</div></div>
                <div><div className="text-xs text-muted">Errors</div><div className={`num font-semibold ${r.rowErrors.length ? "text-neg" : ""}`}>{r.rowErrors.length + r.fileErrors.length}</div></div>
                <div><div className="text-xs text-muted">Total (valid)</div><div className="num font-semibold">{usd(total)}</div></div>
              </div>
              <p className="num mt-3 truncate text-xs text-subtle">sha256 {checked.hash}</p>

              {r.fileErrors.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{r.fileErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              )}

              {r.rowErrors.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold">Fix these rows and upload again — nothing was imported</h3>
                  <div className="max-h-72 overflow-auto rounded-md border border-line">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg text-left text-xs text-muted"><tr><th className="px-3 py-1.5 font-medium">Row</th><th className="font-medium">Column</th><th className="font-medium">Problem</th></tr></thead>
                      <tbody>{r.rowErrors.map((e, i) => (
                        <tr key={i} className="border-t border-line"><td className="num px-3 py-1.5">{e.row}</td><td className="num text-xs">{e.column}</td><td className="text-neg">{e.message}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {passed && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold">Preview</h3>
                  <div className="max-h-72 overflow-auto rounded-md border border-line">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg text-left text-xs text-muted"><tr><th className="px-3 py-1.5 font-medium">Date</th><th className="font-medium">Vendor</th><th className="font-medium">Contract</th><th className="font-medium">Doc #</th><th className="pr-3 text-right font-medium">Amount</th></tr></thead>
                      <tbody className="num">{r.lines.map((l) => (
                        <tr key={l.id} className="border-t border-line"><td className="px-3 py-1.5">{l.postingDate}</td><td className="font-sans">{vendorName[l.vendorId]}</td><td>{l.contractId}</td><td>{l.documentNumber}</td><td className="pr-3 text-right">{usd(l.amount)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setChecked(null)}>Discard</Button>
                    <Button onClick={() => setConfirm("commit")}>Import {r.lines.length} rows</Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Template rules">
            <ul className="space-y-1.5 text-xs text-muted">
              <li><span className="num text-fg">{COLUMNS.join(", ")}</span></li>
              <li>• Dates as YYYY-MM-DD, USD only</li>
              <li>• Cost center, GL, vendor and contract must exist</li>
              <li>• 10-digit SAP document numbers, never re-imported</li>
              <li>• Formulas and instruction-like text are blocked</li>
              <li>• One bad row rejects the whole file</li>
              <li>• Same file twice is blocked by its SHA-256</li>
            </ul>
          </Card>
          <Card title="Import history">
            {batches.length === 0 ? <p className="text-sm text-muted">Only the initial seed load so far.</p> : (
              <ul className="space-y-3">
                {batches.map((b) => (
                  <li key={b.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{b.fileName}</span>{b.status === "committed" ? <Badge tone="pos">Live</Badge> : <Badge>Rolled back</Badge>}</div>
                    <div className="num text-xs text-muted">{b.rowCount} rows · {usd(b.total)}</div>
                    <div className="text-xs text-muted">{b.importedBy} · {fmtDateTime(b.importedAt)}</div>
                    {b.status === "committed" && can("import:rollback") && <Button variant="danger" className="mt-1.5 h-7 text-xs" onClick={() => setConfirm({ rollback: b.id })}>Roll back</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {confirm === "commit" && checked && r && (
        <SignOffDialog title="Import SAP actuals" summary={`${r.lines.length} rows · ${usd(total)} from ${checked.fileName}`} confirmLabel="Sign & import" onClose={() => setConfirm(null)}
          onConfirm={async (reason) => {
            await commitImport({ id: checked.batchId, fileName: checked.fileName, fileHash: checked.hash, rowCount: r.lines.length, total }, r.lines, reason);
            setChecked(null);
          }} />
      )}
      {confirm && typeof confirm === "object" && (
        <SignOffDialog title="Roll back import" summary="All rows from this file are removed from every report. The batch record stays in the audit log." confirmLabel="Sign & roll back" onClose={() => setConfirm(null)}
          onConfirm={(reason) => rollbackImport(confirm.rollback, reason)} />
      )}
    </>
  );
}
