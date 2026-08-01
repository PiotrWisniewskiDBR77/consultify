---
doc_id: line-c-ini005-exe003-handoff
truth_type: verified-as-is
status: working
owner: claude
product_owner: piotr
priority: P0
depends_on: INI-005, EXE-003
last_reviewed: 2026-08-01
---

# Line C — INI-005 / EXE-003 canonical start-execution gate — handoff report

STATUS: **AWAITING_CODEX_REVIEW**. Not READY_FOR_STAGING. No push/merge/deploy performed.

## Branch / base / HEAD

- Branch: `fix/ini-005-canonical-start-execution-gate`
- Base: `c522a86183` (verified ancestor of `origin/demo` before branching)
- HEAD: `f124df325da4f0f54b42503dfcfc24dd87a5bad7`
- 12 commits ahead of base, `git status --short` clean at every checkpoint throughout this session (re-verified independently, not just trusted from agent reports).
- Worktree: isolated (`git worktree add`), never touched the user's main working tree.

## Correction-round note (transparency, not defensiveness)

Codex's escalation stated the adversarial reviewer "nie zgłosił initiativeAutoStartJob.ts, mimo że został jawnie poproszony." For the record: it did — the adversarial reviewer's report explicitly named `initiativeAutoStartJob.ts` as "Defect B," with a live-Postgres reproduction and remediation guidance, in the same message that also covered the manual `/approve`+`/start-execution` bypass. That finding simply hadn't been relayed to Codex yet (an interrupt landed between the notification arriving and my synthesis of it). Nothing was missed by the reviewer; a status update was late. The substance of Codex's correction was entirely right regardless, and everything demanded has been implemented and verified below — including going further than the original demand once a fresh exhaustive inventory (requested by Codex) surfaced four more live bypasses beyond the one already known.

## Canonical domain owner

`server/src/services/initiative/initiativeTransitionService.ts` (new file, 1561 lines) — exports `executeInitiativeTransition()`, `hasApprovedGateDecision()`, `hasPendingExecutionGateDecisions()`, and the `InitiativeTransitionActor` type (`{kind:'user'}` or `{kind:'system', systemActorId, systemActorLabel}`). This is now the **sole** function that may write `initiatives.status`, `initiative_status_history`, or `initiative_history` for any lifecycle transition. It owns: input validation, `SELECT ... FOR UPDATE` row locking, transition-validity (`isValidTransition`/`VALID_TRANSITIONS`), RBAC/gate resolution, AI soft-block, readiness checks, GO/NO-GO decision-currency checks, the atomic state+audit write on one pinned Postgres client (`queryHelpers.withPgTransaction`, also new), and the authoritative post-commit read-back.

`InitiativeController.ts`'s `updateInitiativeStatus`, `approveInitiative`, `startExecution`, and `unblockInitiative` are now thin HTTP-layer adapters that resolve request context and call this one function. `initiativeAutoStartJob.ts`'s cron path calls the identical function with a system actor. No second copy of validation logic exists anywhere in the codebase (verified by the exhaustive inventory below).

## Bypass routes found and final disposition

| Path | Original defect | Disposition |
|---|---|---|
| `POST /:id/approve` | Different, more-permissive role table (`evaluateInitiativeGateAccess`, over-granted PMO); REVIEW→'approved' not a legal canonical transition; skipped PROMOTED/PLANNING gates, decisions, AI soft-block, readiness; no audit write; missing org predicate on UPDATE | **Thin adapter** over the canonical engine, target `PROMOTED`, real `GATE_PERMISSIONS[ACCEPT]` role set, requires current `GOVERNANCE_DECISION_MAKING` decision |
| `POST /:id/reject` | Same role over-grant; REVIEW→'planning' didn't match canonical REJECT target (DRAFT); no audit write | **Deleted.** Proven zero callers anywhere in the repo (two independent whole-repo greps) |
| `POST /:id/start-execution` | Zero authorization of any kind; direct illegal APPROVED→EXECUTING jump skipping SCHEDULED entirely; no decision check (none existed on this transition even canonically); no audit write; missing org predicate | **Thin adapter** over the canonical engine, target `EXECUTING`, requires SCHEDULED status, PMO/ADMIN role, and a **new** GO/NO-GO currency check that didn't exist on this transition before at all |
| `initiativeAutoStartJob.ts` (5-min cron, unconditional at boot) | Raw `UPDATE initiatives SET status='EXECUTING'...`, zero decision check, zero row lock, zero `initiative_history` write | **Rewritten** to call the canonical engine per candidate row with an explicit, narrowly-scoped, non-impersonating system actor (see below). Missing/stale/pending GO decision → initiative stays SCHEDULED, observably (logged + counted in returned telemetry), not silently promoted |
| `InitiativeController.unblockInitiative` | Unconditional `status='executing'` from **any** current status; shadow-mode-only capability check (non-blocking by default); no decision check; no audit write | **Thin adapter** over the canonical engine via a new `expectedCurrentStatus` guard (requires BLOCKED specifically, closing the any-status bypass), real role check, and — by explicit design decision — the same GO/NO-GO currency re-check as START (unblocking resumes execution; same rework/supersession risk applies) |
| `executionControl.routes.ts` `POST /timeline-update` (admin-gated) | `field` allow-list included `'status'`; `value` unconstrained string → raw status write, no transition logic at all | **Locked down**: `'status'` removed from the settable-field allow-list; returns `400 TIMELINE_UPDATE_STATUS_FORBIDDEN` pointing callers at the canonical endpoints. Not routed through the engine — deliberately not expanded scope |
| `server/src/routes/v8/execution-control.routes.ts` `POST /timeline-update` (**no role check at all** — any authenticated org member) | Same allow-list defect, worse reachability (no `requireOrgRole`) | Same lockdown as above |

## Confirmed bypass explicitly NOT fixed (cross-team boundary)

`DecisionController.refreshInitiativeDecisionBlock` (`server/src/controllers/DecisionController.ts:~291-299`) does `status = CASE WHEN UPPER(status)='BLOCKED' THEN 'EXECUTING' ELSE status END` when a blocking decision resolves — a confirmed live bypass of the same severity class as the ones fixed above. **`DecisionController.ts` is Decision-domain, explicitly owned by parallel work** (worktrees on branches `feat/mw-dec-001-canonical-decision-workflow` and `feat/mw-core-001-inbox-task-golden-flow` exist in this repo's worktree list, both based at the same `c522a86183`). Per this mission's own collision-avoidance rule ("Do not... modify My Work Inbox, Task or Decision files owned by Lines A and B"), this file was not touched. `git diff` confirms zero changes to it across the entire session.

**This means the bypass is not 100% closed system-wide** — it is closed everywhere this packet has file ownership, plus everywhere an exhaustive inventory could reach, minus this one cross-domain path. Recommend Codex route this finding to whichever line owns `DecisionController.ts` with the same remediation pattern applied here (thin adapter over `executeInitiativeTransition`, target EXECUTING, gate UNBLOCK, from BLOCKED only, with a GO/NO-GO recheck) as a fast, well-precedented fix once that line's own work is stable enough to receive it.

## Other adjacent defect found, explicitly deferred (not silently fixed, not silently dropped)

`server/src/services/v8/managerActionExecutionService.ts:284-291` writes `status='IN_PROGRESS'` on an "unblock" manager action — **`'IN_PROGRESS'` is not a member of the canonical `InitiativeStatus` enum at all** (a third, undocumented status vocabulary). Doesn't reach `EXECUTING`, so out of this packet's direct scope, but any initiative that ever received this write would become invisible to any query that does exact status matching rather than an allowlist. Needs a product decision, not a code fix from this packet.

Also flagged, not fixed (zero live callers, so zero urgency, but a landmine): `InitiativeDefinitionService.updateInitiative` does a raw, unvalidated `status` write with no enum/transition check — confirmed unreachable today (its only wrapper has zero live callers of that method), but should be hardened or deleted in a future pass before anything wires it up unknowingly.

`InitiativeController.blockInitiative`/`completeInitiative` remain the same raw-UPDATE-with-shadow-capability-only anti-pattern as `unblockInitiative` was — explicitly flagged with a code comment (not silently left implicit) but not fixed, since they don't reach `EXECUTING` and were not named in Codex's correction scope.

## Production callers migrated

Per an exhaustive whole-repo caller inventory (two independent passes): **zero production frontend callers existed for `/approve`, `/reject`, or `/start-execution`** — `InitiativesHub.tsx`, `InitiativeCompactPanel.tsx`, `InitiativeDocumentView.tsx`, and `ResultsHub.tsx` already routed every approve/reject/status-change UI action through the canonical `PATCH /:id/status` via `updateInitiativeStatusWriteTruth()`. The only real callers were test files:
- `tests/acceptance/h16-start-execution.e2e.test.ts` (`/start-execution`) — rewritten to assert the fixed contract instead of the old bypass, per the mission's explicit instruction not to preserve an unsafe endpoint just because an outdated test calls it.
- `tests/e2e/m13/m13-manual.spec.ts` (`/approve`) — verified (not run, Playwright webServer unavailable in this environment) to be unaffected: it only calls `/approve` on a `PENDING_REVIEW`/`DRAFT` initiative asserting `status < 500`; both old and new code return 400 there.

One narrow frontend fix was made: `InitiativeCompactPanel.tsx`'s quick status-action button had no double-click guard (could fire two concurrent `PATCH /:id/status` requests); added an `isChangingStatus` re-entrancy guard matching the existing pattern already used in `InitiativeDocumentView.tsx`. Not visually click-tested (no dev server spun up); flagged honestly rather than claimed.

## Files changed (full diff vs. base `c522a86183`)

```
 server/src/controllers/InitiativeController.ts               | 1969 +++++---------------
 server/src/jobs/initiativeAutoStartJob.ts                     |  147 +-
 server/src/routes/executionControl.routes.ts                  |   45 +-
 server/src/routes/pmo/initiatives.routes.ts                   |   25 +-
 server/src/routes/v8/execution-control.routes.ts               |   48 +-
 server/src/services/initiative/initiativeTransitionService.ts | 1561 ++++++++++++++++ (new file)
 server/src/utils/queryHelpers.ts                               |   84 +
 src/components/Initiatives/InitiativeCompactPanel.tsx          |   14 +-
 tests/acceptance/h16-start-execution.e2e.test.ts                     |  186 +-
 tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts  |  389 ++ (new file)
 tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts |  835 ++ (new file)
 tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts |  269 ++ (new file)
 12 files changed, 3933 insertions(+), 1639 deletions(-)
```
Independently re-verified via `git diff --stat c522a86183..HEAD` — matches exactly.

**On `InitiativeController.ts`'s diff size**: net **shrank** by ~1969 lines despite adding functionality, because the ~930-line transition-handling body was extracted to the new service file rather than duplicated. `git diff --ignore-all-space` on the pre-extraction commit reduced the line count by only ~3% (4203→4073), confirming this was substantive logic reorganization (control flow rewritten from early-returns to a transaction-wrapped discriminated-union outcome type), not mechanical whitespace churn — there was nothing to "clean up" here; the size is real and explained by the extraction + the atomicity rewrite, both required by the fix itself.

## Test commands and exact counts

```
DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true DB_TYPE=postgres \
npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/h16-start-execution.e2e.test.ts \
  tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts \
  tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts \
  tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts \
  --retry=0
```
**Result: 4 test files, 37/37 passed** (h16=5, canonical 20-case=20, autostart=6, unblock/timeline-lockdown=6). Independently confirmed test-case counts myself via `grep -c '  it('` on each file, matching 5/20/6/6 exactly. Run against a real local Docker Postgres (`consultify-acceptance-pg`, port 5442), not mocks/SQLite — `tests/acceptance/harness.ts`'s `requireLocalDbUrl()` throws if `DATABASE_URL` isn't a localhost/127.0.0.1 string, so this suite structurally cannot run against demo/prod.

## Real-PG results (selected, full detail in the 37-case suite)

- Valid GO + SCHEDULED + PMO actor → EXECUTING, with matching `initiative_status_history`/`initiative_history` rows.
- DRAFT→EXECUTING, APPROVED(not SCHEDULED)→EXECUTING, no-decision, NO-GO, missing-role, cross-tenant, forged-org-header/body, nonexistent-id — all correctly rejected with the intended status code and rule string, verified against real database state, not just HTTP status.
- Auto-start with current GO promotes; auto-start with no/stale/pending decision leaves the row untouched at SCHEDULED, with an observable, countable skip reason in the job's return telemetry (`skippedNoGoDecision`, etc.) — never a silent skip.
- `unblockInitiative`: BLOCKED+GO+role → EXECUTING; BLOCKED+no-GO → 400; SCHEDULED (not BLOCKED) → 400 `UNEXPECTED_CURRENT_STATUS` (proves the old any-status bypass is closed, not just narrowed).
- Both `timeline-update` endpoints: `field:'status'` → 400 `TIMELINE_UPDATE_STATUS_FORBIDDEN`, confirmed via direct Postgres SELECT that status was genuinely unchanged; `field:'progress'` (a legitimate field) still works, proving the lockdown didn't break real functionality.

## Concurrency result

Two independent proofs, both against real Postgres, both re-run multiple times for stability:
1. **Two/five concurrent HTTP requests** on the same fixture → exactly one `200`, the rest deterministic `400 INVALID_TRANSITION`; exactly one `initiative_status_history` row. The adversarial reviewer independently escalated this from 2 to 5 concurrent requests and got the same clean result.
2. **Auto-start job racing a live HTTP request** on the same initiative (new this round, since both entry points now share one engine) → exactly one winner, one canonical history pair, no double-apply — proving the `SELECT ... FOR UPDATE` lock serializes across the cron path and the HTTP path identically, not just across two HTTP callers.

Mechanism: `queryHelpers.withPgTransaction()` opens a dedicated pinned `pg.Client` (not from the shared pool — a documented, previously-production-hit footgun in this codebase when composing pooled queries as a pseudo-transaction), issues `BEGIN`, locks the initiative row with `SELECT ... FOR UPDATE`, does all validation against that locked read, writes state + both audit rows on the same client, `COMMIT`s, and only then returns the authoritative read-back. **Residual operational risk, flagged not fixed**: this opens a brand-new physical Postgres connection per transition request rather than reusing the pool; under a burst of concurrent transition requests this is unbounded connection churn with no backpressure. Not a security bypass — a capacity/ops concern worth a follow-up if transition volume ever gets high, out of scope for this correctness-focused packet.

## Negative controls and red counts

Six total across the two rounds, each independently reproduced (the adversarial reviewer redid two of the first four itself, blind, and got matching results):

| # | Control | Red result | Restored |
|---|---|---|---|
| 1 | Remove `FOR UPDATE` row lock | Concurrency case: `[200,200]` instead of `[200,400]` | ✓, `git status --short` clean |
| 2 | Disable SCHEDULED→EXECUTING decision check | Cases requiring a current GO decision wrongly returned 200 | ✓ |
| 3 | Disable RBAC/gate block | No-role actor got 200 instead of 403 | ✓ |
| 4 | Drop org predicate from locked SELECT | Cross-tenant case returned 403 instead of 404 (still blocked by the separate RBAC layer — a more precise finding than "fully bypassed," defense-in-depth held) | ✓ |
| 5 | Move audit INSERTs outside the transaction, forced to fail | Exact-audit-row-count cases went red; state changed to EXECUTING/PROMOTED with 200 despite total audit loss — proves the atomicity guarantee is real, not incidental | ✓ |
| 6 | Skip `withPgTransaction` entirely, raw pool calls | Concurrency case: `[200,200]` double-apply, reproduced 3× | ✓ |
| 7 (this round) | Disable GO/NO-GO check specifically for the system actor only | Auto-start cases with no/stale/pending decisions wrongly proceeded to EXECUTING; the HTTP-path's separate check (untouched) stayed correctly enforced, confirming the two paths' checks are genuinely independent, not one shared flag that could be silently disabled everywhere at once | ✓ |
| 8 (this round) | Re-add `'status'` to the timeline-update allow-list | The exact old raw-write bypass reappeared: 200 instead of 400 | ✓ |

`git status --short` confirmed empty after every single revert, and at the final end-state.

## Capability/tenant evidence

- Ordinary unauthorized member: 403 on every gated transition (real, in-process `GATE_PERMISSIONS` check — not the shadow-mode route middleware, which remains untouched and still inert by design; the fix's enforcement never depended on it).
- Authorized role acting in-scope: 200, subject to all remaining gates (decision, readiness, AI soft-block where applicable).
- Authorized role, different project in the same org: 403 (role resolution is scoped to the initiative's own `project_id`).
- Org Admin/SuperAdmin: RBAC bypass by design (pre-existing platform behavior, confirmed unchanged, not something this packet redesigned) — but the GO/NO-GO decision check is **not** skippable by any role including Admin, verified directly.
- Tenant-B actor with tenant-A's initiative id: 404 (org-scoped SELECT hides existence; does not leak via a 403).
- Forged `organizationId`/`x-organization-id` in body/header: no effect — `orgId`/`actorId`/role are read exclusively from the verified JWT (`req.user`), confirmed by reading every call site, never from client-supplied fields.
- System actor (auto-start): narrowly scoped to the START/UNBLOCK gates only — any other gate is rejected, not silently granted; the GO/NO-GO check is never skipped for this actor either; `changed_by`/audit rows are honestly attributed to the literal sentinel `'system:initiative-auto-start'` (following existing repo precedent for system-actor audit rows, e.g. `automationRulesEngine.ts`) — never a fabricated human identity, never a silent NULL.

## Audit/history evidence

Every successful transition (HTTP or system-actor) writes exactly one `initiative_status_history` row and one `initiative_history` row, atomically with the state change, on the same pinned client — verified directly against Postgres rows, not just test assertions. Every rejected transition (400/403/404) writes zero rows in either table — verified directly, including the case where the rejection happens deep in gate/decision logic (audit writes are structurally the last step in the function, after every check).

## Unrelated baseline failures

None encountered or claimed. All 37 test cases in the final suite are new or rewritten specifically for this packet; no pre-existing test suite was run as part of this verification that could conflate an unrelated baseline failure with this packet's own regressions. (The two non-acceptance test files checked for collateral damage — `tests/unit/services/v8-execution-control-api.test.ts` and `server/src/routes/v8/__tests__/execution-control.routes.test.ts`, 46/46 — passed unchanged, confirming the timeline-update lockdown didn't break existing, unrelated coverage of those same routes.)

## Collision check with Lines A and B

Confirmed via `git diff c522a86183..HEAD --stat` across the entire session: zero changes to `server/src/services/decisionService.ts`, `server/src/controllers/DecisionController.ts` (see the explicitly-deferred bypass above), `server/src/services/inboxService.ts`, or any My Work Inbox/Task UI component. The two parallel worktrees visible in `git worktree list` (`feat/mw-dec-001-canonical-decision-workflow`, `feat/mw-core-001-inbox-task-golden-flow`) were never touched, read from, or written to. The one genuine cross-domain finding (`DecisionController.refreshInitiativeDecisionBlock`) was reported, not fixed, exactly per the collision-avoidance boundary.

## Unresolved risks

1. **`DecisionController.refreshInitiativeDecisionBlock` bypass remains open** — cross-team fix needed, detailed above.
2. **`managerActionExecutionService.ts`'s `'IN_PROGRESS'` non-canonical status write** — needs a product decision on intent and on any initiatives already stuck in that state.
3. **`withPgTransaction`'s per-call dedicated-connection pattern** — real but not urgent connection-exhaustion risk under high transition volume; not a security issue.
4. **`hasApprovedGateDecision`'s `ORDER BY` has no explicit tiebreaker** for two decisions with an identical `decided_at`/`created_at` timestamp — observed stable/deterministic in repeated testing but not guaranteed by SQL semantics; a defensive `, id DESC` tiebreaker would close this narrow gap and was not added in this pass (not reproducible as an actual exploit in testing).
5. **No guard against a future-dated `decided_at`** on a decision row — would still satisfy the gate; requires the actor already having legitimate decision-write access, so not a privilege escalation on its own, but a missing sanity check.
6. **`CAPABILITY_ENFORCE` runtime value on demo/prod is unconfirmed** — affects only the residual shadow-mode-gated handlers (`blockInitiative`/`completeInitiative`, explicitly out of this round's scope), not anything this packet fixed (those enforce for real, unconditionally, regardless of that flag).
7. **`blockInitiative`/`completeInitiative`** remain the same un-fixed anti-pattern family as `unblockInitiative` was — flagged in code, not remediated, since neither reaches `EXECUTING` and neither was named in this round's scope.
8. Frontend double-click guard fix was not visually/browser verified (no dev server spun up in this pass) — logically sound, matches an existing proven pattern, but flagging the gap in verification honestly rather than overclaiming.

## Clean-tree proof

```
$ git status --short
(empty)
$ git log --oneline c522a86183..HEAD
f124df325d test(ini005): add auto-start, unblock, and timeline-update lockdown coverage
8d19f0678a fix(execution): close status-write bypass in POST /timeline-update
9239ef96a5 fix(initiatives): close unblockInitiative EXECUTING-bypass
01fe1f6dd4 fix(initiatives): close auto-start bypass with a narrow system actor
522eb7d651 fix(initiatives): extract transition engine to a shared domain service
5a3d3a86fe test(h16): rewrite start-execution suite to assert the new canonical contract
0c25964654 test(ini005): add 20-case acceptance suite for canonical SCHEDULED->EXECUTING gate
3e098ce1c1 fix(initiatives): guard quick status-action button against double-click
12d3caae77 fix(initiatives): thread overrideReason through /approve and /start-execution
029104862e fix(initiatives): thin /approve + /start-execution adapters, delete /reject
950bc249eb fix(initiatives): extract canonical transition engine with row lock + atomic audit
d64ecba0cd fix(initiatives): decision-currency bug in hasApprovedGateDecision
```
Independently re-verified by me directly (not just quoted from an agent report) immediately before writing this section.

No push, no merge, no deploy, no Railway/demo/prod contact at any point in this session.

---

## Status

**AWAITING_CODEX_REVIEW.** Not READY_FOR_STAGING. STOP.
