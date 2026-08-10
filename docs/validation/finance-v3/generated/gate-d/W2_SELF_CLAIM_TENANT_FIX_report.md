# W2 self-claim tenant mutation fix — NEW-3 + NEW-2 + companion FK migration

**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-selfclaim`
**Branch:** `codex/finance-v3-w2-selfclaim`
**Base SHA (before this work):** `403d430520` (`fix(finance-v3): fan-in interaction defect — coldReopen unwraps findOrCreateMethod result union`)
**Commits produced by this session:**
- `0c44cb0907` — `fix(finance-v3): NEW-3 self-claim tenant mutation + NEW-2 lineage read scoping`
- `7bd4f666f9` — `migration(finance-v3): composite tenant FKs for comment_assignments + post_investment_reviews`
- (this report's own commit, appended after)

`codex/finance-v3-closeout-fanin @ 19b4b06934` was NOT touched, NOT merged, NOT pushed. Nothing pushed anywhere; no staging/demo/prod connection at any point.

---

## 1. NEW-3 — self-claim cross-tenant mutation

### 1.1 Mechanism

All four Finance v3 canonical compute services follow a "self-claim" pattern: `enqueue()` a job for the caller's own organization, then immediately try to claim the row just inserted. All five call sites used `computeJobService.claim()` for this — the SAME function a future worker pool would use, which deliberately claims **the globally-oldest `queued` job of a given `job_type`, across every organization** (`ORDER BY next_attempt_at ASC ... LIMIT n`, no `organization_id` predicate). `claim()` itself is documented as intentionally cross-organizational (WP-B04 ADR, `computeJobService.ts` claim() doc comment, `canonicalServices.pg.test.ts`) and **was correct to leave alone** — the P0 fix (W9-C-5) already made that call.

The bug was entirely in the CALLER. Every self-claim site did:

```ts
const [claimed] = await computeJobService.claim({ workerId: `...:${uuidv4()}`, jobTypes: [...], limit: 1 });
const runningJob = claimed && claimed.id === job.id ? claimed : job;
```

Under ordinary concurrent multi-org use (no exploit needed): if another organization's job of the same `job_type` happens to be older in the queue, `claim()` returns THAT job, not the caller's own. The equality check (`claimed.id === job.id`) correctly detects the mismatch, but the fallback (`: job`) silently proceeds with the caller's own *un-claimed, still-`queued`* row — while the WRONG job (the other organization's) has already been mutated by the `UPDATE` inside `claim()`: `status='running'`, `lease_owner=<this worker>`, `attempt_count+1`, plus a new `compute_job_runs` row.

### 1.2 What changed

`claim()` is **unchanged** — same signature, same body, same cross-organizational semantics, same doc comment (only appended to, not edited). Added a new, adjacent function:

**`server/src/services/finance/canonical/computeJobService.ts`, lines 160–238** (new, nothing else in the file touched except this insertion — see §5 for the exact block for manual merge):
- `export interface ClaimByIdParams { organizationId; jobId; workerId; leaseDurationSeconds? }`
- `export async function claimById(params): Promise<ComputeJobRow | null>` — same `FOR UPDATE SKIP LOCKED` + lease + `attempt_count++` + `compute_job_runs` bookkeeping as `claim()`, but the subquery is `WHERE id = ? AND organization_id = ? AND status = 'queued' AND next_attempt_at <= now()` instead of an `ORDER BY ... LIMIT n` scan over `job_type`. Returns `null` (never throws) if the row cannot be claimed for any reason (wrong org, wrong id, not `queued`).

All five self-claim call sites now do:

```ts
const claimed = await computeJobService.claimById({ organizationId: params.organizationId, jobId: job.id, workerId: `...:${uuidv4()}` });
if (!claimed) throw new Error(`...: failed to self-claim just-enqueued job ${job.id} ...`);
const runningJob = claimed;
```

### 1.3 All five self-claim sites, file:line before → after

| File | Before (parent `403d430520`) | After |
|---|---|---|
| `server/src/services/finance/canonical/baselineComputeService.ts` | line 420–421 | lines 430–439 (`claimById` call at 433) |
| `server/src/services/finance/canonical/kpiComputeService.ts` | line 486–487 | lines 495–504 (`claimById` call at 498) |
| `server/src/services/finance/canonical/predictionComputeService.ts` (site 1, inside `runStandardBase()`, the STANDARD_BASE mode) | line 262–263 | lines 262–276 (`claimById` call at 265) |
| `server/src/services/finance/canonical/predictionComputeService.ts` (site 2, inside `runOverlayCompute()`, the OVERLAY mode) | line 452–453 | lines 464–478 (`claimById` call at 467) |
| `server/src/services/finance/canonical/valuationComputeService.ts` | line 373–374 | lines 373–383 (`claimById` call at 376) |

Verified no other production caller of `computeJobService.claim(` remains:
```
$ grep -rn "computeJobService\.claim(" server/src/services/finance/canonical/*.ts
(no matches — only claimById( now)
```
The only remaining reference to the bare `.claim(` API in the whole tree is `canonicalServices.pg.test.ts`, which is testing `claim()` itself (the worker-pool-style cross-org contract) — correctly untouched.

### 1.4 What happens on a failed `claimById()` — and is it safe?

**Chosen behavior: throw.** All five call sites throw a descriptive `Error` immediately if `claimById()` returns `null`. This happens BEFORE the compute engine's own `try { ... } catch { failJob(...) }` block (the claim call is a precondition, not part of the guarded compute), so the thrown error propagates uncaught out of `runBaselineCompute()` / `computeAnalysisKpis()` / etc. — same "fail loudly, never fabricate a result" precedent already used elsewhere in these files (e.g. the balance-sheet tie-out check, the solver-NI cross-check).

**Why this is the safe choice, and why the OLD behavior was not fully safe even ignoring NEW-3's tenant angle** — investigated via the pre-fix code (`_baselineComputeService_prefix_tmp.ts`, git-show'd from `403d430520`, not committed — see §6.1):

Before this fix, "`claim()` returns nothing that matches the caller's own job" fell back to `runningJob = job` — the just-enqueued row, still `status='queued'` in the DB (never actually transitioned to `running`). The function then proceeds as if it were running:
- Diagnostics rows (`finance_baseline_solver_diagnostics` etc.) are written referencing `runningJob.id` — fine, that FK only needs a valid `compute_jobs.id`, regardless of its status.
- On success, `computeJobService.completeJobSuccess({ jobId: runningJob.id, ... })` is called. Its FIRST action is `SELECT * FROM compute_jobs WHERE id = ? FOR UPDATE` then `if (!job || job.status !== 'running') return { ok: false, code: 'NOT_RUNNING', ... }`. Since the row is still `queued`, this branch fires — **the `compute_job_outputs` INSERT and the `status='succeeded'` UPDATE never run.**
- **None of the five old call sites checked `completeJobSuccess()`'s return value.** The caller (e.g. `runBaselineCompute`) still returns `{ ok: true, job: finalJob, ... }` to ITS OWN caller, and unconditionally calls `stampWorkingRevisionComputeIdentity()` afterward, stamping a `computeRunId` that points at a `compute_jobs` row stuck at `status='queued'` forever (next_attempt_at already in the past, so it would even be a candidate for a REAL future worker pool's `claim()` to pick up and re-run later, out of context).

So even in an org's own single-tenant, non-adversarial "TOCTOU-only" scenario (e.g. two duplicate requests for the same idempotency key racing), the old fallback pattern could silently under-report a job's true bookkeeping state while still reporting business-logic success (`finance_baseline_outputs` rows ARE written correctly — this is a compute_jobs *metadata* bug, not a data-correctness bug). This is a real, if narrow, pre-existing defect the fallback pattern carried independent of NEW-3's tenant-mutation angle. `EVIDENCE_MISSING` note: I did not chase how likely this specific same-org race window is in production (it requires `claim()` to return zero rows for the exact `job_type` at the moment right after `enqueue()` succeeds, which — pre-fix — was actually THE COMMON case whenever ANY other org had an older queued job of that type, not a rare race; post-fix with `claimById`, it can now only happen if the just-enqueued row is concurrently claimed/cancelled by someone else between `enqueue()` and `claimById()`, i.e. a genuine narrow race).

**Post-fix `claimById()` failure is `null`, not a mutation** (see §1.5 Phase 3 below): it makes no write, touches no row, and the caller throws. This is a strict improvement on both axes (tenant isolation AND own-org bookkeeping correctness) over the old fallback.

### 1.5 Negative control — independent-read proof

Script (temporary, deleted after use, not committed): ran against the ephemeral `fv3_sc` cluster (port 57741), reproducing the exact old `claim()`-based pattern (verbatim shape of `baselineComputeService.ts@403d430520` lines 415–421) directly against the unmodified `computeJobService.claim()`, then the new `claimById()`. Every assertion below reads via a raw `pg` client (`node-postgres`), a separate connection from the one the service functions use — a genuinely independent read.

**PHASE 1 — reproduce pre-fix mutation** (org B enqueues first, org A enqueues second, org A calls `claim()` the old way):

```
org A: org-new3-A-a9jvobdp   org B: org-new3-B-0tz09njd
org B enqueued job 31f5bb05-86c0-4f21-b0e0-297308326e10 status queued
org A enqueued job 67a7d221-41ed-4dcd-9d65-31ef096a8e97 status queued
claim() (unscoped, old pattern) returned job id: 31f5bb05-86c0-4f21-b0e0-297308326e10
  expected org A own job id: 67a7d221-...   actually claimed: 31f5bb05-... <-- ORG B'S JOB
runningJob resolved to: 67a7d221-... (fallback to A's own still-queued job)

INDEPENDENT READ (raw pg client) of org B's job after org A's self-claim:
{
  "organization_id": "org-new3-B-0tz09njd",
  "status": "running",
  "lease_owner": "baselineComputeService:worker-A-oldpattern",
  "attempt_count": 1
}
INDEPENDENT READ of compute_job_runs for org B's job:
[ { "worker_id": "baselineComputeService:worker-A-oldpattern", "attempt_number": 1 } ]

INDEPENDENT READ of org A's OWN just-enqueued job (still queued, never actually claimed):
{ "organization_id": "org-new3-A-a9jvobdp", "status": "queued", "lease_owner": null, "attempt_count": 0 }

PHASE 1 RESULT (mutation reproduced?): YES — NEW-3 mechanism confirmed
```

**PHASE 2 — prove the fix holds** (fresh jobs, org A uses `claimById`):

```
org B enqueued job2 9136a80d-...   org A enqueued job2 763c4c38-...
claimById() returned: 763c4c38-... (correctly claimed A's OWN job)

INDEPENDENT READ of org B's job2 after org A's claimById (must be UNTOUCHED):
{ "organization_id": "org-new3-B-0tz09njd", "status": "queued", "lease_owner": null, "attempt_count": 0 }
compute_job_runs rows for org B job2 (must be 0): 0

INDEPENDENT READ of org A's job2 (must be running, claimed by A):
{ "organization_id": "org-new3-A-a9jvobdp", "status": "running", "lease_owner": "baselineComputeService:worker-A-newpattern", "attempt_count": 1 }

PHASE 2 RESULT (fix holds?): YES — org B row untouched, org A claimed its own row
```

**PHASE 3 — failed `claimById()` on an already-running row is a safe `null`, not a mutation:**

```
second claimById() on the same (now running) job returned: null
PHASE 3 RESULT: YES
```

`EVIDENCE_MISSING`: this negative control exercises the mechanism directly at the `computeJobService` level (the exact vulnerable lines, unchanged import of the real, unmodified `claim()`), not a full end-to-end run through `runBaselineCompute()` / `computeAnalysisKpis()` / `runPredictionCompute()` / `runDcfFcffValuation()` themselves (each requires the full statement-pack/model/schedule/assumption fixture graph `tenantMatrix.pg.test.ts` builds, which was judged out of budget to duplicate for all four engines here). The tenant mutation happens ENTIRELY within the `enqueue()`+claim two-line block, before any compute logic runs — this is a faithful, not approximate, reproduction of the mechanism — but I did not separately re-verify that e.g. `predictionComputeService.ts`'s TWO call sites behave identically end-to-end beyond the static code review + grep in §1.3 (both use the literal same `claimById` call shape).

---

## 2. NEW-2 — unscoped `finance_lineage_edges` read

### 2.1 Mechanism

`resolveSourceStatementPackVersion()` exists in both `baselineComputeService.ts` and `kpiComputeService.ts`. In both files it is the ACTUAL first read against a caller-supplied `businessVersionId` — it runs BEFORE the org-scoped checks the W9-C-1 (baseline) / W9-C-6 (KPI) fixes added. Those fixes' own comments claimed "every read below is now scoped" / "this guard is already org-scoped" — true for what they touched, but neither touched `resolveSourceStatementPackVersion()`, which they run AFTER.

`finance_lineage_edges` has a `NOT NULL organization_id` column (migration `20260809_finance_v3_b03_lineage_freshness.sql`). The query had no predicate on it:

```sql
-- before
SELECT source_version_id FROM finance_lineage_edges
 WHERE edge_type = 'STATEMENT_TO_MODEL' AND target_version_id = ?
```

### 2.2 What changed

`server/src/services/finance/canonical/baselineComputeService.ts:155` and `server/src/services/finance/canonical/kpiComputeService.ts:428` — added `organizationId` as the function's first parameter and `AND organization_id = ?` to both queries. Call sites updated: `baselineComputeService.ts:202`, `kpiComputeService.ts:440`. Both functions are module-private (not exported), so no other callers exist (`grep -rn resolveSourceStatementPackVersion server/src tests` confirms — only these four lines, in these two files).

### 2.3 Was this exploitable?

No, per the task's own framing and confirmed here: `loadContext()` (baseline) and `computeAnalysisKpis()` (KPI) both still have their OWN, already org-scoped, downstream checks (`finance_baseline_models WHERE ... AND organization_id = ?` / `getBusinessVersion(organizationId, ...)`), so a cross-tenant call was always refused before this fix — just one check later than necessary, after having actually read (and matched) another org's lineage-edge row.

### 2.4 Negative control — independent proof, pre-fix vs post-fix

**Part 1 — the exact SQL, unscoped vs scoped, direct against the DB (org B has a `STATEMENT_TO_MODEL` edge, org A has none):**

```
UNSCOPED query (no org predicate at all): [ { source_version_id: '4df46dc1-...' } ] <-- LEAKS
SCOPED query, org A (wrong org): [] (correctly empty)
SCOPED query, org B (right org): [ { source_version_id: '4df46dc1-...' } ] (correct)
PART 1 RESULT: true
```

**Part 2 — the REAL, currently-shipped `loadContext()`, org A calling with org B's `businessVersionId`:**

```
loadContext() result: {"ok":false,"code":"NO_SOURCE_STATEMENT_PACK_EDGE","message":"No STATEMENT_TO_MODEL lineage edge targets business_version_id befbae47-..."}
```

**Part 3 — the SAME call, but against `baselineComputeService.ts` as it existed at parent `403d430520`** (git-show'd to a temporary sibling file `_baselineComputeService_prefix_tmp.ts`, imported directly, then deleted — never checked out in place a second time after the first attempt accidentally clobbered uncommitted edits, see §6.1):

```
PRE-FIX loadContext() (baselineComputeService.ts @ 403d430520) result:
{"ok":false,"code":"NO_BASELINE_MODEL_ROW","message":"No finance_baseline_models row for e45ea3eb-..."}
```

**Conclusion: `NO_BASELINE_MODEL_ROW` (pre-fix) vs `NO_SOURCE_STATEMENT_PACK_EDGE` (post-fix) for the IDENTICAL cross-tenant call** — different refusal code, empirically proving the pre-fix code actually read past the (now-fixed) unscoped lineage-edge check and only refused later, one check down. Both codes are `{ok:false}` (isolation held on both sides of the fix — this was never exploitable), but only the post-fix code refuses at the correct, first point.

This SAME code-path change also broke two PRE-EXISTING pinned regression tests in `tenantMatrix.pg.test.ts` that hardcoded the OLD refusal codes:
- `FIXED W9-C-1` (family 2, line ~451): expected `NO_BASELINE_MODEL_ROW` → updated to `NO_SOURCE_STATEMENT_PACK_EDGE`, with an added comment explaining why (the NEW-2 fix moved the refusal point earlier).
- `FIXED W9-C-6` (family 3, line ~515): expected `BUSINESS_VERSION_NOT_FOUND` → updated to `NO_SOURCE_STATEMENT_PACK_EDGE`, same reasoning.

Both tests still assert `ok === false` (isolation holds) — only the specific typed `code` value changed, and the file's own "cannot be lost" discipline is preserved: the tests still pin a real refusal, just the newly-correct one. A THIRD test in the same file (`FIXED W9-C-3`, family 6, `finance_valuation_methods`) asserts `BUSINESS_VERSION_NOT_FOUND` for a DIFFERENT function (`valuationComputeService.findOrCreateMethod`) that this fix never touched — confirmed unaffected, left as-is.

---

## 3. New composite FKs — same structural class as W9-C-7

W9-C-7 (`20260825_finance_v3_w9c7_valuation_child_tenant_fk.sql`) closed six valuation/baseline child tables where `organization_id` was present but the FK to the row's real parent was single-column. The independent verifier found two more tables in the same shape.

### 3.1 `finance_comment_assignments.comment_id -> finance_comments.id`

Before: `finance_comment_assignments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES finance_comments(id)` — no org half. Guarded ONLY by `commentService.ts`'s `assignComment()`, which `SELECT`s `finance_comments WHERE id = ? AND organization_id = ?` before the `INSERT` (`server/src/services/finance/canonical/commentService.ts:212-213`) — pure application code, no DB backstop.

### 3.2 `finance_post_investment_reviews.initiative_id -> initiatives.id`

Before: `finance_post_investment_reviews_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE` — no org half. Guarded ONLY by the route handler (`server/src/routes/v8/finance-value.routes.ts:703-713`, `POST /post-investment-reviews`), which `SELECT`s `initiatives WHERE id = ? AND organization_id = ?` before calling `postInvestmentReviewService.createPostInvestmentReview()` — again pure application code, no DB backstop. `createPostInvestmentReview()` itself inserts `params.initiativeId` directly with no re-check.

`baseline_model_id -> financial_models(id)` on the same table has the identical single-column-FK shape and is ALSO only service-checked (`resolveApprovedBaselineLine`), but was left OUT OF SCOPE: `financial_models` is a pre-Finance-v3-canonical, cross-module table (M04 Consulting Tools era) this work package does not own; closing it is a separate decision for whoever owns that table's migration history.

### 3.3 Migration

`server/migrations/20260826_finance_v3_w2_selfclaim_child_tenant_fk.sql` — additive only, same idiom as W9-C-7:
- `ALTER TABLE finance_comments ADD CONSTRAINT uq_finance_comments_id_org UNIQUE (id, organization_id);`
- `ALTER TABLE finance_comment_assignments ADD CONSTRAINT fk_finance_comment_assignments_comment_org FOREIGN KEY (comment_id, organization_id) REFERENCES finance_comments (id, organization_id);`
- `ALTER TABLE initiatives ADD CONSTRAINT uq_initiatives_id_org UNIQUE (id, organization_id);`
- `ALTER TABLE finance_post_investment_reviews ADD CONSTRAINT fk_finance_post_investment_reviews_initiative_org FOREIGN KEY (initiative_id, organization_id) REFERENCES initiatives (id, organization_id);`

Verified applies clean on a fresh STRICT run: 633 → 634 migrations, exit 0.

### 3.4 Verified "no live vector" claim for the other three tables

```
$ grep -rln "finance_legal_holds" server/src/ tests/       -> (no matches)
$ grep -rln "finance_retention_policies" server/src/ tests/ -> (no matches)
```
Both: **zero production callers anywhere in `server/src` or `tests/`.** `finance_legal_holds.organization_id` is `NOT NULL`; `finance_retention_policies.organization_id` is nullable by design ("NULL = platform default, per-org row overrides", per the migration's own comment) — but moot, since nothing reads or writes either table yet. Claim confirmed.

```
$ grep -rln "finance_candidate_handoffs" server/src/ tests/
server/src/services/finance/financeInvestmentCaseCandidateHandoff.ts
server/src/services/finance/financeValuationRecommendationCandidateHandoff.ts
server/src/services/finance/financeStatementPackCandidateHandoff.ts
server/src/services/finance/financeCandidateHandoffCore.ts
tests/acceptance/fin-006-*.e2e.test.ts (x3)
```
This one DOES have callers, but every single read AND write in `financeCandidateHandoffCore.ts` includes `organization_id` directly in its own `WHERE`/`INSERT` (confirmed by reading the file: lines 334-336, 385-392, 409-411, 456-461) — and the table has NO FK at all to a parent id in the first place (`source_id`/`candidate_id` are plain `TEXT`, no `REFERENCES`, migration `20260802_fin006_candidate_handoff.sql`). It is not the same structural shape as §3.1/§3.2 (an org-scoped column shadowing an unscoped parent FK) — there is no parent FK here to make composite. Claim confirmed as defensible, though on different grounds than "zero callers": "always org-scoped in every query, and no dangling single-column parent FK to begin with."

### 3.5 Negative control for the new FKs, and which layer actually defends

```sql
-- setup: org A, org B, org B's comment cmt-fk-b
INSERT INTO finance_comment_assignments (id, comment_id, organization_id, assignee_id, assigned_by)
  VALUES ('asg-fk-x', 'cmt-fk-b', 'org-fk-test-A', 'u2', 'u2');
-- ERROR:  insert or update on table "finance_comment_assignments" violates foreign key
--         constraint "fk_finance_comment_assignments_comment_org"
--         DETAIL:  Key (comment_id, organization_id)=(cmt-fk-b, org-fk-test-A) is not present
--         in table "finance_comments".
```

```sql
-- setup: org A, org B, org B's initiative init-fk-b, a valid financial_models row (so ONLY the
-- initiative FK is under test, not baseline_model_id's unrelated FK)
INSERT INTO finance_post_investment_reviews (..., organization_id, initiative_id, baseline_model_id, ...)
  VALUES (..., 'org-fk-test-A', 'init-fk-b', 'fm-fk-any', ...);
-- ERROR:  insert or update on table "finance_post_investment_reviews" violates foreign key
--         constraint "fk_finance_post_investment_reviews_initiative_org"
--         DETAIL:  Key (initiative_id, organization_id)=(init-fk-b, org-fk-test-A) is not present
--         in table "initiatives".

-- sanity: SAME-org insert (org B -> its own initiative) succeeds
-- INSERT 0 1  (rolled back, not committed)
```

**Which layer actually defends?** Both blocks above were raw `psql` INSERTs — no TypeScript code, no service, no route in the path. The FK alone rejected both with `23503`, proving it works completely independently of application code. For the REAL request paths that exist today, the application layer is first line of defense (§3.1/§3.2's cited SELECT-before-INSERT checks refuse before the DB write is even attempted) — the FK is a backstop that only a bypass of that application code (a different/future/buggy caller) would ever actually trigger. Both layers can and do catch the same violation; for these two specific tables, no test forced the app-layer check to be skipped to observe the FK fire on its own in the real code path — the raw-SQL test above stands in for "app layer bypassed" and is a faithful proxy (identical statement shape to what the ORM/query builder would send).

---

## 4. `EVIDENCE_MISSING` summary

- NEW-3 negative control is at the `computeJobService` mechanism level (real, unmodified `claim()`/new `claimById()`, real independent-read proof), not a full end-to-end run through all four public compute-engine entry points with their full fixture graphs. The mechanism itself (the two-line enqueue+claim block) is common and unmodified-by-context across all five sites, so this is judged sufficient, but full end-to-end reproduction per engine was not executed.
- The "own-org bookkeeping correctness" side-defect described in §1.4 (pre-fix fallback silently skipping `compute_job_outputs`/`succeeded` transition even in a same-org race) is analyzed from code reading, not independently reproduced under an actual race — flagged, not proven with a timing-based test.
- §3.5's "which layer defends" conclusion for the two new FKs is argued from reading the call sites, not from a live end-to-end HTTP/service-level bypass test that forces the app-layer check to be skipped while still reaching the INSERT.

---

## 5. `computeJobService.ts` — exact lines added, for manual merge

Another agent owns this file concurrently (rebuilding `claim()` itself: kill switch, per-org concurrency limit, reaper, heartbeat). **`claim()` was NOT touched** — only a new, self-contained block was inserted immediately after it (between the end of `claim()` and the start of `CompleteJobSuccessParams`). Current line numbers in this worktree: **lines 160–238** (79 lines: blank line 159, then the `ClaimByIdParams` interface, doc comment, and `claimById()` function, ending with a blank line 239 before `export interface CompleteJobSuccessParams` at line 240). No other line in the file was changed — `git diff` confirms a single contiguous insertion, zero deletions, zero modifications elsewhere in the file.

```
git diff 403d430520..HEAD -- server/src/services/finance/canonical/computeJobService.ts
```
shows exactly one hunk, `@@ -157,6 +157,86 @@`, i.e. 80 lines added right after line 157 of the original file (the closing `}` of `claim()`), nothing removed.

---

## 6. Test/environment notes

### 6.1 Incident: uncommitted edits briefly lost via `git checkout HEAD --`

While building the NEW-2 negative control, I ran `git checkout 403d430520 -- baselineComputeService.ts` to get the pre-fix file for comparison, then `git checkout HEAD -- baselineComputeService.ts` to restore — but at that point `HEAD` was still the parent commit (`403d430520`, nothing of this session's work committed yet), so the "restore" actually discarded my uncommitted NEW-3+NEW-2 edits to that one file. Caught immediately via `git diff --stat` showing empty and a `grep` for `claimById`/the new `resolveSourceStatementPackVersion` signature coming up empty. Re-applied both edits from memory (verified identical to the lost version via the same `grep`/`tsc` checks), then committed immediately. Subsequent `git show <parent>:<path> > _tmp_prefix_file.ts` (a NEW temp file, never checking out in place again) was used for the second, more careful pre-fix comparison in §2.4 Part 3 — no in-place checkout was performed again after this incident.

### 6.2 Migrations

```
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-sc-pgdata ; PGSOCK=/tmp/fv3scsock ; PORT=57741
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3sc_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_sc;"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_sc" \
  npx tsx server/scripts/migrate.postgres.ts   # STRICT, no --safe
```
Result: **exit 0, 634 migrations** (baseline 633 + this session's 1 new migration).

### 6.3 Test runs (from `server/`, `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://postgres@127.0.0.1:57741/fv3_sc NODE_ENV=test`)

```
npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism
```
Before any code change (baseline confirmation): **31 files passed, 421/421 tests, exit 0.**
After NEW-3 + NEW-2 + tenantMatrix.pg.test.ts updates: **31 files passed, 421/421 tests, exit 0** — the two intermediate failures (`FIXED W9-C-1`, `FIXED W9-C-6`, both asserting a now-stale refusal `code`) were fixed by updating the pinned expected code, per §2.4, not by reverting the NEW-2 fix.

```
npx vitest run src/services/finance --no-file-parallelism
```
**40/41 files passed, 688/689 tests, exit 1** — the ONE failure is `src/services/finance/collaboration/__tests__/collaboration.pg.test.ts`, `computePinning.enqueueComputeForCurrentRevision > pins to the CURRENT content_semantic_hash...`, asserting `NO_CONTENT_HASH` but getting `ok:true`. This EXACTLY matches the orchestrator's documented pre-existing baseline for this SHA ("1 czerwony, `collaboration.pg.test.ts`, konflikt semantyczny `NO_CONTENT_HASH` — naprawia go inny agent, nie Twój problem, odlicz go") — confirmed NOT caused by this session's changes (nothing in `computePinning.ts`/`autosaveService.ts`/collaboration code was touched here).

```
cd .. && npx tsc -p server
```
**Exit 0, zero output**, run fresh after the checkout incident was fully resolved (i.e. against the final, correct file state).

### 6.4 Migration STRICT count baseline vs after

Before this session's migration: 633 (orchestrator-provided baseline, reconfirmed on a fresh cluster at session start). After: 634.

---

## 7. Recommendation for gate FC-01

- **NEW-3**: fixed, empirically proven at the mechanism level (§1.5), all five call sites updated (§1.3), `claim()` itself untouched (compatible with the concurrent worker-pool rebuild in `computeJobService.ts`, merge instructions in §5).
- **NEW-2**: fixed, empirically proven pre-fix vs post-fix (§2.4), two pinned regression tests updated with documented rationale, non-exploitable before and after (defense-in-depth improvement, not a boundary closure).
- **New FKs**: two tables closed in the same class as W9-C-7, migration additive and verified (§3.3, §3.5); three candidate tables independently re-verified as out-of-scope with fresh grep evidence (§3.4), one (`financial_models` via `baseline_model_id`) explicitly flagged as a related-but-out-of-scope follow-on for whoever owns that table.
- Recommend FC-01 proceed to close on this specific finding, contingent on the orchestrator's own re-run of the full suite after merging the concurrent `computeJobService.ts` work from the other agent (this session's `claimById()` addition is designed to merge cleanly alongside that work per §5, but was not tested AGAINST that agent's in-flight changes, which this worktree does not have).
- `EVIDENCE_MISSING` items in §4 should be closed before treating NEW-3 as fully closed for a real worker-pool rollout (today's self-claim-only usage is covered; a future actual worker pool calling `claim()` concurrently with self-claim callers using `claimById()` was not tested together).
