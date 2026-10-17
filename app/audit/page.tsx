"use client";

import { useState } from "react";
import { Badge, Button, Card, PageHeader, Restricted, Segmented } from "@/components/ui";
import { useStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";

export default function AuditPage() {
  const { audit, ai, can, verifyChain, tamperDemo, user } = useStore();
  const [tab, setTab] = useState<"changes" | "ai">("changes");
  const [check, setCheck] = useState<{ ok: boolean; brokenAt: number | null } | null>(null);

  if (!can("audit:view")) return <><PageHeader title="Audit & AI log" /><Restricted what="The audit log" /></>;

  return (
    <>
      <PageHeader
        title="Audit & AI log"
        description="Append-only. Each change is signed by a named user with a reason and linked to the previous entry by SHA-256."
        actions={<>
          <Button variant="secondary" onClick={async () => setCheck(await verifyChain())}>Verify integrity</Button>
          {user.role === "admin" && <Button variant="danger" onClick={() => { tamperDemo(); setCheck(null); }} title="Demo: edits entry #1 without re-hashing">Simulate tamper</Button>}
        </>}
      />

      {check && (
        <div className={`mb-4 rounded-md px-4 py-3 text-sm ${check.ok ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"}`} role="status">
          {check.ok ? `✓ Chain intact — all ${audit.length} entries verified.` : `✕ Chain broken at entry #${check.brokenAt}. The record was altered after it was written.`}
        </div>
      )}

      <Card title={tab === "changes" ? `Changes (${audit.length})` : `AI interactions (${ai.length})`} action={
        <Segmented value={tab} onChange={setTab} options={[{ value: "changes", label: "Changes" }, { value: "ai", label: "AI log" }]} />
      }>
        {tab === "changes" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1.5 font-medium">#</th><th className="font-medium">When</th><th className="font-medium">Who</th><th className="font-medium">Action</th><th className="font-medium">Change</th><th className="font-medium">Reason</th><th className="font-medium">Hash</th></tr>
              </thead>
              <tbody>
                {audit.slice().reverse().map((e) => (
                  <tr key={e.seq} className="border-t border-line align-top">
                    <td className="num py-2 text-muted">{e.seq}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(e.at)}</td>
                    <td className="whitespace-nowrap">{e.userName}</td>
                    <td><Badge>{e.action}</Badge><div className="num mt-0.5 text-xs text-muted">{e.entity} {e.entityId}</div></td>
                    <td className="text-xs">{e.before ? <><span className="text-muted line-through">{e.before}</span> → </> : null}{e.after}</td>
                    <td className="max-w-56 text-xs">{e.reason}</td>
                    <td className="num text-xs text-subtle" title={`prev ${e.prevHash}`}>{e.hash.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ai.length === 0 ? (
          <p className="text-sm text-muted">No AI calls yet. Use &ldquo;Explain with AI&rdquo; on any page; each call is recorded here with exactly what the AI was allowed to see.</p>
        ) : (
          <ul className="divide-y divide-line">
            {ai.map((i) => (
              <li key={i.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{i.kind}</Badge>
                  <span className="text-muted">{i.userName} · {fmtDateTime(i.at)} · {i.model}</span>
                  {i.redactions > 0 && <Badge tone="warn">{i.redactions} redacted</Badge>}
                </div>
                <p className="mt-1.5">{i.summary}{i.summary.length >= 180 ? "…" : ""}</p>
                <p className="mt-1 text-xs text-muted">Data scope: {i.fieldsSent.length} aggregate fields — <span className="num">{i.fieldsSent.join(", ")}</span>. No raw rows, names or document numbers.</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
