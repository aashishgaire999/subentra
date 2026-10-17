"use client";

import { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, Kpi, PageHeader, SignOffDialog } from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { useStore } from "@/lib/store";
import { budgets, CURRENT_FY, departments, FIRST_FY, vendors } from "@/lib/seed";
import { actualByYear, aopByYear, backtest, cagr, forecast, growthVolatility, landingEstimate, runRateByContract } from "@/lib/finance";
import { pct, usd, usdShort } from "@/lib/format";
import type { ForecastAssumption } from "@/lib/types";

const LAST_FULL_FY = CURRENT_FY - 1;
const vendorName = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
const deptName = Object.fromEntries(departments.map((d) => [d.id, d.name]));

function Slider({ label, value, min, max, step, unit, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="num text-sm font-semibold text-accent">{value}{unit}</span>
      </div>
      <input type="range" className="mt-2 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function ForecastPage() {
  const { lines, contracts, plans, can, savePlan } = useStore();
  const [scope, setScope] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const scopedLines = useMemo(() => (scope === "all" ? lines : lines.filter((l) => l.departmentId === scope)), [lines, scope]);
  const scopedBudgets = useMemo(() => (scope === "all" ? budgets : budgets.filter((b) => b.departmentId === scope)), [scope]);
  const byYear = useMemo(() => actualByYear(scopedLines), [scopedLines]);
  const aop = useMemo(() => aopByYear(scopedBudgets), [scopedBudgets]);
  const histCagr = cagr(byYear, FIRST_FY, LAST_FULL_FY);
  const vol = growthVolatility(byYear, FIRST_FY, LAST_FULL_FY);

  const [a, setA] = useState<Omit<ForecastAssumption, "departmentId">>(() => {
    const all = actualByYear(lines);
    const g = cagr(all, FIRST_FY, LAST_FULL_FY);
    return { inflationPct: 3, realGrowthPct: Math.round(((1 + g) / 1.03 - 1) * 1000) / 10, horizonYears: 3, spreadPct: Math.round(growthVolatility(all, FIRST_FY, LAST_FULL_FY) * 1000) / 10 };
  });
  const assumption: ForecastAssumption = { ...a, departmentId: scope };
  const nominal = (1 + a.inflationPct / 100) * (1 + a.realGrowthPct / 100) - 1;

  const landing = landingEstimate(scopedLines, CURRENT_FY);
  const fc = useMemo(() => forecast(scopedLines, contracts, assumption, CURRENT_FY), [scopedLines, contracts, a.inflationPct, a.realGrowthPct, a.horizonYears, a.spreadPct, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = fc[fc.length - 1];

  const chart = [
    ...Array.from({ length: CURRENT_FY - FIRST_FY }, (_, i) => FIRST_FY + i).map((y) => ({ year: String(y), actual: byYear[y] ?? 0, aop: aop[y] })),
    { year: `${CURRENT_FY}e`, landing: landing.estimate, aop: aop[CURRENT_FY], base: landing.estimate, band: [landing.estimate, landing.estimate] as [number, number] },
    ...fc.map((p) => ({ year: String(p.year), base: p.base, band: [p.low, p.high] as [number, number], aop: aop[p.year] })),
  ];

  const tests = backtest(byYear, FIRST_FY, [FIRST_FY + 2, FIRST_FY + 3]);
  const mape = tests.reduce((s, t) => s + Math.abs(t.errorPct), 0) / tests.length;

  const rr = runRateByContract(scopedLines);
  const horizonEnd = `${CURRENT_FY + a.horizonYears}-12-31`;
  const rows = contracts
    .filter((c) => (scope === "all" || c.departmentId === scope) && rr[c.id])
    .map((c) => {
      const renewsInHorizon = c.endDate <= horizonEnd;
      return { c, run: rr[c.id], next: rr[c.id] * (1 + nominal) * (c.endDate < `${CURRENT_FY + 1}-01-01` && c.decision !== "renegotiate" ? 1 + c.upliftPct : 1), renewsInHorizon, exposure: renewsInHorizon && c.decision !== "terminate" ? rr[c.id] * c.upliftPct : 0 };
    })
    .sort((x, y) => y.run - x.run);
  const upliftExposure = rows.reduce((s, r) => s + r.exposure, 0);

  const facts = () => ({
    scope: scope === "all" ? "All departments" : deptName[scope],
    historical_cagr_pct: histCagr * 100,
    inflation_pct: a.inflationPct,
    real_growth_pct: a.realGrowthPct,
    nominal_growth_pct: nominal * 100,
    fy_current_landing_estimate: landing.estimate,
    fy_current_aop: aop[CURRENT_FY] ?? 0,
    forecast_final_year: last?.year ?? 0,
    forecast_final_base: last?.base ?? 0,
    forecast_final_low: last?.low ?? 0,
    forecast_final_high: last?.high ?? 0,
    renewal_uplift_exposure: upliftExposure,
    backtest_mean_abs_error_pct: mape * 100,
  });

  return (
    <>
      <PageHeader
        title="Forecast"
        description="Project spend from today's run-rate. Move the sliders; every contract renewal and decision flows through."
        actions={<>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm" aria-label="Scope">
            <option value="all">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <ExplainButton kind="forecast" facts={facts} />
          <Button disabled={!can("plan:save")} title={can("plan:save") ? "" : "Your role cannot save plans"} onClick={() => setSaving(true)}>Save as plan</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card title="Assumptions">
          <div className="space-y-5">
            <div className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent">
              Historical CAGR FY{FIRST_FY}–FY{LAST_FULL_FY}: <strong className="num">{pct(histCagr)}</strong> · volatility <span className="num">{pct(vol)}</span>
            </div>
            <Slider label="Inflation" value={a.inflationPct} min={0} max={10} step={0.1} unit="%" onChange={(v) => setA({ ...a, inflationPct: v })} />
            <Slider label="Real growth" value={a.realGrowthPct} min={-10} max={15} step={0.1} unit="%" onChange={(v) => setA({ ...a, realGrowthPct: v })} hint="Volume and scope growth above inflation." />
            <Slider label="Time horizon" value={a.horizonYears} min={1} max={5} step={1} unit=" yrs" onChange={(v) => setA({ ...a, horizonYears: v })} />
            <Slider label="Uncertainty band" value={a.spreadPct} min={0} max={10} step={0.1} unit="%" onChange={(v) => setA({ ...a, spreadPct: v })} hint="Defaults to historical volatility." />
            <div className="border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Nominal growth</span><span className="num font-semibold">{pct(nominal)}</span></div>
              <p className="mt-1 text-xs text-subtle">(1 + inflation) × (1 + real) − 1</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label={`FY${CURRENT_FY} landing estimate`} value={usdShort(landing.estimate)} sub={`${pct(landing.estimate / (aop[CURRENT_FY] || 1) - 1)} vs AOP`} tone={landing.estimate > (aop[CURRENT_FY] ?? 0) ? "neg" : "pos"} />
            <Kpi label={`FY${last?.year} forecast`} value={usdShort(last?.base ?? 0)} sub={`${usdShort(last?.low ?? 0)} – ${usdShort(last?.high ?? 0)}`} />
            <Kpi label="Renewal uplift exposure" value={usdShort(upliftExposure)} sub="Vendor increases due in horizon" tone="warn" />
            <Kpi label="Method accuracy (backtest)" value={pct(mape)} sub="Mean absolute error, last 2 years" tone={mape < 0.05 ? "pos" : "warn"} />
          </div>

          <Card title="Actual, plan and forecast">
            <div className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={usdShort} tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip formatter={(v) => (Array.isArray(v) ? `${usdShort(Number(v[0]))} – ${usdShort(Number(v[1]))}` : usd(Number(v)))} contentStyle={{ borderRadius: 8, borderColor: "var(--line)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area dataKey="band" name="Range" fill="var(--accent)" fillOpacity={0.1} stroke="none" />
                  <Bar dataKey="actual" name="Actual" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="landing" name="Landing est." fill="var(--accent)" fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Line dataKey="aop" name="AOP (plan)" stroke="var(--subtle)" strokeDasharray="4 4" dot={{ r: 3 }} connectNulls />
                  <Line dataKey="base" name="Forecast" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="How good were past plans? (AOP vs Actual)">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Year</th><th className="text-right font-medium">AOP</th><th className="text-right font-medium">Actual</th><th className="text-right font-medium">Variance</th></tr></thead>
            <tbody className="num">
              {Array.from({ length: CURRENT_FY - FIRST_FY }, (_, i) => FIRST_FY + i).map((y) => {
                const v = (byYear[y] ?? 0) / (aop[y] || 1) - 1;
                return (
                  <tr key={y} className="border-t border-line">
                    <td className="py-1.5">FY{y}</td><td className="text-right">{usdShort(aop[y] ?? 0)}</td><td className="text-right">{usdShort(byYear[y] ?? 0)}</td>
                    <td className={`text-right ${v > 0.02 ? "text-neg" : v < -0.02 ? "text-pos" : ""}`}>{pct(v)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Positive variance = overspend. Backtest: predicting each year from prior CAGR was off by {tests.map((t) => `${pct(t.errorPct)} (FY${t.year})`).join(", ")}.</p>
        </Card>

        <Card title="Saved plans" action={<Badge>{plans.length}</Badge>}>
          {plans.length === 0 ? (
            <p className="text-sm text-muted">No plans saved yet. Adjust the sliders and press <strong>Save as plan</strong>; it is signed and audited.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Plan</th><th className="font-medium">Assumptions</th><th className="text-right font-medium">Final year</th><th className="font-medium">By</th></tr></thead>
              <tbody>
                {plans.map((p) => {
                  const f = p.totals[p.totals.length - 1];
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-1.5 font-medium">{p.name}</td>
                      <td className="num text-xs text-muted">{p.assumption.inflationPct}% / {p.assumption.realGrowthPct}% / {p.assumption.horizonYears}y</td>
                      <td className="num text-right">{usdShort(f.base)}</td>
                      <td className="text-xs text-muted">{p.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Contract-level forecast" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1.5 font-medium">Contract</th><th className="font-medium">Dept</th><th className="text-right font-medium">Run-rate (12m)</th><th className="text-right font-medium">FY{CURRENT_FY + 1} forecast</th><th className="text-right font-medium">Uplift</th><th className="font-medium">Ends</th><th className="font-medium">Decision</th></tr>
            </thead>
            <tbody>
              {rows.map(({ c, run, next, renewsInHorizon }) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-1.5"><div className="font-medium">{vendorName[c.vendorId]}</div><div className="text-xs text-muted">{c.title}</div></td>
                  <td className="text-muted">{deptName[c.departmentId]}</td>
                  <td className="num text-right">{usd(run)}</td>
                  <td className="num text-right">{c.decision === "terminate" && c.endDate < `${CURRENT_FY + 1}-01-01` ? "—" : usd(next)}</td>
                  <td className="num text-right">{pct(c.upliftPct, 1)}</td>
                  <td className="num">{c.endDate}{renewsInHorizon && <span className="ml-1 text-warn">●</span>}</td>
                  <td><Badge tone={c.decision === "terminate" ? "neg" : c.decision === "renew" ? "pos" : c.decision === "renegotiate" ? "accent" : "default"}>{c.decision}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {saving && (
        <SaveDialog onClose={() => setSaving(false)} onSave={(name, reason) => savePlan({ name, assumption, totals: fc }, reason)} summary={`${a.inflationPct}% inflation · ${a.realGrowthPct}% real · ${a.horizonYears} yrs → ${usdShort(last?.base ?? 0)} in FY${last?.year}`} />
      )}
    </>
  );
}

function SaveDialog({ onClose, onSave, summary }: { onClose: () => void; onSave: (name: string, reason: string) => Promise<void>; summary: string }) {
  const [name, setName] = useState(`Plan FY${CURRENT_FY + 1} base`);
  return (
    <SignOffDialog
      title="Save forecast as plan"
      summary={<div className="space-y-2"><p>{summary}</p><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-line-strong px-3 py-1.5 text-sm text-fg" aria-label="Plan name" /></div>}
      onClose={onClose}
      onConfirm={(reason) => onSave(name.trim() || "Untitled plan", reason)}
    />
  );
}
