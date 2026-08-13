# AP-02 — Excel/CSV Round-Trip (Finance Data Grid) — Implementation Report

**Program:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 2
("Excel/CSV round-trip: szablon, eksport wartości i formuł, preview diff, mapping, validation,
transactional reimport oraz manifest version/unit/source").
**Foundation reused:** AP-00 (`server/src/types/finance/{ArtifactRef,CellRef,Operation,financeValueSemantics}.ts`),
AP-01 (`server/src/services/finance/grid/{PasteEngine,BulkOpsEngine,gridCoordinates,engineContext}.ts`),
AP-04 (`server/src/services/finance/collaboration/autosaveService.ts` — demote-then-INSERT working-revision
pattern), Gate C (`server/src/services/finance/canonical/artifactVersionService.ts` — `reopenVersion()`),
WP-D01 (`finance_stmt_lines`, `finance_stmt_entities`, `finance_stmt_periods`), WP-D03 (`finance_analysis_kpi_catalog`
formula AST, `formulaAstEvaluator.ts` types).
**Date:** 2026-08-10. **Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`.

---

## 1. Format decision: real `.xlsx` via `exceljs`, not CSV+JSON

The task brief allowed a fallback to "uproszczony, ale realny format CSV+JSON manifest" if `.xlsx` would
require too large a scope, provided a from-scratch binary parser was avoided. **Decision: real `.xlsx`**,
because the "avoid from-scratch parser" condition is already satisfied by an existing repo dependency —
`exceljs` (`package.json` line 342, `^4.4.0`) is already used for exactly this purpose elsewhere:
`server/src/services/workbook/WorkbookBuilder.ts` (writer), `server/src/services/workbook/workbookImport.ts`
(reader), and mounted at `server/src/routes/v8/finance.routes.ts`. There is no "from scratch" parser risk to
avoid by downgrading to CSV+JSON — the real format was the same amount of *new* code either way, and gives a
materially better product: multiple sheets in one file (Manifest + Values + Formulas + Template), a format
analysts already have Excel open for, and a manifest that travels WITH the data instead of as a separate
JSON sidecar a re-upload flow would have to keep paired with the right CSV by convention. `.csv` is still
supported on the import side (`parseFinanceExcelBuffer` branches on file extension) for the single-sheet
case, with the caller expected to supply the original manifest object out-of-band in that case (matches the
task's own wording: "bierze zaimportowany plik (sparsowany do tablicy wierszy) + oryginalny manifest").

**Workbook shape** — four sheets, always in this order:
| Sheet | Content |
|---|---|
| `Manifest` | key/value pairs: `manifestVersion`, `source`, `exportId`, `organizationId`, `artifactId`, `artifactType`, `businessVersionId`, `businessVersionStatus`, `businessVersionNo`, `businessVersionCasVersion`, `workingRevisionId`, `asOf`, `defaultUnit`, `defaultPresentationCurrency`, `rowCount` |
| `Values` | current `finance_stmt_lines` rows, 18 columns (Statement Type, Line Code/Name, Entity Code/Name, Period Label, Fiscal Year, Accumulation Basis, Consolidation Scope, Value Status, Value, Native/Presentation Currency, Unit, Multiplier, Is Adjustment, Adjustment Reason, Cell Key) |
| `Formulas` | `finance_analysis_kpi_catalog` ACTIVE rows (UNIVERSAL tier + this org's ORG_CUSTOM), `formula_ast` rendered via `renderFormulaNode()` as e.g. `CURRENT_ASSETS / CURRENT_LIABILITIES`, not raw JSON |
| `Template` | the `Values` header row only, zero data rows |

Files: `server/src/services/finance/canonical/financeExcelShared.ts` (shared manifest/row schema, formula
renderer, the "never silent zero" value-cell parser), `financeExportService.ts` (DB read + workbook writer),
`financeImportService.ts` (parser, preview-diff, transactional apply).

## 2. Pipeline

1. **`exportFinanceStatementPack(params)`** — read-only, one `withPinnedPostgresTransaction`. Rejects
   non-`STATEMENT_PACK` artifacts (`WRONG_ARTIFACT_TYPE`) — the task scoped AP-02 to Statement Pack; other
   artifact types are a future package's extension, per the same "don't design what a future WP owns"
   discipline `ArtifactRef.ts` documents.
2. **`parseFinanceExcelBuffer(buffer, filename)`** — pure, no DB. Header-name-keyed (not positional), so a
   re-ordered/re-saved Excel file still round-trips.
3. **`previewFinanceImport(params)`** — read-only. Resolves every row against the live taxonomy
   (`finance_stmt_entities`/`finance_stmt_periods`/`financial_statement_lines`, scoped to this
   organization/business-version), diffs against current `finance_stmt_lines`, classifies each touched cell
   as `toAdd` / `toChange` / `toClear` / unchanged. Safe to call repeatedly with zero side effects.
4. **`applyFinanceImport(params)`** — one transactional apply. Re-validates under `SELECT ... FOR UPDATE`
   (closes the TOCTOU gap between preview and apply — a row could change between the two calls), builds
   **one** `ApplyOperationsBatchRequest` (AP-00 contract) using the SAME `'paste'`/`'clear'` verbs
   `PasteEngine.ts`/`BulkOpsEngine.ts` emit for interactive grid edits (task requirement: "Excel import
   powinien produkować Operation.batch tą samą ścieżką co paste w gridzie"), applies it inside ONE
   `withPinnedPostgresTransaction` call, then bumps `finance_working_revisions` via the exact demote-then-
   INSERT pattern `reopenVersion()`/`checkpointOperationStack()` already use.

**"MISSING never becomes zero"** (task requirement, verbatim: "z jawnym oznaczeniem MISSING vs zero — zero
silent coercion"): the `Value`/`Value Status` column pair is parsed by `parseValueCells()`
(`financeExcelShared.ts`) with one explicit rule — a truly blank cell always parses to `MISSING`, an
explicit `0` always parses to `PRESENT_ZERO`, and a `Value Status` that contradicts the number in `Value` is
a validation error, not a silent override. Verified empirically in section 4 (AP02-T10/T15/T17/T16), not
just asserted in a comment.

## 3. Scope decision: GoldCo-*flavored* fixture, not the full oracle replay

The task said "eksportuj GoldCo Statement Pack (dane z Fali 3)". The full GoldCo dataset
(`docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json`) is a ~500-fact, multi-entity,
multi-year oracle built for WP-D01/D02's own vertical-slice acceptance (`GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md`,
`GOLDCO_FULL_DAG_END_TO_END_REPORT.md`) — replaying it here would re-test WP-D01/D02/D04/D06/D08/D10's own
correctness, which AP-02 does not own and those reports already cover. AP-02's own test instead builds a
smaller, purpose-built fixture under the same "GoldCo Manufacturing Group" name/spirit (1 entity, 2 fiscal
years, 6 canonical lines, 9 seeded cells) — enough to exercise every diff class (add/change/clear/unchanged,
explicit-zero, explicit-MISSING) plus the Approved-immutability guard, without re-deriving 500 independently-
computed oracle facts AP-02 has no way to cross-check on its own.

## 4. Test results — round-trip, against a real migrated ephemeral Postgres

**Isolation:** own ephemeral cluster, `/private/tmp/finance-v3-ap02-pgdata-*`, port `58217`,
`listen_addresses=127.0.0.1`, `initdb --locale=C` + `LC_ALL=C` throughout (same recipe as
`WP-D01b_statements_migration_report.md`). Verified via `ps aux` that PID 911 (shared Homebrew instance) and
the concurrent session's own ephemeral cluster (port 57231) were both left untouched throughout. Stopped
(`pg_ctl stop`) and data directory `rm -rf`'d at the end of this session — confirmed by a final `ps aux`
showing only PID 911 remaining.

**Pre-flight blocker found and fixed:** a fresh strict migration run failed with `relation "finance_artifacts"
does not exist` while applying `20260809_finance_v3_ap06_comments_01_tables.sql` — that file (a concurrent
session's AP-06 comments/review work, already on this branch) and `20260809_finance_v3_b01_core_artifacts.sql`
share the `20260809` date prefix, and the migration runner's same-date tiebreak is filename order —
`'ap06' < 'b01'` lexicographically, so AP-06's migration (which needs `finance_business_versions`/
`finance_artifacts`, created by b01) ran BEFORE its own foundation. `server/scripts/migrate.postgres.ts`
already has a purpose-built, previously-unused mechanism for exactly this bug class
(`LATE_PHASE_MANIFEST`, a list of filenames forced to run after every phase-0/phase-1 migration) — fixed
with a one-line addition (`server/scripts/migrate.postgres.ts`), confirmed self-contained (no other
migration references `finance_comments`/`finance_comment_assignments`/`finance_review_checklists`), then a
fresh migration run succeeded (31 pending -> 31 applied, 0 skipped, 0 errors).

**Second bug found and fixed (in already-shipped AP-00 code, not this work package's own new code):**
`findDuplicateTargetsInBatch()` (`server/src/types/finance/Operation.ts`) keyed duplicate detection on
`organizationId|businessVersionId|tableName` only — identical for every cell in the same table, so it
flagged ANY batch touching more than one cell in the same table as "duplicate", regardless of whether the
cells actually collided. Confirmed via `grep` that no caller had ever exercised this function before
`financeImportService.ts` (AP-01's engines build multi-batch, single-op-per-batch requests that never call
it either). Fixed to key on the full cell identity via `cellRefKey()` (rowKey+columnKey included), matching
what the function's own doc comment always described it as doing.

**Third gap found and closed (documented as deliberately narrow-scoped):** `reopenVersion()`
(`artifactVersionService.ts`, Gate C, artifact-type-agnostic) creates the new business-version/working-
revision pair but does not copy any Gate-D domain content table — confirmed by `WP-D01_statements_schema_ADR.md`'s
own text: content tables are version-scoped "dokladnie po to, zeby reopen... mogl skopiowac tresc z vN do
vN+1... ten ADR NIE implementuje tej kopii (nalezy do wykonawczego Gate D razem z reszta serwisu reopen)" —
i.e. this was an explicitly deferred, not-yet-built piece. Confirmed empirically (not just by reading the
comment): a reopen without this copy left the new draft with zero `finance_stmt_entities` rows, and
`previewFinanceImport` correctly rejected every row as referencing an unknown entity. Closed narrowly, inside
`financeImportService.ts` only (`copyStatementPackContentForReopen`), copying `finance_stmt_entities` (with
`id`/`parent_entity_row_id` remapping) and `finance_stmt_lines` for the Statement Pack's own reopen+reimport
path specifically — NOT a generic "copy any Gate D content table for any reopen caller" service, which
remains the deferred future work package the ADR itself named.

**23/23 assertions pass** (`docs/validation/finance-v3/generated/gate-d/ap02/ap02_roundtrip.ts`):

| ID | Result | What it proves |
|---|---|---|
| AP02-T1..T5 | PASS | export succeeds on DRAFT; manifest/row counts correct; exported `.xlsx` round-trips through the parser |
| AP02-T6..T11 | PASS | preview diff correctly classifies 2 changes / 1 clear / 3 adds against a real DB read; explicit `0` -> `PRESENT_ZERO` |
| AP02-T12..T13 | PASS | transactional apply succeeds on DRAFT, `appliedCount` matches the diff exactly |
| AP02-T14..T17 | PASS | re-read from DB (not from the in-memory result) confirms: value changed, cell cleared to `MISSING` (not `0`), previously-`MISSING` cell now populated, new cell is `PRESENT_ZERO`/`0` (not silently `MISSING`) |
| AP02-T18 | PASS | re-applying the identical `batchIdempotencyKey` replays idempotently (no double-apply) |
| AP02-T19 | PASS | import on an APPROVED business version, without `reopen`, is rejected (`STATE_PRECONDITION_FAILED`, `reopenRequired: true`) |
| AP02-T20..T23 | PASS | import WITH `reopen` succeeds against a NEW draft business version; the Approved parent's `finance_stmt_lines` rows are **byte-identical** before/after (immutability upheld); the new draft carries the re-imported value |

## 5. Size test — 5k x 60 (300,000 cells), in-memory, real `.xlsx`

Since AP-02 chose real `.xlsx` (section 1), this measures the REAL `exceljs` write/read path — a strictly
harder number than the CSV+JSON floor the task offered as a fallback. Shape: 5,000 (entity x canonical-line)
row-combinations x 60 periods = 300,000 Values-sheet rows x 18 columns = 5.4M physical Excel cells written
and read. `docs/validation/finance-v3/generated/gate-d/ap02_size_test.ts`, no Postgres involved anywhere in
this script (the diff phase runs `computeFinanceImportDiffPure` — the exact hot-path code
`applyFinanceImport` runs under a DB transaction, factored out specifically so this test could exercise it
against synthetic in-memory `Map`s instead of real database lookups).

| Phase | Time | Note |
|---|---|---|
| Row generation (JS objects) | 58 ms | negligible |
| Workbook build (`sheet.addRow` x 300k) | 1,141 ms | |
| Workbook write (`xlsx.writeBuffer()`) | **21,408 ms** | dominant cost — `exceljs`'s XML/zip serialization, not this package's own logic |
| Workbook parse (`parseFinanceExcelBuffer`) | 16,324 ms | second-largest cost |
| Diff/resolve (`computeFinanceImportDiffPure`) | 2,082 ms | 300,000 taxonomy lookups + `FinanceValueInputSchema` validations |
| **Total end-to-end** | **~41.0 s** | **136.7 µs/cell average** |

**Honest read of this number, not a "budget met" claim:** ~41 seconds end-to-end for a 300k-cell full-pack
round trip is too slow for a synchronous request/response UI action — an analyst clicking "Export" or
"Import" on a pack this large needs an async job with a progress indicator, not a blocking call. This is
consistent with AP-01's own ADR framing 10k *visible* cells (live grid rendering) as the interactive-latency
budget, and treating full-pack bulk operations as a separate concern with pagination/virtualization (master
plan section 3 point 11: "wieloletnie/multi-entity payloads mają pagination/virtualization"). A 300,000-row,
18-column Statement Pack is also an unusually large single artifact in practice — GoldCo's own real fixture
(section 3) is 9 rows; most production packs will land far below this ceiling, where the per-cell cost
(~137 µs) implies sub-second round trips (e.g. ~1,400 cells in 2 s). The dominant cost is `exceljs`'s own
XML serialization (21.4 s of the 41 s), not this package's row-resolution/diff logic (2.1 s) — if the 300k
scale needs to become a real, synchronous product target, the next optimization to investigate is streaming
`.xlsx` writing (`exceljs`'s `stream.xlsx.WorkbookWriter`, already available in the same dependency) rather
than this package's own code.

## 6. Escalations / follow-ups (flagged, not silently absorbed)

1. **`findDuplicateTargetsInBatch()` bugfix** (section 4) ships in this commit since it directly blocked
   AP-02's own tests and is a one-line, clearly-scoped correctness fix to already-shipped AP-00 code.
2. **`copyStatementPackContentForReopen()`** (section 4) is intentionally narrow — Statement Pack only,
   called only from `financeImportService.ts`'s reopen branch. A generic "any Gate D domain reopen needs its
   content copied forward" service (for Analysis/Baseline/Prediction/Valuation, and for reopen callers other
   than Excel import — e.g. a future interactive "reopen this pack" UI button) remains open, exactly where
   `WP-D01_statements_schema_ADR.md` already deferred it ("nalezy do wykonawczego Gate D razem z reszta
   serwisu reopen"). This is the single largest scope gap this work package surfaced but did not close.
3. **`server/scripts/migrate.postgres.ts` `LATE_PHASE_MANIFEST` fix** (section 4) is a one-line, well-
   justified, in-pattern addition that unblocks fresh-DB migration for every future Gate D session, not just
   this one — worth confirming it lands on `demo`/`Londyn` promptly rather than only in this worktree.
4. **Executor scope**: `executeStmtLinesOperations()` (`financeImportService.ts`) only implements `'paste'`/
   `'clear'` — `'set'`/`'bulk_set'`/`'reset'` throw (documented, not silently no-op'd) since the import flow
   never emits them. A future generic AP-00 executor (e.g. backing AP-01's interactive grid mutations
   directly, not just Excel import) needs the other three verbs implemented.
5. **300k-cell write/parse latency** (section 5) — flagged for a future decision on whether full-pack bulk
   export/import needs to become an async background job with a progress indicator once real Statement Packs
   approach this scale; not blocking for AP-02 since GoldCo-scale packs (tens to low thousands of cells) are
   comfortably sub-second.

## 7. Files

- `server/src/services/finance/canonical/financeExcelShared.ts` — manifest schema, Values/Template column
  schema, "never silent zero" value-cell parser, formula-AST-to-readable-string renderer.
- `server/src/services/finance/canonical/financeExportService.ts` — `exportFinanceStatementPack()`.
- `server/src/services/finance/canonical/financeImportService.ts` — `parseFinanceExcelBuffer()`,
  `previewFinanceImport()`, `applyFinanceImport()`, `computeFinanceImportDiffPure()`,
  `copyStatementPackContentForReopen()`, the `finance_stmt_lines` operations executor.
- `server/src/types/finance/Operation.ts` — `findDuplicateTargetsInBatch()` bugfix.
- `server/scripts/migrate.postgres.ts` — `LATE_PHASE_MANIFEST` fix for the AP-06/b01 same-date ordering bug.
- `docs/validation/finance-v3/generated/gate-d/ap02/ap02_roundtrip.ts` — 23-assertion integration test
  (real ephemeral Postgres).
- `docs/validation/finance-v3/generated/gate-d/ap02/ap02_size_test.ts` — 300k-cell in-memory size test.

## 8. Verification method

Full-project `tsc --noEmit` (strict, `server/tsconfig.json`, `--max-old-space-size=8192`) run BEFORE and
AFTER this work package's edits: one pre-existing, unrelated error both times (`lineageService.ts:177`, not
touched by this work package); zero errors in any file this work package added or edited. The integration
test ran against a real migrated Postgres schema (590+ migrations), not a mock — `RUN_DB_TESTS=1
MOCK_DB=false` enforced by the script's own guard (mirrors `goldco_pipeline.ts`'s convention). Every DB-level
assertion (section 4, AP02-T14/T15/T16/T17/T22/T23) re-reads from the database after the call under test,
not from the in-memory function-return value — the load-bearing "did it actually land" check the CLAUDE.md
"złota reguła" ("testy przeszły" ≠ "działa") requires.
