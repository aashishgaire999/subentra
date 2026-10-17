# SUBENTRA — Entity relationship model

Every tenant-owned table has `company_id`. In Postgres/Supabase, Row-Level Security restricts each row to users of that company.

```mermaid
erDiagram
  COMPANY ||--o{ USER : employs
  COMPANY ||--o{ DEPARTMENT : has
  COMPANY ||--o{ VENDOR : buys_from
  COMPANY ||--o{ CONTRACT : holds
  USER }o--|| ROLE : "admin | finance | executive | viewer"
  DEPARTMENT ||--o{ BUDGET_AOP : "one per fiscal year"
  DEPARTMENT ||--o{ CONTRACT : owns
  VENDOR ||--o{ CONTRACT : supplies
  CATEGORY ||--o{ CONTRACT : classifies
  CONTRACT ||--o{ ACTUAL_LINE : "invoiced against"
  IMPORT_BATCH ||--o{ ACTUAL_LINE : loaded
  IMPORT_BATCH ||--o{ IMPORT_ERROR : rejected
  CONTRACT ||--o{ RENEWAL_DECISION : decided
  PLAN ||--|| FORECAST_ASSUMPTION : uses
  PLAN ||--o{ PLAN_LINE : "per year"
  USER ||--o{ AUDIT_EVENT : signs
  USER ||--o{ AI_INTERACTION : requests

  COMPANY { uuid id PK; text name; char3 currency; int fy_start_month }
  USER { uuid id PK; uuid company_id FK; text name; citext email UK; role role; bool mfa_enabled }
  DEPARTMENT { uuid id PK; uuid company_id FK; text name; text cost_center UK }
  CATEGORY { uuid id PK; text name; text gl_account UK }
  VENDOR { uuid id PK; uuid company_id FK; text sap_vendor_id UK; text name; text description }
  CONTRACT { uuid id PK; uuid company_id FK; uuid vendor_id FK; uuid department_id FK; uuid category_id FK; text title; date start_date; date end_date; date invoice_end_date; int notice_days; bool auto_renew; numeric annual_value; numeric uplift_pct; numeric aop_current_fy; decision decision }
  BUDGET_AOP { uuid id PK; uuid company_id FK; uuid department_id FK; int fiscal_year; numeric amount; uuid approved_by FK }
  ACTUAL_LINE { uuid id PK; uuid company_id FK; uuid batch_id FK; date posting_date; char7 period; uuid contract_id FK; text cost_center; text gl_account; text document_number UK; numeric amount }
  IMPORT_BATCH { uuid id PK; uuid company_id FK; text file_name; char64 file_sha256 UK; int row_count; numeric total; uuid imported_by FK; timestamptz imported_at; text status }
  IMPORT_ERROR { uuid id PK; uuid batch_id FK; int row; text column; text message }
  RENEWAL_DECISION { uuid id PK; uuid contract_id FK; decision value; uuid decided_by FK; text reason; timestamptz at }
  PLAN { uuid id PK; uuid company_id FK; text name; uuid created_by FK; timestamptz created_at }
  FORECAST_ASSUMPTION { uuid plan_id PK; numeric inflation_pct; numeric real_growth_pct; int horizon_years; numeric spread_pct; uuid department_id }
  PLAN_LINE { uuid plan_id FK; int year; numeric base; numeric low; numeric high }
  AUDIT_EVENT { bigint seq PK; uuid company_id FK; uuid user_id FK; text action; text entity; text entity_id; text reason; jsonb before; jsonb after; char64 prev_hash; char64 hash }
  AI_INTERACTION { uuid id PK; uuid company_id FK; uuid user_id FK; text kind; text[] fields_sent; int redactions; text model; text summary; timestamptz at }
```

## Key rules
- **AUDIT_EVENT is append-only.** No UPDATE/DELETE grants. `hash = sha256(prev_hash + event body)`, so any edit breaks the chain.
- **ACTUAL_LINE is never edited.** Corrections go through a new import or a rollback of a whole batch.
- **IMPORT_BATCH.file_sha256 is unique.** The same file can't be loaded twice.
- **AI_INTERACTION stores the field names sent, never the values or raw rows.**
- **Demo note:** the hackathon build holds these in browser memory with the same shapes (`lib/types.ts`). Moving to Supabase is a schema migration, not a redesign.
