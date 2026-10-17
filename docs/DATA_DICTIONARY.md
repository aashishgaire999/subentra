# SUBENTRA — Data dictionary

## Glossary (the three "plan" numbers)
| Term | Meaning | Source |
|---|---|---|
| **AOP** (Annual Operating Plan) | Board-approved budget per department per fiscal year | Finance, `BUDGET_AOP` |
| **Contract AOP** | The share of AOP planned for one contract this year | Procurement, `CONTRACT.aop_current_fy` |
| **Actual** | Spend posted in SAP | SAP import, `ACTUAL_LINE` |
| **Variance** | Actual − AOP. Positive = overspend. YTD compares with AOP × months closed / 12 | Calculated |
| **% used** | Actual ÷ annual AOP | Calculated |
| **Run-rate** | Last 12 closed months of actuals | Calculated |
| **Landing estimate** | YTD actual + run-rate for the months left | Calculated |
| **Notice deadline** | Contract end date − notice days. Miss it and the contract renews | Calculated |
| **Uplift** | Vendor price increase applied at renewal | Contract |

## Forecast method (`lib/finance.ts`)
- **Historical CAGR** = (Actual FY_last / Actual FY_first)^(1/years) − 1. Shown as the anchor, not a slider.
- **Nominal growth** = (1 + inflation) × (1 + real growth) − 1.
- **Contract forecast, year t** = run-rate × (1 + nominal)^t × (1 + uplift, if renewed before that year).
  - Renegotiate removes the uplift.
  - Terminate removes the contract after its end date.
- **Range** = the same calculation at nominal ± uncertainty. The default uncertainty is the historical standard deviation of YoY growth.
- **Backtest** predicts each past year from the CAGR before it and reports the error (mean absolute %).

## SAP import template
| Column | Format | Rule |
|---|---|---|
| posting_date | YYYY-MM-DD | Not in the future. Not in a closed period |
| company_code | text | Must equal the tenant's code (`HAL1`). Rows from other companies are rejected |
| cost_center | text | Must map to a department |
| gl_account | 6 digits | Must map to a category |
| sap_vendor_id | text | Must exist |
| vendor_name | text ≤ 80 | For display only. Formulas and instruction-like text are blocked |
| contract_id | text | Must exist and belong to that vendor |
| document_number | 10 digits | Unique, within the file and across history |
| amount | number | Non-zero, below $10M. Negative = credit note |
| currency | `USD` | Only USD for now |

**File rules:** `.csv` or `.xlsx`, ≤ 5 MB, ≤ 50,000 rows, exact headers, all-or-nothing, SHA-256 duplicate block, rollback by batch.

## Roles (`lib/rbac.ts`)
| Permission | Admin | Finance | Executive | Viewer |
|---|---|---|---|---|
| View dashboards, forecast, renewals | ✓ | ✓ | ✓ | ✓ |
| Import actuals | ✓ | ✓ | | |
| Roll back an import | ✓ | | | |
| Save plans / decide renewals | ✓ | ✓ | | |
| View audit and AI log | ✓ | | ✓ | |
| Use AI explanations | ✓ | ✓ | ✓ | |
