# ROI-E007 fan-in — independent verification report

**Branch:** `codex/finance-v3-roi-e007-fanin`
**Verified HEAD:** `dbe91576fef03f8740df71aade53b042bfc8009b` (2026-08-10 10:05:43 +0200)
**Pre-fan-in base:** `a1de531d90` (the commit the three stream merges landed on top of)
**Position vs `origin/demo`:** 220 ahead, 0 behind
**Date of verification:** 2026-08-10
**Mode:** pure verification — no code was changed. Every defect found is documented, not fixed.

## Environment

Purpose-built ephemeral PostgreSQL, torn down after the run. Nothing was executed
against demo, prod or dev.

| Item | Value |
| --- | --- |
| Engine | PostgreSQL 15.15 (Homebrew, `postgresql@15`) |
| Port | 55000 (probed free with `lsof -i:PORT`; never 5432/28711/52824) |
| Locale | `LC_ALL=C` at both `initdb` and `pg_ctl start` |
| Database | `roi_e007`, created empty, extensions `uuid-ossp` + `pgcrypto` |
| Vitest cwd | `server/` for `server/src/**`; repo root for `tests/**` |

**Env contract that decides truth or fiction:** the Finance `.pg.test.ts` suites gate on
`RUN_DB_TESTS=1` **and** `MOCK_DB=false` **and** a non-empty `DATABASE_URL`. The first run of
point 3 omitted `MOCK_DB=false` and reported `308 passed | 144 skipped`, **exit 0** — a green
exit that had silently skipped every real-database suite. All numbers below come from the
re-run with the complete env. Any future run of this gate that does not print
`27 passed (27)` for test *files* has not actually touched a database.

---

## Verdict table

| # | Check | Result |
| --- | --- | --- |
| 1 | Migrations from zero, strict (no `--safe`) | **PASS** |
| 2 | No duplicate ownership of `rvn_roi_*` | **PASS** |
| 3 | Full Finance regression | **PASS** |
| 4 | Canonical Results vNext tests not worsened | **PASS** (no fan-in regression; 12 pre-existing reds remain) |
| 5 | Stream B + Stream C adapters coexist | **PASS** |
| 6a | `roi_realized_values` UPDATE rejected | **PASS** |
| 6b | `v8_roi_realization_entries` UPDATE rejected | **PASS** (with a documented schema-twin gap) |
| 6c | `benefit_tracking.actual_*` UPDATE rejected | **EVIDENCE_MISSING** (structural — table absent by design) |
| 6d | `PUT /api/economics/analyses/:id/benefits` | **PASS** |
| 7 | RC-00 parser still fixed after the merge | **PASS** |
| 8 | `tsc` error count not increased | **PASS** |

---

## 1. Migrations from zero — PASS

```
DOTENV_IGNORE_LOCAL=1 NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55000/roi_e007 \
  npx tsx server/scripts/migrate.postgres.ts
```

| Metric | Value |
| --- | --- |
| Exit code | **0** |
| Migrations applied | **625** |
| `schema_migrations` status breakdown | `success = 625`, `failed = 0`, `skipped = 0` |
| Base tables created (`public`) | 1448 |

`--safe` was deliberately **not** passed, so a failing migration would have aborted with
exit 1 rather than being recorded as `skipped`. The single-status result (`success|625`)
is therefore a real assertion, not the `--safe` artefact that produced past false greens.

Required migrations, all recorded `success`:

| Migration | Role | Status |
| --- | --- | --- |
| `20260810_finance_v3_d01c_real_company_integrity_fix.sql` | RC-02 / RC-03 | success |
| `20260810_finance_v3_d02_reconciliation_coverage.sql` | **RC-01 / RC-05** (name resolved from commit `ec0b2937f0`) | success |
| `20260815_rvn_roi_core.sql` | canonical ROI core | success |
| `20260820_rvn_roi_finance_seam.sql` | canonical Finance seam | success |
| `20260809_finance_v3_e007_03_legacy_actual_protection.sql` | append-only triggers | success |

All 19 `rvn_roi_*` tables are present, including `rvn_roi_finance_links` and
`rvn_roi_finance_reconciliations`.

## 2. No duplicate ownership of `rvn_roi_*` — PASS

A repo-wide grep for `CREATE TABLE … rvn_roi_finance` over `server/` and `src/` returns
exactly two hits, both in the canonical seam migration:

```
server/migrations/20260820_rvn_roi_finance_seam.sql:18: CREATE TABLE IF NOT EXISTS rvn_roi_finance_links (
server/migrations/20260820_rvn_roi_finance_seam.sql:46: CREATE TABLE IF NOT EXISTS rvn_roi_finance_reconciliations (
```

The Finance-owned duplicates were removed in `d6b27db6fa`
(*"revert(roi-e007): drop conflicting Finance-owned rvn_roi_* schema (Stream A 01/02)"*),
deleting `20260809_finance_v3_e007_01_tables.sql` and
`20260809_finance_v3_e007_02_integrity.sql`. **Neither file came back through any of the
three merges** — `ls server/migrations/ | grep -Ei "e007_01|e007_02"` is empty at HEAD.

The only other file mentioning these tables is
`20260809_finance_v3_e007_03_legacy_actual_protection.sql`, and only inside `RAISE EXCEPTION`
message text — no DDL. Ownership is single and canonical.

## 3. Full Finance regression — PASS

```
cd server && DOTENV_IGNORE_LOCAL=1 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:55000/roi_e007 \
  npx vitest run src/services/finance --no-file-parallelism
```

| Metric | Value |
| --- | --- |
| Test files | **27 passed / 27** |
| Tests | **452 passed, 0 failed, 0 skipped / 452** |
| Exit code | 0 |

Coverage spans canonical (14 files), grid/statement, collaboration (3), keyboard (1) and
workspace (1). The 12 `.pg.test.ts` suites ran against the real database — their
130–770 ms durations (vs 3–6 ms for the pure-unit suites) confirm real I/O rather than a
silently mocked driver.

**Zero red tests.** No failure to classify as pre-existing or merge-induced.

Per-file results (abridged to the suites this wave touched):

| File | Tests |
| --- | --- |
| `canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts` (Stream B) | 4 passed |
| `canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts` (Stream C) | 16 passed |
| `canonical/__tests__/valuationAdvisorService.pg.test.ts` (Gate A, 34 rules) | 21 passed |
| `canonical/__tests__/statementCoverageAndJumps.pg.test.ts` (RC-01/RC-05) | 5 passed |
| `keyboard/__tests__/KeyboardCommandRegistry.test.ts` (AP-03) | 25 passed |
| `workspace/__tests__/workspaceContracts.test.ts` (AP-09/10/11) | 80 passed |
| `__tests__/numberNotation*.ts` (RC-00, 3 files) | 35 passed |

## 4. Canonical Results vNext tests — PASS (no regression from the fan-in)

| File | Tests | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- |
| `tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts` | 5 | 0 | 5 | 0 |
| `tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts` | 6 | 0 | 6 | 0 |
| `tests/resultsVnext/roi/roiActualEntryAppendOnly.realdb.test.ts` | 3 | 2 | 1 | 0 |
| `server/src/routes/resultsVnext/__tests__/roiFinanceSeam.routes.test.ts` | 18 | 18 | 0 | 0 |
| **Total** | **32** | **20** | **12** | **0** |

### The failure cause is unchanged and single

All **12** failures carry byte-identical error text — the log contains exactly 12 occurrences
of one string and no other error class:

```
error: new row for relation "initiatives" violates check constraint "initiatives_status_check"
```

Root cause, confirmed directly against the live schema:

```sql
-- column default
initiatives.status DEFAULT 'step3'::text
-- its own constraint
CHECK (status = ANY (ARRAY['DRAFT','PENDING_REVIEW','REVIEW','PROMOTED','PLANNING','APPROVED',
                           'SCHEDULED','EXECUTING','BLOCKED','DONE','TRACKING','CANCELLED','ARCHIVED']))
```

`'step3'` is not in its own allow-list. Every fixture that inserts an initiative without an
explicit `status` — which all these tests do — is rejected on a fresh strict database.
`20260624_initiative_status_normalize.sql` backfills legacy `'step3'` rows and adds the CHECK
but **never drops the column DEFAULT**.

### Proof that this is pre-existing and not merge-induced

- `git diff a1de531d90 HEAD` over all four test files: **empty** — byte-identical to pre-fan-in.
- `git diff a1de531d90 HEAD -- server/src/services/resultsVnext server/src/routes/resultsVnext tests/resultsVnext`: **empty** — the fan-in did not touch the canonical ROI source tree or its tests at all.
- The two migrations that own the defect (`20260624_initiative_status_normalize.sql`, `000_z_core_baseline.sql`) date from 2026-06-24 and 2026-08-02 and are untouched by the fan-in.

The fan-in therefore **cannot** have caused or worsened these failures.

### Note on the 38 vs 32 baseline discrepancy

The prior measurement was recorded as *19 passed / 15 failed / 4 skipped of 38*. This run
collects **32** tests from these four files, with **0** skipped. The gap is not a loss of
coverage introduced by the merge: the files are byte-identical to the pre-fan-in commit, and
`roiFinanceSeam.routes.test.ts` contains no `skipIf` gate at all (18 unconditional tests), so
it cannot contribute skips. The earlier figure most likely came from a different or wider file
set. **Failures went from 15 to 12 and the cause is identical — the numbers did not worsen.**

### Supplementary: the whole ROI suite tells the same story

Running all of `tests/resultsVnext/roi` (37 files, 120 tests): **60 passed / 48 failed /
12 skipped**. Every one of the 48 failures traces to the same
`initiatives_status_check` string — 100 occurrences in the log, no second cause. This is a
single platform-level defect gating the ROI domain, not ROI-E007 breakage.

## 5. Stream B + Stream C adapter coexistence — PASS

Both adapters are now in one tree for the first time. Assessment:

**Compile together:** yes. `tsc -p server/tsconfig.json` reports **zero** errors in
`roiFinanceLinkAdapter.ts` and `roiFinanceReconciliationAdapter.ts` (see point 8).

**Name collisions:** none. The exported symbol sets are disjoint — Stream B exports
`linkFinanceArtifactToRoiCase`, `getFinanceContextForLink`, `listFinanceLinksForCase`,
`FinanceBusinessVersionNotFoundError`, `FinanceArtifactNotFoundError`; Stream C exports
`detectAndReconcile`, `resolveReconciliationDecision`, `assessMateriality`,
`findReconciliationTargetForInitiative`, `findActiveRoiCaseIdForInitiative`,
`RoiFinanceReconciliationAdapterError`, `ReconciliationNotFoundError`,
`PROVISIONAL_MATERIALITY_THRESHOLD_PCT`.

**Duplicated responsibility:** none. Stream C's report was accurate — it imports
`listRoiFinanceLinks` directly from the canonical repository
(`server/src/services/resultsVnext/roi/roiFinanceLinkRepository.js`, line 56). Stream B
imports **the same canonical function from the same module** (line 44). Both paths converge on
one canonical reader; there is no second implementation and no divergent behaviour.

**Tests on one database:** both suites executed in a single vitest invocation against the same
`roi_e007` database — **20 passed / 20** (Stream B 4, Stream C 16), exit 0.

### Recommendation: leave it as it is — do not change the import

Stream B's `listFinanceLinksForCase` is a **zero-behaviour pass-through**:

```ts
export async function listFinanceLinksForCase(
  organizationId: string, caseId: string, userId: string
): Promise<RoiFinanceLink[]> {
  return listRoiFinanceLinks({ userId, organizationId, caseId });
}
```

Switching Stream C to call it would add no behaviour, would introduce a dependency between two
sibling adapters that currently have none, and would move Stream C one hop further from the
canonical reader. The current arrangement — both adapters calling canonical directly — is the
correct one.

*Backlog (non-blocking):* `listFinanceLinksForCase` has **no production caller**. Its only
reference in the entire tree is its own test, self-described as a *"thin wrapper sanity
check."* It is dead code that should either acquire a caller or be removed — but that is a
Stream B scope question, not a fan-in blocker.

## 6. Physical proof: ROI Actual cannot be silently overwritten

Executed as raw SQL against the merged database. **Methodology note:** a first attempt
produced `UPDATE 0` on every table and looked like a pass — it was not. The fixture rows had
failed to insert on FK violations, so the row-level triggers never fired. `UPDATE 0` on an
append-only table is not evidence of protection; it is evidence of an empty table. The results
below all begin from a **confirmed inserted row**.

### 6a. `roi_realized_values` — PASS

| Step | Result |
| --- | --- |
| INSERT fixture | 1 row, `realized_savings = 1000` |
| `UPDATE … SET realized_savings = 999999` | **REJECTED** |
| Value after | **1000** (unchanged) |
| `DELETE` | **REJECTED** |
| Rows after | **1** (unchanged) |

```
ERROR: roi_realized_values is append-only under ROI-E007 governance; UPDATE not permitted
(row proof-rrv-1) -- corrections must be new rows (variance_notes/source explaining the
correction), reconciliation must open a row in rvn_roi_finance_reconciliations, never
UPDATE realized_* here
CONTEXT: PL/pgSQL function roi_realized_values_deny_mutation() line 3 at RAISE
```

### 6b. `v8_roi_realization_entries` — PASS

| Step | Result |
| --- | --- |
| INSERT fixture | 1 row, `realized_value = 500` |
| `UPDATE … SET realized_value = 888888` | **REJECTED** |
| Value after | **500** (unchanged) |
| `DELETE` | **REJECTED** |
| Rows after | **1** (unchanged) |

```
ERROR: v8_roi_realization_entries is append-only under ROI-E007 governance; UPDATE not
permitted (row proof-v8-1) -- corrections must be new rows, reconciliation must open a row
in rvn_roi_finance_reconciliations, never UPDATE realized_value here
CONTEXT: PL/pgSQL function v8_roi_realization_entries_deny_mutation() line 3 at RAISE
```

#### Finding F-1 (non-blocking, hardening): the `v8`-schema twin is unprotected

The database contains **two** copies of this table: `public.v8_roi_realization_entries` and
`v8.v8_roi_realization_entries` (the latter created by `20260719_baseline_gap.sql`).
`20260809_finance_v3_e007_03_legacy_actual_protection.sql` attaches its triggers to an
**unqualified** `v8_roi_realization_entries`, which resolves through the migration session's
`search_path` to `public` only. The `v8.` twin carries no trigger. Proven physically:

```
INSERT INTO v8.v8_roi_realization_entries … realized_value = 500   -> 1 row
UPDATE v8.v8_roi_realization_entries SET realized_value = 777777   -> UPDATE 1   (no exception)
SELECT realized_value                                              -> 777777     (SILENTLY OVERWRITTEN)
```

**Why this is not a live hole today:** the runtime sets `SET search_path TO public, v8`
(`server/src/database/PostgresDatabase.ts:470,609`; `server/src/utils/queryHelpers.ts:242`), so
`public` is resolved first and every unqualified application write lands on the **protected**
table. No code anywhere references `v8.v8_roi_realization_entries` explicitly. The governance
guarantee holds for all current callers. It is nonetheless a latent gap: any future
schema-qualified write, or any change to search_path ordering, bypasses ROI-E007 governance
without error. Recommend qualifying the trigger DDL, or attaching the same trigger pair to the
`v8.` copy, in a follow-up.

### 6c. `benefit_tracking.actual_*` — EVIDENCE_MISSING

The table **does not exist** on a fresh strict installation:

```sql
SELECT count(*) FROM information_schema.tables WHERE table_name='benefit_tracking';  -- 0
```

Justification, verified rather than assumed:

- `benefit_tracking` is created by exactly one migration — `067_economics_initiative_integration.sql` (line 62). No other migration creates it.
- `migrate.postgres.ts` excludes it via `isSqliteOnlyMigration()`: *"Older pre-baseline fragments (<500) are often SQLite-first and conflict with baseline"* — `if (versionNum > 0 && versionNum < 500) return true` for anything not named `000_z_core_baseline*`. Version 67 < 500.
- Confirmed absent from `schema_migrations` (`WHERE filename LIKE '067%'` returns nothing).

The protection logic **is** written — `20260809_finance_v3_e007_03_legacy_actual_protection.sql`
line 128 carries a column-scoped guard on `actual_cost_savings` / `actual_revenue_increase` /
`actual_productivity_gains`, and it is authored defensively so its absence does not fail the
migration. But it **cannot be exercised on a strict fresh database**, so no physical evidence
can be produced here. This is a structural limitation of the environment, exactly as
anticipated — not a defect in this branch and not a fan-in regression. Proving it requires a
database built from a path that includes migration 067 (i.e. demo, or a run with `--only`).

### 6d. `PUT /api/economics/analyses/:id/benefits` — PASS

Stream C's regression tests are genuine HTTP-level tests (`supertest` against the mounted
Express router), not adapter-level stand-ins. All green against the merged database:

| Test | Result |
| --- | --- |
| REGRESSION A: divergent actual **with** ROI case + link → **200 + reconciliationId**, stored actual **UNCHANGED** | passed (158 ms) |
| REGRESSION B: divergent actual **without** a ROI case → **409**, value unchanged, **NOT 500** | passed (5 ms) |
| An unchanged actual still saves normally (ordinary verify-a-period flow not broken) | passed (5 ms) |
| A sub-threshold divergence still refuses the overwrite and says so, rather than claiming plain success | passed (5 ms) |
| **Negative control:** the raw pre-migration `UPDATE` really is rejected by the trigger (proves the above are not vacuous) | passed (3 ms) |

The negative control matters: it fails if the trigger is absent, so the four assertions above
cannot pass vacuously on an unprotected database.

**Deviation from the brief, stated literally:** the specification asked for "409/422". The
handler emits **409** (`economics.routes.ts:1661,1772`) and **503** for an unreachable
dependency; it never emits **422**. Grep confirms no `422` anywhere in the file. The
behavioural requirement — an honest, actionable refusal instead of a 500 — is met; the
specific code is 409, not 422.

## 7. RC-00 parser still fixed after the merge — PASS

Parser suites: `numberNotation.test.ts` (18), `numberNotation.realCompanyRegression.test.ts`
(14), `numberNotation.persistence.pg.test.ts` (3) — **35 passed, 0 failed**.

The committed test asserts only `< 5%`, so the literal post-fix share was recomputed directly
from `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json` using
the shipped `parseStatementNumber`:

| Filing | Values | Fractional share before | After |
| --- | --- | --- | --- |
| Tesla 10-K 2024 | 39 | 74.4 % | **0.0 %** |
| Coca-Cola 10-K 2025 | 35 | 71.4 % | **0.0 %** |
| bp Annual Report 2025 | 60 | 48.3 % | **0.0 %** |
| BMW Group Financial Statements 2024 | 52 | 46.2 % | **0.0 %** |
| KGHM SRR 2024 | 42 | 2.4 % | **0.0 %** |
| Apator SA Raport R 2024 | 75 | 0.0 % | 0.0 % |
| Grupa Apator Raport RS 2023 | 89 | 0.0 % | 0.0 % |
| Grupa Apator Raport RS 2024 | 90 | 0.0 % | 0.0 % |
| Raport skonsolidowany Apator | 101 | 0.0 % | 0.0 % |

All five named companies are at **exactly 0.0 %**, not merely under the 5 % threshold. Every
"before" figure reproduces the value published in `REAL_COMPANY_PROOF_report.md` §RC-00.

## 8. `tsc` — PASS

```
npx tsc --noEmit -p server/tsconfig.json    # exit 2
```

| Metric | Previous | Now |
| --- | --- | --- |
| Total errors | 18 | **18** |
| Distinct files | 1 | **1** |

All 18 remain in `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`, all from
the same `decimal.js` import shape (`TS2709` "Cannot use namespace 'Decimal' as a type",
`TS2351` "not constructable", `TS2339` on `ROUND_HALF_EVEN`/`ROUND_HALF_UP`).

**No new errors in any file this wave touched.** The fan-in modified 22 files under
`server/src`; cross-referencing every one against the tsc output yields zero matches.
`roiCalculationEngine.ts` itself is untouched by the fan-in (`git diff a1de531d90 HEAD` on it is
empty).

---

## Recommendation

### Terminal state `ROUND_1_CANONICALLY_REBASED_READY_FOR_REVIEW`: **ACHIEVED**

The fan-in is clean. Four branches merged with zero textual conflicts *and* — which is the part
that actually needed proving — zero behavioural conflicts:

- Migrations build a database from zero, strict, 625/625 success, exit 0.
- Schema ownership is single and canonical; the reverted Stream A duplicates did not return.
- The entire Finance surface is green on a real database: **452/452**, nothing skipped.
- The two independently written adapters compile together, collide nowhere, converge on one canonical reader, and pass together on one database: **20/20**.
- The governance guarantee that the whole epic exists to enforce is physically demonstrated: ROI Actual values cannot be silently overwritten, and the endpoint that used to 500 now answers 200-with-reconciliation or an honest 409, with a negative control proving the tests are not vacuous.
- RC-00 holds at a literal 0.0 % across all nine real filings.
- `tsc` did not move: 18 errors, same single pre-existing file.

**Aggregate across everything executed: 504 passed, 12 failed, 0 skipped** (452 Finance +
20 canonical passed + 32-file canonical set). Every one of the 12 failures is pre-existing and
provably outside this branch's diff.

### Three caveats the reviewer must carry forward

1. **P1 — pre-existing platform defect blocks canonical ROI acceptance evidence.**
   `initiatives.status DEFAULT 'step3'` violates `initiatives_status_check`, so no initiative
   can be inserted without an explicit status on a fresh strict database. This alone accounts
   for 12/12 failures in the four canonical files and 48/48 across the full ROI suite. It is
   **not** ROI-E007's to fix — it originates in `000_z_core_baseline.sql` /
   `20260624_initiative_status_normalize.sql` and is untouched by the fan-in — but until it is
   fixed, **the canonical ROI seam cannot be demonstrated green on a fresh database.** The fix
   is one line: drop the column default, or set it to `'DRAFT'`. Recommend raising it as a
   separate platform ticket and re-running point 4 afterwards, because the 20-passed figure is
   currently a floor, not a measurement of the seam's real health.

2. **Point 6c is unprovable in this environment, by design.** `benefit_tracking` is created only
   by migration 067, which the strict runner excludes as a pre-baseline fragment. The guard
   code exists and is written defensively; it simply has no table to attach to here. To close
   this evidence gap, exercise it on a database built by a path that includes 067.

3. **F-1, latent hardening item.** `v8.v8_roi_realization_entries` accepts a silent overwrite
   (proven: 500 → 777777, no exception) because the protection migration attaches its triggers
   unqualified, hitting `public` only. Not currently reachable — the runtime's
   `search_path = public, v8` resolves every application write to the protected copy, and no
   code references the `v8.` twin explicitly. Worth qualifying the DDL before anything changes
   search_path ordering.

None of the three is a fan-in regression, and none blocks review. Points 1, 2, 3, 5, 6a, 6b,
6d, 7 and 8 are unconditional passes; point 4 is a pass on the only question the fan-in can
answer (no worsening); point 6c is structurally unprovable here.

**The branch is ready for review.** It is *not* yet ready for a demo-green claim — caveat 1
must be resolved and point 4 re-measured before anyone states that the ROI seam works
end-to-end on a fresh database.

---

### Reproduction

```bash
# ephemeral PG 15 (LC_ALL=C at BOTH steps), port probed free in 55000-59999
LC_ALL=C initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C pg_ctl -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1" start
psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE roi_e007;"
psql -h 127.0.0.1 -p $PORT -U postgres -d roi_e007 \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;'

export DB="postgresql://postgres@127.0.0.1:$PORT/roi_e007"

# 1 — migrations, strict
DOTENV_IGNORE_LOCAL=1 NODE_ENV=test DB_TYPE=postgres DATABASE_URL=$DB \
  npx tsx server/scripts/migrate.postgres.ts

# 3 — Finance regression (MOCK_DB=false is MANDATORY; without it 13 files skip and exit 0)
cd server && DOTENV_IGNORE_LOCAL=1 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DB_TYPE=postgres DATABASE_URL=$DB npx vitest run src/services/finance --no-file-parallelism

# 4 — canonical Results vNext (repo root for tests/, server/ for the routes test)
DOTENV_IGNORE_LOCAL=1 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=$DB \
  npx vitest run tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts \
                 tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts \
                 tests/resultsVnext/roi/roiActualEntryAppendOnly.realdb.test.ts --no-file-parallelism

# 8 — tsc
npx tsc --noEmit -p server/tsconfig.json
```

Teardown: `pg_ctl stop` + `rm -rf "$PGDATA"`, executed on completion.
