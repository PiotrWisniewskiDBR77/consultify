# PACZKA 6 #61 — Demo garbage-data inventory + cleanup (2026-07-03)

Demo DB (Railway `demo` env, public proxy). **Prod (centerbeam) NOT touched.**
Canonical demo org for 16:00 = `atelier` (`DEMO_ORG_ID=atelier`) — **explicitly excluded from all writes**.

## Org landscape
- `SESSION_CLONE` (demo-org-session-* / atelier-session-*): **183 orgs** — ephemeral per-visitor demo-entry clones. Demo-entry-stream territory → **NOT in #61 scope** (not touched).
- `OTHER`: **177 orgs** — includes internal test org **DBR77** (`a3e05d4a-5397-419d-b486-8e44366c0063`), where Piotr's acceptance session ran (BUG-ACC1: piotr.wisniewski = OWNER of DBR77). **All reported garbage lives here.**
- `ATELIER_CANONICAL`: **1** (`atelier`) — verified 0 marked rows, left fully intact.

## Verdict: garbage is concentrated in DBR77, explicitly name-marked
Markers scanned (case-insensitive) in name/title: `THROWAWAY`, `DELETE`, `E2E`, `smoke`.

### HARD-DELETED (64 rows, DBR77 only — all explicitly marked)
| Table | Deleted | Example |
|---|---|---|
| initiatives | 16 | "E2E Initiative Init-…", "delete test", "M05-E2E-CV-Init-…", "QA Smoke …" |
| initiative_kpis | 5 | "E2E KPI 1782326203494" |
| benefits_register | 13 | "E2E benefit 1782325660502" (the 16-item "Rejestr korzyści" Piotr saw in Execution) |
| financial_models | 4 | "M16-THROWAWAY-Model DELETE" (the Finance Models list Piotr saw) |
| report_builder_reports | 6 | "E2E ToReport-…" |
| presentation_decks | 7 | "E2E ToPresentation-…", "Gotowość AI — smoke test" |
| v8_output_artifacts | 13 | "E2E ToReport-…", "…smoke test" |
| **TOTAL** | **64** | |

- Source of the "E2E …" rows: live E2E/smoke specs that POST to the demo backend
  (`tests/e2e/m15-results-cockpit.spec.ts`, `deploy-gate-api-execution-benefits-finance.spec.ts`;
  the `1782…` values are `Date.now()` millis).
- FK safety: all referencing FKs are `ON DELETE CASCADE` / `SET NULL`; marked initiatives had 0 children. Deletion ran in a single transaction.
- **Backup before delete:** `dbr77-garbage-backup-<ts>.json` (full row dump of all 64). Result manifest: `dbr77-delete-result-<ts>.json`.
- **Post-verify:** DBR77 marked counts = 0 across all tables; Atelier unchanged (33 initiatives, 17 artifacts, 1 model).

### LEFT IN PLACE — soft-hide candidates awaiting Piotr decision (NOT deleted)
Per rule "NIE kasuj niczego niejednoznacznego" + **no soft-hide flag exists on `initiatives`**
(schema has `status`/`stage` only; the S6.3 `is_draft` filter is on `v8_output_artifacts`/M17 Materiały, not initiatives):

- **Duplicate-name DRAFT bloat in DBR77** (unmarked → ambiguous, not deleted):
  - 32× "Optymalizacja kosztów logistyki magazynu" (src=teresa_chat, DRAFT)
  - 12× "F1-26 from assessment" (src=assessment, DRAFT)
  - 11× "F3 Rich Card Initiative" (src=manual, DRAFT)
  - ~9 names at exactly 3× — some with real statuses (DevOps EXECUTING, Cloud Migration APPROVED) that look like intentional seeded demo portfolio.
- DBR77 initiatives after cleanup: **139 total, 114 DRAFT** (was 148 DRAFT — the 32/12/11 clusters dominate the DRAFT count).

**Recommendation for Piotr:** the 55 obvious test-generated duplicates (teresa_chat/assessment/manual loops) are the visible bloat. Two clean options, both need a green light because they are not name-marked:
1. Add a soft-hide/`is_draft`/archive mechanism to initiatives + a list filter (mirrors S6.3 for Materiały), then hide these — zero data loss, reversible. **Preferred.**
2. Explicit one-time hard-delete of the 3 mass-duplicate clusters (55 rows) after Piotr confirms they are throwaway.

Not actioned autonomously to avoid deleting legitimate seeded demo initiatives.

## Method / reproducibility
Read-only inventory + backup/dry-run/delete scripts under `scratchpad-inv/` (not committed — contain no secrets; DB URL always injected via env `DEMO_DB_URL`, never printed). Raw inventory: `inventory-raw.txt`.
