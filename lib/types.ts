// Entity types. Mirrors docs/ERD.md — every record carries companyId for tenant isolation.

export type RoleId = "admin" | "finance" | "executive" | "viewer";

export interface Company { id: string; name: string; currency: "USD"; fiscalYearStartMonth: number }
export interface User { id: string; companyId: string; name: string; email: string; role: RoleId }
export interface Department { id: string; companyId: string; name: string; costCenter: string }
export interface Category { id: string; name: string; glAccount: string }
export interface Vendor { id: string; companyId: string; sapVendorId: string; name: string; description: string }

export type RenewalDecision = "undecided" | "renew" | "renegotiate" | "terminate";

export interface Contract {
  id: string;
  companyId: string;
  vendorId: string;
  departmentId: string;
  categoryId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  invoiceEndDate: string;
  noticeDays: number;
  autoRenew: boolean;
  annualValue: number; // contract value at signature, USD
  upliftPct: number; // vendor price increase applied at renewal
  aopCurrentFy: number; // contract-level plan for the current fiscal year
  decision: RenewalDecision;
}

export interface BudgetAop { id: string; companyId: string; departmentId: string; fiscalYear: number; amount: number }

export interface ActualLine {
  id: string;
  companyId: string;
  batchId: string;
  postingDate: string;
  period: string; // YYYY-MM
  contractId: string;
  vendorId: string;
  departmentId: string;
  categoryId: string;
  costCenter: string;
  glAccount: string;
  documentNumber: string;
  amount: number;
}

export interface ImportBatch {
  id: string;
  companyId: string;
  fileName: string;
  fileHash: string;
  rowCount: number;
  total: number;
  importedBy: string;
  importedAt: string;
  status: "committed" | "rolled_back";
}

export interface ForecastAssumption { inflationPct: number; realGrowthPct: number; horizonYears: number; spreadPct: number; departmentId: string | "all" }

export interface Plan {
  id: string;
  companyId: string;
  name: string;
  assumption: ForecastAssumption;
  totals: { year: number; base: number; low: number; high: number }[];
  createdBy: string;
  createdAt: string;
}

export interface AuditEvent {
  seq: number;
  companyId: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  reason: string;
  before: string | null;
  after: string | null;
  prevHash: string;
  hash: string;
}

export interface AiInteraction {
  id: string;
  companyId: string;
  at: string;
  userId: string;
  userName: string;
  kind: string;
  fieldsSent: string[];
  redactions: number;
  model: string;
  summary: string;
}
