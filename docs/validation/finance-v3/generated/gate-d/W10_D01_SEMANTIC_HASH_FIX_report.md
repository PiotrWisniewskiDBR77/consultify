# W10-D01 — `content_semantic_hash` / `compute_run_id` fix (compute→approve path)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`.
**Defect origin:** `docs/validation/finance-v3/generated/gate-d/W10_COLD_REOPEN_report.md` section 7
(defect W10-D01, found and deliberately NOT fixed by the W10 cold-reopen work package, whose
allowlist was test-files-only).
**Date:** 2026-08-10.
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3-d01hash`, branch `codex/finance-v3-d01hash`.
**Base:** `db081bc74c` (`codex/finance-v3-w10-coldreopen` + `codex/finance-v3-w10-testisolation` merged).
**Final commit:** `5bfc761c03`.
**Frozen baseline respected:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` was neither touched nor
merged. No staging/demo/production database was touched — all work and all evidence in this report is
against a private ephemeral Postgres 15 cluster (`PGDATA=/private/tmp/fv3-d01hash-pgdata`, port `57611`),
destroyed after this session.

**Commits (not pushed):**

| SHA | Subject |
| --- | --- |
| `fa796d46d0` | stage 1 — stamp `content_semantic_hash`/`compute_run_id` on working revisions (`createArtifact()` + 4 compute engines + Statement Pack reconciliation), consolidate the two pre-existing hash implementations into one |
| `61a5b9ba7d` | stage 2 — `approveVersion()` also freezes hash/run_id onto the `finance_business_versions` row itself (found by the strengthened test, was still NULL after stage 1) |
| `5bfc761c03` | stage 3 — `reopenVersion()`'s copy-on-write INSERT also copies `compute_run_id` (was silently dropped, only `content_semantic_hash` was copied) |

Files touched: `server/src/services/finance/canonical/contentHash.ts` (new),
`artifactVersionService.ts`, `baselineComputeService.ts`, `predictionComputeService.ts`,
`valuationComputeService.ts`, `kpiComputeService.ts`, `statementReconciliationService.ts`,
`server/src/services/finance/collaboration/autosaveService.ts`,
`server/src/services/finance/canonical/financeImportService.ts` (both only to delegate to the shared
hash primitive — behavior unchanged), and
`server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts` (strengthened assertions).
No UI/frontend code touched. No production code in `computeJobService.ts`,
`valuationSensitivityService.ts`, `baselineComputeService.ts`'s `loadContext()`,
`valuationComputeService.ts`'s `findOrCreateMethod()`, or `predictionPreflightService.ts`'s
`runPreflight()` was touched (the five files/functions reserved for the parallel cross-tenant-leak
fix) — see §9 "Collision points" for the one place this fix's scope brushes against that reservation.

---

## 1. Inventory — who writes/reads `content_semantic_hash`/`compute_run_id` (grepped, not from docs)

### Before this fix (as found)

| Column | Writers (file:line) | Readers (file:line) |
| --- | --- | --- |
| `finance_working_revisions.content_semantic_hash` | `autosaveService.ts:154` (autosave/explicit-save checkpoint), `financeImportService.ts:1056` (Excel import) — **only these two** | `computePinning.ts:66-79` (`enqueueComputeForCurrentRevision`, fails `NO_CONTENT_HASH` if null), `artifactVersionService.ts:517/527` and `:755/765` (copied into a frozen snapshot), `artifactVersionService.ts:1088` (`reopenVersion` copy-on-write) |
| `finance_working_revisions.compute_run_id` | **nobody** — column existed, was written by no code path at all | `artifactVersionService.ts:516/525`, `:754/763` (copied into a frozen snapshot) |
| `finance_business_versions.content_semantic_hash` | **nobody** | none found (dead column) |
| `finance_business_versions.compute_run_id` | **nobody** | none found (dead column) |
| `finance_compute_snapshots.content_semantic_hash` / `.compute_run_id` | `artifactVersionService.ts` step (b) of `approveVersion()` and `createComputeSnapshot()` — both copy straight from the working revision above, so inherited NULL | `coldReopenReader.ts` (this fix's own evidence reader), UI (not exercised here) |
| `compute_job_outputs.content_semantic_hash` (a **different** table, schema `NOT NULL`) | `computeJobService.completeJobSuccess()`, called by all four compute engines — **already always non-null**, was never the problem | compute-job audit trail only; never flowed into `finance_working_revisions` |

Root cause, stated precisely: four compute engines (`baselineComputeService.runBaselineCompute`,
`predictionComputeService.runPredictionCompute` — both `runStandardBase` and `runOverlayCompute`
branches, `valuationComputeService.runDcfFcffValuation`, `kpiComputeService.computeAnalysisKpis`) each
already computed a correct, real `contentSemanticHash` from their own output and a real `runningJob.id`
— and used both to write `compute_job_outputs`, correctly. None of them, and no other code path
(`createArtifact()`, `statementReconciliationService.runReconciliation()`), ever wrote either value onto
`finance_working_revisions`. `approveVersion()` then faithfully copied whatever was on the working
revision (NULL) into the frozen `finance_compute_snapshots` row and — as found mid-fix, see §4 — never
even attempted to copy it onto `finance_business_versions` at all.

### After this fix

| Column | New/changed writers | Notes |
| --- | --- | --- |
| `finance_working_revisions.content_semantic_hash` + `.compute_run_id` | `artifactVersionService.createArtifact()` (seeds revision_seq=1); `artifactVersionService.stampWorkingRevisionComputeIdentity()` — new, called from `baselineComputeService.ts`, both branches of `predictionComputeService.ts`, `valuationComputeService.ts`, `kpiComputeService.ts` (right after `completeJobSuccess()`), and `statementReconciliationService.runReconciliation()` (which has no `compute_jobs` row at all — see §2) | One centralised UPDATE (`artifactVersionService.ts`), not five divergent copies |
| `finance_business_versions.content_semantic_hash` + `.compute_run_id` | `artifactVersionService.approveVersion()` step (c), now copies both from the working revision being frozen, in the SAME `UPDATE` statement as `compute_snapshot_id` | Was the stage-2 gap; see §4 |
| `finance_working_revisions.compute_run_id` on reopen | `artifactVersionService.reopenVersion()`'s copy-on-write INSERT, now includes `compute_run_id` in its column list | Was the stage-3 gap; see §4 |
| `finance_compute_snapshots.*` | Unchanged code (`approveVersion()` step (b), `createComputeSnapshot()`) — now inherits real values because its INPUT (the working revision) is no longer NULL | Zero lines changed here; fixing the source was sufficient |

---

## 2. Proof the SAME hash function is used everywhere — not a second one

Before this fix, two independent, byte-for-byte-identical implementations of
`createHash('sha256').update(JSON.stringify(x)).digest('hex')` already existed
(`autosaveService.ts`'s `canonicalPayloadHash`, `financeImportService.ts`'s `batchContentHash`). Adding a
third or fourth inline copy for `createArtifact()`/the compute engines would have been the exact failure
mode the task brief warned about ("dwie różne implementacje hasha to gwarantowany cichy rozjazd").

Instead: `server/src/services/finance/canonical/contentHash.ts` now holds the **one** definition —

```ts
export function canonicalPayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
```

— and every call site imports it:

- `autosaveService.ts` — its own `canonicalPayloadHash` function body deleted, now imports the shared one. Byte-identical behavior (verified by the unchanged 374/374 canonical suite, which includes autosave-path tests).
- `financeImportService.ts` — `batchContentHash()` is now a one-line wrapper (`return canonicalPayloadHash(operations)`), not a second `createHash` call.
- `artifactVersionService.ts` — `createArtifact()`'s initial hash is `canonicalPayloadHash({ unsavedOperationStack: [] })`, the exact shape an immediate no-op autosave checkpoint would produce (same function, same "empty" convention).
- `statementReconciliationService.ts` — imports `canonicalPayloadHash` for its own run fingerprint.

The four compute engines (`baselineComputeService.ts`, `predictionComputeService.ts` (×2),
`valuationComputeService.ts`, `kpiComputeService.ts`) were **not** rewritten to call
`canonicalPayloadHash` — they already had their own `createHash('sha256').update(JSON.stringify(...))`
lines producing `contentSemanticHash`, already correct, already used for `compute_job_outputs`
(schema `NOT NULL`, so these were never the NULL problem). This fix reuses that **already-computed
value** — the exact same JS variable — passed into the new `stampWorkingRevisionComputeIdentity()` call
right next to the existing `completeJobSuccess()` call. Grep proof there is exactly one hash landing in
each place:

```
$ grep -n "contentSemanticHash," server/src/services/finance/canonical/baselineComputeService.ts
639:    contentSemanticHash,                              # -> compute_job_outputs (completeJobSuccess)
648:    contentSemanticHash,                              # -> finance_working_revisions (stampWorkingRevisionComputeIdentity, SAME variable)
```

`stampWorkingRevisionComputeIdentity()` (new, `artifactVersionService.ts`) itself never derives a hash —
its signature takes `contentSemanticHash: string` as a caller-supplied value, by design (its own doc
comment: *"this function never derives a hash itself"*), so it cannot become a sixth implementation no
matter what future caller uses it.

---

## 3. Non-null proof — independent read straight off the tables (not a service return value)

Fresh ephemeral cluster, single clean `coldReopen.pg.test.ts` run
(`org-w10-coldreopen-763e0741-6b22-4efc-ac61-973dad3255c0`), read via raw `psql`, joined only to
`finance_artifacts` for the type label — **not** via `artifactVersionService`/`coldReopenReader.ts`:

```sql
-- business_versions
    artifact_type    |  status  | freshness | bv_hash_ok | bv_run_ok
---------------------+----------+-----------+------------+-----------
 BASELINE_MODEL      | APPROVED | CURRENT   | t          | t
 HISTORICAL_ANALYSIS | APPROVED | CURRENT   | t          | t
 PREDICTION_SCENARIO | APPROVED | CURRENT   | t          | t
 STATEMENT_PACK      | APPROVED | CURRENT   | t          | t
 VALUATION_CASE      | APPROVED | CURRENT   | t          | t

-- working_revisions (is_current = true)
    artifact_type    | wr_hash_ok | wr_run_ok
---------------------+------------+-----------
 BASELINE_MODEL      | t          | t
 HISTORICAL_ANALYSIS | t          | t
 PREDICTION_SCENARIO | t          | t
 STATEMENT_PACK      | t          | t
 VALUATION_CASE      | t          | t

-- compute_snapshots (frozen)
    artifact_type    | snap_hash_ok | snap_run_ok
---------------------+--------------+-------------
 BASELINE_MODEL      | t            | t
 HISTORICAL_ANALYSIS | t            | t
 PREDICTION_SCENARIO | t            | t
 STATEMENT_PACK      | t            | t
 VALUATION_CASE      | t            | t
```

`*_ok` = `(col IS NOT NULL AND col <> '')`, i.e. rejects both NULL and empty-string, per the task's own
warning that a NULL-vs-NULL comparison was exactly what let this defect hide inside a "PASS" before.
All 30 cells (5 artifacts × 3 layers × 2 columns) are `t`. STATEMENT_PACK and HISTORICAL_ANALYSIS are
called out specifically because they are the two artifact types with **no** `compute_jobs`/engine path
at all (Statement Pack goes through `statementReconciliationService.runReconciliation()`, Historical
Analysis's hash comes from `kpiComputeService.computeAnalysisKpis()` but its `compute_run_id` is a real
`compute_jobs.id` same as the other three) — the two easiest to miss when wiring a fix scoped around
"the compute engines".

---

## 4. What the fix actually took — three stages, two of them found BY the negative control

**Stage 1** (commit `fa796d46d0`) wired `createArtifact()` and the five engine paths to call the new
`stampWorkingRevisionComputeIdentity()`. Running the full canonical suite afterward was green
(27 files / 374 tests) — but that only proves nothing broke, not that the fix works, because the
existing `coldReopen.pg.test.ts` assertions never checked non-nullness (see §6).

**Stage 2** (commit `61a5b9ba7d`) was found by *strengthening* `coldReopen.pg.test.ts` (§6) and running
it against stage 1's code: `finance_business_versions.content_semantic_hash`/`.compute_run_id` were
**still NULL** after stage 1, because `approveVersion()` step (c)'s `UPDATE finance_business_versions`
only ever set `compute_snapshot_id`, never the other two columns — even though that table has had its
own copies of both columns since the original `b01` migration. This was a second, independent instance
of the same defect class, one layer up from the working revision. Fixed by adding both columns to the
existing step-(c) `UPDATE` statement, values taken from the same `workingRevision` row step (b) already
reads.

**Stage 3** (commit `5bfc761c03`) was found by code review while writing this report, not by a failing
test (no existing test exercises reopen→re-approve without an intervening compute — a real gap, noted in
§8): `reopenVersion()`'s copy-on-write INSERT for the new working revision had `content_semantic_hash` in
its column list but **not** `compute_run_id` — the column was simply absent from the INSERT, so a
reopened Draft (e.g. for a restatement) silently reset to NULL even though nothing about the underlying
computed content changed (copy-on-write — the whole point of `reopenVersion()` is that content doesn't
move). Fixed by adding `compute_run_id` to the same copy.

---

## 5. Compute-pinning proof — `NO_CONTENT_HASH` no longer returned

Ran `computePinning.enqueueComputeForCurrentRevision()` directly (not through a test double) against a
real artifact's real current working revision, on both sides of the fix, using the same ephemeral
cluster:

**Before** (leftover working revision from a run made under the pre-fix code, `content_semantic_hash IS NULL`):

```json
{
  "ok": false,
  "code": "NO_CONTENT_HASH",
  "message": "Current working revision has no content_semantic_hash yet (never checkpointed) — nothing to pin compute to"
}
```

**After** (real GOLDCO Baseline Model artifact from the fixed code):

```json
{
  "ok": true,
  "job": { "id": "a0feb407-38fc-442a-b1c1-b8ba768fff5d", "job_type": "BASELINE_COMPUTE", "status": "queued", "...": "..." },
  "wasExisting": false,
  "pinnedContentSemanticHash": "f747517dddb52f2d2ba5a292d7efc597701ca071e88ff0dccd6180a3ba712411"
}
```

Compute pinning is reachable again.

---

## 6. Snapshot-uniqueness probe — surrogate `uq_finance_compute_snapshots_revision_run` alive

`uq_finance_compute_snapshots_revision_run UNIQUE (working_revision_id, compute_run_id)` already existed
(`20260809_finance_v3_b06_reproducibility_retention_export.sql:45`) — **no new migration was written**,
because the constraint itself was never missing; it was inert only because `compute_run_id` was always
NULL and Postgres treats NULLs as distinct in a UNIQUE index. Proven with the same working revision, in
the same session, both states, transactions rolled back so nothing persisted:

**Before-shape probe** (both rows inserted with `compute_run_id = NULL`, simulating the code this fix
replaces):

```sql
BEGIN
INSERT 0 1
INSERT 0 1
 accepted_duplicate_rows_with_null_run_id
-------------------------------------------
                                         2
ROLLBACK
```

Both inserts succeeded — the exact "duplicate accepted" defect W10-D01 originally reported.

**After-shape probe** (real `working_revision_id` + `compute_run_id` pair produced by this fix's own
code, a literal second row with the identical pair):

```sql
BEGIN
ERROR:  duplicate key value violates unique constraint "uq_finance_compute_snapshots_revision_run"
DETAIL:  Key (working_revision_id, compute_run_id)=(1ff8c79c-289b-4a28-8762-f2437031ee29, 1f5bf1e9-97ff-47bb-a0a7-a457ef6b7b7d) already exists.
ROLLBACK
```

Same duplicate shape, opposite outcome: rejected.

---

## 7. Negative control (mandatory) — RED before, GREEN after

**Coverage-of-the-assertion check.** `coldReopen.pg.test.ts` originally only compared `bv.content_semantic_hash`
for hot-vs-cold **equality**, never asserted it non-null — exactly the "compared NULL to NULL" failure mode
flagged in the parent W10 report. Strengthened it (this fix's own commit) with an `expectRealComputeIdentity()`
helper asserting `not.toBeNull()` AND `not.toBe('')` on the business version, every working revision, and every
frozen snapshot, for FC-05.8 (Baseline), FC-07.9 (Valuation), and — critically — all five stages of FC-12.4
(the chain test, the only one that also covers Statement Pack and Historical Analysis).

**Procedure** (production code reverted via `git checkout <parent-sha> -- <files>`, never `git stash` —
worktree-shared and forbidden by this session's brief):

1. `git checkout db081bc74c -- artifactVersionService.ts baselineComputeService.ts valuationComputeService.ts kpiComputeService.ts predictionComputeService.ts statementReconciliationService.ts financeImportService.ts autosaveService.ts` + delete `contentHash.ts` (the strengthened TEST file stayed at HEAD).
2. Ran `coldReopen.pg.test.ts` → **RED**, 3 of 4 tests failed, each on the new non-null assertion:

```
❯ src/services/finance/canonical/__tests__/coldReopen.pg.test.ts (4 tests | 3 failed)
  × FC-05.8 ... AssertionError: expected null not to be null
      848|     expect(bv.content_semantic_hash).not.toBeNull();
  × FC-07.9 ... AssertionError: expected null not to be null
      132|     expect(value).not.toBeNull();
  × FC-12.4 ... AssertionError: expected null not to be null
      132|     expect(value).not.toBeNull();
Test Files  1 failed (1)
     Tests  3 failed | 1 passed (4)   # FC-NEG (unrelated corruption-detection control) still passed
```

3. `git checkout HEAD -- <same files>` restored the fix. Ran again → **GREEN**:

```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**DB-gate negative control** (separate, mandatory): ran the same file with none of `RUN_DB_TESTS`/`MOCK_DB`/
`DATABASE_URL` set:

```
↓ FC-05.8 ... ↓ FC-07.9 ... ↓ FC-12.4 ... ↓ FC-NEG ...
Test Files  1 skipped (1)
     Tests  4 skipped (4)
```

`skipped`, never a false `passed` — `describe.skipIf(!REAL_PG)` gate confirmed correct.

---

## 8. Backfill of pre-existing data — NOT performed, and not needed

- This session touched only its own ephemeral, throwaway Postgres cluster — nothing to backfill there by construction (destroyed after this session).
- Per `MEMORY.md` (`finance-v3-stan-2026-08-10.md`), Finance v3's five compute domains have **~0 production connections** today — there is no known live/demo/production data with approved artifacts and NULL `content_semantic_hash` that this fix would need to repair retroactively.
- **If** such data is ever found on a real environment: it is backfillable without guessing, because `compute_job_outputs.content_semantic_hash` has been `NOT NULL` and correctly populated by every compute engine since Gate C — a backfill would `UPDATE finance_working_revisions wr SET content_semantic_hash = cjo.content_semantic_hash, compute_run_id = cjo.job_id FROM compute_job_outputs cjo WHERE cjo.output_working_revision_id = wr.working_revision_id AND wr.content_semantic_hash IS NULL`, then re-run `approveVersion()`'s step-(c) logic (now fixed) is NOT retroactively re-triggerable — an already-APPROVED business_version's row would need the same values copied by a one-off additive script, since `finance_compute_snapshots` is DB-trigger-immutable
  (`trg_finance_compute_snapshots_deny_update`) but `finance_business_versions`/`finance_working_revisions`
  are not. **Not written here** — out of this fix's verified scope (no real data to test it against), and
  the task instructions were explicit that any backfill must stay inside my own ephemeral cluster.

---

## 9. Collision points with the parallel cross-tenant-leak fix

**None found that required touching a reserved file.** I read but did not modify `computeJobService.ts`,
`valuationSensitivityService.ts`, `baselineComputeService.ts`'s `loadContext()`,
`valuationComputeService.ts`'s `findOrCreateMethod()`, and `predictionPreflightService.ts`'s
`runPreflight()`. The one place this fix's scope comes close: `baselineComputeService.ts`,
`predictionComputeService.ts`, `valuationComputeService.ts`, and `kpiComputeService.ts` were all edited
— but only at their `completeJobSuccess()` call sites (adding one `stampWorkingRevisionComputeIdentity()`
call immediately after, using values already in scope), never inside `loadContext()`/`findOrCreateMethod()`/
`runPreflight()` themselves. **Flagged for the fan-in reviewer to double-check**: if the other agent's
tenant-isolation fix also touches the `completeJobSuccess()` call sites in these same four files (e.g. to
add an organization-scoping check around the same lines), the two diffs will be adjacent and should be
merged by hand rather than auto-merged, since both add new statements right after the same existing call.

---

## 10. FC-05.8 — is it now genuinely, non-vacuously PASSING?

**Yes.** Before this fix, "content_semantic_hash survives cold reopen" was true only because both sides
were `NULL` — a comparison that would have passed even if the ENTIRE mechanism were deleted. After this
fix: (a) the value is proven non-null/non-empty independently on both the hot and the cold side (§7,
`expectRealComputeIdentity()`, now baked permanently into the test); (b) the value is proven to be the
SAME real sha256 hex digest hot vs cold (unchanged digest-equality assertions, now meaningful); (c) the
negative control proves the assertion actually distinguishes "has a real hash" from "doesn't" (§7); (d)
independent raw-SQL reads confirm it outside the service layer entirely (§3). FC-05.8's own text
("... snapshot, semantic hash, freshness), with no recompute") is now a claim the test can actually fail
on, not one it structurally cannot fail on.

---

## Reproduce

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-d01hash-pgdata ; PGSOCK=/tmp/fv3d01sock ; PORT=57611
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3d01_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_d01hash;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_d01hash"

# migrations — STRICT, no --safe
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

# tsc
(cd server && npx tsc -p . --noEmit)

# full canonical suite
(cd server && RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run src/services/finance/canonical --no-file-parallelism)

# the cold-reopen suite specifically (4 tests: FC-05.8 / FC-07.9 / FC-12.4 / FC-NEG)
(cd server && RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run src/services/finance/canonical/__tests__/coldReopen.pg.test.ts --no-file-parallelism)

# DB-gate negative control (must skip, not pass)
(cd server && npx vitest run src/services/finance/canonical/__tests__/coldReopen.pg.test.ts --no-file-parallelism)

$PGBIN/pg_ctl -D "$PGDATA" stop
```

---

## Final measured numbers

| Check | Result |
| --- | --- |
| Migrations STRICT (fresh DB) | exit 0 |
| `tsc -p server` | exit 0 |
| `server/src/services/finance/canonical` suite | **27/27 files, 374/374 tests**, unchanged before/after this fix (no regression) |
| `coldReopen.pg.test.ts` | **4/4 PASS**, non-vacuously (see §7/§10) |
| DB-gate negative control (no env vars) | 4/4 `skipped`, never `passed` |
| Production-code negative control | RED (3/4 fail) on parent-commit code with the strengthened test; GREEN (4/4) restored |
| Duplicate-snapshot probe | before-shape: 2/2 accepted; after-shape: 2nd insert rejected by `uq_finance_compute_snapshots_revision_run` |
| Compute pinning (`enqueueComputeForCurrentRevision`) | `NO_CONTENT_HASH` before (stale pre-fix data) → `ok:true` after (real fix data) |
| Non-null coverage | 5 artifacts × 3 layers (business_version / working_revision / compute_snapshot) × 2 columns = 30/30 cells non-null/non-empty, independently read |

**EVIDENCE_MISSING:** none. Every claim above is backed by a command and its raw output captured in this
session; nothing was rounded up. The one item explicitly NOT done, by design, is a production backfill —
§8 states why and states the exact approach if it is ever needed.
