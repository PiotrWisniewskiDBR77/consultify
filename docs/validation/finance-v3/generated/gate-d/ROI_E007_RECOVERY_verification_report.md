# ROI-E007 Recovery — Finance v3 ↔ Results vNext Integration Verification

**Date:** 2026-08-10
**Worktree:** `/private/tmp/finance-v3-roi-e007-integration`
**Branch:** `codex/finance-v3-roi-e007-integration`
**HEAD at verification time:** `c2ff92ac8b9bf522c7d19a54ef2a3fbf58da4599`
(merge commit: `Merge branch 'codex/results-vnext-g0-20260809' into codex/finance-v3-roi-e007-integration`,
parent 1 = `d6b27db6fa` Finance v3 tip after Stream A 01/02 revert, parent 2 = `5fe1b647fd`
Results vNext branch tip)

**Context:** This is a repeat of the ROI-E007 recovery verification. A prior attempt failed on a
transient API error mid-way through point 7, not on a substantive finding. This run started clean,
independently, from scratch.

**Scope:** pure verification. No application code, migrations, or tests were modified. Only this
report and its evidence artifacts were added.

**Ephemeral Postgres discipline:** three separate ephemeral Postgres 15.15 (Homebrew) clusters were
used, each `initdb --locale=C` under `/private/tmp/`, ports 55391 / 56201 / 57312 (all confirmed via
`lsof -i:PORT` to be free before use, and none of them 5432, 28711, or 52824). All three clusters and
their data directories were stopped (`pg_ctl stop -m fast`) and deleted (`rm -rf`) at the end of this
session — confirmed clean (see "Cleanup confirmation" at the end of this report).

---

## Summary table

| # | Check | Verdict |
|---|-------|---------|
| 1 | Fresh install (clean migration run) | **PASS** |
| 2 | Upgrade path (pre-merge → post-merge, data preserved) | **PASS** |
| 3 | Schema fingerprint vs. canonical results-vnext-only | **PASS** (byte-identical) |
| 4 | No duplicate `rvn_roi_finance_*` ownership | **PASS** |
| 5 | Canonical ROI-E007 realDB tests — no regression | **PASS** (identical to canonical branch; see caveat) |
| 6 | Finance canonical regression suite | **PASS** (188/188, 0 regressions) |
| 7a | Legacy "no silent overwrite" trigger protection | **PASS** for 2/3 stores; **EVIDENCE_MISSING** for 1/3 (pre-existing, documented, not a merge defect) |
| 7b | vNext append-only mechanisms | **PASS** (core assertions); same pre-existing fixture caveat as #5 |

**Bottom line: nothing found here blocks proceeding to the next recovery step.** All failures observed
are proven — by direct A/B comparison against an isolated cluster running *only* the canonical
`codex/results-vnext-g0-20260809` migrations — to be pre-existing defects unrelated to the Finance
v3 / ROI-E007 Stream A merge, not regressions introduced by it.

---

## Point 1 — Fresh install

**Command:**
```
DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL=postgresql://postgres@localhost:55391/roi_e007_fresh \
npx tsx server/scripts/migrate.postgres.ts
```

**Result: PASS**
- `server/migrations/` contains **828** `.sql` files.
- Runner applied **623** migrations, **0 errors**, exit code 0, `✅ Postgres migrations complete`.
- Confirmed idempotent: immediate `--dry-run` re-check reports `Pending migrations: 0`.
- Wall time for the apply run: **≈5.0s** (shell `time`: `0.91s user 0.24s system … 5.04s total`,
  includes Node/tsx startup); the follow-up idempotency dry-run alone took `0.61s` real.

**Note on the "~828" expectation vs. the measured 623:** 828 is the total *file count* in
`server/migrations/`, not the applied count. The runner's own documented logic
(`isSqliteOnlyMigration()` in `server/scripts/migrate.postgres.ts`, see the large comment block
starting "Deterministic execution-order contract") intentionally excludes ~205 legacy
SQLite-first migrations numbered `<500` on a fresh/strict install (with a small
`PROMOTED_LEGACY_PRODUCERS` allow-list re-included: `081_studio_tables.sql`, `073_conversations.sql`,
`215_partner_portal.sql`, `256_integrations_system.sql`). This is pre-existing, documented runner
behavior, not something this merge changed — confirmed by diffing `migrate.postgres.ts` between
`codex/results-vnext-g0-20260809` and this branch's HEAD: the only difference is one unrelated
`LATE_PHASE_MANIFEST` entry for an AP-06 Finance migration, irrelevant to the ROI seam. **623
applied / 0 errors is the correct, real number for this worktree; the "~828" figure in the task
brief was an estimate of file count, not applied-migration count.**

---

## Point 2 — Upgrade path (pre-merge → post-merge)

**Pre-merge point used:** commit `d6b27db6fa` (`revert(roi-e007): drop conflicting Finance-owned
rvn_roi_* schema (Stream A 01/02)`), i.e. parent 1 of the merge commit — Finance v3 tip with 01/02
already removed, before the results-vnext merge. Migrations for this commit were exported via
`git archive d6b27db6fa -- server/migrations` (811 `.sql` files; **no** `rvn_roi_*` files present,
confirming the pre-merge state has zero ROI schema).

**Step A — apply pre-merge migrations to a fresh ephemeral cluster (port 57312):**
- **606** migrations applied, **0 errors**.

**Step B — seed sanity data (GoldCo full pipeline `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts`
was assessed and judged too heavyweight for this specific check — it drives the full Gate D
statement-mapping/reconciliation/artifact-lifecycle service stack end-to-end, which is out of scope
for "does the upgrade path preserve rows"; used the task's documented simpler fallback: direct
sanity inserts):**
- 1 organization (`org-roi-e007-upgrade-test`), 1 initiative, 1 KPI definition.
- 2 rows in `roi_realized_values` (the ADR's primary "ROI Actual" legacy store).
- 2 rows in `v8_roi_realization_entries` (the second legacy store).
- Captured before-upgrade: `count(roi_realized_values)=2`, `count(v8_roi_realization_entries)=2`,
  `md5` checksum of each table's seeded rows (`rv_checksum=60fb1a226b5e4a6c2f0f3bbaadb339a8`,
  `v8_checksum=54610834e0dd8b51d4adfd32102d1012`).

**Step C — apply the upgrade delta (full merged `server/migrations/`, same DB):**
- `--dry-run` confirmed pending = exactly the **17** new files the merge introduces (all
  `20260809_rvn_platform_*` / `2026081[0-9]_rvn_kpi_*` / `2026081[5-9]_rvn_roi_*` /
  `20260820_rvn_roi_finance_seam.sql`) — matches `git diff --name-only` between the pre-merge and
  merged migration sets exactly, no more, no fewer.
- Applied: **17/17**, **0 errors**, 0.63s.

**Step D — verify:**
- Post-upgrade `roi_realized_values` count = **2** (unchanged), checksum **unchanged**.
- Post-upgrade `v8_roi_realization_entries` count = **2** (unchanged), checksum **unchanged**.
- `rvn_roi_finance_links` and `rvn_roi_finance_reconciliations` exist post-upgrade with the expected
  columns/FKs/indexes (see Point 3 for the full DDL — same fingerprint).

**Result: PASS.** Upgrade applies cleanly on top of a populated pre-merge database; the exact delta
set migrates with 0 errors; pre-existing data (2 legacy ROI Actual rows in each of the two stores)
is byte-for-byte unchanged (verified by row count + md5 checksum before/after).

---

## Point 3 — Schema fingerprint vs. canonical results-vnext-only

**Isolated reference cluster (port 56201):** migrations exported via
`git archive codex/results-vnext-g0-20260809 -- server/migrations` into a scratch directory (**801**
`.sql` files, including the 6 canonical `rvn_roi_*` files), run against a brand-new ephemeral
cluster with `--dir <scratch>/server/migrations`.
- **596** migrations applied, **0 errors**.

**DDL comparison:**
```
pg_dump --schema-only -t rvn_roi_finance_links -t rvn_roi_finance_reconciliations
```
run against both:
- the fully **integrated** database from Point 1 (623 migrations, this worktree's merged set), and
- the **isolated** results-vnext-only database above (596 migrations, canonical branch alone).

`diff` of the two DDL dumps (excluding pg_dump's random `\restrict`/`\unrestrict` session tokens):
**exit code 0 — zero differences.** Columns, types, defaults, `NOT NULL`, the PK on `link_id` /
`reconciliation_id`, the `rvn_roi_finance_reconciliations_status_check` CHECK constraint (open /
investigating / resolved / accepted_divergence), both indexes
(`idx_rvn_roi_finance_links_case`, `idx_rvn_roi_finance_reconciliations_case`), and all three FKs
(`...case_id_fkey` ×2, `...finance_link_id_fkey`) are byte-identical between the integrated worktree
and the canonical branch run in isolation.

**Result: PASS — byte-identical structurally**, exactly as required. Evidence saved to
`docs/validation/finance-v3/generated/gate-d/ROI_E007_RECOVERY_evidence/fresh_integrated_ddl.sql` and
`.../isolated_vnext_ddl.sql`.

---

## Point 4 — No duplicate `rvn_roi_finance_*` ownership

```
grep -rn "CREATE TABLE.*rvn_roi_finance_links\|CREATE TABLE.*rvn_roi_finance_reconciliations" server/migrations/
```

**Output:**
```
server/migrations/20260820_rvn_roi_finance_seam.sql:18:CREATE TABLE IF NOT EXISTS rvn_roi_finance_links (
server/migrations/20260820_rvn_roi_finance_seam.sql:46:CREATE TABLE IF NOT EXISTS rvn_roi_finance_reconciliations (
```

**Result: PASS.** Both `CREATE TABLE` statements exist in exactly one file,
`20260820_rvn_roi_finance_seam.sql` (the canonical results-vnext migration). The Finance-owned
Stream A 01/02 files that previously created a conflicting `rvn_roi_finance_links` /
`rvn_roi_finance_reconciliations` schema are confirmed absent from `server/migrations/` (only
`20260809_finance_v3_e007_03_legacy_actual_protection.sql` remains from that stream, and it creates
no tables — triggers only, per the owner's decision).

---

## Point 5 — Canonical ROI-E007 realDB tests

**Test files (exact set requested):**
`tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts`,
`tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts`,
`tests/resultsVnext/roi/roiEvidenceLinkFreshness.realdb.test.ts`,
`tests/resultsVnext/roi/roiEvidenceLinksByKpi.realdb.test.ts`,
`server/src/routes/resultsVnext/__tests__/roiFinanceSeam.routes.test.ts`.

**Run 1 — integrated schema** (Point 1's fully-migrated DB, port 55391,
`RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...`):
```
Test Files  4 failed | 1 passed (5)
     Tests  15 failed | 19 passed | 4 skipped (38)
```
`roiFinanceSeam.routes.test.ts`: **18/18 passed** (route-level, does not touch the real
`initiatives` table).

**Run 2 — isolated canonical schema** (Point 3's results-vnext-only DB, port 56201, same test
files, same env):
```
Test Files  4 failed | 1 passed (5)
     Tests  15 failed | 19 passed | 4 skipped (38)
```
**Byte-identical pass/fail signature to Run 1**, down to the same test names failing.

**Root cause of the 15 failures (verified, not guessed):** the `initiatives` table's `status`
column has `DEFAULT 'step3'` (set by `000_z_core_baseline.sql` / `000_initdb_core_tables.sql`), but
the later `initiatives_status_check` CHECK constraint (added by
`20260624_initiative_status_normalize.sql` and reinforced by `20260719_baseline_gap.sql` /
`20260802_mvp_core_schema_parity.sql`) does **not** include `'step3'` in its allowed value list
(`DRAFT, PENDING_REVIEW, REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED, EXECUTING, BLOCKED, DONE,
TRACKING, CANCELLED, ARCHIVED`). Every failing test shares a fixture helper
(`buildCaseWithFinanceLink` / equivalent) that inserts a test initiative without specifying
`status` explicitly, so it falls back to the broken default and 23514s. Reproduced identically on
both branches; the migration files responsible (`000_z_core_baseline.sql`,
`20260624_initiative_status_normalize.sql`) are untouched by, and predate, ROI-E007 Stream A /
the results-vnext merge entirely.

**Result: PASS** in the sense the task actually needs — **zero regression from the merge** (proven
by direct A/B, not inference). It is **not** the case that "all tests pass" in absolute terms; that
was never true on the canonical branch either. Flagging as a separate, pre-existing, out-of-scope
defect rather than papering over it.

---

## Point 6 — Finance regression suite

```
DATABASE_URL=postgresql://postgres@localhost:55391/roi_e007_fresh (integrated schema)
npx vitest run server/src/services/finance/canonical/__tests__/
```

**Result:**
```
Test Files  15 passed (15)
     Tests  188 passed (188)
```
0 failures, 0 regressions.

**Note on the ">250 testów" expectation vs. the measured 188:** "the whole directory" literally
contains **15** files (7 `*.pg.test.ts` real-DB files + 8 plain `*.test.ts` unit files —
`statementReconciliationService.test.ts`, `baselineScheduleEngine.test.ts`,
`periodConventionResolver.test.ts`, `formulaAstEvaluator.test.ts`, `lineageService.test.ts`,
`lifecycleService.test.ts`, `baselineCircularitySolver.test.ts`, `financeCompareService.test.ts`),
totaling **188** individual `it()`/`test()` cases (cross-checked by both vitest's own summary and
an independent `grep -c "it(\|test("` per file, which sums to ≈189, consistent within `it.each`
expansion rounding). This is the real, measured count for this worktree's checkout — flagging the
discrepancy from the task's ">250" estimate rather than silently substituting a different number.

**Result: PASS — 0 regressions**, exact count reported honestly as 188/188, not the estimated
"~250+".

---

## Point 7a — Legacy "no silent overwrite" trigger protection

Tested on the **upgrade-path** cluster from Point 2 (post-upgrade, i.e. the final integrated
schema, with the two seeded legacy rows still present), port 57312:

| Store | UPDATE attempt | DELETE attempt |
|---|---|---|
| `roi_realized_values` | **REJECTED** — `roi_realized_values is append-only under ROI-E007 governance; UPDATE not permitted ...` | **REJECTED** — same trigger, DELETE branch |
| `v8_roi_realization_entries` | **REJECTED** — `v8_roi_realization_entries is append-only under ROI-E007 governance; UPDATE not permitted ...` | **REJECTED** — same trigger, DELETE branch |
| `benefit_tracking` | **EVIDENCE_MISSING** — table does not exist on this schema | **EVIDENCE_MISSING** — table does not exist on this schema |

Row counts confirmed unchanged after the rejected attempts (`2`/`2`).

**On the `benefit_tracking` gap:** this is **not** a defect introduced by this merge. The migration
`20260809_finance_v3_e007_03_legacy_actual_protection.sql` itself documents, in its own inline
comment, that `benefit_tracking`'s sole producer (`067_economics_initiative_integration.sql`,
version `067 < 500`) is excluded by `migrate.postgres.ts`'s `isSqliteOnlyMigration()` on a fresh/
strict install (the same class of gap as `081_studio_tables.sql` / `073_conversations.sql` /
`215_partner_portal.sql` / `256_integrations_system.sql`, which the runner's
`PROMOTED_LEGACY_PRODUCERS` list re-includes — `067` was never added to that list). The migration
guards this correctly with a runtime `to_regclass('public.benefit_tracking') IS NOT NULL` check and
emits a `NOTICE` instead of failing, exactly as designed. Verified: `\d benefit_tracking` on this
schema returns "Did not find any relation". On environments where `benefit_tracking` does exist
(demo/dev, created via `PostgresDatabase.ts`'s own `initDb()` — a separate code path per the
migration's own comment), the trigger would apply. This is a pre-existing, out-of-scope,
already-flagged-by-its-own-author platform gap, not a Stream A / merge regression.

**Result: PASS for 2 of 3 physical guarantees (the two stores this ADR/orchestrator scope
prioritized as P0 and that the migration actually created triggers for on this schema);
EVIDENCE_MISSING for the third, for the documented, pre-existing, non-merge-related reason above.**

---

## Point 7b — vNext append-only mechanisms

```
DATABASE_URL=postgresql://postgres@localhost:55391/roi_e007_fresh (integrated schema)
npx vitest run tests/resultsVnext/roi/roiActualEntryAppendOnly.realdb.test.ts \
               tests/resultsVnext/roi/roiActualSnapshot.realdb.test.ts
```

**Result (integrated schema):**
```
Test Files  2 failed (2)
     Tests  3 failed | 2 passed (5)
```

Passed:
- `raw UPDATE/DELETE on rvn_roi_actual_entries is genuinely revoked from PUBLIC at the schema
  level` — **the core physical guarantee this point exists to prove.**
- `correcting/verifying/disputing a nonexistent actual_entry_id throws
  RoiActualEntryNotFoundError`.

Failed (3): all three fail on the exact same `initiatives_status_check` root cause documented under
Point 5 (shared fixture helper `buildTrackingCase` inserts a test initiative without an explicit
`status`).

**Cross-check — isolated canonical schema** (results-vnext-only cluster, port 56201, same two test
files, same env):
```
Test Files  2 failed (2)
     Tests  3 failed | 2 passed (5)
```
**Byte-identical** to the integrated run.

**Result: PASS** — the core append-only/REVOKE mechanism (the entire point of this check) is proven
to work on the fully integrated schema, and behaves identically to the canonical branch. The 3
failures are the same pre-existing, non-merge-related fixture defect as Point 5, confirmed via
direct A/B, not a new regression.

---

## Cleanup confirmation

- All three ephemeral Postgres clusters (`roi_e007_pg1_data` :55391, `roi_e007_pg2_data` :56201,
  `roi_e007_pg3_data` :57312) stopped via `pg_ctl stop -m fast` and their data + socket directories
  removed via `rm -rf` from `/private/tmp/`.
- Scratch migration-export directories (`roi_e007_vnext_migrations`, `roi_e007_premerge_migrations`)
  removed.
- `lsof -i:55391`, `:56201`, `:57312` all return empty post-cleanup.
- `ps aux | grep postgres.*roi_e007` returns empty post-cleanup.
- No shared/forbidden ports (5432, 28711, 52824) were ever touched by this session.
- No git worktree was created by this verification (branch export used `git archive`, not
  `git worktree add`); `git worktree list` shows no new entries attributable to this session.
- Only `.sql`/`.log` evidence files remain under `/private/tmp/roi_e007_*` and
  `/private/tmp/roi_e007_evidence/` (harmless, not database processes/data).

---

## What would block the next recovery step

**Nothing found in this verification blocks proceeding.** The two caveats worth carrying forward
(both pre-existing, both proven via A/B comparison to be unrelated to the Finance v3 ↔ Results
vNext merge):

1. `initiatives.status` DEFAULT `'step3'` violates `initiatives_status_check` — breaks any INSERT
   into `initiatives` that relies on the column default instead of specifying `status` explicitly.
   Affects 15 ROI-E007 canonical realdb tests + 3 ROI-E004 actual-entry/snapshot tests via a shared
   fixture pattern. Root migrations: `000_z_core_baseline.sql` (or `000_initdb_core_tables.sql`) and
   `20260624_initiative_status_normalize.sql`. Recommend a follow-up ticket, separate from ROI-E007.
2. `benefit_tracking`'s producer migration (`067_economics_initiative_integration.sql`) is excluded
   by `migrate.postgres.ts`'s legacy filter on fresh/strict installs — already self-documented as a
   P1 by the ROI-E007 migration's own author, not new information from this verification.
