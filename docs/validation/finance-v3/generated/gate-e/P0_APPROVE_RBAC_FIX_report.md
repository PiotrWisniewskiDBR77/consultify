# P0 APPROVE RBAC FIX — report

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`
Branch: `codex/fv3p-p0-approve-rbac`
Tip before this work: `92d55300fb` (J4 RBAC + maker-checker + immutability report — P0 confirmed)
Tip after this work: **`71f905b6aa`**
Candidate this branch is validating: `ee5736a5a6`

Commits added:

```
0f4e079f34 fix(finance-v3/P0): gate POST /models/:modelId/approve by FinanceRole
83b2060295 wip(finance-v3/P0): UNVERIFIED — test bramki roli, praca przerwana
71f905b6aa fix(finance-v3/P0): defect 2 partial — derive editorUserIds from finance_working_revisions
```

`git diff --stat 92d55300fb..71f905b6aa`:

```
 .../__tests__/approveRbacGate.pg.test.ts           | 355 +++++++++++++++++++++
 server/src/routes/v8/finance-v2/models.routes.ts   |  20 +-
 .../finance/canonical/artifactVersionService.ts    |  87 ++++-
 3 files changed, 458 insertions(+), 4 deletions(-)
```

---

## Defect 1 — P0, no role gate on approve — FIXED

### What was wrong

`approveVersion()` (`server/src/services/finance/canonical/artifactVersionService.ts`)
declared `params.role: FinanceRole` in `ApproveVersionParams` and never read it
anywhere in its body. `POST /api/v8/finance-v2/models/:modelId/approve`
(`models.routes.ts`) called it with no role check of its own either. Any
authenticated org member — including `viewer` — could approve an `IN_REVIEW`
version, as long as they were not literally the submitter (the SoD check still
ran, but it only ever compared identity, never role).

### Role set chosen and why

`APPROVE_ALLOWED_ROLES = ['approver', 'finance_admin']`.

This was **not** copied from `REOPEN_ALLOWED_ROLES` even though the two sets
are identical today. The source of truth read to derive it is
`allowedActionsFromStatus()` in `lifecycleService.ts` — the same function
`GET /artifacts/:artifactId/capabilities` calls to compute `allowedActions`
for the UI:

```ts
if (currentStatus === 'IN_REVIEW' && (role === 'approver' || role === 'finance_admin')) {
  actions.add('approve');
}
```

`/capabilities` already correctly hid `approve` from every role except
`approver`/`finance_admin` for an `IN_REVIEW` version — the UI hint was
correct, only the endpoint behind it was unguarded. `APPROVE_ALLOWED_ROLES`
makes the endpoint agree with what capabilities already promised, rather than
introducing a third, independently-invented rule. Reopen and approve are
different actions in the ADR (T8 vs T12) and could legitimately have diverged
— they happen not to, but that is a fact about today's rule table, not a
reason to derive one from the other.

### Fix — two independent gates (defense-in-depth)

1. **Service layer** (`artifactVersionService.ts`, `approveVersion()`):
   checked before `withPinnedPostgresTransaction` even opens — ahead of the
   idempotency-replay lookup too, so a forbidden-role caller can never observe
   a cached successful result from someone else's prior approval either.
   Returns the same typed shape `reopenVersion()` already uses for
   `REOPEN_ALLOWED_ROLES`: `{ ok: false, code: 'FORBIDDEN', message }`. Added
   `'FORBIDDEN'` to `ApproveErrorCode`.
2. **Route layer** (`models.routes.ts`, `POST /models/:modelId/approve`):
   checked before any DB round-trip, independently of the service call —
   `if (!APPROVE_ALLOWED_ROLES.includes(role)) return res.status(403).json({...})`.
   The route's error-code switch also now maps the service's own `'FORBIDDEN'`
   to 403 (previously fell through to the generic `400` default), so a
   hypothetical future second caller of `approveVersion()` that bypasses this
   route still gets a correct HTTP status if it is ever wired to one.

Both layers use the same `APPROVE_ALLOWED_ROLES` constant (exported from the
service, imported by the route) — sharing the constant is a maintenance
choice, not a weakening of the two enforcement *points*, which are textually
and causally independent (see negative control below).

---

## Defect 2 — maker-checker gap — PARTIAL (editorUserIds fixed, reviewStartedBy remains)

### editorUserIds — FIXED, no migration needed

`ApproveVersionParams.editorUserIds` was documented as "caller supplies from
`artifact_lifecycle_events` if it wants full enforcement; defaults to `[]`" —
i.e. opt-in, and no production caller ever opted in (the route never passed
it; `autosaveService.checkpointOperationStack()` never writes to
`artifact_lifecycle_events` at all — and it structurally **cannot** today,
because `20260809_finance_v3_b02_lifecycle_events.sql`'s `action` column has a
`CHECK (action IN ('CREATE', 'SUBMIT_FOR_REVIEW', ..., 'REOPEN', ...))`
constraint with no value for an edit/checkpoint — adding one is a migration).

Investigating the alternative the task asked me to check first: is there
already a correct, unread data source? Yes —
`finance_working_revisions.edited_by` is stamped correctly on **every**
checkpoint (`checkpointOperationStack()`'s INSERT) and on the very first
working revision (`createArtifact()`). The J4 probe's own
`RULE-SOD-EDITOR-NOT-SUBMITTER-GAP` check confirmed this directly
(`edited_by was indeed the approving user: true`) even before this fix — the
data was never missing, only unread.

Fix: `approveVersion()` now runs, inside the same pinned transaction, in the
same step group as the other SoD preconditions:

```sql
SELECT DISTINCT edited_by FROM finance_working_revisions
 WHERE business_version_id = ? AND organization_id = ? AND edited_by IS NOT NULL
   AND (checkpoint_source IS NOT NULL OR revision_seq = 1)
```

merged (union, not replace) with any caller-supplied `params.editorUserIds`,
and passed to `checkSelfApproval()`. This makes full editor-conflict
enforcement the **default**, not opt-in, using data that was already correct
— zero changes to `autosaveService.ts` and zero migration.

**The filter is load-bearing, found by a real regression, not written
defensively up front.** A first, unfiltered version (`edited_by IS NOT NULL`,
no other condition) broke 8 existing tests
(`lineageFreshnessService.pg.test.ts`'s `reopenAndApprove` helper and one
other suite): `reopenVersion()`'s copy-on-write INSERT *also* stamps
`edited_by` on the new working revision it mechanically clones, set to
whichever actor called reopen — an actor restricted to
`approver`/`finance_admin` by `REOPEN_ALLOWED_ROLES`. This codebase's own
tests legitimately have the same approver reopen a version and later
re-approve it — a real, intended workflow (fix a mistake, re-submit under a
new draft, re-approve), not an attack. Counting that mechanical row as
"editing" produced a false `SELF_APPROVAL_FORBIDDEN`. The `revision_seq = 1`
/ `checkpoint_source IS NOT NULL` filter distinguishes genuine authorship
(the original creation row, or any real autosave/explicit-save checkpoint)
from that copy-on-write row (which is never `revision_seq = 1` for a reopened
version and never sets `checkpoint_source`). After the fix: J4 probe 37/37,
full real-DB suite 656/656 (see below) — root-caused and re-verified, not
just reverted.

### reviewStartedBy — NOT FIXED, needs a migration (out of allowlist)

There is **no** `review_started_by` column on `finance_business_versions` at
all. `TRANSITIONS`'s `T4` (`start_review`) has no `ACTOR_FIELD_BY_ACTION`
entry the way `T2`/`T10` (`submitted_by`/`archived_by`) do — nobody has ever
recorded who started a review. The HIGH_RISK-only "approver must also differ
from the reviewer" half of `checkSelfApproval()` therefore has zero
production data to check against, migration or not-migration. Fixing this
needs: (a) `ALTER TABLE finance_business_versions ADD COLUMN
review_started_by TEXT` (additive, safe), (b) wiring `transition()`'s
`ACTOR_FIELD_BY_ACTION` for `start_review`, (c) reading it in `approveVersion()`.
(a) is a migration file, which is outside this fix's allowlist
(`artifactVersionService.ts` / `models.routes.ts` / new test files /
`autosaveService.ts`) — reported here rather than done, per the task's own
"do not force it outside the allowlist" instruction. Cost: small (one
additive column + one line in `ACTOR_FIELD_BY_ACTION` + one read in
`approveVersion()`), but requires a migration PR this agent cannot open.

---

## Capability ↔ endpoint consistency — checked for ALL actions, one more gap found and reported (not fixed, out of allowlist)

The most important test requested: for every lifecycle action, does
`GET /capabilities`'s `allowedActions` agree with what the real endpoint
actually enforces?

**Generalized regression test**:
`server/src/routes/v8/finance-v2/__tests__/approveRbacGate.pg.test.ts`,
capability-sweep section — drives a fresh artifact to the correct `from`
status for each of the 9 lifecycle actions (`submit_for_review`, `withdraw`,
`start_review`, `request_changes`, `resume_editing`, `approve`, `archive`,
`invalidate`, `reopen`), for both `viewer` (excluded from every action) and
`preparer` (excluded from the approver/finance_admin-only actions), and
asserts: capabilities says "not allowed" **and** the real endpoint
independently agrees (403 `FORBIDDEN`) **and** the row is unchanged
(independent `pg.Client`, separate socket). 15 sweep cases, all pass — see
run log below.

Result: **every action `/capabilities` reports is now correctly enforced.**
`submit_for_review`/`withdraw`/`start_review`/`request_changes`/`resume_editing`
were already enforced via `validateTransition()`; `archive`/`invalidate` the
same; `reopen` via `REOPEN_ALLOWED_ROLES`; `approve` via this fix's
`APPROVE_ALLOWED_ROLES`.

**One more gap of a different shape, reported not fixed**: I had a
general-purpose research agent survey every mutating route across
`server/src/routes/v8/finance-v2/*` for the same *class* of bug. Finding:
`POST /versions/:businessVersionId/compute-snapshot` (T8a pre-approval
snapshot freeze) calls `createComputeSnapshot()`, whose
`CreateComputeSnapshotParams` has **no `role` field at all** — any
authenticated org member, including `viewer`, can freeze a compute snapshot.
This is **not** a capability/endpoint *mismatch* like the approve bug was —
`allowedActionsFromStatus()` never reports a `'compute_snapshot'` action, so
there is no UI hint promising a restriction the endpoint fails to honor. It
is a plain missing-authorization gap, structurally the closest sibling to the
approve bug (same file, same T8/T8a/T9/T12 family). Fixing it needs a new
`role` param threaded through `createComputeSnapshot()` **and** route wiring
in `versions.routes.ts`, which is outside this fix's allowlist
(`versions.routes.ts` is not in it). Flagged as a spawned follow-up task
(`task_d8178653`, "Fix missing role gate on compute-snapshot freeze (T8a)")
rather than fixed here. `export`/`import`/`compute`/comment-resolve/
review-checklist routes were also surveyed: none of them have a role check
either, but none of them are ever reported as gated by any capability
computation, so — per the letter of "capability ↔ endpoint consistency" —
they are a separate, broader authorization gap, not this bug's class, and out
of scope for this specific fix.

---

## No-mutation proof on denial

Every regression test in `approveRbacGate.pg.test.ts` that expects a 403
confirms the row via a **separate `pg.Client`** connection (own TCP socket,
never the app's `PostgresDatabase` pool) — status, version, `approved_by`,
`approved_at` all asserted unchanged. Same pattern the J4 probe already used
(`verifyIndependently()`). Sample assertions (from the "viewer cannot
approve" test):

```ts
expect(after.status).toBe('IN_REVIEW');
expect(after.version).toBe(before.version);
expect(after.approved_by).toBeNull();
expect(after.approved_at).toBeNull();
```

---

## Negative control (per layer, independently)

Method: `git show HEAD:<file> > <file>` to restore only — never `git stash`/
`reset`/`clean`. Every mutant confirmed restored via empty `git diff` before
moving to the next.

Because the route-layer check short-circuits (`return` before ever calling
`approveVersion()`), removing **one** layer alone does not reproduce the
vulnerability over HTTP by itself — that is what defense-in-depth is
supposed to guarantee, not a weakness in the experiment. Four experiments
were run to prove each layer is independently load-bearing:

| # | Mutant | Test | Result |
|---|---|---|---|
| 1 | Route check disabled (`if (false && ...)`), service check intact | HTTP `POST /models/:id/approve` as viewer | **403 — still blocked.** Proves the service layer alone protects the HTTP path even with the route gate gone. |
| 2a | Service check disabled, route check intact | Same HTTP call | **403 — still blocked** (route catches it first). |
| 2b | Same mutant as 2a | **Direct call** to `approveVersion({role:'viewer', ...})`, bypassing the route entirely | **`ok:true`, row flipped to `APPROVED`, `approved_by` = the viewer's id — VULNERABLE.** Proves the service's own gate, not the route, is what protects any caller that does not go through this specific route (and is not dead code shadowed by the route). |
| 3 | Both checks disabled | Same HTTP call, run via `--rule=RULE-P0` | **Both `RULE-P0-VIEWER-APPROVE` and `RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER` FAIL — HTTP 200, row `APPROVED` — exact reproduction of the original P0.** |

After each mutant: `git show HEAD:<file> > <file>` on the affected file(s),
then `git diff --quiet` confirmed empty before the next experiment. Final
state after all four experiments: `git diff` empty, both fix commits intact.

---

## J4 probe — before / after

Same probe (`server/scripts/finance-v3-audit/j4-rbac-probe.ts`), fresh
local-only Postgres 15 database each run (`/Users/piotrwisniewski/fv3-pg/newdb.sh <name>`,
127.0.0.1:54330), full four-variable gate (`RUN_DB_TESTS=1 MOCK_DB=false
NODE_ENV=test DATABASE_URL=postgresql://...`).

| When | Checks | FAIL | Failing checks |
|---|---|---|---|
| Before any fix (HEAD `92d55300fb`) | 37 | **4** | `RULE-P0-VIEWER-APPROVE`, `RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER`, `RULE-SOD-EDITOR-NOT-SUBMITTER-GAP`, `RULE-CAPABILITY-NOT-A-GATE` |
| After defect-1 fix only (`0f4e079f34`) | 37 | 1 | `RULE-SOD-EDITOR-NOT-SUBMITTER-GAP` (defect 2, expected) |
| After defect-1 + defect-2 fix (`71f905b6aa`, final) | 37 | **0** | — |

Final clean run: `j4-rbac-probe: 37 checks, 0 FAIL, duration 1626ms` (full
wall time including schema init ~32s). One earlier rerun hit a transient
`ECONNRESET`/"socket hang up" mid-run on this shared local Postgres cluster
(documented in the probe's own header as an expected hazard when other
agents' sessions are concurrently active against the same physical cluster)
— confirmed environmental by an immediate clean rerun on a freshly dropped/
recreated database, not a defect.

---

## Full real-DB regression — `finance-v2` + `canonical`

`cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/<fresh> npx vitest run --config vitest.config.ts --maxWorkers=2 src/routes/v8/finance-v2 src/services/finance/canonical`

| Run | Files | Tests | Result | Duration | Note |
|---|---|---|---|---|---|
| 1 (before defect-2 fix) | 60 | 656 | 656 passed, 1 unhandled schema-init race (`CREATE INDEX idx_tasks_reporter` duplicate key) | 21s | exit 1 from the race, not a test failure |
| 2 (repeat, fresh DB) | 60 | 656 | **656/656, exit 0** | 24s | confirms run 1's failure was the DB race, not my change |
| 3 (first, unfiltered defect-2 fix) | 60 | 656 | **648/656, 8 FAIL** | 31s | genuine regression — root-caused (reopen's copy-on-write `edited_by`), fixed with the `checkpoint_source`/`revision_seq=1` filter |
| 4 (refined defect-2 fix) | 60 | 656 | 654/656, 2 FAIL (both `socket hang up` / passed in isolation) | 32s | infra flake, confirmed by isolation rerun (15/15) |
| 5 (repeat, fresh DB, final) | 60 | 656 | **656/656, exit 0** | 29s | clean confirmation |

`exit 134` (OOM) never observed. Exit codes measured directly
(`cmd > file 2>&1; code=$?`), never through a pipe.

---

## `tsc --noEmit -p server/tsconfig.json`

`NODE_OPTIONS=--max-old-space-size=12288`, explicit exit code captured every
time: **exit 0** on the final tree. Run after each of: defect-1 fix, defect-2
first (unfiltered) attempt, defect-2 refined fix.

`grep -rn "approveVersion(" server/src` (excluding this file's own doc
comments) and `grep -rln "approveVersion" tests/` (repo-root `tests/`, no
matches): the only production caller is `models.routes.ts` (already updated
to pass `role`); every `.pg.test.ts` caller across
`server/src/services/finance/canonical/__tests__/*` and
`server/src/routes/v8/finance-v2/__tests__/*` already passes
`role: 'approver'` or `role: 'finance_admin'` — none needed updating, and the
full real-DB run above (656/656) is the direct confirmation none broke.

---

## New test file

`server/src/routes/v8/finance-v2/__tests__/approveRbacGate.pg.test.ts` — 20
tests, real HTTP (`express` + `supertest`) + real PostgreSQL + independent
`pg.Client` verification:

- viewer / preparer (not submitter) cannot approve — 403 `FORBIDDEN`, row
  unchanged.
- approver / finance_admin CAN approve — 200, row `APPROVED`,
  `approved_by` correct.
- service-level: role `'reviewer'` (unreachable via any real org role today
  — confirmed by the J4 probe's `RULE-REVIEWER-UNREACHABLE` structural
  finding) is still rejected when calling `approveVersion()` directly,
  so a future role-mapping change cannot silently regain the P0.
- capability ↔ endpoint sweep, 15 cases across all 9 lifecycle actions ×
  {viewer, preparer-on-elevated-actions}, generalizing the exact shape of
  this bug class.

---

## Not delivered, and why

1. **`reviewStartedBy` (defect 2, HIGH_RISK reviewer-conflict half)** —
   needs a new `review_started_by` column (migration, outside allowlist).
   See "Defect 2" section above for the exact 3-step cost once unblocked.
2. **`createComputeSnapshot()` role gate** — same bug class as approve, found
   while surveying for capability/endpoint mismatches, but is a plain
   missing-authorization gap (no capability ever claims to restrict it) and
   needs route-layer changes in `versions.routes.ts`, outside this fix's
   allowlist. Flagged as `task_d8178653`.
3. **`compute`/`export`/`import`/comment-resolve/review-checklist routes
   with zero role checks** — surveyed, none collide with any capability
   computation (so not this bug's class), left unflagged as individual
   follow-ups since they were not the mandate of this fix; noted here for
   visibility.

Every other requested deliverable (role regression matrix, generalized
capability/endpoint consistency test, no-mutation proof, per-layer negative
control, J4 before/after, full real-DB regression, `tsc`, caller grep) is
complete and evidenced above.
