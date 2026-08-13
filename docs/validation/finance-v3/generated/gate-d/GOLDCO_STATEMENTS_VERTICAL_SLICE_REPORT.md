# GoldCo Statements Vertical Slice — Gate D / Fala 3 close-out report

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 13
("Gold vertical slice") and section 14 ("Fala 3 — GoldCo Statements + productivity contracts/grid/drafts").
**Scope of this WP:** the Statements layer only (WP-D01/WP-D01b/WP-D02's own schema and services). Analysis,
Baseline Models, Prediction, and Valuation — also named in section 13's full GoldCo description — belong to
Fala 4–7 and do not exist as engines yet; this slice does not attempt to test them.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `PIPELINE VS ORACLE: 347/347 comparable values MATCH. Restatement flow: PARTIALLY BLOCKED by a newly
found P0 bug (BUG-GOLDCO-03), not by a data mismatch. Two additional bugs found and documented (BUG-GOLDCO-01
P1, BUG-GOLDCO-02 P0), none fixed in this WP — all three live in prior-committed WP-B01/WP-C02/WP-D01b files
outside this WP's ownership.`

---

## 1. What this WP read before building anything

1. `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 13 (exact GoldCo spec: PLN parent + EUR
   subsidiary, FY2023-2025 + monthly, 2024 restatement, consolidated pack + elimination + NCI).
2. `generated/gate-d/WP-D01_statements_schema_ADR.md` (full DDL, integrity triggers, readiness gate, restatement
   mechanism), `WP-D01b_statements_migration_report.md` (confirms the DDL actually shipped as 3 real migrations,
   590/590 fresh-install), `WP-D02_reconciliation_service_report.md` (the mapping/reconciliation service's exact
   contract and its own 4 integration tests, reused here as the pattern for DB isolation and lifecycle wiring).
3. `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 2 (fiscal calendars, restatements, consolidation/
   NCI/eliminations, currencies/FX/CTA — and specifically the tolerance correction: `LEAST(source-rounding,
   materiality)`, not `max(1 unit, 0.1%)`).
4. The actual service source (`server/src/services/finance/canonical/{statementMappingService,
   statementReconciliationService,artifactVersionService,lifecycleService}.ts`) and the actual migration SQL
   (`server/migrations/20260809_finance_v3_d01_statements_0{1,2,3}_*.sql`) — not just the ADR prose — to get
   exact trigger scoping right (this is where BUG-GOLDCO-02 and BUG-GOLDCO-03 were found, both by reading the
   real trigger/index SQL, then confirmed live).

## 2. GoldCo Manufacturing Group — the dataset

Synthetic, invented for this test, not real client data. Full narrative and every number's provenance are in
`goldco/goldco_oracle.ts` (heavily commented); summary:

- **GoldCo Manufacturing S.A. ("PARENT")** — Warsaw, Poland, PLN, mid-size industrial manufacturer.
- **GoldCo Deutschland GmbH ("SUB")** — Germany, EUR, **80%-owned** subsidiary (20% NCI), full consolidation,
  acquired at the start of FY2023.
- FY2023, FY2024 **original** (APPROVED), FY2024 **restated** (inventory valuation error, ERROR_CORRECTION,
  PLN 3,000,000 write-down), FY2025 (built on the restated FY2024 closing position) — full P&L/BS/CF for both
  entities every year.
- FY2025 monthly P&L + cash detail for PARENT (12 months, seasonality-weighted, ties exactly to the annual
  figures).
- One FY2025 consolidated pack: PARENT + SUB (translated EUR→PLN, IAS-21 current-rate method: average rate for
  flow lines, closing rate for stock lines, historical rate for equity + a CTA plug) + one intercompany-loan
  elimination (PLN 3,320,000 / EUR 800,000, matched NATURAL/CONTRA pair) + 20% NCI split.

All standalone entity-year balance sheets balance exactly (A=L+E), all retained-earnings roll-forwards
(opening+NI-dividends=closing) tie exactly, and the FY2025 monthly figures sum exactly to the FY2025 annual
figures — all asserted **inside `goldco_oracle.ts` itself** (six `throw` guards) before the pipeline ever runs,
so the oracle cannot silently be self-inconsistent.

### Documented scope decisions (not hidden, not accidental)

1. The restatement's tax effect is held constant between original/restated (avoids needing a deferred-tax/
   tax-payable BS line the canonical taxonomy does not have) — the full PLN 3,000,000 write-down flows straight
   to NET_INCOME/RETAINED_EARNINGS.
2. Only **one** intercompany elimination is modeled (a BS loan), not a P&L revenue/COGS elimination — the
   schema's elimination-balance trigger nets ELIMINATION-scope rows **per canonical_line_id**, so a revenue/COGS
   elimination would need a contrived shared-line construction; one clean, realistic elimination is enough to
   prove the mechanism.
3. SUB pays no dividend in FY2024/FY2025 (avoids an intercompany-dividend/equity-method elimination, out of
   scope for a Statements-only slice).
4. The consolidated pack covers FY2025 only, not all three years (the mechanism is proven once at full depth).
5. Monthly detail is P&L(+cash)-only for PARENT, not full monthly BS/CF.
6. GoldCo's own "standalone" entity packs are mapped at the schema's **default** `consolidation_scope`
   (`'CONSOLIDATED'`, not `'STANDALONE'`) so the balance/cash/RE-rollforward triggers actually fire against
   real, multi-year, oracle-derived data — see section 5, BUG-GOLDCO-02, for why this was necessary and what it
   revealed. A dedicated minimal negative probe instead explicitly exercises `'STANDALONE'` scope.
7. Cross-fiscal-year retained-earnings/cash roll-forward triggers only fire **within one `business_version_id`**
   (confirmed by reading the trigger SQL: the previous-period lookup is scoped by `business_version_id`, not
   just by `period.previous_period_id`). Since PARENT's FY2023/FY2024/FY2025 are three separate Statement Pack
   Versions (as a real close cadence would produce), the DB roll-forward triggers do **not** get live,
   cross-pack coverage for the annual chain — only within-pack coverage (proven for the FY2025 monthly pack,
   which chains 12 periods inside one version). The oracle's own internal roll-forward assertions are the
   correctness evidence for the annual PARENT/SUB RE chain; this is a modeling-choice limitation, not a bug (see
   note in section 5 for why it is not filed as one).

## 3. How the pipeline was run (DB isolation)

Per the task's hard ban on touching any shared/live database:

- Own ephemeral PostgreSQL 15 cluster, `initdb --locale=C`, `LC_ALL=C` exported for every invocation, data
  directory `/private/tmp/goldco-pgdata-<pid>` (outside the repo), port `57219` (55000-59999 range, verified
  free with `lsof`/`pg_isready` first), `listen_addresses=127.0.0.1`.
- Full migration set applied fresh via the project's own runner: `DB_TYPE=postgres NODE_ENV=test
  DATABASE_URL=postgresql://postgres@127.0.0.1:57219/finance_v3_goldco npx tsx server/scripts/migrate.postgres.ts`
  — **590/590 migrations, 0 errors**, including the three WP-D01b Statements migrations.
- The shared Homebrew instance (PID 911, `/opt/homebrew/var/postgresql@15`) was confirmed running before,
  during (via `ps aux`, two fully separate postmaster processes), and after this session, never connected to.
- `pg_ctl stop` + `rm -rf` of the ephemeral data directory after this WP's work (executed at the end of this
  report, section 7).
- Pipeline run: `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
  DATABASE_URL=postgresql://postgres@127.0.0.1:57219/finance_v3_goldco npx tsx
  docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts`

## 4. Result: pipeline vs. independent oracle

`goldco_compare.ts` loads `goldco_oracle.json` (computed by hand-written arithmetic in `goldco_oracle.ts`,
**zero imports from any pipeline/service code**) and `goldco_pipeline_results.json` (values read back **out of**
`finance_stmt_lines` via direct SQL, never the oracle's own numbers echoed back) and diffs every field with
tolerance `LEAST(1 presentation unit, 5% of that period's total assets)` — the exact formula
`finance_stmt_balance_tolerance()` uses in the DB itself (WP-D01 ADR section 5.0's "korekta tolerancji": the
more restrictive of source-rounding and materiality, not `max(1 unit, 0.1%)`).

**Result: 347/347 comparable values match within tolerance.** (2 additional rows are `N/A` by design — the
NCI equity/net-income split, which has no dedicated canonical taxonomy line and was therefore never written to
`finance_stmt_lines`, documented in scope decision above; shown in the comparison JSON for completeness, not
counted as a pass or fail.)

Covered, all matching:

| Section | What matched |
|---|---|
| PARENT FY2023 / FY2024 original / FY2024 restated / FY2025 | Full P&L (10 lines), full BS (12 lines), retained earnings, dividends, CF (4 lines) — 4 periods × 27 fields |
| PARENT FY2025 monthly (12 months) | P&L (10 lines) + cumulative cash + net-change-cash per month, **and** the sum of 12 monthly pipeline values vs. the FY2025 annual pipeline value (a pipeline-internal tie-out, not oracle-dependent) — for revenue/COGS/net income |
| SUB FY2023 / FY2024 / FY2025 (EUR) | Full P&L, full BS, retained earnings — 3 periods × 23 fields |
| GoldCo Group FY2025 consolidated | Consolidated REVENUE/COGS/NET_INCOME (pre-NCI), TOTAL_ASSETS/TOTAL_LIABILITIES/TOTAL_EQUITY/TOTAL_LIABILITIES_EQUITY, SUB's FX-translated REVENUE/NET_INCOME/TOTAL_ASSETS/EQUITY/TOTAL_LIABILITIES_EQUITY/CTA_OCI, the elimination pair's stored NATURAL/CONTRA net (=0), and the intercompany loan face value |
| PARENT FY2024 restatement delta | Restated NET_INCOME − original NET_INCOME = exactly the PLN 3,000,000 write-down (both oracle-internal and pipeline-read) |

Full row-by-row detail (all 349 rows, including the 2 N/A rows) is in `goldco/goldco_comparison.json`.

### One expected, explained (not a bug) non-zero reconciliation residual

The GoldCo Group FY2025 consolidated pack's reconciliation waterfall reports `residual = -6,640,000`
(`status='WITHIN_TOLERANCE'`, well inside the 5% placeholder on a ~PLN 196M asset base). This is **not** a data
error — `computeWaterfall()`'s `sourceTotal` sums every raw row's face value regardless of bucket, including
**both** elimination legs at their full −3,320,000 face value each (−6,640,000 total), while
`canonicalTotal`'s `eliminationNetTotal` correctly nets the matched NATURAL/CONTRA pair to zero (as designed,
per `statementReconciliationService.ts`'s own doc comment on `duplicateTotal`/elimination netting). Mixing
heterogeneous P&L/BS totals and elimination legs into one reconciliation batch produces a `sourceTotal` that has
no independent accounting meaning on its own — the batch-level "reconciliation ledger" waterfall is a generic,
artifact-agnostic mechanism (WP-B05), not a per-statement-type total. The thing that actually proves the
consolidated pack is correct is the **balance trigger passing without raising** (confirmed: the transaction
committed, i.e. `finance_stmt_check_balance()` did not reject it) plus the value-by-value oracle comparison
above, both of which are clean.

## 5. Restatement flow — what worked, what didn't, and why

| Step | Result |
|---|---|
| FY2024 original mapped, reconciled CLEAN, `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED` | ✅ |
| `reopenVersion()` (T12): new `vN+1 = DRAFT`, `parent_version_id = vN`, `vN` untouched | ✅ (confirmed: `vN`'s `finance_stmt_lines` row count unchanged at 28 both before and after) |
| `vN+1.version_kind = 'RESTATED'`, `restatement_reason`/`restatement_class` set | ✅ **via a documented workaround**, not through `reopenVersion()` itself — see BUG-GOLDCO-01 |
| Restated FY2024 mapped (write-down applied), reconciled CLEAN, `DRAFT → READY_FOR_REVIEW → IN_REVIEW` | ✅ |
| Restated FY2024 → `APPROVED` | ❌ **blocked by BUG-GOLDCO-03** (P0) — `approveVersion()` throws a raw Postgres unique-violation for every version that has a `parent_version_id`, i.e. every reopened/restated version, unconditionally |
| Original `vN` → `SUPERSEDED` (T9) once the restated version is approved | ❌ never reached — direct consequence of the row above; `vN` remains `APPROVED` with `superseded_by_version_id = NULL` |
| FY2025 built on the restated closing position | ✅ (the restated numbers are correct and readable even though the version itself never reaches `APPROVED` — DRAFT/IN_REVIEW rows are fully readable, just not immutable/final) |

The task asked for "original APPROVED, then restated as a new version... old original NOT overwritten." The
**data-immutability and version-lineage half of that requirement is fully proven**: the original's content is
byte-for-byte unchanged, the restated version carries its own correct numbers and correct metadata, and the two
are linked via `parent_version_id`. The **lifecycle-completion half** (restated version reaching `APPROVED`, old
version flipping to `SUPERSEDED`) is not reachable through the current `approveVersion()` implementation for
*any* reopened version — not a GoldCo-specific problem, a structural one, documented as BUG-GOLDCO-03 below.

## 6. Bugs found

Per the task instruction: fix if it's a simple bug in *this WP's own new files*; otherwise document as a P0/P1
finding, since the code lives in prior-committed work packages this WP does not own. All three bugs below are
in the second category — **none were patched**, all were reproduced live against real ephemeral Postgres (not
inferred from documentation).

### BUG-GOLDCO-01 (P1) — `reopenVersion()` cannot actually set `version_kind='RESTATED'`

`server/src/services/finance/canonical/artifactVersionService.ts`, `reopenVersion()` (T12). WP-D01's own ADR
(section 6) documents the restatement mechanism as "reopen z dodatkowymi metadanymi (`versionKind: 'RESTATED'`)"
— but `ReopenVersionParams`/the function's `INSERT INTO finance_business_versions` statement has no
`version_kind`/`restatement_reason`/`restatement_class` parameter or column at all. Every reopened version,
restatement or not, silently defaults to `version_kind='ORIGINAL'`. Confirmed live: reading the function's own
source shows the gap; this slice worked around it with a direct `UPDATE` on the still-`DRAFT` row (legal —
the immutability trigger only blocks `APPROVED` rows) and confirmed the columns actually persisted correctly
afterward.
**Status:** documented, not fixed (prior-committed WP-C02 code, out of this WP's file ownership).

### BUG-GOLDCO-02 (P0) — balance/roll-forward triggers silently never check `STANDALONE`-scope rows

`server/migrations/20260809_finance_v3_d01_statements_02_integrity.sql`, section 8.1
(`finance_stmt_check_balance()`) — and by the identical code pattern, sections 8.3/8.4
(cash/retained-earnings roll-forward). Every one of these triggers' `SELECT` is hardcoded to
`consolidation_scope = 'CONSOLIDATED'`. `finance_stmt_lines.consolidation_scope` has three legal values —
`STANDALONE`/`CONSOLIDATED`/`ELIMINATION` (WP-D01 ADR section 4.5) — but a Statement Pack line mapped at
`STANDALONE` (the schema's own documented scope for a genuine single-entity, non-consolidated pack — i.e. most
real-world statement packs, which are not group consolidations) **never triggers the Assets = Liabilities +
Equity check at all.**

Confirmed live with a dedicated negative probe (`goldco_pipeline.ts`, "NEGATIVE-TEST PROBE" section): an
identical PLN 50,000,000 imbalance was mapped twice, once at each scope —

```
[PROBE STANDALONE,    50000000 PLN off-balance] result: {"rejected":false,"mappedCount":2,"storedCount":2}
[PROBE CONSOLIDATED,  50000000 PLN off-balance] result: {"rejected":true,"error":"finance_stmt_lines: balance
  check failed ... assets=100000000 liab+equity=50000000 diff=50000000 tolerance=1"}
```

The `STANDALONE`-scope imbalance was silently accepted and would sail through the readiness gate to
`APPROVED` with no balance check ever having run. This is the master plan's own hard control ("Assets =
Liabilities + Equity w source-rounding tolerance", section 5) silently not applying to the majority real-world
case — the same failure class ("a SQL condition silently evaluates to skip instead of block") WP-D01's ADR
section 7 already found and fixed once, in the readiness gate's `bool_and`/`COALESCE`. This is a second,
previously undiscovered instance of that exact class, in a different trigger.

**Status:** documented, not fixed. A correct fix (checking per-`(entity_id, consolidation_scope)` pair instead
of hardcoding `'CONSOLIDATED'`, or adding an explicit `STANDALONE`-scope variant of each check) is a schema
change to already-migrated Gate D SQL and needs its own ADR sign-off per this program's own discipline, not a
same-day patch inside a data-slice exercise.

### BUG-GOLDCO-03 (P0, blocking) — no reopened/restated version can ever reach `APPROVED`

`server/migrations/20260809_finance_v3_b01_core_artifacts.sql:143` (`uq_finance_bv_one_approved`, a partial
`CREATE UNIQUE INDEX ... WHERE status = 'APPROVED'`) combined with `approveVersion()`'s own step ordering
(`artifactVersionService.ts`, T8): step (c) sets the **child** row to `APPROVED` first; T9 (demote the
**parent** to `SUPERSEDED`) runs **after**, in the same transaction. Postgres partial unique **indexes** (as
opposed to table `CONSTRAINT`s) cannot be declared `DEFERRABLE` — the uniqueness check fires at the end of the
child's `UPDATE` statement, not at `COMMIT`. Since reopening a version *requires* its parent to already be
`APPROVED` (that is `reopenVersion()`'s own precondition), the parent is **always** still `APPROVED` at the
moment the child's `UPDATE` runs — the unique index rejects it immediately, before T9 ever executes:

```
[PARENT FY2024 RESTATED] approve THREW: duplicate key value violates unique constraint "uq_finance_bv_one_approved"
```

This blocks **every** restatement or plain reopen-then-approve in the entire schema, not just this slice's
scenario — it is a structural bug in already-committed WP-B01 (the index) + WP-C02 (`approveVersion()`'s step
order), not a GoldCo-data problem. `WP-B02_lifecycle_concurrency_ADR.md` section 5.2 already flags "T9 in the
same transaction" as a documented tradeoff, but does not appear to have been exercised against a real Postgres
partial unique index before this slice.

**Status:** documented, not fixed. A correct fix needs its own ADR (either reorder T9 before the child's
`UPDATE` within the same transaction — SUPERSEDE parent, THEN approve child — or replace the partial unique
index with a deferrable-constraint-trigger equivalent, the exact pattern WP-D01's own five triggers already use
for cross-row checks); this is squarely in "already-committed code from a previous work package" territory per
this WP's own instructions, not a same-day patch.

## 7. Teardown

```
pg_ctl -D /private/tmp/goldco-pgdata-31368 stop
rm -rf /private/tmp/goldco-pgdata-31368
```

Executed after this report was written; confirmed via a final `ps aux` that only the shared Homebrew instance
(PID 911) remained.

## 8. Files

- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts` — independent workbook-oracle (source of
  truth), self-asserting, zero pipeline/service imports.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json` — oracle output (generated).
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts` — runs the real
  `statementMappingService`/`statementReconciliationService`/`artifactVersionService`/`lifecycleService` against
  an ephemeral Postgres, reads every intermediate value back out of the DB.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline_results.json` — pipeline output
  (generated), includes the `bugs[]` array reproduced live during the run.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_compare.ts` — diffs oracle vs. pipeline with the
  DB's own tolerance formula.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_comparison.json` — full 349-row comparison result
  (generated).
- This report.

## 9. Reproduce

```bash
# 1. Own ephemeral Postgres (never the shared instance / demo / dev / prod).
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/initdb --locale=C -D /private/tmp/goldco-repro-pgdata -U postgres
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/goldco-repro-pgdata \
  -o "-p 57219 -h 127.0.0.1" -l /private/tmp/goldco-repro-pg.log start
/opt/homebrew/opt/postgresql@15/bin/createdb -h 127.0.0.1 -p 57219 -U postgres finance_v3_goldco

# 2. Migrate.
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:57219/finance_v3_goldco \
  npx tsx server/scripts/migrate.postgres.ts

# 3. Oracle -> pipeline -> compare.
npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:57219/finance_v3_goldco \
  npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts
npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_compare.ts

# 4. Teardown.
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/goldco-repro-pgdata stop
rm -rf /private/tmp/goldco-repro-pgdata
```
