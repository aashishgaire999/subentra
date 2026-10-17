# SUBENTRA — Security & AI compliance

Status: **Built** = working in this demo · **Planned** = designed, not built yet.

## Platform
| Control | Status | How |
|---|---|---|
| RBAC | Built | 4 roles, explicit permission matrix, checked in UI and store (`lib/rbac.ts`) |
| Signed changes | Built | Every write needs a named user + reason (`SignOffDialog`) |
| Tamper-evident audit log | Built | SHA-256 hash chain; "Verify integrity" detects edits |
| Company data isolation | Built (import) / Planned (DB) | Rows with a foreign company code are rejected; Postgres RLS on `company_id` |
| Import safety | Built | Template-only, size/row caps, formula-injection block, duplicate-file hash, closed-period lock, rollback |
| Security headers | Built | CSP (self only), no framing, nosniff, HSTS, Permissions-Policy |
| Encryption in transit / at rest | Planned | TLS 1.2+ (hosting), AES-256 at rest (Postgres default) |
| SSO + MFA | Planned | Replaces the demo user switcher |
| Backup & recovery | Planned | Daily snapshots + point-in-time recovery; quarterly restore test |
| DLP | Partly built | AI never receives raw rows; exports are limited to roles |
| Independent security testing | Planned | External pen test before go-live; it's a process, not a feature |

## AI controls (OWASP Top 10 for LLM apps)
| Risk | Control in SUBENTRA |
|---|---|
| LLM01 Prompt injection | Data is sent as JSON labelled "data only". Instruction-like strings are redacted server-side **and** blocked at import |
| LLM02 Sensitive info disclosure | Minimum data: only ~10 aggregate numbers per call. No names, document numbers or raw lines |
| LLM05 Improper output handling | Output is stripped of links/markup and rendered as plain text, never HTML |
| LLM06 Excessive agency | AI is read-only. It cannot write, approve or call tools; humans sign every change |
| LLM09 Misinformation | Code does all maths; the prompt forbids new figures; the UI shows exactly which fields the AI saw |
| LLM10 Unbounded consumption | 400-token cap, 8 KB request cap, 20 req/min per IP, 20 s timeout |
| Logging | Every AI call → `AI_INTERACTION` (who, when, fields sent, redactions, model, summary) |
