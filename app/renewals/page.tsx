"use client";

import { useState } from "react";
import { Badge, Card, Kpi, PageHeader, Segmented, SignOffDialog } from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { useStore } from "@/lib/store";
import { categories, departments, vendors } from "@/lib/seed";
import { daysToNotice, isActive, noticeDeadline, runRateByContract, urgency } from "@/lib/finance";
import { fmtDate, pct, usd, usdShort } from "@/lib/format";
import type { Contract, RenewalDecision } from "@/lib/types";

const vendorById = Object.fromEntries(vendors.map((v) => [v.id, v]));
const deptName = Object.fromEntries(departments.map((d) => [d.id, d.name]));
const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

const urgencyBadge = {
  overdue: <Badge tone="neg">Notice missed</Badge>,
  critical: <Badge tone="neg">≤ 30 days</Badge>,
  soon: <Badge tone="warn">≤ 90 days</Badge>,
  later: <Badge>Later</Badge>,
};

export default function RenewalsPage() {
  const { contracts, lines, can, decideRenewal } = useStore();
  const [view, setView] = useState<"attention" | "active" | "all">("attention");
  const [pending, setPending] = useState<{ c: Contract; d: RenewalDecision } | null>(null);
  const rr = runRateByContract(lines);

  const active = contracts.filter(isActive);
  const attention = active.filter((c) => urgency(c) !== "later" && c.decision === "undecided");
  const list = (view === "attention" ? attention : view === "active" ? active : contracts).slice().sort((a, b) => daysToNotice(a) - daysToNotice(b));
  const count = (u: string) => active.filter((c) => urgency(c) === u && c.decision === "undecided").length;
  const valueAtRisk = attention.reduce((s, c) => s + (rr[c.id] ?? 0), 0);
  const autoRenewTraps = attention.filter((c) => c.autoRenew).length;

  const facts = () => ({
    contracts_needing_attention: attention.length,
    notice_missed: count("overdue"),
    due_within_30_days: count("critical"),
    due_within_90_days: count("soon"),
    annual_value_at_risk: valueAtRisk,
    auto_renew_contracts_in_window: autoRenewTraps,
    most_urgent_vendor: attention[0] ? vendorById[attention[0].vendorId].name : "none",
    most_urgent_days_left: attention[0] ? daysToNotice(attention.slice().sort((a, b) => daysToNotice(a) - daysToNotice(b))[0]) : 0,
  });

  return (
    <>
      <PageHeader
        title="Renewals"
        description="Termination notice deadlines. Decide before the deadline, or the contract renews on the vendor's terms."
        actions={<ExplainButton kind="renewals" facts={facts} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Notice missed" value={String(count("overdue"))} sub="Deadline passed, no decision" tone={count("overdue") ? "neg" : "default"} />
        <Kpi label="Due ≤ 30 days" value={String(count("critical"))} tone={count("critical") ? "neg" : "default"} sub="Act this month" />
        <Kpi label="Due ≤ 90 days" value={String(count("soon"))} tone="warn" sub="Start negotiation" />
        <Kpi label="Annual value needing a decision" value={usdShort(valueAtRisk)} sub={`${autoRenewTraps} auto-renew`} />
      </div>

      <Card className="mt-4" title="Contracts" action={
        <Segmented value={view} onChange={setView} options={[{ value: "attention", label: `Needs attention (${attention.length})` }, { value: "active", label: `Active (${active.length})` }, { value: "all", label: `All (${contracts.length})` }]} />
      }>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1.5 font-medium">Vendor / contract</th><th className="font-medium">Dept · Category</th>
                <th className="text-right font-medium">FY AOP</th><th className="text-right font-medium">Run-rate</th><th className="text-right font-medium">Variance</th>
                <th className="font-medium">End</th><th className="font-medium">Invoice end</th><th className="font-medium">Notice by</th><th className="font-medium">Status</th><th className="font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const v = vendorById[c.vendorId];
                const run = rr[c.id] ?? 0;
                const variance = c.aopCurrentFy ? run / c.aopCurrentFy - 1 : 0;
                const days = daysToNotice(c);
                return (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="py-2"><div className="font-medium">{v.name}</div><div className="text-xs text-muted">{c.title} · {v.description}</div></td>
                    <td className="text-xs text-muted">{deptName[c.departmentId]}<br />{catName[c.categoryId]}</td>
                    <td className="num text-right">{usdShort(c.aopCurrentFy)}</td>
                    <td className="num text-right">{usdShort(run)}</td>
                    <td className={`num text-right ${variance > 0.02 ? "text-neg" : variance < -0.02 ? "text-pos" : ""}`}>{run ? pct(variance) : "—"}</td>
                    <td className="num text-xs">{fmtDate(c.endDate)}</td>
                    <td className="num text-xs">{fmtDate(c.invoiceEndDate)}</td>
                    <td className="num text-xs">{fmtDate(noticeDeadline(c))}<div className={days < 0 ? "text-neg" : "text-muted"}>{days < 0 ? `${-days}d ago` : `${days}d left`}</div></td>
                    <td className="space-y-1">{isActive(c) ? urgencyBadge[urgency(c)] : <Badge>Expired</Badge>}{c.autoRenew && isActive(c) && <div><Badge tone="warn">Auto-renew +{pct(c.upliftPct, 0)}</Badge></div>}</td>
                    <td>
                      {c.decision !== "undecided" ? (
                        <Badge tone={c.decision === "terminate" ? "neg" : c.decision === "renew" ? "pos" : "accent"}>{c.decision}</Badge>
                      ) : isActive(c) ? (
                        <select disabled={!can("renewal:decide")} defaultValue="" onChange={(e) => { setPending({ c, d: e.target.value as RenewalDecision }); e.target.value = ""; }}
                          className="h-7 rounded-md border border-line-strong bg-surface px-1.5 text-xs disabled:opacity-45" aria-label={`Decide on ${v.name}`}>
                          <option value="" disabled>Decide…</option>
                          <option value="renew">Renew</option>
                          <option value="renegotiate">Renegotiate</option>
                          <option value="terminate">Terminate</option>
                        </select>
                      ) : <span className="text-xs text-subtle">—</span>}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-muted">Nothing needs attention. Every deadline in the next 90 days has a decision.</td></tr>}
            </tbody>
          </table>
        </div>
        {!can("renewal:decide") && <p className="mt-3 text-xs text-muted">Your role can view renewals but not decide them.</p>}
      </Card>

      <Card className="mt-4" title="Before a notice deadline, check">
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>✓ Usage vs licences — are we paying for shelfware?</li>
          <li>✓ Uplift vs inflation — is the vendor increase above CPI?</li>
          <li>✓ Security review and DPA still valid (IT/IS)</li>
          <li>✓ Budget owner has AOP for next year</li>
          <li>✓ Alternative quotes for contracts over $250K</li>
          <li>✓ Written notice sent and acknowledged by vendor</li>
        </ul>
      </Card>

      {pending && (
        <SignOffDialog
          title={`${pending.d[0].toUpperCase() + pending.d.slice(1)} ${vendorById[pending.c.vendorId].name}?`}
          summary={<>Run-rate {usd(rr[pending.c.id] ?? 0)}/yr. This decision feeds straight into the forecast{pending.d === "terminate" ? " (spend drops after the end date)" : pending.d === "renegotiate" ? " (vendor uplift removed)" : " (vendor uplift applied)"}.</>}
          confirmLabel="Sign decision"
          onClose={() => setPending(null)}
          onConfirm={(reason) => decideRenewal(pending.c.id, pending.d, reason)}
        />
      )}
    </>
  );
}
