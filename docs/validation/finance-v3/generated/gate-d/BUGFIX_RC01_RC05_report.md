# BUGFIX RC-01 / RC-05 — silent success on an incomplete import

**Findings source:** `docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md`, sections RC-01 and RC-05.
**Date:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/roi-e007-integration`, branch `codex/finance-v3-roi-e007-integration`
**Also fixed here:** the `tsc` error at `lineageService.ts:177` reported by the AP-09/10/11 package (outside their allowlist).

Both P1s are the same failure class: **the system had the number and did not act on it**. RC-01 counted the
unmapped/untargeted value and then subtracted it away; RC-05 stored an impossible value with the same
`PRESENT_NONZERO` status a correct one gets. Neither produced a mark the analyst could see.

---

## 1. Database isolation

Own ephemeral cluster, never the shared Homebrew instance and never demo/dev/prod.

- Binaries `/opt/homebrew/opt/postgresql@15/bin/` (not `@16` — no pgvector there), `initdb --locale=C`.
- `LC_ALL=C` exported for `initdb` **and** `pg_ctl`/`psql`/the migration runner (the recurring macOS
  "postmaster became multithreaded during startup" gotcha).
- Data dir `/private/tmp/rc0105-pgdata-45846`, port **56100**, picked from 55000-59999 and verified free with
  `lsof -iTCP:<p> -sTCP:LISTEN` before use; `listen_addresses=127.0.0.1`.
- Two databases: `rc0105` (full migration run, 1462 tables, used for red/green) and `rc0105fresh`
  (second full run from empty, used to prove the new migration applies on a fresh schema and to re-run the
  real Apator pipeline end to end).
- `NODE_ENV=test` set only to satisfy `databaseTargetResolver`'s loopback guard — left in place, not bypassed.
- Vitest invoked **from `server/`**; from the repo root the config's `include` matches nothing and vitest
  exits 1 with "No test files found", which reads as a failure but proves nothing (a known false-success shape).
- Teardown: `pg_ctl stop` + `rm -rf` of the data directory.

---

## 2. RC-01 — an import that lost 76% of the statement reported `CLEAN`

### 2.1 What was actually wrong

The residual formula is a GENERATED column in `finance_reconciliation_runs` (WP-B05):

```
residual = source_total - canonical_total - excluded_total - unmapped_total
```

`unmapped_total` and `excluded_total` are **subtracted**. That is correct arithmetic for a residual — a row
you explicitly did not map is not a discrepancy between source and canonical. But it means the residual is
**structurally incapable** of noticing incompleteness: the more you fail to map, the more you subtract, and
the residual stays at 0. `determineReconciliationStatus()` looked only at that residual, so it answered
`CLEAN`.

The number existed (`unmapped_total`, right there in the row). It just had no consequence. That is the
precise shape the brief predicted: *"liczy, ale nie wpływa"*.

### 2.2 The part the finding did not say, and that a naive fix would have missed

The real Apator PASS A did **not** route its 212 orphan lines through `UNMAPPED`. It routed them through
`EXCLUDED`:

```ts
// docs/validation/finance-v3/generated/gate-d/realcompany/apator_real_pipeline.ts
rules.push({ ..., action: 'EXCLUDE', excludeReasonCode: 'NO_P0_CANONICAL_TARGET' });
```

So a fix that only made `UNMAPPED` consequential would have been green in a unit test and **still reported
`CLEAN` on the actual Apator import**. `EXCLUDED` conflates two opposite meanings:

| exclusion | meaning | canonical pack is |
|---|---|---|
| "one-off gain, keep it out" | the analyst answered the question | **complete** |
| "the taxonomy has nowhere to put this" | nobody answered the question | **incomplete** |

### 2.3 Fix

**`statementMappingService.ts`**

- New `MappingRule.excludeKind?: 'ANALYST_DECISION' | 'NO_CANONICAL_TARGET'` — the distinction above, declared
  rather than guessed.
- Exported `TAXONOMY_GAP_EXCLUSION_REASON_CODES` (`NO_P0_CANONICAL_TARGET`, `NO_CANONICAL_TARGET`,
  `CANONICAL_TARGET_MISSING`, `CANONICAL_LINE_NOT_FOUND`, `TAXONOMY_GAP`) so callers that only set a reason
  code — like the harness — are still classified correctly without being rewritten.
- New `MappedRowResult.coverageLoss: boolean`, set for every `UNMAPPED` row and for taxonomy-gap `EXCLUDED`
  rows. `DUPLICATE` is deliberately **not** coverage loss: the value *is* in the canonical model, and the
  conflict is already caught on the residual axis.

**`statementReconciliationService.ts`**

- `WaterfallTotals.coverage: CoverageMetrics` — row counts per bucket, `coverageLossRowCount`, and absolute
  value sums (`absSourceTotal` / `absCoveredTotal` / `absCoverageLossTotal`) with the derived
  `sourceValueCoveragePct`, `sourceRowCoveragePct`, `coverageLossSharePct`.
  **Absolute magnitudes, not signed sums** — a signed total lets a +500 asset and a −500 contra cancel to 0
  and report "nothing missing" on a pack that lost both. There is a unit test for exactly that.
  `sourceValueCoveragePct` is `null` (undefined) when every source value is 0, never `1.0`.
- `determineReconciliationStatus()` now refuses `CLEAN` when any coverage loss exists.
- `determineResultQuality()` → DEC-FIN-009's own `CLEAN | CONDITIONAL | PROVISIONAL`.
- A `finance_exceptions` row, `reason_code='RECONCILIATION_SOURCE_COVERAGE_INCOMPLETE'`, severity scaled by
  `severityForResidual(coverageLossSharePct, threshold)`, carrying the full coverage block as evidence plus a
  plain-language summary ("68 of 280 source rows reached the canonical model…").
- The verdict is propagated onto the Statement Pack itself
  (`finance_business_versions.result_quality`, scoped `WHERE status='DRAFT'` so the B01 post-approval
  immutability trigger is never provoked).

**Migration `20260810_finance_v3_d02_reconciliation_coverage.sql`** — additive only:
`result_quality`, `source_value_coverage_pct`, `coverage_exception_id` on `finance_reconciliation_runs`, plus
one index. No CHECK dropped, no column altered; `status` keeps its original three values verbatim.

### 2.4 The judgment call, stated openly

Coverage loss **does not** escalate `status` to `EXCEEDS_MATERIALITY`, even at 76%.

`finance_stmt_readiness_check()` check #6 treats `EXCEEDS_MATERIALITY` as a hard block on
DRAFT → READY_FOR_REVIEW. DEC-FIN-009 is explicit that a data-quality defect must not block creation, compute
or export — only security/tenant breach and mathematically undefined operations may block. So the severity
rides on things that **mark**: `result_quality='PROVISIONAL'` (DEC-FIN-009's literal
"wynik ma status Provisional / Accepted with critical exceptions") and an open `CRITICAL_DATA` exception in
the ledger. The status only loses the word `CLEAN`.

Consequence to be aware of: the Apator PASS A pack still reaches APPROVED — but it now arrives there
labelled `PROVISIONAL`, with a `CRITICAL_DATA` exception open against it, instead of labelled `CLEAN`.
If the owner wants incomplete packs to be un-approvable, that is a one-line change in
`determineReconciliationStatus` (return `EXCEEDS_MATERIALITY` above the threshold) — flagged here as an
owner decision rather than taken unilaterally, because it contradicts the literal text of DEC-FIN-009.

---

## 3. RC-05 — no plausibility control between periods

### 3.1 Fix

`detectPeriodOverPeriodJumps()` in `statementReconciliationService.ts` — pure, DB-free, unit-tested.
`runReconciliation()` loads the version's balance-sheet cells (`loadBalanceSheetObservations()`), groups them
into per-`(entity, canonical line, scope, basis)` series ordered by `period_end`, walks consecutive pairs, and
raises one **`WARNING`** exception (`reason_code='PERIOD_OVER_PERIOD_JUMP'`) per finding, deduplicated by
`dedup_key` so a re-run does not multiply the ledger.

Each exception carries `expected` = prior value, `observed` = current value, `delta`, and evidence containing
both period labels, the signed % change, the materiality floor and a sentence a human can read.

### 3.2 Thresholds, and why these

**Relative: ±80%.**
Working-capital positions track revenue; a group whose revenue moved +8% y/y does not move a payables balance
by 80% for an operating reason. Above 80% the move is either a corporate event (disposal, acquisition,
refinancing) or a defect — and both are things a human must see, which is what a WARNING is for. Setting it
at 30-50% would fire on ordinary cash and debt swings and train the analyst to ignore the flag, which is
worse than no flag. The defect it exists for (−99.2%) clears 80% by an order of magnitude, so the threshold
is not tuned to the sample.

**Material: ≥1% of the largest absolute BS position in the compared periods.**
1% of total assets sits at the conventional lower edge of audit planning materiality (0.5-2% of total
assets). Anchoring to the pack's own largest position instead of a currency amount keeps the control
**unit-agnostic** — identical behaviour whether the pack is filed in UNITS, THOUSANDS or MILLIONS (there is a
regression test asserting exactly that, and the live run confirms it: the UNITS scale-control pack produced
the same percentages as the THOUSANDS pack).

Both constants are exported (`PERIOD_JUMP_RELATIVE_THRESHOLD_PCT`, `PERIOD_JUMP_MATERIALITY_ANCHOR_PCT`),
overridable per call, and marked PROVISIONAL_PENDING_OWNER_DECISION like the materiality placeholder.

### 3.3 What it deliberately does not flag

- **Either side MISSING** — that is RC-06 (a coverage gap); reading a NULL as 0 would manufacture a fake
  "100% collapse" out of a missing row.
- **Prior value exactly 0** — the relative change is undefined, not infinite, and a line appearing for the
  first time (new lease, new instrument) is ordinary.
- **Immaterial lines** — 3 → 300 on a PLN 1.4bn pack is noise.

### 3.4 Non-blocking, verified

`WARNING` is not `SECURITY`, so readiness check #7 (`NO_BLOCKING_EXCEPTIONS`) still passes, and the jump
never touches `status`. It raises `result_quality` to at most `CONDITIONAL`, never `PROVISIONAL` — a
plausibility flag is not by itself grounds for calling a whole pack provisional. Asserted in the pg test by
reading `finance_stmt_readiness_check()` back after the warning is raised.

---

## 4. `lineageService.ts:177` — compile error

```
TS2322: Type '{ ok: false; code: "LINEAGE_CYCLE_REJECTED" | "ASSUMPTION_SNAPSHOT_HASH_REQUIRED"
| "ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN"; message: string; }' is not assignable to type 'InsertEdgeResult'.
```

`insertEdge` forwards a `validateEdgeRank` rejection verbatim (`return preCheck`). `EdgeRankValidation` has
three failure codes, `InsertEdgeResult` had two of them plus `DUPLICATE_EDGE`. TypeScript cannot narrow
`preCheck` in the `else` branch because after `!preCheck.ok` it is a *single* object type whose `code` is a
union — comparing the property narrows the property, not the object.

**Fix chosen: add `ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN` to the `InsertEdgeResult` union.** Rationale, from the
code's own comment: the value is "kept in the union for forward-compat with a future stricter B03 amendment;
fall through to DB semantics". Keeping the two unions in sync is what makes that comment true instead of
aspirational. **Zero runtime change** — the code still falls through to DB semantics and never returns
FORBIDDEN today; callers exhaustively switching on `code` gain a branch, not a behaviour change.
`lineageService.test.ts` (7 assertions on `validateEdgeRank`/`stageRank`) is untouched and green.

---

## 5. Evidence — red before, green after

Both service files were reverted to `HEAD` (`git show HEAD:… > …`), the new tests run, then the fix restored.
The migration stayed applied throughout, so the red is behavioural, not a missing column.

### 5.1 Red (pre-fix), 27 failures

```
× the real Apator PASS A shape (212 of 280 line-values with no P0 target, routed as
  EXCLUDE/NO_P0_CANONICAL_TARGET) is PROVISIONAL with a countable coverage exception — not CLEAN
  AssertionError: expected 'CLEAN' not to be 'CLEAN'

× the same 212 rows arriving as UNMAPPED (no rule at all) are caught identically
  AssertionError: expected 'CLEAN' not to be 'CLEAN'

× Apator trade payables 93 591 -> 722 tys. PLN (-99.2%) raises a WARNING exception
  TypeError: Cannot read properties of undefined (reading 'find')      // result.periodJumps did not exist

× THE BUG: residual is exactly 0 yet three quarters of the source never arrived — this must not read CLEAN
  TypeError: determineResidualStatus is not a function

× a single immaterial lost row still forbids CLEAN, but only reaches CONDITIONAL
  AssertionError: expected 'CLEAN' to be 'WITHIN_TOLERANCE'
```

The count assertions (`280` rows / `212` without a target / `68` with / `89` distinct extractor ids) passed
**before** the failing line in every case — the fixture really is the report's data, not a look-alike.

### 5.2 Green (post-fix)

```
Test Files  2 passed (2)
     Tests  41 passed (41)
```

### 5.3 Full canonical regression

```
server/src/services/finance/canonical/__tests__/   Test Files  16 passed (16)
                                                        Tests  216 passed (216)
```
(baseline before this work on the same cluster: 15 files / 188 tests, all green.)

### 5.4 `tsc -p server/tsconfig.json`

| | errors | files |
|---|---:|---|
| before | 19 | `lineageService.ts` (1) + `resultsVnext/roi/engine/roiCalculationEngine.ts` (18) |
| after | 18 | `resultsVnext/roi/engine/roiCalculationEngine.ts` (18) |

The target error is gone. The 18 that remain are **pre-existing and unrelated** — all in
`server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`, all the same `decimal.js` import shape
(`TS2709 Cannot use namespace 'Decimal' as a type`, `TS2351 expression is not constructable`,
`TS2339 ROUND_HALF_EVEN / ROUND_HALF_UP does not exist`). Outside this package's allowlist, untouched.

### 5.5 Migration replay on a fresh database

Full `migrate.postgres.ts --safe` run against an empty `rc0105fresh`: exit 0, the new file applied in
sequence, and all three columns present afterwards.

### 5.6 End-to-end on the real Apator documents

The unmodified real-company harness re-run against the fixed code:

```
[PASS A] buckets={"MAPPED":68,"EXCLUDED":212}
[PASS A] reconciliation status=WITHIN_TOLERANCE residual=0 ready=true     (was: status=CLEAN)
[PASS B] buckets={"MAPPED":84}
[PASS B] reconciliation status=CLEAN residual=0 ready=true
```

`finance_reconciliation_runs`:

| status | result_quality | source_value_coverage_pct | pack |
|---|---|---:|---|
| `WITHIN_TOLERANCE` | **`PROVISIONAL`** | **0.72447** | PASS A (as-extracted) |
| `CLEAN` | `CONDITIONAL` | 1.00000 | PASS B (analyst-completed) |
| `CLEAN` | `CONDITIONAL` | 1.00000 | scale control (UNITS) |
| `CLEAN` | `CONDITIONAL` | 1.00000 | probe 3 (CONTRA) |

`finance_exceptions`:

| reason_code | severity | count |
|---|---|---:|
| `RECONCILIATION_SOURCE_COVERAGE_INCOMPLETE` | `CRITICAL_DATA` | 1 |
| `PERIOD_OVER_PERIOD_JUMP` | `WARNING` | 14 |

Two things worth reading off that table:

1. **PASS A loses 76% of the ROWS but only 27.6% of the VALUE** (coverage 0.72447) — the surviving 68 rows
   are the big aggregates. Both numbers are now visible; previously neither was.
2. The 14 warnings are 3-4 per pack across four packs, not a flood:
   `AP` −99.2% (the RC-05 target), `RETAINED_EARNINGS` −29 215 → −72 699 (−148.8%) and −72 699 → 8 590
   (+111.8%) — the real IFRS equity movements RC-02 already documents — and `WORKING_CAPITAL`
   56 343 → 126 482 (+124.5%). Every one is a move a reviewer should genuinely look at.
   The UNITS pack produced identical percentages to the THOUSANDS pack, confirming unit-agnosticism live.

The harness's committed output files (`apator_real_pipeline_results.json`, `..._run.log`) were restored to
their committed content after the run — this fix package does not rewrite the proof's evidence.

---

## 6. Files changed

| file | change |
|---|---|
| `server/src/services/finance/canonical/statementMappingService.ts` | `excludeKind`, `TAXONOMY_GAP_EXCLUSION_REASON_CODES`, `isCoverageLoss()`, `MappedRowResult.coverageLoss` |
| `server/src/services/finance/canonical/statementReconciliationService.ts` | `CoverageMetrics`, coverage-aware status, `determineResultQuality()`, coverage exception, `detectPeriodOverPeriodJumps()` + `loadBalanceSheetObservations()` + WARNING raising |
| `server/migrations/20260810_finance_v3_d02_reconciliation_coverage.sql` | new, additive: 3 columns + 1 index |
| `server/src/services/finance/canonical/lineageService.ts` | type-only: one variant added to `InsertEdgeResult` |
| `server/src/services/finance/canonical/__tests__/statementReconciliationService.test.ts` | +27 pure tests (coverage math, status/quality, jump detector) |
| `server/src/services/finance/canonical/__tests__/statementCoverageAndJumps.pg.test.ts` | new, real-Apator pg regression |

The pg regression reads the committed extraction evidence
(`.../realcompany/apator_real_source.json`) and **throws** if it is missing rather than skipping — a skip
here would restore exactly the false green the suite exists to catch.

---

## 7. Not fixed here (out of scope, flagged)

- **RC-01 root cause** — the P0 taxonomy is still 31 codes against a 251-entry extractor registry. This
  package makes the gap loud and countable; it does not widen the taxonomy.
- **RC-05 root cause** — `fsl-bs-ap` FY2024 = 722 is still a wrong number from extraction. The control flags
  it; the parser fix is RC-00's package.
- **Owner decision** — whether an incomplete pack should be un-approvable (section 2.4).
- **Non-BS statements** — the jump control covers `statement_type='BS'` only, per the finding's scope. P&L and
  CF plausibility (e.g. revenue collapsing 99%) is a natural extension, not done here.
