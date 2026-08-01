---
doc_id: MW-DEC-001_CURRENT_RUNTIME_AND_ROOT_CAUSE
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
branch: feat/mw-dec-001-canonical-decision-workflow
base_sha: c522a861839f54d0f26baa918566589aab3f6f6b
last_updated: 2026-08-01
---

# MW-DEC-001 — Current Runtime and Root Cause

## What was phantom, and why

The Decision object's core row (`decisions` table) always had a solid,
single-owner, real backend: `DecisionController.ts` / `pmo/decisions.routes.ts`,
writing to `decisions`/`decision_history`/`decision_impacts`, org-scoped, with
real read-back. But everything the frontend's `DecisionDetailView.tsx`
presents as the decision's "dossier" — comments, alternatives, risks — had
**zero backend**. `DecisionDetailView.tsx:2051-2110` read and wrote
`localStorage['consultify-decision-enhancements:<id>']` directly, with a
hardcoded fake author string `"Current User"`. This is client-only state: it
doesn't survive a different browser/device, isn't organization-scoped (no
tenant isolation — it's a browser key), isn't visible to any other user
including the actual decision maker, and vanishes on `localStorage.clear()`.
This was the single highest-severity finding of the MW-CORE-001
reconnaissance (§2, §4) — exactly the "exists in UI but not backed by a real
write path" (STUB) failure mode the parent packet flagged twice as the
pattern not to repeat.

A second, smaller, pre-existing gap existed on the core row itself: the old
`DecisionController.decide()` set `status`/`decision_rationale`/`decided_at`
via one `UPDATE` and the `decision_history` audit row via a second,
independent `queryHelpers.queryRun()` call — two separate pool-connection
acquisitions, not one transaction. A crash between the two calls could leave
a decision APPROVED with no matching history row, or vice versa. No
`decided_by` column existed at all (asymmetric with `decided_at`), and no
concurrency guard existed anywhere on `decisions`, so two concurrent
`decide()` calls would silently last-write-win.

**Evidence.** `DecisionDetailView.tsx:2051-2110` (localStorage read/write,
fake author) — file intentionally not touched by this packet (see
MW-DEC-004). Pre-fix `DecisionController.ts` `decide()` — two independent
`queryHelpers.queryRun()` calls, no `FOR UPDATE`, no version field.
`server/migrations-v2/001_baseline_20260413.sql:10921-10967` — `decisions`
table definition, no `version`/`decided_by` column.

## Three real bugs found by the real-Postgres acceptance suite (not present in mocked/SQLite tests)

1. **P0 — false 500 on a successfully committed approval.** `decision_impacts.is_blocker`
   is not reliably `BOOLEAN` across this repo's own migration history (`292`/`297`
   define it `INTEGER`, `728_beta_missing_tables_2.sql`'s `CREATE TABLE IF NOT EXISTS`
   defines it `BOOLEAN` — a genuine, pre-existing schema conflict, not
   introduced by this packet). The post-commit block-refresh cascade in
   `decide()` compared it with `= TRUE`, which throws a hard Postgres type
   error on the `INTEGER` variant — uncaught — crashing the HTTP response
   with 500 **after** the atomic transaction had already committed. The
   server was lying to the client about a successful write. First fix
   attempt (`= 1`) was itself silently neutralized by
   `PostgresDatabase.ts`'s `ALWAYS_BOOLEAN_COLUMNS` rewriter, which rewrites
   any `= 1` back to `= TRUE` before the query reaches Postgres — discovered
   only by the final falsification reviewer. Real fix:
   `is_blocker::text IN ('1','true')`, robust to either schema variant,
   applied at all 4 call sites in `DecisionController.ts` (not just the one
   in `decide()`'s cascade — `getDecisions`'s blocked-count subquery and
   `refreshTaskDecisionBlock`/`refreshInitiativeDecisionBlock` had the same
   bug). The cascade is now also wrapped in try/catch so it can never again
   turn a committed decision into an HTTP error, whatever it throws for in
   the future.
2. **Rationale-required check was dead code.** `decide()` synthesized a
   default rationale (`'Approved'`/`'Rejected'`) whenever the caller omitted
   the field, so `decisionOutcomeService`'s `requiresRationale()` check never
   saw an empty value for the omitted case (only the explicit-blank-string
   case was ever actually rejected). Fixed by removing the fabricated
   fallback.
3. **Cross-tenant relationship forgery.** `createDecision` accepted a
   client-supplied `projectId`/`initiativeId`/`taskId` with no check that it
   belongs to the caller's own organization — an org-A decision could forge
   a link to a real org-B project/initiative/task. Fixed with an org-scoped
   existence check (`assertRelatedObjectsBelongToOrg`) before insert.

All three were found by `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts`
running against **real local Postgres** — none would have been caught by the
mocked/SQLite test patterns already dominant elsewhere in this repo's My Work
test suite (see MW-CORE-001 §8 for that prior finding).

## Fixed by this packet

`server/migrations/932_decision_workflow_canonical.sql` adds
`decision_comments`/`decision_alternatives`/`decision_risks` (real,
org-scoped, author-from-token, FK'd to `decisions.id`) plus
`decisions.version`/`decisions.decided_by`. `decisionCollaborationService.ts`
is the real, tenant-safe data-access layer; `finalizeDecisionTransition`
makes the approve/reject write genuinely atomic on one pinned `pg.Client`
(independently confirmed by the final falsification reviewer: exactly one
`BEGIN`/`COMMIT` boundary, `ROLLBACK` on every error path, `client.release()`
in `finally`). `DecisionController.ts` exposes it all through the existing
canonical router. `src/components/MyWork/Decision/*` is a new, honest,
independently-mountable frontend that calls this real API — see MW-DEC-004
for its current (intentionally unwired) integration status.
