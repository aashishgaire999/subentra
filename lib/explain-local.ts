// Built-in explainer: turns the same aggregate facts the AI would see into plain-English prose.
// Runs entirely in the browser when no AI model is configured, so no data leaves the page.

type Facts = Record<string, number | string>;

const money = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`;
  return v < 0 ? `−${s}` : s;
};
const p = (v: number) => `${v.toFixed(1)}%`;

function narrate(kind: string, f: Facts): string | null {
  const n = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);
  const s = (k: string) => String(f[k] ?? "");

  if (kind === "executive-summary" || kind === "dashboard") {
    if (!("actual_ytd" in f)) return null;
    const over = n("variance_vs_aop_ytd") > 0;
    const pace = (n("months_closed") / 12) * 100;
    return [
      `FY${s("fiscal_year")} spend is ${money(n("actual_ytd"))} after ${n("months_closed")} months, ${p(n("pct_of_annual_aop_used"))} of the ${money(n("aop_full_year"))} annual plan.`,
      `That is ${money(Math.abs(n("variance_vs_aop_ytd")))} ${over ? "over" : "under"} the pro-rata plan; at this point of the year about ${p(pace)} would be on pace.`,
      `${s("largest_category")} is the biggest cost area at ${money(n("largest_category_spend"))}.`,
      `${n("active_contracts")} contracts are active, ${n("contracts_expiring_90d")} expire within 90 days and ${n("notice_decisions_pending")} notice decisions are still open.`,
      `Suggested action: ${n("notice_decisions_pending") > 0 ? "clear the open notice decisions before their deadlines, then " : ""}${over ? "ask departments running ahead of pace for a reforecast." : "protect the underspend by reviewing renewals before they auto-renew."}`,
    ].join(" ");
  }

  if (kind === "forecast") {
    if (!("forecast_final_base" in f)) return null;
    const landingGap = n("fy_current_landing_estimate") - n("fy_current_aop");
    const aboveHistory = n("nominal_growth_pct") > n("historical_cagr_pct");
    return [
      `For ${s("scope")}, this year should land at ${money(n("fy_current_landing_estimate"))}, ${money(Math.abs(landingGap))} ${landingGap > 0 ? "above" : "below"} plan.`,
      `With ${p(n("inflation_pct"))} inflation and ${p(n("real_growth_pct"))} real growth (${p(n("nominal_growth_pct"))} nominal, ${aboveHistory ? "faster than" : "at or below"} the ${p(n("historical_cagr_pct"))} historical CAGR), spend reaches ${money(n("forecast_final_base"))} in FY${n("forecast_final_year")}, likely between ${money(n("forecast_final_low"))} and ${money(n("forecast_final_high"))}.`,
      `Vendor price increases at renewal add ${money(n("renewal_uplift_exposure"))} of exposure.`,
      `Back-testing this method on past years gives an average error of ${p(n("backtest_mean_abs_error_pct"))}.`,
      `Suggested action: ${n("renewal_uplift_exposure") > 0 ? "negotiate the largest renewal uplifts down before signing, then save this scenario as the plan." : "save this scenario as the base plan."}`,
    ].join(" ");
  }

  if (kind === "renewals") {
    if (!("contracts_needing_attention" in f)) return null;
    if (!n("contracts_needing_attention")) return "Every notice deadline in the next 90 days already has a decision. Suggested action: none needed this month.";
    return [
      `${n("contracts_needing_attention")} contracts need a decision, worth ${money(n("annual_value_at_risk"))} a year.`,
      n("notice_missed") ? `${n("notice_missed")} ${n("notice_missed") === 1 ? "has" : "have"} already missed the notice date and may renew on the vendor's terms.` : "",
      `${n("due_within_30_days")} ${n("due_within_30_days") === 1 ? "is" : "are"} due within 30 days and ${n("due_within_90_days")} within 90 days; ${n("auto_renew_contracts_in_window")} of them renew automatically.`,
      s("most_urgent_vendor") !== "none" ? `Most urgent: ${s("most_urgent_vendor")}.` : "",
      `Suggested action: ${n("notice_missed") ? "contact the vendors with missed dates today, then " : ""}send written notice or renewal approval for everything due within 30 days.`,
    ].filter(Boolean).join(" ");
  }
  return null;
}

export function explainLocally(kind: string, facts: Facts) {
  const prose = narrate(kind, facts);
  if (prose) return prose;
  const lines = Object.entries(facts).slice(0, 8).map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${typeof v === "number" ? Math.round(v * 100) / 100 : v}`);
  return `Key figures:\n${lines.join("\n")}\nSuggested action: review the largest variance first.`;
}
