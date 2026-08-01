---
doc_id: MW-DEC-005_REAL_PG_AND_NEGATIVE_CONTROLS
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
last_updated: 2026-08-01
---

# MW-DEC-005 — Real PostgreSQL Acceptance and Negative Controls

## Harness

Reused the existing repo convention (`tests/acceptance/run.mjs` +
`harness.ts` + `seed.mjs`), not a new bespoke harness. Isolated docker
Postgres `consultify-acceptance-pg` (port 5442, `pgvector/pgvector:pg16`),
full schema + migration 932 loaded. `requireLocalDbUrl()` refuses any
`DATABASE_URL` not matching `localhost`/`127.0.0.1` — **live-verified twice**
(once by the PG-test agent, once implicitly by the orchestrator never
pointing at the `.env`/`.env.local` Railway URLs at any point): pointing at
`trolley.proxy.rlwy.net` aborts the whole suite immediately with
`[seed] REFUSING: DATABASE_URL must be LOCAL`, 0 tests run.

Two independent suites, both real-Postgres, both `--retry=0`:
- `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts` — 22 cases,
  written by the PG-test agent.
- `tests/acceptance/mw-dec-001-falsification-review.e2e.test.ts` — 9 cases,
  written independently by the final falsification reviewer (not a copy).

**Combined result, run independently by the orchestrator as the final
gate: 31/31 passed.**

## The 20 mandated cases — result

| # | Case | Result |
| --- | --- | --- |
| 1 | Org-A decision readable in org A | PASS |
| 2 | Org-B cannot read org-A's decision | PASS — 404, no content leak (verified response body) |
| 3 | Org-B cannot mutate via known id | PASS — 404, DB confirmed unchanged |
| 4 | Unauthorized org-A member cannot decide | PASS — 403, DB unchanged |
| 5 | Authorized decision-maker can approve | PASS (after bug #1 fix — was 500 pre-fix despite committing) |
| 6 | Actor identity from token, not body | PASS — both a forged-body attempt and a schema-passthrough variant tested; confirmed two independent defense layers (schema stripping + controller) |
| 7 | Comment persists with real author | PASS |
| 8 | Alternative persists, survives refresh | PASS — verified via direct SQL, not just API echo |
| 9 | Risk persists, survives refresh | PASS — same |
| 10 | Approval persists rationale/actor/timestamp + audit event | PASS (after bug #1 fix) |
| 11 | Refresh returns same aggregate | PASS — including an interleaved POST+GET stress variant by the final reviewer |
| 12 | Illegal transition rejected | PASS — 409, DB unchanged |
| 13 | Missing rationale rejected | PASS (blank-string case; independently protected by Zod `min(1)`) |
| — | (13b) Omitted rationale rejected | PASS (after bug #2 fix — was a silent-success gap pre-fix) |
| 14 | Stale concurrent approval → 409 | PASS |
| 15 | Two simultaneous finals → one valid outcome | PASS — re-run independently by the final reviewer with a fresh decision; exactly 1 history row, exactly one 200 |
| 16 | Failure during final transition → no false-completed decision | **Documented partial-coverage gap, not faked.** True mid-transaction fault injection (killing the connection between UPDATE and INSERT) isn't reachable via black-box HTTP with this schema. Code-level proof instead: single BEGIN/COMMIT boundary, ROLLBACK on every error path, `client.release()` in `finally` (confirmed by final falsification reviewer's direct code read) — plus the adversarial reviewer's real fault-injection (splitting the transaction deliberately) DID produce a genuine "APPROVED with 0 history rows" state, proving the read-back assertions would catch this class of bug if it existed in the shipped code. |
| 17 | Deleted/missing decision → honest 404 | PASS (both "never existed" and "different status" sub-cases) |
| 18 | Cross-tenant relationship cannot be forged | PASS (after bug #3 fix — was a real, unfixed gap pre-fix; forging `projectId` from org B now returns 400) |
| 19 | No authoritative Decision state in localStorage | PASS at the API level (server-only reconstructability) + PASS at the new-frontend level (triple-independently-grepped: zero `localStorage`/`sessionStorage` calls in `src/components/MyWork/Decision/*`). **Caveat, not a red test result**: the OLD `DecisionDetailView.tsx` still does use localStorage and is still what's live in production — see MW-DEC-004. This packet did not, and by mandate could not, remove that file's behavior; it built the honest replacement. |
| 20 | Every claimed mutation has a raw-SQL read-back | PASS — audited by the PG-test agent's own case-by-case review, re-confirmed independently by the final falsification reviewer using a brand-new `pg.Client` never touched by the app or test harness |

## Adversarial controls — the 8 mandated reversals, all confirmed to turn tests red

| Control removed | Turned red? | Note |
| --- | --- | --- |
| Organization predicate (read + write paths) | YES | Read-path removal produced a 500 (a different downstream check caught it, not a clean leak); write-path removal produced a direct 201-should-be-404 |
| Trust org_id/author from request body | YES, on second attempt | First attempt (controller-only) produced NO red signal — investigated and found to be a genuine second, independent defense layer (Zod schema strips unrecognized fields before the controller ever sees them), not a test gap. Adding `.passthrough()` to bypass that layer too then produced the expected red result. |
| Capability/ownership check on decide() | YES | Confirmed the inline controller check is the only real gate; the capability middleware is shadow-only (matches repo-wide pattern, not unique to Decisions) |
| Lifecycle/terminal-state validation | YES | Also broke case 15 as a documented side effect |
| Optimistic concurrency/version guard | YES | Status code stayed 409 (coincidentally) but the specific error code changed, proving the intended guard was gone and a different one caught the request instead |
| Final-rationale requirement | YES | Case 13 (blank-string) stayed green independently via Zod validation — another two-layer defense instance |
| Split final transition + audit onto independent clients | YES, with a real fault-injection red signal (not just code reading) | Produced an actual "decision APPROVED, decision_history row count 0" failure caught by the read-back assertions |
| Restore localStorage-only comment success / return success before read-back | N/A as a red-test control (no automated frontend suite exists in this packet) — verified by code reading instead: every mutating call in the new component `await`s the real HTTP response before updating UI state; zero localStorage calls for business state | Reported honestly as static-analysis-only, not fabricated as a passing test |

## Concurrency evidence

Two independent double-decide races were run against real Postgres (one by
the PG-test agent as case 15, one independently reconstructed by the final
falsification reviewer on a freshly created decision): both produced exactly
one `200` response, one non-200, and exactly one row in `decision_history`
verified via direct SQL — no split-brain, no double-audit-row.

## What was NOT independently re-derived by every reviewer (honest scope note)

The final falsification reviewer's 9-case suite deliberately targeted new
angles (list-endpoint enumeration, fresh-connection persistence proof,
interleaved refresh, independent concurrency race) rather than re-running
the first 22 verbatim — both suites are kept and both are green, but they
are not fully disjoint in what they exercise (e.g. both touch tenancy and
concurrency, from different angles). This is by design, not a gap.
