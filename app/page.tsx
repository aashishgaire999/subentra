"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, Kpi, PageHeader, Segmented } from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { useStore } from "@/lib/store";
import { budgets, categories, CURRENT_FY, departments, FIRST_FY, vendors } from "@/lib/seed";
import { actualByYear, aopByYear, daysBetween, daysToNotice, isActive, latestPeriod, sumBy, urgency } from "@/lib/finance";
import { fmtDateTime, monthLabel, pct, usd, usdShort } from "@/lib/format";
import { TODAY } from "@/lib/seed";

const years = Array.from({ length: CURRENT_FY - FIRST_FY + 1 }, (_, i) => FIRST_FY + i);
const vendorName = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
const tick = { fontSize: 12, fill: "var(--muted)" };

export default function Dashboard() {
  const { lines, contracts, audit, ai, can } = useStore();
  const [fy, setFy] = useState(CURRENT_FY);
  const [grain, setGrain] = useState<"month" | "quarter">("month");

  const last = latestPeriod(lines);
  const monthsDone = last.startsWith(String(fy)) ? Number(last.slice(5)) : 12;
  const byYear = useMemo(() => actualByYear(lines), [lines]);
  const aop = aopByYear(budgets);
  const actual = byYear[fy] ?? 0;
  const aopYtd = (aop[fy] ?? 0) * (monthsDone / 12);
  const variance = actual - aopYtd;

  const active = contracts.filter(isActive);
  const expiring = active.filter((c) => daysBetween(TODAY, c.endDate) <= 90);
  const needNotice = active.filter((c) => urgency(c) !== "later" && c.decision === "undecided");

  const fyLines = useMemo(() => lines.filter((l) => l.period.startsWith(String(fy))), [lines, fy]);
  const byPeriod = sumBy(fyLines, (l) => (grain === "month" ? l.period : `Q${Math.ceil(Number(l.period.slice(5)) / 3)}`), (l) => l.amount);
  const spendSeries = Object.entries(byPeriod).sort().map(([k, v]) => ({ label: grain === "month" ? monthLabel(k) : k, spend: v }));

  const deptActual = sumBy(fyLines, (l) => l.departmentId, (l) => l.amount);
  const prevDept = sumBy(lines.filter((l) => l.period.startsWith(String(fy - 1)) && l.period.slice(5) <= String(monthsDone).padStart(2, "0")), (l) => l.departmentId, (l) => l.amount);
  const catActual = sumBy(fyLines, (l) => l.categoryId, (l) => l.amount);
  const catRows = categories.map((c) => ({ name: c.name, v: catActual[c.id] ?? 0 })).sort((a, b) => b.v - a.v);
  const catMax = Math.max(...catRows.map((c) => c.v), 1);

  const activity = [
    ...audit.map((e) => ({ at: e.at, who: e.userName, text: `${e.action} · ${e.entityId}`, sub: e.reason, ai: false })),
    ...ai.map((i) => ({ at: i.at, who: i.userName, text: `AI explained ${i.kind}`, sub: i.summary, ai: true })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  const facts = () => ({
    fiscal_year: fy,
    months_closed: monthsDone,
    actual_ytd: actual,
    aop_full_year: aop[fy] ?? 0,
    aop_ytd_prorated: aopYtd,
    variance_vs_aop_ytd: variance,
    pct_of_annual_aop_used: (actual / (aop[fy] || 1)) * 100,
    active_contracts: active.length,
    contracts_expiring_90d: expiring.length,
    notice_decisions_pending: needNotice.length,
    largest_category: catRows[0]?.name ?? "",
    largest_category_spend: catRows[0]?.v ?? 0,
  });

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Actuals loaded through ${monthLabel(last)} ${last.slice(0, 4)}. Figures in USD.`}
        actions={<>
          <select value={fy} onChange={(e) => setFy(Number(e.target.value))} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm" aria-label="Fiscal year">
            {years.map((y) => <option key={y} value={y}>FY{y}</option>)}
          </select>
          <ExplainButton kind="executive-summary" facts={facts} label="Executive summary" />
          <Button variant="secondary" onClick={() => window.print()}>Print report</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={`Actual spend FY${fy}${monthsDone < 12 ? " YTD" : ""}`} value={usdShort(actual)} sub={`${pct(actual / (aop[fy] || 1), 0)} of annual AOP used`} />
        <Kpi label={`AOP FY${fy}`} value={usdShort(aop[fy] ?? 0)} sub={monthsDone < 12 ? `${usdShort(aopYtd)} pro-rata YTD` : "Full year"} />
        <Kpi label="Variance vs AOP" value={usdShort(variance)} sub={variance > 0 ? "Over plan" : "Under plan"} tone={variance > 0 ? "neg" : "pos"} />
        <Kpi label="Active contracts" value={String(active.length)} sub={`${contracts.length} total`} />
        <Kpi label="Expiring ≤ 90 days" value={String(expiring.length)} sub={`${needNotice.length} notice decisions pending`} tone={needNotice.length ? "warn" : "default"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="AOP vs Actual by year">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={years.map((y) => ({ year: `FY${y}`, AOP: aop[y] ?? 0, Actual: byYear[y] ?? 0 }))} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="year" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={usdShort} tick={tick} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => usd(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="AOP" fill="var(--chart-grey)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Actual" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted">FY{CURRENT_FY} actual is year to date.</p>
        </Card>

        <Card title={`${grain === "month" ? "Monthly" : "Quarterly"} spend FY${fy}`} action={<Segmented value={grain} onChange={setGrain} options={[{ value: "month", label: "Month" }, { value: "quarter", label: "Quarter" }]} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={spendSeries} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={usdShort} tick={tick} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => usd(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="spend" name="Spend" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title={`Department budgets FY${fy}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1.5 font-medium">Department</th><th className="text-right font-medium">Approved AOP</th><th className="text-right font-medium">Actual</th><th className="w-40 pl-4 font-medium">% used</th><th className="text-right font-medium">YoY</th></tr>
              </thead>
              <tbody>
                {departments.map((d) => {
                  const b = budgets.find((x) => x.departmentId === d.id && x.fiscalYear === fy)?.amount ?? 0;
                  const a = deptActual[d.id] ?? 0;
                  const used = a / (b || 1);
                  const pace = monthsDone / 12;
                  const yoy = prevDept[d.id] ? a / prevDept[d.id] - 1 : 0;
                  return (
                    <tr key={d.id} className="border-t border-line">
                      <td className="py-2 font-medium">{d.name}<span className="ml-1.5 text-xs font-normal text-subtle">{d.costCenter}</span></td>
                      <td className="num text-right">{usdShort(b)}</td>
                      <td className="num text-right">{usdShort(a)}</td>
                      <td className="pl-4">
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 flex-1 rounded-full bg-bg">
                            <div className={`h-1.5 rounded-full ${used > pace + 0.03 ? "bg-neg" : "bg-accent"}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
                            <div className="absolute -top-1 h-3.5 w-px bg-fg/40" style={{ left: `${pace * 100}%` }} title="Expected pace" />
                          </div>
                          <span className="num w-10 text-right text-xs">{pct(used, 0)}</span>
                        </div>
                      </td>
                      <td className={`num text-right text-xs ${yoy > 0.08 ? "text-neg" : "text-muted"}`}>{prevDept[d.id] ? pct(yoy) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Tick mark = expected pace for {monthsDone} of 12 months. YoY compares the same months last year.</p>
        </Card>

        <Card title="Category breakdown">
          <ul className="space-y-2.5">
            {catRows.map((c) => (
              <li key={c.name}>
                <div className="flex justify-between text-sm"><span>{c.name}</span><span className="num">{usdShort(c.v)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-bg"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${(c.v / catMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Notice deadlines needing a decision" action={<Link href="/renewals" className="text-xs font-medium text-accent">All renewals →</Link>}>
          {needNotice.length === 0 ? <p className="text-sm text-muted">All clear.</p> : (
            <ul className="divide-y divide-line">
              {needNotice.sort((a, b) => daysToNotice(a) - daysToNotice(b)).slice(0, 5).map((c) => {
                const d = daysToNotice(c);
                return (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span><span className="font-medium">{vendorName[c.vendorId]}</span> <span className="text-muted">· {c.title}</span></span>
                    <Badge tone={d < 0 ? "neg" : d <= 30 ? "neg" : "warn"}>{d < 0 ? `${-d}d overdue` : `${d}d left`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" action={can("audit:view") ? <Link href="/audit" className="text-xs font-medium text-accent">Full audit log →</Link> : <Badge>Executives & admins</Badge>}>
          {can("audit:view") ? (
            <ul className="space-y-2.5">
              {activity.map((a, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center gap-2">{a.ai ? <Badge tone="accent">AI</Badge> : <Badge>Change</Badge>}<span className="truncate font-medium">{a.text}</span></div>
                  <div className="mt-0.5 truncate text-xs text-muted">{a.who} · {fmtDateTime(a.at)} · {a.sub}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">The activity feed is visible to executives and admins.</p>}
        </Card>
      </div>
    </>
  );
}
