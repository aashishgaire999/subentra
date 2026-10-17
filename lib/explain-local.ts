// Rule-based explainer used when no AI model is reachable (static hosting, no key, outage).
// Same inputs as the AI: aggregate facts only.

type Facts = Record<string, number | string>;

const MONEY = /(spend|aop|actual|value|estimate|forecast|exposure|variance|base|low|high)/;
const PCT = /_pct$/;

function fmt(key: string, v: number | string) {
  if (typeof v === "string" || /(^|_)(year|days|count)$/.test(key)) return String(v);
  if (PCT.test(key)) return `${v.toFixed(1)}%`;
  if (MONEY.test(key)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  return String(Math.round(v * 100) / 100);
}

const n = (f: Facts, k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);

const ACTIONS: Record<string, (f: Facts) => string> = {
  "executive-summary": (f) => (n(f, "variance_vs_aop_ytd") > 0 ? "ask the departments over pace for a reforecast before next month's close." : "lock in the savings and review the notice deadlines coming up."),
  dashboard: (f) => (n(f, "variance_vs_aop_ytd") > 0 ? "review the departments running ahead of plan." : "keep the current plan and watch renewals."),
  forecast: (f) => (n(f, "renewal_uplift_exposure") > 0 ? "start renegotiating the renewals with the largest vendor uplifts." : "save this scenario as the base plan."),
  renewals: (f) => (n(f, "notice_missed") > 0 ? "contact the vendors with missed notice dates today to limit auto-renewal terms." : "send notices for contracts due within 30 days."),
  import: () => "review the rejected rows and re-upload the corrected file.",
};

export function explainLocally(kind: string, facts: Facts) {
  const lines = Object.entries(facts).slice(0, 8).map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${fmt(k, v)}`);
  const action = (ACTIONS[kind] ?? ACTIONS.dashboard)(facts);
  return `Key figures:\n${lines.join("\n")}\nSuggested action: ${action}`;
}
