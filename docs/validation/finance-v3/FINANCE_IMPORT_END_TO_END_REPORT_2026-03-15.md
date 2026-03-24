# Finance Import End-to-End Report

## Scope

- Corpus manifest: `docs/validation/finance-v3/STATEMENT_IMPORT_SAMPLE_MANIFEST_2026-03-15.json`
- Documents tested: 11
- Statement attempts: 33
- Import modes:
  - Offline audit via service layer
  - API import via `upload -> detect -> extract -> map -> values -> confirm`
  - Direct DB import fallback via service layer + PostgreSQL writes

## Executive Result

- The ingestion logic is operational for the tested corpus, but it is not production-ready for CFO-grade use.
- I successfully created statement records for the full corpus via direct import fallback.
- Only 3 of 33 statement attempts reached `ready`.
- All 3 `ready` cases are balance sheets from the Apator corpus.
- The remaining 30 cases are `recoverable`, mostly because required canonical lines are still missing or mapping coverage is too low.

## What Was Successfully Fixed During Testing

### 1. Canonical line FK blocker

Problem:
- API imports initially failed on `financial_statement_values.canonical_line_id` foreign key checks.
- Root cause: the target database contained only 27 canonical lines, while the mapping layer emitted IDs from the expanded registry.

Action:
- Ran `server/scripts/sync-canonical-lines-local.ts`.

Outcome:
- Canonical line definitions in DB increased from 27 to 204.
- `values` persistence started working.

### 2. False-empty reads in schema compatibility paths

Problem:
- `confirm` and some finance read paths returned empty results under old-schema conditions.
- Root cause: `dbAll()` defaulted to `fallback: true`, swallowed schema errors, and prevented intended `try/catch` compatibility fallbacks from running.

Action:
- Updated `server/src/routes/finance-statements.routes.ts` to use `{ fallback: false }` in schema-sensitive reads.

Outcome:
- Compatibility fallback paths now execute correctly instead of silently returning empty arrays.

### 3. Postgres alias casing bug in `confirm` / `validate`

Problem:
- Even with persisted values, `confirm` treated all rows as unmapped.
- Root cause: aliases like `canonical_line_id as canonicalLineId` were lowercased by Postgres, so downstream code received the wrong property names.

Action:
- Updated route queries to use quoted aliases like `as "canonicalLineId"` and `as "isNonFinancial"`.

Outcome:
- End-to-end `values -> confirm` succeeded for a known-good case (`Apator SA Raport R 2024 / BS`).

## API Import Result

Reference output:
- `docs/validation/finance-v3/generated/FINANCE_IMPORT_API_TEST_RESULTS_2026-03-15.md`

Observed result:
- The API path worked after the above fixes for early cases.
- The long-running backend then became unavailable during the batch.
- A clean backend restart on port `3001` was blocked by an unrelated route registration failure in `my-work.routes.ts`.

Blocking runtime defect:
- `PathError [TypeError]: Unexpected ( at index 13, expected end: /my-ideas/:id([0-9a-fA-F-]{36})/map`

Impact:
- The API batch completed only partially.
- This is an environment/runtime stability issue, not a finance-specific mapping result.

## Full-Corpus Import Result

Reference outputs:
- `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.md`
- `docs/validation/finance-v3/generated/FINANCE_DIRECT_IMPORT_RESULTS_2026-03-15.md`

Summary:
- `ready`: 3
- `recoverable`: 30
- `rejected`: 0

### Strongest corpus

- `Apator SA Raport R 2024`
- `Grupa Apator Raport RS 2024`
- `Raport skonsolidowany Apator`

Observed pattern:
- Balance sheets hit 100% coverage and reached `ready` in 3 cases.
- P&L and CF still stayed `recoverable` despite 100% mapped coverage because required canonical lines were missing from the extracted/mapped set.

### Medium-quality corpus

- `KGHM SRR 2024`

Observed pattern:
- Balance sheet and P&L are partially workable.
- Cash flow remains weak.
- Main issues are incomplete mapping and missing required lines.

### Weak corpus

- `BMW Group Financial Statements 2024`
- `bp Annual Report 2025`
- `Coca-Cola 10-K 2025`
- `Tesla 10-K 2024`

Observed pattern:
- Coverage is too low for reliable downstream use.
- Large English-language annual reports expose weakness in section isolation, label normalization, and canonical mapping breadth.

### Excel corpus

- `BDG 2026 V1.xlsx`
- `BDG 2026 V1 old.xls`

Observed pattern:
- Files are parseable, but they behave more like planning/model workbooks than clean source financial statements.
- BS coverage is moderate.
- P&L coverage is low.
- CF extraction produces very large candidate volumes with minimal useful mapping.

## Problem List

### P0

- Runtime startup failure outside finance blocks stable API retesting: `my-work.routes.ts` path-to-regexp error.
- Without canonical registry sync, finance imports fail at DB write time on FK constraints.

### P1

- Finance routes relied on silent DB fallbacks, causing false-empty reads and broken readiness evaluation.
- Postgres alias casing caused `confirm` and `validate` to misread mapped values.
- P&L and CF contracts are too strict relative to current extractor/mapping output for otherwise well-structured Polish reports.

### P2

- English annual reports have low mapping coverage across BS/P&L/CF.
- Cash flow extraction remains the weakest statement family across nearly all non-Apator corpora.
- Excel workbook ingestion lacks document-type discrimination, so planning sheets flood extraction with low-signal rows.

## Recommended Repair Order

### 1. Stabilize the backend runtime

- Fix the invalid route pattern in `my-work.routes.ts`.
- Re-run the full API batch after the server can restart cleanly.

### 2. Make canonical registry sync mandatory before imports

- Run registry sync as part of finance startup, migration, or preflight.
- Add a health check that verifies canonical line count/version before `values` persistence is allowed.

### 3. Keep the Postgres finance routes strict on schema errors

- Apply the same `fallback: false` pattern anywhere a finance route expects compatibility fallback behavior.
- Audit other routes for camelCase aliases that rely on SQLite behavior.

### 4. Improve P&L and CF completeness on Polish statements

- Expand required-line handling for common Polish report layouts.
- Reduce cases where 100% mapped rows still fail readiness because the canonical contract and extractor output are misaligned.

### 5. Improve section isolation and mapping for English annual reports

- Strengthen section boundary detection for 10-K/20-F style documents.
- Add English aliases and broader canonical synonym coverage.
- Separate narrative sections from statement tables more aggressively before extraction.

### 6. Add workbook-aware Excel ingestion

- Detect statement sheets explicitly instead of flattening all tabs into one text stream.
- Ignore assumptions, presentations, and model tabs by default.

## Final Assessment

- The system can already produce valid balance sheets for the strongest Polish corpus.
- The system is not yet ready to claim reliable full-statement imports across PDF/XLS/XLSX.
- The biggest remaining blockers are:
  - backend runtime stability,
  - contract completeness for P&L/CF,
  - English-report mapping breadth,
  - workbook-aware Excel ingestion.
