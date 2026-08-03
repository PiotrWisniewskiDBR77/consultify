# FIN-005 — Statement Ingestion Golden Flow — Discovery Gate

Branch `feat/fin-005-statement-ingestion-golden-flow`, base `4811abcb947abd55fd3ca24e66f6654688268a6e`.
Worktree `/private/tmp/consultify-fin-005-ingestion`. Written before any implementation code, per
packet instructions.

**Naming collision, read first**: the `FIN-005` id is already claimed on `origin` by an unrelated
package — `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-005_*` (demo-tenant Atelier data
coherence, branch `fix/fin-005-atelier-coherence`, base `c522a86...`, status `AWAITING_CODEX_REVIEW`)
and `scripts/testing/run-fin005-pg-tests.mjs` / `npm run test:fin005:pg` (targets
`server/src/services/demo/__tests__/*.pg.test.ts`). This document and this branch are a **different**
FIN-005: statement *ingestion mechanics* (upload → parse → map → approve → pack → read-back), not
demo-data coherence. Do not run `npm run test:fin005:pg` expecting it to cover this work — it covers
the other package. Flag for Codex: resolve the id collision before both land.

## 1. Route mounting

`server/src/Gateway.ts:129,1159-1165` mounts the real router:
`app.use('/api/finance-statements', gatewayVerifyToken, highRiskSurfaceGuard({categories:['upload','export']}), deprecationHeader('/api/v8/finance'), financeStatementsRoutes)`.
Reachable, not dead code. `highRiskSurfaceGuard` hard-blocks file uploads for DEMO-scoped and
unconfirmed-trial orgs (`server/src/middleware/highRiskSurfaceGuard.middleware.ts:170-176`) — a
real-org/local-dev/PAID-scope caller is unaffected; this only matters if/when this ever gets probed
against `demo.consultify.ai` (out of scope here — no push/demo per packet rules).

Frontend: `src/routes/AppRoutes.tsx:2041-2069`, route `ROUTES.FINANCE` = `/finance` and
`/finance/statements/:id`, wrapped in `<BetaGate moduleId="MODULE_ECONOMICS">`. Default state of that
gate is **`closed`** (`src/utils/betaAccess.ts:47`, "Finance (M16 — poza MVP)") — intentionally off by
default per this repo's UI rollout convention (CLAUDE.md rule 7); enabling it is a local/dev-only
override for verification, not a change to the shipped default.

Live screens (both call the real API client, not a stub):
`src/components/Finance/FinancialStatementImportWizard.tsx` (upload/detect/extract/map/values/confirm)
rendered inside `src/components/Economics/FinanceHub.tsx:3202`, and
`src/components/Finance/FinancialStatementPackWorkspace.tsx` (pack/report-section) at
`FinanceHub.tsx:3015`, both via `src/views/EconomicsView.tsx`.
`src/components/Finance/FinancialStatementWorkspace.tsx` has **zero importers** — dead/orphaned, not
the live entry point; do not confuse it with the wizard above.

## 2. Canonical writer — single writer, no duplication

- `server/src/services/financialStatementService.ts` — writer of statement metadata/status/values:
  `createStatement()` L8168, `saveStatementValues()` L8257, `updateStatementStatus()` L8322,
  `persistStatementExtractedSections()` L7410, `persistStatementCandidateRows()` L7459,
  `persistStatementValueEvidence()` L7821.
- `server/src/services/financialStatementPackService.ts` — sole writer of `financial_statement_packs`:
  `createPack()` L265, `assignStatementToPack()` L295.
- `financialStatementValueWriteService.ts` is an orchestration layer only (no direct SQL) — calls into
  the two files above.

No parallel/competing writer found for any of these tables — did not need to pick a winner.

## 3. Tables

All required tables exist in `server/migrations-v2/001_baseline_20260413.sql` (live-schema mirror) and
`server/migrations/never-ran/668_statement_ready_contract.sql` +
`669_statement_import_rebuild.sql`. Per `server/migrations/never-ran/README_6xx.md`, those two files'
content is confirmed already present on live demo/prod (historical manual `db:migrate` runs before the
boot-runner regex was narrowed to `7XX_*`/8-digit-date) — **but a fresh local Postgres built only from
the normal `server/scripts/migrate.postgres.ts` run does NOT get them** (regex excludes `6XX_*`, and
`never-ran/` isn't recursed). Confirmed by direct reproduction below (§8). `financial_statements`,
`financial_statement_ingest_runs`, `financial_statement_quality_runs`, `financial_statement_packs` etc.
all carry `organization_id`; several child tables (`financial_statement_values`,
`financial_statement_candidate_rows`, `financial_statement_value_evidence`, …) scope tenancy only via
`statement_id` → parent join, not their own `organization_id` column — fine as long as every read joins
back through the parent (confirmed for the routes touched here).

## 4. XLSX / CSV parsing (`finance-statements.routes.ts` `extractTextFromFile()`, ~L225-286)

XLSX/XLS: SheetJS (`xlsx` "0.20.2" via CDN tarball dependency, pre-existing), ranks sheets by a
financial-content heuristic, converts to tab-delimited text. CSV: `fs.readFileSync(path, 'utf-8')` —
raw UTF-8 only, no BOM strip, no delimiter sniffing, no Windows-1250 fallback.
**CSV was unreachable via the real upload path**: `server/src/middleware/fileUpload.middleware.ts`'s
`EXT_TO_MIME_BASES` (~L114-120) allow-lists only `pdf, docx, doc, xlsx, xls` — a real `.csv` upload gets
`400 FILE_UPLOAD_DISALLOWED_TYPE` before ever reaching the route, despite the route's own error message
advertising CSV support and the `ext === 'csv'` branch existing in the parser. This is the single
biggest gap against the golden-flow requirement "an analogous minimal flow works for CSV too."

No zip-bomb / pathological-sheet-count guard on the XLSX path. No magic-byte/content sniffing anywhere
— `fileFilter` only compares the client-declared MIME string against the extension, never inspects file
bytes.

## 5. Idempotency

Zero hits for "idempoten" anywhere under `financial_statement*` route/service code. A double
POST /upload of the same file creates two independent `financial_statements` rows and — because
`findExistingPack()` (`financialStatementPackService.ts:230-260`) excludes packs that already have a
non-archived statement of the same type — **two independent packs**, silently, with no error or
warning. A reusable idempotency-key pattern already exists for a different domain
(`financialModelingService.ts:1498-1570`, `financial_model_idempotency` table + `pg_advisory_xact_lock`)
— not directly reusable (schema/operation-enum narrow to model create/approve) but a good blueprint.

## 6. Security posture (full detail: see PR/report)

Actor/org identity: session-derived only (`getOrgId`/`getUserId`, `finance-statements.routes.ts:156-164`
read `req.organizationId`/`req.user`, never `req.body`/`req.query`) — good. Capability/RBAC: auth-only
(`verifyToken, isAuthenticated`), no `requireCapability`/`requirePermission` gate on any of the 8 core
endpoints, even though a fail-closed pattern exists and is used elsewhere in this repo — any
authenticated member of the org can upload/confirm/delete any statement in their org regardless of
role. Reported as an unresolved risk (not a FIN-005 golden-flow blocker — org isolation is the hard
requirement here, and that one *is* enforced).

Cross-tenant: `getStatementOrFail()` (`finance-statements.routes.ts:2551-2569`) filters
`WHERE id = ? AND organization_id = ?` in the SQL itself → 404 on mismatch, not a post-fetch check.
**Verified live** with a genuine second user + genuine org membership (not just a relabeled JWT — see
§8, the pre-existing test's original cross-tenant case did not actually exercise this because of an
auth-middleware fallback, see below) — org isolation holds.

Upload hardening (`fileUpload.middleware.ts`): 10 MB size cap, extension allow-list, filename rebuilt
server-side (`buildSafeUploadedFilename`), path-traversal-guarded destination resolution
(`resolveAssessmentUploadDir` + `isPathInsideDir`), org-scoped storage directory — good. Missing: real
content-type/magic-byte sniffing (trusts client `mimetype` header, paired against extension only), CSV
encoding/delimiter handling, XLSX zip-bomb guard.

**Auth-middleware behavior worth knowing for anyone else writing cross-tenant tests against this repo**:
`auth.middleware.ts` (~L640, comment "QA-2026-06-08 BUG-02/15") silently falls back to the caller's own
real ACTIVE org membership whenever the JWT's claimed `organizationId` is not one they actually belong
to. A test that forges a token for the *same* seeded user with a *different* `organizationId` claim
never actually reaches the route as that foreign org — it quietly resolves back to the user's real org
and the negative case silently no-ops (was true of the pre-existing `odbior--fin003a` acceptance test's
cross-tenant assertion until fixed in this branch — see §8). A real second user with a real membership
row is required.

## 7. Provenance

`persistStatementCandidateRows()` (`financialStatementService.ts:7459`, live caller confirmed at routes
L1089/1097 inside `/extract`, and L1278 inside `/map`) stores `row_label`, `normalized_label`,
`source_row`, `selected_period_label`, `raw_value`, `normalized_value`, `currency`, `scaling`,
`confidence`, `classification_reason`, `metadata_json`. Source file identity reached via
`ingest_run_id` → `financial_statement_ingest_runs.source_file_name/source_file_path`.
`persistStatementValueEvidence()` (L7821) records manual-correction lineage
(`evidence_type`, `explanation`, `contribution_value`). This already satisfies the packet's
provenance requirement (source file, row, original label/value, normalized account/period,
transformation status) for the XLSX/CSV row-based case — confirmed via a real, currently-passing
acceptance run (§8), not just a code read.

## 8. Real-runtime verification performed during discovery (not just code reading)

Per CLAUDE.md's "verify REALNY runtime" rule: created a local Postgres 15 database
(`consultinity_test`, `postgresql://consultinity:consultinity@localhost:5432/consultinity_test`), ran
`server/scripts/migrate.postgres.ts --safe` (full run; a handful of unrelated migrations fail on a
fresh DB due to pre-existing cross-migration ordering issues — not a FIN-005 concern, worked around with
`--safe`), then additionally applied `server/migrations/never-ran/668_statement_ready_contract.sql` and
`669_statement_import_rebuild.sql` directly (idempotent `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN IF NOT
EXISTS` — safe, and per the `never-ran/README_6xx.md` audit this content already matches live
demo/prod schema) to get the full `financial_statement_*` table set locally.

Ran the pre-existing `tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts` against this real
database. It **failed** on first run — not because of anything on this branch, but because the test
itself had never actually been exercised against a real, fully-migrated Postgres:
1. `cleanup()` referenced a non-existent `financial_statement_packs.source_file_name` column — always
   threw, failing every run.
2. Its single-value-per-line fixture (`label, value, "PLN"`) doesn't satisfy
   `extractFinancialLines()`'s requirement of ≥2 numeric tokens per line (the real deterministic parser
   is built for comparative current+prior-period statements) — extraction returned 1 line, not the 3+
   asserted.
3. Its "cross-tenant" case used a relabeled JWT for the same seeded user (see §6) — always returned 200,
   silently proving nothing.
4. A minor read-back JSON-string-vs-object assertion bug.

All four are now fixed in this branch (test-file-only changes, no production code touched for these) and
the suite passes green end-to-end for XLSX, including a *genuine* cross-tenant denial. This is strong
real evidence the existing pipeline is fundamentally sound for XLSX; the work in this packet is closing
the CSV/idempotency/zip-bomb/magic-byte gaps identified above, not rebuilding anything.

## Decision

Smallest complete slice for the golden flow: (a) unblock CSV at the middleware allow-list + fix its
encoding/delimiter handling, (b) add an XLSX zip-bomb/pathological-size guard, (c) add basic magic-byte
sniffing, (d) add an `Idempotency-Key` mechanism on `POST /upload`, (e) new real-Postgres acceptance
tests for CSV + the above + a *correct* cross-tenant negative. Not rebuilding any pipeline. Not touching
`computeModel()`, OpEx sign, `discount_rate`, Atelier seeds, Results/Execution handoff, or FIN-06.
RBAC/capability-gate gap and the `loadPriorPeriodStatements()` Date-to-string SQL error (found live, see
full report) are recorded as unresolved risks, not fixed here — both pre-exist this branch and are
outside golden-flow scope.
