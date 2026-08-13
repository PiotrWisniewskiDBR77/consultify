# WP-D02 — Statement Pack Mapping & Reconciliation Service (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 5
(Statements — pełna przebudowa), EPIC-03.
**Work package:** WP-D02 — mapping + reconciliation service on top of the WP-D01/WP-D01b schema
(`finance_stmt_*`, already migrated), reusing the WP-B05 exception/reconciliation ledger and the WP-B02
lifecycle transition (`submit_for_review`), both already shipped in Gate C.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CODE + TESTS — real code, real ephemeral-Postgres test run, NOT deployed/migrated to demo/dev/prod`

---

## 1. Inputs read (in full, before writing code)

1. `docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md` — full DDL (Załącznik A),
   sections 4.5 (`finance_stmt_lines`), 4.6 (`finance_stmt_reconciliation`), 5 (integrity triggers), 7
   (readiness gate).
2. `docs/validation/finance-v3/generated/gate-d/WP-D01b_statements_migration_report.md` — confirms the ADR's
   DDL actually shipped as three real migrations (`20260809_finance_v3_d01_statements_0{1,2,3}_*.sql`), 590/590
   fresh-install, 15/15 constraint tests, AP-01/AP-04 compatibility intact.
3. `docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md` and
   `server/src/services/finance/canonical/exceptionLedgerService.ts` — `finance_exceptions` /
   `finance_reconciliation_runs` already designed and implemented; this work package reuses both, adding
   nothing new to either table.
4. `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` section 7 — the
   materiality placeholder ("5% wartości linii/subtotala LUB konfigurowalny per-organizacja próg, cokolwiek
   niższe", `PROVISIONAL_PENDING_OWNER_DECISION`).
5. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 5 ("Workflow":
   Upload -> malware/file validation -> parse -> map -> reconcile -> exception resolution -> review -> approve;
   "Reconciliation ledger": source total -> mapped -> excluded -> unmapped -> duplicate/reclass/elimination ->
   canonical total -> residual) and section 3 problem #1 (CD Projekt 2025 — radically different margins between
   Statement and Analysis for the same period, no reconciliation caught it).
6. `server/src/services/finance/canonical/{artifactVersionService,lifecycleService,exceptionLedgerService,
   lineageService}.ts` — the Gate C service-writing convention this work package follows: pure logic
   (`lifecycleService.ts`) separated from `withPinnedPostgresTransaction`-based persistence, never `DbPromise`
   (that helper's `fallback:true` default silently swallows real DB errors — the exact "zielone testy,
   fałszywy sukces" failure mode this program's own audits keep finding elsewhere in Finance).

---

## 2. Scope boundary (explicit, per the task's hard ban)

File upload, malware scanning, and PDF/XLSX extraction are **not** part of this work package and are not
touched by it. Both services consume an already-parsed input shape exactly as specified in the task brief:

```ts
{ line_item, period, entity, currency, value, source_ref }
```

mapped 1:1 onto `RawStatementLine { lineItem, periodId, entityCode, currency, value, sourceRef }`, where
`periodId` is an existing `finance_stmt_periods.period_id` and `entityCode` is an existing
`finance_stmt_entities.entity_code` scoped to the target `business_version_id`. Resolving a raw period LABEL
into a `finance_stmt_periods` row and declaring the consolidation perimeter into `finance_stmt_entities` are
WP-D01 schema-level concerns, already shipped; this service consumes those dimension rows, it does not create
them. This boundary is documented in both service files' header comments, not just here.

---

## 3. What was implemented

### 3.1 `server/src/services/finance/canonical/statementMappingService.ts`

`mapStatementLines(params)` — takes raw parsed lines + a plain dictionary of `MappingRule` (source label ->
`{statementType, lineCode}`, exact match after normalization: trim/lowercase/collapse-whitespace — **no fuzzy
matching, no ML**, per the task's explicit instruction), and for each raw line:

1. No rule matches -> `UNMAPPED` (`reasonCode='NO_MAPPING_RULE'`), nothing written.
2. Rule says `action='EXCLUDE'` -> `EXCLUDED`, nothing written, `reasonCode` carries the rule's
   `excludeReasonCode`.
3. Entity/period/canonical-line resolution fails (raw `entityCode`/`periodId` doesn't match a real dimension
   row, or the taxonomy `(statementType, lineCode)` doesn't exist) -> `UNMAPPED` with a specific reason code
   (`ENTITY_NOT_FOUND` / `PERIOD_NOT_FOUND` / `CANONICAL_LINE_NOT_FOUND` / `RECLASS_TARGET_NOT_FOUND` /
   `ELIMINATION_COUNTERPARTY_NOT_FOUND`).
4. Otherwise resolves the target `finance_stmt_lines` cell key — **exactly** the six columns of
   `uq_finance_stmt_lines_cell` (`entity_id, canonical_line_id, period_id, accumulation_basis,
   consolidation_scope`) — and checks an in-batch dedup map:
   - first row to claim a cell -> written to `finance_stmt_lines`, bucket `MAPPED` / `RECLASS` (if
     `action='RECLASS'`, written under the target line with `reclassified_from_line_id` set to the as-filed
     line) / `ELIMINATION` (if `consolidationScope='ELIMINATION'`, requires
     `eliminationCounterpartyEntityCode`);
   - any later row claiming the **same** cell -> bucket `DUPLICATE`, nothing written, `duplicateOfRowIndex`
     points back at the first row. This is the mechanism the CD Projekt regression test exercises (section 5).
5. `value=null` is written as `value_status='MISSING'`, `value_decimal=NULL` — never silently coerced to a
   fabricated `0`. The row is still written (not skipped) so the readiness gate's
   `MAPPING_COMPLETE_NO_MISSING` check can see it.

The whole batch runs in **one** `withPinnedPostgresTransaction` call so WP-D01's five deferred constraint
triggers on `finance_stmt_lines` (balance / cash roll-forward / retained-earnings roll-forward / elimination
balance) evaluate against the complete batch at `COMMIT` — the "check the whole batch paste/import" semantics
the ADR documents, not a transiently-unbalanced partial write.

### 3.2 `server/src/services/finance/canonical/statementReconciliationService.ts`

- `computeWaterfall(rows)` — **pure, no DB.** Sums `sourceTotal`/`mappedTotal`/`excludedTotal`/`unmappedTotal`/
  `duplicateTotal`/`reclassNetTotal`/`eliminationNetTotal` (elimination legs signed by `CONTRA` flip, per WP-D01
  section 5.4) and computes `canonicalTotal = mappedTotal + reclassNetTotal + eliminationNetTotal` and
  `residual = sourceTotal - canonicalTotal - excludedTotal - unmappedTotal` — this formula is copied **verbatim**
  from `finance_reconciliation_runs`' own `GENERATED ALWAYS AS` column (WP-B05 migration), so the app-computed
  residual and the DB-computed residual can never disagree.
- `determineReconciliationStatus`/`severityForResidual` — pure helpers mapping the waterfall onto
  `CLEAN`/`WITHIN_TOLERANCE`/`EXCEEDS_MATERIALITY` and, for the exceeds case, a severity that scales with how
  far over threshold the residual is (`WARNING` up to 2x, `MATERIAL` up to 5x, `CRITICAL_DATA` beyond —
  documented as this work package's own scaling decision, since neither ADR specifies exact multipliers; never
  returns `SECURITY`, which WP-B05 reserves for `TENANT_BREACH`/`UNDEFINED_MATH`, a different failure class).
- `runReconciliation(params)` — persists one `finance_reconciliation_runs` row (WP-B05, already shipped) and one
  `finance_stmt_reconciliation` row per input row (WP-D01 section 4.6, rolling up into the run via
  `reconciliation_run_id`, not re-deriving the waterfall shape — ADR section 10.3's explicit design choice).
  When `status='EXCEEDS_MATERIALITY'`, raises a `finance_exceptions` row via the existing
  `exceptionLedgerService.raise()` and links it back (`finance_reconciliation_runs.linked_exception_id`).
  Optionally (`attemptReadinessTransition: true`) calls the already-shipped
  `finance_stmt_readiness_check()`/`finance_stmt_is_ready_for_review()` SQL functions (WP-D01 section 7) and,
  only if ready, calls the already-shipped `artifactVersionService.transition()` (T2, `submit_for_review`) to
  move the Statement Pack `DRAFT -> READY_FOR_REVIEW`.

**Nothing in `finance_reconciliation_runs`, `finance_stmt_reconciliation`, `finance_stmt_readiness_check`, or
`artifactVersionService.transition` was modified.** This work package is a pure consumer of all four, per the
task's "GATE B/C, użyj ich, nie duplikuj" instruction.

**The residual formula does NOT subtract `duplicateTotal`, deliberately** (documented in both the code and the
tests): an unresolved duplicate mapping is never silently netted out of the canonical total. It always shows up
as residual until a human explicitly resolves it (re-maps it to `EXCLUDE`, or removes the conflicting rule).
This is the direct mechanism behind the CD Projekt regression test in section 5 below.

---

## 4. Test results

### 4.1 Unit — pure waterfall logic (no database)

`server/src/services/finance/canonical/__tests__/statementReconciliationService.test.ts`

```
DB_TYPE=sqlite npx vitest run --config server/vitest.config.ts \
  server/src/services/finance/canonical/__tests__/statementReconciliationService.test.ts
```

**13/13 passed** (342 ms). Covers: fully-mapped balanced batch -> zero residual; excluded+unmapped correctly
subtracted out of the residual formula; **an unresolved DUPLICATE is never netted out** (residual = the
duplicate amount, exactly); RECLASS contributes its full value; a balanced NATURAL/CONTRA elimination pair nets
to zero; an unbalanced elimination pair nets nonzero (but is caught at the DB trigger layer, not this one — see
4.2); MISSING contributes zero without being indistinguishable from a real `PRESENT_ZERO`; `sourceTotal=0` with
nonzero residual reports `residualPct=null` (undefined %, never silently `0`); status
`CLEAN`/`WITHIN_TOLERANCE`/`EXCEEDS_MATERIALITY` boundary behavior, including the CD Projekt shape computed
purely; severity scaling `WARNING -> MATERIAL -> CRITICAL_DATA`, never `SECURITY`.

### 4.2 Integration — real ephemeral PostgreSQL

`server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts`

Isolation, identical to WP-D01b's own procedure (`WP-D01b_statements_migration_report.md` section 1): own
ephemeral cluster, `initdb --locale=C`, `LC_ALL=C` on every invocation (not just `initdb`), own port
(58217, from the 55000-59999 range, verified free with `lsof` first), `listen_addresses=127.0.0.1`, data
directory under `/private/tmp/`. Full migration set applied fresh (590 files, including this work package's
own two new test files — no new migration files were needed since WP-D01b already shipped every table/function
this service touches). `ps aux` confirmed the shared Homebrew instance (PID 911,
`/opt/homebrew/var/postgresql@15`) stayed untouched throughout; `pg_ctl stop` + `rm -rf` of the ephemeral data
directory executed immediately after the run, confirmed by a final `ps aux` showing only PID 911 remaining.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:58217/finance_v3_gate_d02 \
  npx vitest run --config server/vitest.config.ts \
  server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts --no-file-parallelism
```

**4/4 passed** (490 ms total). One test per `describe` block:

| # | Test | What it proves |
|---|---|---|
| 1 | Happy path: 6 lines (TOTAL_ASSETS/TOTAL_LIABILITIES_EQUITY/CASH/NET_INCOME/RETAINED_EARNINGS/DIVIDENDS_DECLARED), all balanced, all MAPPED | Full flow map -> reconcile -> `CLEAN` (residual=0, exception=null) -> `finance_stmt_is_ready_for_review()` returns true (all 7 named checks pass) -> `artifactVersionService.transition()` T2 succeeds -> re-read from `finance_business_versions` directly confirms `status='READY_FOR_REVIEW'` |
| 2 | **CD Projekt regression**: "Operating profit" (500,000) and "EBIT (reported)" (620,000) both map to the same `(entity, EBIT, period)` cell | First row `MAPPED`, second `DUPLICATE` (not silently dropped, not silently overwritten); `residual=620,000` (the un-netted duplicate, exactly); `run.status='EXCEEDS_MATERIALITY'`; a real `finance_exceptions` row is raised, severity `CRITICAL_DATA` (≈55% residual vs. 5% threshold — ratio ≈11, past the >5x boundary), confirmed independently via a direct `finance_exceptions_current` query (state=`OPEN`); readiness gate fails on **two** independent named checks (`RECONCILIATION_NO_OPEN_UNMAPPED_DUPLICATE` and `RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE`); transition is **not attempted**; a direct re-read confirms `finance_business_versions.status` is still `DRAFT` |
| 3 | A raw `INVENTORY` line with `value=null` | Written to `finance_stmt_lines` as `value_status='MISSING'`, `value_decimal IS NULL` (confirmed by a direct query on the inserted row, not just the service's return value); contributes 0 to both `sourceTotal` and `canonicalTotal` (`residual=0`, `status='CLEAN'`, no exception — a missing value is not a false discrepancy); readiness gate fails **specifically** on `MAPPING_COMPLETE_NO_MISSING` (detail text asserted: `"1 cell(s) with value_status=MISSING"`) while `RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE` and every other check still pass — a targeted, single-axis block, not a blanket failure; transition not attempted |
| 4 | An `action='EXCLUDE'` rule with `excludeReasonCode='NON_RECURRING'`, alongside two balanced BS lines | The excluded row is never written to `finance_stmt_lines`, keeps its `canonical_line_id` (rule matched, chose to exclude) and `reason_code` in the `finance_stmt_reconciliation` row; `excludedTotal` is correctly subtracted in the residual formula (`residual=0`, `status='CLEAN'`) — exclusion does not manufacture a false discrepancy |

### 4.3 No-regression check on the same ephemeral cluster

Ran this work package's tests alongside the existing Gate C/D suites and AP-04's own Postgres suite, all
against the same migrated schema:

```
server/src/services/finance/canonical/__tests__/  (all 5 files: canonicalServices.pg.test, lifecycleService.test,
  lineageService.test, statementReconciliationService.test, statementServices.pg.test)
server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts
```

**81/81 passed** (1.45 s total, `--no-file-parallelism`). No existing test needed a change; no existing
migration was touched.

---

## 5. Discrepancies / decisions not dictated by an ADR

None of these change any already-shipped schema or service — all are this work package's own, documented
design decisions where the brief left a degree of freedom:

1. **Severity scaling multipliers** (`WARNING` <=2x threshold, `MATERIAL` <=5x, `CRITICAL_DATA` beyond) are
   this service's own choice — no ADR specifies exact ratios, only "severity odpowiednim do wielkości
   residuala". Documented in the code and easy to retune without touching the DB.
2. **`canonicalLineId` on a `RECLASS` reconciliation row is the as-filed (original) line, `reclass_target_line_id`
   is where the value actually landed** — chosen to preserve both halves of the traceability the DDL comment
   ("`reclass_target_line_id` ... required when bucket requires it") implies, without inventing a new column.
3. **`mappedAmount` is `null` (not `0`) for a `MISSING` cell.** The DDL's own comment on `mapped_amount` says
   "NULL for EXCLUDED/UNMAPPED/DUPLICATE" — MISSING is a fourth case that comment doesn't name explicitly; `null`
   was chosen over a fabricated `0` for consistency with the "MISSING never becomes zero" principle that runs
   through the entire WP-D01 schema (section 5.6 of the ADR).
4. **Materiality threshold is caller-suppliable but defaults to the 5% `PROVISIONAL_PENDING_OWNER_DECISION`
   placeholder**, exported as `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` — this work package does not resolve the
   still-open owner decision (`GATE_B_INTEGRATION_RECONCILIATION.md` §7, escalated, not routine); it only wires
   the placeholder through, exactly as `finance_stmt_balance_tolerance()` already does on the DB side.

---

## 6. Escalations required before full GO

Same open item as WP-D01/WP-D01b, not resolved or worsened by this work package:

1. **Concrete materiality threshold number** — `GATE_B_INTEGRATION_RECONCILIATION.md` §7, `B02-Q4`, still
   `PROVISIONAL_PENDING_OWNER_DECISION`. This service consumes the 5% placeholder; it does not decide it.

No new escalation is introduced by WP-D02 itself.

---

## 7. Files touched

New files only — no existing file was modified:

- `server/src/services/finance/canonical/statementMappingService.ts`
- `server/src/services/finance/canonical/statementReconciliationService.ts`
- `server/src/services/finance/canonical/__tests__/statementReconciliationService.test.ts` (unit, no DB)
- `server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts` (integration, real Postgres)
- `docs/validation/finance-v3/generated/gate-d/WP-D02_reconciliation_service_report.md` (this file)
