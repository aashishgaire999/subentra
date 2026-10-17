// Deterministic demo data for a fictional company. Same output on server and client.
import type { ActualLine, BudgetAop, Category, Company, Contract, Department, User, Vendor } from "./types";

export const TODAY = "2026-10-17";
export const CURRENT_FY = 2026;
export const FIRST_FY = 2022;

const CO = "co-halcyon";

export const company: Company = { id: CO, name: "Halcyon Manufacturing", currency: "USD", fiscalYearStartMonth: 1 };

export const users: User[] = [
  { id: "u-admin", companyId: CO, name: "Priya Shah", email: "priya@halcyon.test", role: "admin" },
  { id: "u-fin", companyId: CO, name: "Daniel Okafor", email: "daniel@halcyon.test", role: "finance" },
  { id: "u-exec", companyId: CO, name: "Maria Chen", email: "maria@halcyon.test", role: "executive" },
  { id: "u-view", companyId: CO, name: "Sam Lee", email: "sam@halcyon.test", role: "viewer" },
];

export const departments: Department[] = [
  { id: "d-it", companyId: CO, name: "IT", costCenter: "CC1100" },
  { id: "d-fin", companyId: CO, name: "Finance", costCenter: "CC1200" },
  { id: "d-mkt", companyId: CO, name: "Marketing", costCenter: "CC1300" },
  { id: "d-ops", companyId: CO, name: "Operations", costCenter: "CC1400" },
  { id: "d-hr", companyId: CO, name: "HR", costCenter: "CC1500" },
  { id: "d-legal", companyId: CO, name: "Legal", costCenter: "CC1600" },
];

export const categories: Category[] = [
  { id: "cat-sw", name: "Software", glAccount: "640100" },
  { id: "cat-cloud", name: "Cloud & Infrastructure", glAccount: "640200" },
  { id: "cat-ps", name: "Professional Services", glAccount: "650100" },
  { id: "cat-tel", name: "Telecom", glAccount: "660100" },
  { id: "cat-fac", name: "Facilities", glAccount: "670100" },
  { id: "cat-mkt", name: "Marketing Services", glAccount: "680100" },
];

const v = (id: string, sap: string, name: string, description: string): Vendor => ({ id, companyId: CO, sapVendorId: sap, name, description });
export const vendors: Vendor[] = [
  v("v01", "100001", "Northbeam Cloud", "Public cloud hosting and managed infrastructure"),
  v("v02", "100002", "Ledgerline", "ERP support and maintenance"),
  v("v03", "100003", "Brightdesk", "IT service desk platform"),
  v("v04", "100004", "Kestrel Security", "Endpoint security and SOC monitoring"),
  v("v05", "100005", "Atlas Telecom", "WAN, voice and mobile connectivity"),
  v("v06", "100006", "Meridian Consulting", "Finance transformation advisory"),
  v("v07", "100007", "Harbor Facilities", "Integrated facilities management"),
  v("v08", "100008", "Lumen Media", "Creative and media buying agency"),
  v("v09", "100009", "PeopleGrid", "HR information system"),
  v("v10", "100010", "Clausewise", "External legal panel"),
  v("v11", "100011", "Datavault", "Backup and disaster recovery"),
  v("v12", "100012", "Signalform", "Marketing automation platform"),
  v("v13", "100013", "Quarry Analytics", "Business intelligence platform"),
  v("v14", "100014", "Pinecrest Print", "Print and mail services"),
];

type Spec = [id: string, vendor: string, dept: string, cat: string, title: string, annual: number, start: string, end: string, notice: number, auto: boolean, uplift: number, growth: number];
const specs: Spec[] = [
  ["c01", "v01", "d-it", "cat-cloud", "Cloud hosting", 1_450_000, "2021-01-01", "2026-12-31", 60, false, 0.06, 0.11],
  ["c02", "v02", "d-fin", "cat-sw", "ERP support", 620_000, "2020-07-01", "2027-06-30", 120, false, 0.04, 0.04],
  ["c03", "v03", "d-it", "cat-sw", "Service desk", 310_000, "2022-01-01", "2026-12-15", 30, true, 0.07, 0.05],
  ["c04", "v04", "d-it", "cat-sw", "Endpoint security", 540_000, "2022-04-01", "2027-03-31", 90, false, 0.09, 0.08],
  ["c05", "v05", "d-ops", "cat-tel", "WAN connectivity", 480_000, "2019-01-01", "2027-12-31", 180, false, 0.03, 0.02],
  ["c06", "v06", "d-fin", "cat-ps", "Advisory retainer", 750_000, "2023-01-01", "2026-10-31", 30, true, 0.05, 0.06],
  ["c07", "v07", "d-ops", "cat-fac", "Facilities management", 1_100_000, "2018-01-01", "2028-12-31", 180, false, 0.035, 0.04],
  ["c08", "v08", "d-mkt", "cat-mkt", "Agency of record", 900_000, "2022-07-01", "2027-01-31", 60, false, 0.05, 0.07],
  ["c09", "v09", "d-hr", "cat-sw", "HRIS subscription", 380_000, "2021-01-01", "2027-08-31", 90, false, 0.06, 0.05],
  ["c10", "v10", "d-legal", "cat-ps", "Legal panel", 420_000, "2022-01-01", "2027-12-31", 60, false, 0.04, 0.03],
  ["c11", "v11", "d-it", "cat-cloud", "Backup & DR", 210_000, "2023-04-01", "2027-01-15", 45, true, 0.08, 0.09],
  ["c12", "v12", "d-mkt", "cat-sw", "Marketing automation", 260_000, "2022-01-01", "2028-01-31", 90, false, 0.06, 0.06],
  ["c13", "v13", "d-fin", "cat-sw", "BI platform", 190_000, "2024-01-01", "2026-12-31", 30, false, 0.07, 0.05],
  ["c14", "v14", "d-ops", "cat-fac", "Print services", 95_000, "2019-01-01", "2027-02-28", 30, false, 0.03, 0.01],
  ["c15", "v04", "d-it", "cat-ps", "SOC monitoring", 330_000, "2024-07-01", "2027-06-30", 90, false, 0.08, 0.07],
  ["c16", "v05", "d-ops", "cat-tel", "Mobile fleet", 150_000, "2020-01-01", "2025-12-31", 60, false, 0.03, 0.02],
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261017);

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const LAST_SEED_PERIOD = "2026-09";

/** Expected (noise-free) monthly spend for a contract in a given month. */
export function expectedMonthly(s: { annual: number; start: string; growth: number }, y: number, m: number) {
  const base = Math.max(Number(s.start.slice(0, 4)), FIRST_FY);
  const monthsIn = (y - base) * 12 + (m - 1);
  return (s.annual / 12) * Math.pow(1 + s.growth, monthsIn / 12);
}

const catGl = Object.fromEntries(categories.map((c) => [c.id, c.glAccount]));
const deptCc = Object.fromEntries(departments.map((d) => [d.id, d.costCenter]));

export const actuals: ActualLine[] = [];
let doc = 5100000000;
for (const [id, vendor, dept, cat, , annual, start, end, , , , growth] of specs) {
  for (let y = FIRST_FY; y <= CURRENT_FY; y++) {
    for (let m = 1; m <= 12; m++) {
      const p = ym(y, m);
      if (p > LAST_SEED_PERIOD || p < start.slice(0, 7) || p > end.slice(0, 7)) continue;
      const season = cat === "cat-mkt" && m >= 10 ? 1.25 : 1;
      const amount = Math.round(expectedMonthly({ annual, start, growth }, y, m) * season * (0.94 + rand() * 0.12));
      actuals.push({
        id: `a-${id}-${p}`, companyId: CO, batchId: "seed", postingDate: `${p}-28`, period: p,
        contractId: id, vendorId: vendor, departmentId: dept, categoryId: cat,
        costCenter: deptCc[dept], glAccount: catGl[cat], documentNumber: String(doc++), amount,
      });
    }
  }
}

// AOP = expected spend with a planning bias per department/year (plans are usually a little optimistic).
export const budgets: BudgetAop[] = [];
for (const d of departments) {
  for (let y = FIRST_FY; y <= CURRENT_FY + 1; y++) {
    let exp = 0;
    for (const [, , dept, , , annual, start, end, , , , growth] of specs) {
      if (dept !== d.id) continue;
      for (let m = 1; m <= 12; m++) {
        const p = ym(y, m);
        if (p < start.slice(0, 7) || p > end.slice(0, 7)) continue;
        exp += expectedMonthly({ annual, start, growth }, y, m);
      }
    }
    const bias = 1 + (rand() * 0.1 - 0.06);
    budgets.push({ id: `b-${d.id}-${y}`, companyId: CO, departmentId: d.id, fiscalYear: y, amount: Math.round((exp * bias) / 1000) * 1000 });
  }
}

export const contracts: Contract[] = specs.map(([id, vendorId, departmentId, categoryId, title, annual, startDate, endDate, noticeDays, autoRenew, upliftPct, growth]) => {
  let fy = 0;
  for (let m = 1; m <= 12; m++) {
    const p = ym(CURRENT_FY, m);
    if (p >= startDate.slice(0, 7) && p <= endDate.slice(0, 7)) fy += expectedMonthly({ annual, start: startDate, growth }, CURRENT_FY, m);
  }
  const invoiceEnd = new Date(endDate + "T00:00:00Z");
  invoiceEnd.setUTCDate(invoiceEnd.getUTCDate() + 30);
  return {
    id, companyId: CO, vendorId, departmentId, categoryId, title, startDate, endDate,
    invoiceEndDate: invoiceEnd.toISOString().slice(0, 10), noticeDays, autoRenew,
    annualValue: annual, upliftPct, aopCurrentFy: Math.round((fy * (0.97 + rand() * 0.05)) / 1000) * 1000,
    decision: "undecided",
  };
});
