# MW-CORE-004 — Negative-control report (Inbox/Task golden flow)

Branch: `feat/mw-core-001-inbox-task-golden-flow` (worktree `wt-mw-core-001`).
Suite under test: `tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts`
(17 scenarios, real Postgres, real routers/middleware), run via
`scripts/test-mw-core-golden-flow-pg.sh`.

Baseline confirmed before starting: 17/17 green, `git diff --stat server/src src`
empty.

Method for each of the 8 controls: make one temporary edit in `server/src`,
run the suite (or, where the script's schema-reload step interfered, run
`npx vitest run --config tests/integration/mywork/vitest.golden-flow.config.ts
--retry=0 tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts`
directly against the already-loaded scratch DB), capture the RED, `git
checkout --` the file back, confirm GREEN (17/17), confirm
`git diff --stat server/src src` is empty again before moving to the next
control. After the final control, `git status --short` at the repo root was
verified clean before writing this report.

---

## 1. Remove organization predicate — VERIFIED

**Changed**: `server/src/routes/v8/my-work.routes.ts`, the Step-2 close
route's task lookup (`POST /inbox/tasks/:taskId/close`). Original:

```ts
`SELECT id, organization_id, assignee_id, owner_id, status
 FROM tasks WHERE id = ? AND organization_id = ?`,
[taskId, organizationId]
```

Removed the `AND organization_id = ?` predicate and its bound param (line
~714-717).

**RED**: `#5 tenant isolation > 5c tenant B cannot close tenant A's Task
inbox item (404 INBOX_CLOSE_TASK_NOT_FOUND)` — expected 404, got **403**.
Not a 200 (the downstream `isOwnerOrAssignee` check still coincidentally
blocks user B, since he isn't TASK_TENANT_A's assignee/owner), but the
response code changed from the required 404 to a 403 — proof the tenant
boundary is no longer enforced at the DB-lookup layer and now depends
entirely on a second, independent check. This is a real behavior change the
test catches, confirming the predicate is on the exercised path.

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED. The org predicate is live and its removal is
detected by the test suite (via a status-code change, not silence).

---

## 2. Remove capability enforcement — VERIFIED

**Changed**: `server/src/routes/pmo/tasks.routes.ts:1145`, commented out
`requireTaskCapability('task.update', { shadow: true })` on
`PUT /api/tasks/:id`.

**RED**: `#6 missing task.update capability (OBSERVER role) returns 403
under CAPABILITY_ENFORCE=enforce, changes nothing` — expected 403
`CAPABILITY_REQUIRED`, got **200** (unauthorized mutation succeeded).

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED.

---

## 3. Restore silent legacy Inbox fallback / swallow V8_ORG_DISABLED — VERIFIED

**Changed**: `server/src/middleware/v8FeatureGate.middleware.ts`, the
`v8OrgGate` fail-closed branch (lines ~51-56). Replaced the
`res.status(404).json({ code: 'V8_ORG_DISABLED' })` + `return` with
`(req as any).v8ShadowMode = false; next();` — i.e. let the request through
as if V8 were enabled for the org, instead of failing closed.

**RED**: `#16 an org with V8 explicitly disabled gets 404 V8_ORG_DISABLED
from the real v8OrgGate — no legacy fallback success` — expected 404, got
**200** (the disabled org silently got real Inbox data back).

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED. This is the real backend gate exercised by scenario
#16 — no separate frontend `shouldFallbackToLegacyMyWorkInbox` mutation was
needed since the backend gate is what the test hits directly and it alone
fully demonstrates the "silent success instead of fail-closed" failure mode.

---

## 4. Remove idempotency key/uniqueness — VERIFIED (with a real methodology gotcha found)

**Changed**: two things, both needed —
1. `server/src/services/inboxService.ts`, `materializeInboxItems()`'s
   `UPSERT_SQL`: removed the `ON CONFLICT (user_id, source_entity_type,
   source_entity_id) DO UPDATE SET ...` clause, leaving a plain `INSERT`.
2. Dropped the actual DB-level unique constraint
   `canonical_inbox_items_user_id_source_entity_type_source_ent_key` on the
   scratch Postgres (`ALTER TABLE canonical_inbox_items DROP CONSTRAINT ...`).

**Finding surfaced by the discipline check**: doing only (1) and re-running
via `scripts/test-mw-core-golden-flow-pg.sh` produced a **false GREEN** —
the script's `tests/acceptance/schema.mjs` reload step (which runs on every
invocation, before the suite) silently re-created the dropped constraint as
part of its "known-rollback workaround" re-apply pass for
`canonical_inbox_items`. Verified directly: `SELECT conname FROM
pg_constraint WHERE conrelid = 'canonical_inbox_items'::regclass` showed the
unique constraint back in place after a script run where I had dropped it
beforehand. This means a naive "just flip the code and run the wrapper
script" negative control for this specific case would have wrongly reported
"no duplicate" (silently masked, not because the app protects against it,
but because the DB constraint — reapplied by test tooling — did). To get a
real signal, I dropped the constraint, then ran `vitest` **directly**
(bypassing the script's schema-reload step) against the same
already-provisioned scratch DB.

**RED** (application code changed + DB constraint dropped, vitest run
directly): 3 failures —
- `#2 repeated materialization of the same task creates no duplicate row` —
  expected 1 row, got 6 (materialize called repeatedly across earlier
  scenarios in the same suite run, each producing a new row for `TASK_MAIN`).
- `#9/#10/#13 full happy path...` — expected 1 row for `TASK_MAIN`, got 6.
- `#11/#12 fault after Task commit...` — expected 1 row for
  `TASK_RECOVERY`, got 7.

**GREEN**: reverted `inboxService.ts` via `git checkout`, then explicitly
re-created the DB constraint (`ALTER TABLE canonical_inbox_items ADD
CONSTRAINT ... UNIQUE (user_id, source_entity_type, source_entity_id)`),
confirmed present again, then ran the **full wrapper script**: 17/17 passed.

**Verdict**: VERIFIED — and worth flagging as a standing methodology risk:
this suite's app-level protection has real DB-level defense in depth (a
genuine unique constraint), but the test *script* itself will silently
restore that constraint on every run via its schema-reload pass. Anyone
attempting this specific negative control in the future must either bypass
the script's schema step or drop the constraint *after* schema load, or
the drop will be invisible and the control will falsely read as still
green. Not a production bug — the production migration correctly created
the constraint; this is purely a test-harness surprise worth remembering.

---

## 5. Return UI/API success before database read-back — VERIFIED (after escalating past a DID-NOT-APPLY)

**First attempt (DID-NOT-APPLY)**: `server/src/controllers/TaskController.ts:1736`,
changed `await DbPromise.run(sql, params);` to `void DbPromise.run(sql,
params);` (fire-and-forget) with no other change. Ran the suite: **17/17
still passed** — no failure at all. Root cause: between the fire-and-forget
UPDATE and the final `res.json(updatedTask)` (which re-reads the row from
DB), `updateTask` performs a long chain of *other* awaited work (task
history inserts, an audit-log call, a fresh `syncedTask` SELECT, Jira sync,
EventBus publish, notification dispatch, PMO throttled-notification logic —
9+ additional `await` points). Each of those yields to the event loop long
enough that the fire-and-forgotten UPDATE reliably lands before the
response is ever sent. Reporting this honestly per the task's own
discipline rule rather than picking an easier mutation: **a bare
fire-and-forget in this specific handler does not reproduce the failure
mode**, because of incidental downstream latency that happens to protect it.

**Escalated, deterministic version**: kept the fire-and-forget `void
DbPromise.run(...)` and added an immediate optimistic
`res.json({ ...currentTask, ...updates, id, updated_at: now }); return;`
right after it — skipping all the downstream logic (and the real read-back)
so the response is sent essentially synchronously with firing the write.

**RED** (reproduced identically on 3 consecutive runs): `#11/#12 fault
after Task commit -> 500 recovery-required; retry repairs without
duplication` failed at:
```
expect(committedTask.status).toBe('in_progress');
// AssertionError: expected 'todo' to be 'in_progress'
```
Step 1 (`PUT /api/tasks/:id`) returned 200 with an optimistic body claiming
`in_progress`, but the very next line's **independent direct SQL read**
(`getTask(TASK_RECOVERY)`, a raw `client.query` outside the app) showed the
task was still `'todo'` — the write had not yet landed. (Scenario
`#9/#10/#13`, which reads back via a full `request(app).get(...)` instead
of a raw client query, happened not to catch it in this run — the extra
Express routing/middleware overhead on that path apparently gives the fired
UPDATE enough time to land first. #11/#12's raw, immediate DB read is the
one that reliably exposes the race.)

**GREEN**: reverted `TaskController.ts` via `git checkout`; 17/17 passed.

**Verdict**: VERIFIED, with an honest DID-NOT-APPLY logged first. The
production code's real behavior (`await`ing the write, and doing so before
any response is sent) is what prevents this exact bug today; a bare
fire-and-forget alone wasn't sufficient to break it in this handler because
of unrelated intervening awaits, but skipping straight to the response
does expose the same underlying race.

---

## 6. Disable the failure-injection/recovery path itself — VERIFIED

**Changed**: `server/src/routes/v8/my-work.routes.ts`, the close route's
`catch` block (lines ~764-775). Replaced the honest
`res.status(500).json({ code: 'INBOX_CLOSE_RECOVERY_REQUIRED', ... })` with
a fabricated success: `res.json({ data: { success: true, taskId, status:
'closed', inboxItem: null }, ... })` — i.e. swallow whatever exception
`closeInboxItemForSource` threw (including the test's real fault-injection
trigger) and report success anyway.

**RED**: `#11/#12 fault after Task commit -> 500 recovery-required; retry
repairs without duplication` — `firstAttempt` expected 500
`INBOX_CLOSE_RECOVERY_REQUIRED`, got **200** `closed` (the genuine DB
trigger exception — confirmed firing via the logged error message
`mwgolden test-injected recovery fault...` — was silently swallowed and
reported as a fabricated success).

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED.

---

## 7. Allow another recipient to close the item — VERIFIED (re-verification of the existing #4 proof)

Per the mission brief, this reversal overlaps with scenario #4's ownership
check, which the test-suite's own commit message
(`c72d2d84d4`) claims was already verified red→green during the suite's
construction. Per the "audits go stale, verify the real runtime, don't
trust a claim" rule, I re-did the check independently rather than taking
the commit message's word for it.

**Changed**: `server/src/routes/v8/my-work.routes.ts:726`, replaced
```ts
const isOwnerOrAssignee = task.assignee_id === userId || task.owner_id === userId;
```
with `const isOwnerOrAssignee = true;` (always pass, regardless of caller
identity).

**RED**: `#4 another user in the same org cannot close the Inbox item (403
INBOX_CLOSE_FORBIDDEN, no state change)` — expected 403, got **200** (a
non-owner/non-assignee user in the same org successfully closed another
user's inbox item).

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED — the prior build-time proof for scenario #4 still
holds; independently re-confirmed today, not merely re-stated from the
commit message.

---

## 8. Replace canonical Task service with direct raw Task update — VERIFIED

**Changed**: `server/src/routes/pmo/tasks.routes.ts`, replaced the entire
`PUT /api/tasks/:id` route registration —

```ts
router.put(
  '/:id',
  requireAudit,
  requireTaskCapability('task.update', { shadow: true }),
  validateBody(UpdateTaskSchema),
  TaskController.updateTask
);
```

— with a raw handler that bypasses `requireAudit`,
`requireTaskCapability`, `validateBody(UpdateTaskSchema)`, and
`TaskController.updateTask` entirely:

```ts
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = (req.body as any)?.status;
    if (status !== undefined) {
      await DbPromise.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, id]);
    }
    const row = await DbPromise.get(`SELECT * FROM tasks WHERE id = ?`, [id]);
    res.json(row);
  })
);
```

**RED**: 3 tests failed simultaneously, each exposing a different guard the
raw path skips —
- `5b tenant B cannot mutate tenant A's Task via PUT /api/tasks/:id (404,
  org-scoped SELECT)` — expected 404, got **200** (the raw `SELECT ... WHERE
  id = ?` has no `organization_id` scoping at all, so cross-tenant writes
  succeed).
- `#6 missing task.update capability ... returns 403` — expected 403, got
  **200** (capability gate entirely bypassed).
- `#7a invalid task status transition (backlog -> done) is rejected 400
  INVALID_TRANSITION` — expected 400, got **200** (no
  `validateTaskStatusTransition` call at all in the raw path — any status
  string is accepted unconditionally).

**GREEN**: reverted; 17/17 passed.

**Verdict**: VERIFIED. The raw-update substitution simultaneously breaks
tenancy scoping, capability enforcement, and transition validation — strong
confirmation that `TaskController.updateTask` (plus its route-level
middleware) is the sole place all three guards live; there is no redundant
enforcement elsewhere in the request path for `PUT /api/tasks/:id`.

---

## Summary

| # | Control | Verdict |
|---|---------|---------|
| 1 | Remove organization predicate (close route task lookup) | VERIFIED |
| 2 | Remove capability enforcement (Step 1 route) | VERIFIED |
| 3 | Restore silent legacy fallback / swallow V8_ORG_DISABLED | VERIFIED |
| 4 | Remove idempotency key/uniqueness | VERIFIED (script schema-reload gotcha documented) |
| 5 | Return success before DB read-back | VERIFIED (first bare fire-and-forget attempt was DID-NOT-APPLY, honestly reported; escalated mutation produced a reliable RED) |
| 6 | Disable failure-injection/recovery path | VERIFIED |
| 7 | Allow another recipient to close the item | VERIFIED (independent re-verification of the build-time #4 proof) |
| 8 | Raw Task update bypassing canonical service | VERIFIED |

All 8 controls produced genuine RED→GREEN pairs against the real Postgres
integration suite. No control was skipped or replaced with an easier
substitute; the two controls that did not work on the first attempt (#4's
plain ON CONFLICT removal, #5's bare fire-and-forget) are reported exactly
as they happened, including why, before describing the escalation that did
produce a real signal.

No files under `server/src` or `src` carry any residual diff — every
temporary edit was reverted with `git checkout --` and reconfirmed against
a full 17/17 green run before moving to the next control. The scratch
Postgres container's `canonical_inbox_items` unique constraint, which was
deliberately dropped for control #4, was explicitly recreated and verified
present again before finishing.
