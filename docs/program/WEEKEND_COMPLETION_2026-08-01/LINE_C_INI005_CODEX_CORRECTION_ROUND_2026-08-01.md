---
doc_id: line-c-ini005-codex-correction-round
truth_type: verified-as-is
status: working
owner: claude
product_owner: piotr
priority: P0
depends_on: INI-005, EXE-003
last_reviewed: 2026-08-01
---

# Line C — Codex correction round — JWT hermeticity + decision-currency race

STATUS: **AWAITING_CODEX_REVIEW**. Not READY_FOR_STAGING, not CODE_GO. No push/merge/deploy.

## 1. Branch, base, previous HEAD, new HEAD

- Branch: `fix/ini-005-canonical-start-execution-gate`
- Base: `c522a861839f54d0f26baa918566589aab3f6f6b` (`git merge-base HEAD origin/demo`, independently re-derived, not assumed)
- Previous (Codex-reviewed) HEAD: `28d86ab49b5db279e2e79a3f2bab48e98528d97f`
- New HEAD: `786899df7455ff5f0b2ab8fdc2f92d4b57b3a4ac`
- `git status --short` empty at start, throughout, and at end. No stray processes touching the worktree confirmed at session start.

## 2. New commits this round

```
e8affaeb0e fix(tests): pin explicit JWT_SECRET for INI-005 acceptance suite
786899df74 fix(ini-005): close decision-race TOCTOU in executeInitiativeTransition
```
(Report doc for this round committed separately after this file is written.)

## 3. Root cause — JWT (Blocker 1)

`tests/acceptance/harness.ts:32-36` `getJwtSecret()` falls back to `'development_secret_key_change_in_production_abc123xyz'` when `JWT_SECRET` is unset. `server/src/config/Config.ts:93-101` falls back, under `NODE_ENV=test`, to a **different** string: `'test-secret-key-for-testing-only-min-32-chars'`. Whenever the shell running the suite doesn't export `JWT_SECRET`, `mintToken()` (harness) signs against one secret and the real `verifyToken` middleware (Config) verifies against another — every authenticated request 401s (`[AuthMiddleware] Verification failed`). Independently reproduced Codex's exact failure mode (30 failed / 7 passed) before applying any fix, using `env -i` (stripped shell) — not just `unset JWT_SECRET`, a stronger reproduction than the original break.

No committed `.env`/`.env.local` exists anywhere in this repo. A `server/.env.test` file does exist with `JWT_SECRET=test_secret` but is dead — `server/src/config/loadEnv.ts` never resolves `*.env.test`, confirmed by reading it and by a repo-wide grep for any reference to that filename. The most likely explanation for this session's earlier 37/37 claims vs. Codex's fresh-shell 30-failure reproduction: an ambient `JWT_SECRET` was exported in some shells in this session and not in Codex's, which trivially makes both fallbacks moot when present.

## 4. Root cause — decision-currency race (Blocker 2)

`executeInitiativeTransition()` runs inside `queryHelpers.withPgTransaction(async (client) => {...})`, which locks the target `initiatives` row via `SELECT ... FOR UPDATE` on a pinned client. `hasApprovedGateDecision(orgId, initiativeId, pmoDomain)` — called from inside that same transaction at up to one of four gate checkpoints (REVIEW→PROMOTED, PROMOTED→PLANNING, APPROVED→SCHEDULED, (SCHEDULED|BLOCKED)→EXECUTING) — used the **global connection pool** (`queryHelpers.queryOne`), a different physical connection from the pinned client. The `initiatives` row lock provides zero protection for a `decisions` table read on a different connection: a concurrent write to `decisions` (from `DecisionController.ts`, frozen/out of scope) is invisible to that lock. Confirmed live write paths that could race: `DecisionController.decide` (the primary vector — flips a decision's `status`), `createDecision`, `updateDecision`, `escalateDecision`, `deleteDecision` — all currently bare autocommit statements against the shared pool with no lock of any kind.

## 5. Transactional/synchronization protocol applied

Four changes, all confined to `server/src/services/initiative/initiativeTransitionService.ts` (no `DecisionController.ts` changes):

1. **Pinned client**: `hasApprovedGateDecision` now requires a `client: PgTransactionClient` parameter and reads via that client, not the shared pool. All 5 call sites (4 original gates + 1 new pre-commit recheck) updated; confirmed via grep this is the only caller anywhere in the codebase.
2. **Deterministic tiebreaker**: `ORDER BY COALESCE(decided_at, created_at) DESC` → `..., id DESC`.
3. **Advisory lock**: first statement inside `hasApprovedGateDecision`, on the pinned client: `SELECT pg_advisory_xact_lock(hashtextextended(orgId || ':' || initiativeId || ':' || pmoDomain, 0))` — transaction-scoped, auto-released on COMMIT/ROLLBACK, matches the existing house pattern in `server/src/services/tablePlatform/RecordsService.ts:106`. **Honest, verified finding from the adversarial pass**: this lock is currently *inert* for anything exercised today — the only real caller already serializes via the `initiatives` row lock, so removing the advisory lock alone did not turn any test red. Its value is (a) internal consistency of the transition's own repeated decision reads, and (b) publishing the exact key-derivation contract a future `DecisionController.ts` fix must adopt to close the residual gap (§10).
4. **Pre-commit recheck**: immediately before the state `UPDATE`, if a decision gate was satisfied earlier in the function, `hasApprovedGateDecision` is called again on the same client; a mismatch **throws** `TransitionGateSupersededError` (not a `return`, because an early `return` would still reach `COMMIT` in `withPgTransaction` — verified against its actual implementation — and a schedule-baseline INSERT may have already run earlier in the `APPROVED→SCHEDULED` branch, which must be rolled back too). The throw is caught narrowly around the `withPgTransaction` call and mapped to `409 { rule: 'GATE_DECISION_SUPERSEDED' }`; every other error still propagates unchanged.

A test-only `__testSyncHook` param (`'after-decision-read' | 'before-commit'`) was added, default no-op, verified unreachable from any HTTP request body (all 5 real call sites in `InitiativeController.ts`/`initiativeAutoStartJob.ts` build the params object as an explicit field literal, never a `req.body` spread).

## 6. Direct red→green evidence, both blockers

**JWT (Blocker 1)**: pre-fix, exact documented command, `JWT_SECRET` unset → **30 failed / 7 passed**, matching Codex's report exactly. Post-fix, same command, same unset condition → **37/37**, reproduced 3 consecutive times by the fix author and independently reproduced once more by me directly. Negative control: disabling the new secret-pin → the divergence guard fires immediately and loudly with the exact original mismatch message, no silent 401s.

**Decision-race (Blocker 2)**: new test `tests/acceptance/odbior--ini005--decision-race.e2e.test.ts`, Test 1 (race lands before the pre-commit recheck) — pre-fix-equivalent (recheck commented out) → wrongly succeeds (`ok:true`, matches Test 2's shape). Post-fix → correctly rejected (`409 GATE_DECISION_SUPERSEDED`, initiative status unchanged, zero new audit rows). Negative control performed independently twice: (a) by the implementer, commenting out the recheck → Test 1 goes red exactly as expected, reverted, confirmed clean; (b) by the adversarial reviewer, same edit, independently reproduced the same red result. A second negative control (reverting only the pinned-client change, keeping lock+recheck) was run and — reported honestly rather than forced to fit a narrative — **did not** turn Test 1 red, because in that specific scenario a pooled connection sees the same already-committed row a pinned one would under READ COMMITTED; the pre-commit recheck is what does the real work in this test, not connection-pinning in isolation. Pinning still matters for the underlying correctness invariant (keeping the decision read inside the same session/transaction as the row lock and the advisory lock, avoiding the documented pooled-connection composability footgun in `withPgTransaction`'s own doc comment) even though this particular test can't distinguish it alone.

## 7. All test results, 3× (fresh shell, `JWT_SECRET` unset)

Exact command:
```
DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true DB_TYPE=postgres \
npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/h16-start-execution.e2e.test.ts \
  tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts \
  tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts \
  tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts \
  tests/acceptance/odbior--ini005--decision-race.e2e.test.ts \
  --retry=0
```
- Fix-author run: 3× → **39/39, 39/39, 39/39**.
- Adversarial-reviewer run, independently, using `env -i` (stronger isolation than `unset`): 3× → **39/39, 39/39, 39/39**.
- My own independent run (this report's author, fresh shell): **39/39**.
Total: 7 independent fresh-shell executions of the exact documented command, all 39/39. `--retry=0` confirmed in effect throughout (no vitest `retry` config applies to the acceptance project; verified in an earlier round and unchanged).

Real local Postgres only — `tests/acceptance/harness.ts`'s `requireLocalDbUrl()` throws on any non-`localhost`/`127.0.0.1` `DATABASE_URL`, so this suite structurally cannot run against demo/prod; this guard predates this round and was re-confirmed present and unmodified.

## 8. Inventory of all `initiatives.status` / `initiative_status_history` / `initiative_history` writers

Full 16-row table produced by a dedicated fresh read-only pass (not copied from any prior round); condensed here, see the agent transcript for the complete per-row detail if needed:

| # | Site | Reaches EXECUTING? | Transaction | Audit | Disposition |
|---|---|---|---|---|---|
| 1 | `initiativeTransitionService.ts` `executeInitiativeTransition` | Yes (the only two edges to EXECUTING) | Yes, pinned+locked | Both tables | **canonical** |
| 2 | `InitiativeController.updateInitiativeStatus` (PATCH `/:id/status`) | via #1 | via #1 | via #1 | adapter |
| 3 | `InitiativeController.approveInitiative` (POST `/:id/approve`) | No (targets PROMOTED) | via #1 | via #1 | adapter |
| 4 | `InitiativeController.startExecution` (POST `/:id/start-execution`) | Yes | via #1 | via #1 | adapter |
| 5 | `InitiativeController.unblockInitiative` (POST `/:id/unblock`) | Yes | via #1 | via #1 | adapter |
| 6 | `initiativeAutoStartJob.autoStartScheduledInitiatives` (cron, system actor) | Yes | via #1 | via #1 | adapter |
| 7 | `InitiativeController.blockInitiative` | No | No | Neither | follow-up (documented gap) |
| 8 | `InitiativeController.completeInitiative` | No | No | Neither | follow-up (documented gap) |
| 9 | `InitiativeController.archiveInitiative` | No | No | Neither | **follow-up — newly identified this round**, same anti-pattern as #7/#8 but not previously named in the file's own "known gap" comment |
| 10 | `executionControl.routes.ts` `/timeline-update` | N/A, `field:'status'` rejected | N/A | N/A | locked down |
| 11 | `v8/execution-control.routes.ts` `/timeline-update` | N/A, rejected | N/A | N/A | locked down |
| 12 | `DecisionController.refreshInitiativeDecisionBlock` (BLOCKED→EXECUTING on decision resolution) | **Yes — see §10** | No | Neither | **integration blocker — frozen, Decisions team** |
| 13 | `DecisionController.createDecision` auto-block loop (→BLOCKED, opposite direction) | No | No | Neither | **integration blocker — frozen, Decisions team** |
| 14 | `managerActionExecutionService.ts` `'unblock'` action | No (writes non-canonical `'IN_PROGRESS'`) | No | Neither (generic action log only) | follow-up |
| 15 | `managerActionExecutionService.ts` `'scope_reduction'` action | No (same non-canonical value) | No | Neither | follow-up |
| 16 | `assessmentInitiativeGenerationRunService.bulkSubmitRunDrafts` (DRAFT→PENDING_REVIEW, bulk) | No | No | Neither | follow-up |

Out of scope, verified non-live (dev/demo/CLI tooling only, no HTTP route reaches them): `demoSeedService.ts`, and four `server/scripts/*.ts` one-off backfill/seed scripts.

## 9. Corrected canonical-ownership claim

Replacing the prior round's overclaim ("the sole function that may write initiatives.status... for any lifecycle transition") with the precise version:

> `executeInitiativeTransition` (`server/src/services/initiative/initiativeTransitionService.ts`) is the canonical owner and sole write path for the transitions covered by INI-005 — REVIEW→PROMOTED (via `POST /:id/approve`), SCHEDULED→EXECUTING (via `POST /:id/start-execution` and the `initiativeAutoStartJob` system actor), and BLOCKED→EXECUTING (via `POST /:id/unblock`) — plus every other transition reachable through the generic `PATCH /:id/status` adapter. Eight other pre-existing write paths to `initiatives.status` remain outside this packet's scope: two are confirmed cross-team integration blockers (`DecisionController.refreshInitiativeDecisionBlock` and the auto-block loop in `DecisionController.createDecision`, both frozen and owned by the Decisions team), and six are deferred follow-ups (`blockInitiative`, `completeInitiative`, `archiveInitiative`, the `'unblock'` and `'scope_reduction'` manager-action handlers, and `assessmentInitiativeGenerationRunService.bulkSubmitRunDrafts`).

## 10. Explicit status of `DecisionController.refreshInitiativeDecisionBlock`

**Confirmed untouched** (`git diff c522a86183..HEAD -- server/src/controllers/DecisionController.ts` empty, independently re-verified by the adversarial reviewer with the same result) — correctly respecting the frozen boundary.

**Sharper finding from this round's adversarial pass, materially more severe than how this was framed in the prior handoff report**: this is not merely a timing-dependent race. `refreshInitiativeDecisionBlock` does a raw `UPDATE initiatives SET status = CASE WHEN UPPER(status)='BLOCKED' THEN 'EXECUTING' ELSE status END ...` with **zero row lock, zero advisory lock, zero GO/NO-GO check**, wired live into the mounted `PATCH/PUT /api/decisions/:id/decide` route. Its trigger condition (`normalizedStatus !== 'pending'`) fires whenever the last blocking decision on an initiative is resolved — **including when that decision is REJECTED, not just approved**. This means a BLOCKED initiative can be pushed straight to EXECUTING through ordinary, deterministic product usage (resolve/reject the blocking decision via the Decisions UI) with no race condition or special timing required at all. This predates this branch (not a regression it introduced) and is a distinct, more severe gap than the disclosed TOCTOU window in §6/Test 2 — that one needs precise timing; this one doesn't.

**Recommendation to Codex**: this needs its own controlled B/C-boundary window, not a Line-C fix. The exact required change (from the concurrency-design agent's integration contract, applicable to `decide`/`createDecision`/`updateDecision`/`escalateDecision`/`deleteDecision`): wrap each in a pinned-client transaction (via the same `queryHelpers.withPgTransaction` this branch uses) and, before the write, acquire the identical `pg_advisory_xact_lock(hashtextextended(organization_id || ':' || initiative_id || ':' || pmo_domain, 0))` that `hasApprovedGateDecision` now takes — plus, specifically for `refreshInitiativeDecisionBlock`, routing its BLOCKED→EXECUTING write through `executeInitiativeTransition` (gate `UNBLOCK`) instead of a raw UPDATE, so it inherits the GO/NO-GO check rather than only the lock.

## 11. Collisions and B/C integration requirements

No collisions this round: `git diff <base>..HEAD --stat` shows only `initiativeTransitionService.ts`, the new decision-race test file, `ini005TestSecret.ts`, and the 4 existing test files' top-of-file imports — no My Work/Decision/Results/Assessment/locale/migration/seed files touched. The one required B/C integration is §10 above; no other new integration requirement surfaced this round.

## 12. Typecheck / build / diff / secret scan

- **`git diff --check`** (base..HEAD): clean, exit 0 — no whitespace/conflict-marker issues.
- **Secret scan** (changed files, common credential patterns — AWS keys, private key headers, `sk-`/`xox` tokens, generic secret-assignment patterns): clean, only known dev/test placeholder strings present (`test-secret-key-for-testing-only-...`, `ini005-hermetic-test-secret-...`, etc. — all pre-existing or newly-introduced *test* fixtures, never real credentials).
- **Backend typecheck vs. baseline**: full `server/tsconfig.json` project build (`npx tsc --noEmit -p tsconfig.json`, not the ad-hoc per-file invocation used in earlier rounds) — **173 pre-existing errors project-wide, zero in any of the 7 files this branch touched** (confirmed by name-filtering the output). An earlier ad-hoc invocation of mine with mismatched compiler flags (`--module esnext --moduleResolution bundler` instead of the project's actual `NodeNext`/`NodeNext`) produced a false-positive error in `initiativeAutoStartJob.ts` — re-verified against the real project config and confirmed spurious; flagging this myself so it isn't mistaken for a hidden defect.
- **Frontend typecheck**: full `tsconfig.json` project build with an increased Node heap (`NODE_OPTIONS=--max-old-space-size=8192`, since the default heap OOM-crashes on this project's size — confirmed by first getting a silent-crash "0 errors" that was actually exit code 134, not a real pass; re-ran with more memory to get a genuine result) — **0 errors**, including `InitiativeCompactPanel.tsx`.
- **Backend build** (`tsc --noCheck`): clean, exit 0.
- **Frontend build** (`vite build`, `NODE_OPTIONS=--max-old-space-size=8192`): clean, `✓ built in 30.45s`, 10,187 modules transformed. Only pre-existing large-chunk-size advisory warnings (unrelated to this branch — this app's bundle has carried several >500kB chunks, e.g. `App-*.js` at 3.3MB, long before this round; not a new regression).

## 13. Clean-tree proof

```
$ git status --short
(empty)
$ git log --oneline c522a86183..HEAD
786899df74 fix(ini-005): close decision-race TOCTOU in executeInitiativeTransition
e8affaeb0e fix(tests): pin explicit JWT_SECRET for INI-005 acceptance suite
28d86ab49b docs(ini-005): Line C handoff report — AWAITING_CODEX_REVIEW
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
Independently re-verified directly by me immediately before writing this section, not copied from an agent report.

## 14. No push, no merge, no deploy

Confirmed — no `git push`, no `git merge`, no deploy or Railway/demo/prod contact at any point in this session, this round or any prior round.

---

## Residual open items (unchanged from disclosure obligation, restated precisely for this round)

1. `DecisionController.refreshInitiativeDecisionBlock` and the `createDecision` auto-block loop — confirmed live integration blockers, detailed in §10, need a B/C-owned fix.
2. The advisory lock added this round is correct but currently inert for anything exercised today (§5/§6) — will only become load-bearing once the Decision side adopts the matching lock per §10's contract.
3. `archiveInitiative` — newly identified this round as sharing `blockInitiative`/`completeInitiative`'s anti-pattern, not previously named in the code's own "known gap" comment.
4. `assessmentInitiativeGenerationRunService.bulkSubmitRunDrafts` — newly identified this round, deferred follow-up.
5. All items already disclosed in the prior handoff report (`LINE_C_INI005_EXE003_HANDOFF_2026-08-01.md`) remain unchanged and still open: `managerActionExecutionService.ts`'s non-canonical `'IN_PROGRESS'` status, the `withPgTransaction` per-call dedicated-connection resource-usage pattern, and the frontend double-click guard not being browser-verified.

## Status

**AWAITING_CODEX_REVIEW.** Not READY_FOR_STAGING. No CODE_GO self-declared.
