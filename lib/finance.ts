// All finance maths lives here, in code. The AI only ever explains these numbers.
import { TODAY } from "./seed";
import type { ActualLine, BudgetAop, Contract, ForecastAssumption } from "./types";

export const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export function noticeDeadline(c: Contract) {
  const d = new Date(c.endDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - c.noticeDays);
  return d.toISOString().slice(0, 10);
}
export const daysToNotice = (c: Contract) => daysBetween(TODAY, noticeDeadline(c));
export const isActive = (c: Contract) => c.startDate <= TODAY && c.endDate >= TODAY;

export function urgency(c: Contract): "overdue" | "critical" | "soon" | "later" {
  const d = daysToNotice(c);
  if (d < 0) return "overdue";
  if (d <= 30) return "critical";
  if (d <= 90) return "soon";
  return "later";
}

export const latestPeriod = (lines: ActualLine[]) => lines.reduce((m, l) => (l.period > m ? l.period : m), "0000-00");

export function sumBy<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + val(r);
  return out;
}

export const actualByYear = (lines: ActualLine[]) => sumBy(lines, (l) => l.period.slice(0, 4), (l) => l.amount);
export const aopByYear = (b: BudgetAop[]) => sumBy(b, (x) => String(x.fiscalYear), (x) => x.amount);

/** Compound annual growth between two full fiscal years. */
export function cagr(byYear: Record<string, number>, from: number, to: number) {
  const a = byYear[from], b = byYear[to];
  if (!a || !b || to <= from) return 0;
  return Math.pow(b / a, 1 / (to - from)) - 1;
}

/** Standard deviation of year-on-year growth — used as the default uncertainty band. */
export function growthVolatility(byYear: Record<string, number>, from: number, to: number) {
  const g: number[] = [];
  for (let y = from + 1; y <= to; y++) if (byYear[y - 1] && byYear[y]) g.push(byYear[y] / byYear[y - 1] - 1);
  if (g.length < 2) return 0.02;
  const mean = g.reduce((s, x) => s + x, 0) / g.length;
  return Math.sqrt(g.reduce((s, x) => s + (x - mean) ** 2, 0) / (g.length - 1));
}

function shiftPeriod(p: string, months: number) {
  const [y, m] = p.split("-").map(Number);
  const t = y * 12 + (m - 1) + months;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Trailing-12-month spend per contract, ending at the latest closed period. */
export function runRateByContract(lines: ActualLine[]) {
  const last = latestPeriod(lines);
  const from = shiftPeriod(last, -11);
  return sumBy(lines.filter((l) => l.period >= from && l.period <= last), (l) => l.contractId, (l) => l.amount);
}

export interface ForecastPoint { year: number; base: number; low: number; high: number }

/**
 * Nominal growth = (1 + inflation) × (1 + real growth) − 1.
 * Each contract grows from its run-rate; at renewal the vendor uplift applies once;
 * contracts marked "terminate" drop out after their end date.
 */
export function forecast(lines: ActualLine[], contracts: Contract[], a: ForecastAssumption, fromYear: number): ForecastPoint[] {
  const rr = runRateByContract(lines);
  const g = (1 + a.inflationPct / 100) * (1 + a.realGrowthPct / 100) - 1;
  const s = a.spreadPct / 100;
  const scoped = contracts.filter((c) => a.departmentId === "all" || c.departmentId === a.departmentId);
  const out: ForecastPoint[] = [];
  for (let t = 1; t <= a.horizonYears; t++) {
    const year = fromYear + t;
    let base = 0, low = 0, high = 0;
    for (const c of scoped) {
      const run = rr[c.id] ?? 0;
      if (!run) continue;
      const endYear = Number(c.endDate.slice(0, 4));
      if (c.decision === "terminate" && endYear < year) continue;
      const uplift = endYear < year && c.decision !== "renegotiate" ? 1 + c.upliftPct : 1;
      base += run * Math.pow(1 + g, t) * uplift;
      low += run * Math.pow(1 + g - s, t) * uplift;
      high += run * Math.pow(1 + g + s, t) * uplift;
    }
    out.push({ year, base, low, high });
  }
  return out;
}

/** Current-year landing estimate: actuals to date + run-rate for the remaining months. */
export function landingEstimate(lines: ActualLine[], year: number) {
  const ytd = lines.filter((l) => l.period.startsWith(String(year))).reduce((s, l) => s + l.amount, 0);
  const last = latestPeriod(lines);
  const monthsDone = last.startsWith(String(year)) ? Number(last.slice(5)) : 12;
  const rr = Object.values(runRateByContract(lines)).reduce((s, x) => s + x, 0) / 12;
  return { ytd, monthsDone, estimate: ytd + rr * (12 - monthsDone) };
}

/** Backtest: predict year Y from prior years' CAGR, compare with what actually happened. */
export function backtest(byYear: Record<string, number>, first: number, years: number[]) {
  return years.map((y) => {
    const g = cagr(byYear, first, y - 1) || 0;
    const predicted = (byYear[y - 1] ?? 0) * (1 + g);
    const actual = byYear[y] ?? 0;
    return { year: y, predicted, actual, errorPct: actual ? (predicted - actual) / actual : 0 };
  });
}
