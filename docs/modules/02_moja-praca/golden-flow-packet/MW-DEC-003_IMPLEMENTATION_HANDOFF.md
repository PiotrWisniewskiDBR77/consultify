---
doc_id: MW-DEC-003_IMPLEMENTATION_HANDOFF
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
last_updated: 2026-08-01
---

# MW-DEC-003 — Implementation Handoff

## Branch / commits

`feat/mw-dec-001-canonical-decision-workflow`, 8 commits on top of base
`c522a861839f54d0f26baa918566589aab3f6f6b` (= `origin/demo` HEAD at the time
of branching, verified match). HEAD: `d359dc5165`.

```
1264d498f2 feat(mw-dec-001): migration for decision_comments/alternatives/risks + decided_by/version
907d401f02 feat(mw-dec-001): service layer for decision comments/alternatives/risks + atomic finalize
ae9ec72bdf feat(mw-dec-001): wire routes + capability checks for decision detail/comments/alternatives/risks; harden decide() atomicity and terminal-state guards
ecc112daa9 feat(mw-dec-001): honest Decision workspace UI (comments/alternatives/risks/decide)
8aacd6854c test(mw-dec-001): real-Postgres acceptance suite for canonical decision workflow
5cf7c03245 fix(mw-dec-001): 3 real bugs found by acceptance suite against real Postgres
a362af6259 test(mw-dec-001): update case 13b to assert the fixed behavior
d359dc5165 fix(mw-dec-001): decision_impacts.is_blocker comparisons neutralized by ALWAYS_BOOLEAN_COLUMNS
```

No push, no merge, no deploy, no Railway/demo mutation at any point.

## Changed/added files (19 total, `git diff c522a861..HEAD --stat`: +5749/-87)

Backend (single writer throughout: backend/domain agent, plus 2 targeted fix
passes by the same agent and by the final falsification reviewer):
- `server/migrations/932_decision_workflow_canonical.sql` (new)
- `server/src/controllers/DecisionController.ts` (extended)
- `server/src/database/PostgresDatabase.ts` (added `acquirePgClient()`)
- `server/src/routes/pmo/decisions.routes.ts` (extended)
- `server/src/services/decisionCollaborationService.ts` (new)
- `server/src/services/decisionOutcomeService.ts` (new)
- `server/src/validators/decision.validators.ts` (extended)

Frontend (single writer: frontend/UX agent), all new files under
`src/components/MyWork/Decision/`:
- `types.ts`, `decisionWorkspaceApi.ts`, `workspaceHelpers.ts`,
  `DecisionWorkspace.tsx`, `DecisionAlternativesSection.tsx`,
  `DecisionRisksSection.tsx`, `DecisionCommentsSection.tsx`,
  `DecisionDecideBar.tsx`, `DecisionAuditTrail.tsx`, `index.ts`

Tests (single writer: PG-test agent, plus the final falsification
reviewer's independent second suite):
- `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts` (22 cases)
- `tests/acceptance/mw-dec-001-falsification-review.e2e.test.ts` (9 cases,
  independent re-derivation, not a copy of the first suite)

Zero edits to any file outside these three groups — independently confirmed
by the orchestrator after every stage via `git diff --name-only` grepped
against the forbidden-file list.

## Migration

`server/migrations/932_decision_workflow_canonical.sql` — see MW-DEC-002 for
full schema. Numbered in the `server/migrations/9xx_*.sql` convention (next
free number after `931`). **Not** auto-applied by the app's own
`migrationRunner.ts` (which only picks up `/^(7\d{2}|\d{8})_/` — same
convention gap as the pre-existing `931_interview_insight_section_overrides.sql`),
but **is** picked up unconditionally by the acceptance-test schema loader.
Promotion to demo/prod is a separate step, explicitly out of this packet's
scope (no Railway/demo mutation performed or implied).

## Exact test commands

```bash
docker start consultify-acceptance-pg   # or run.mjs's docker-up steps if the container doesn't exist yet
DATABASE_URL="postgres://consultinity:consultinity@localhost:5442/consultinity" \
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true \
JWT_SECRET=development_secret_key_change_in_production_abc123xyz \
npx vitest run tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts tests/acceptance/mw-dec-001-falsification-review.e2e.test.ts \
  --config vitest.acceptance.config.ts --retry=0
```

Result, independently run by the orchestrator (not just claimed by an
agent): **31/31 passed** (22 + 9), real local Postgres, `--retry=0`.

## Capabilities used (no new middleware invented)

`verifyToken`, `requireOrgAccess()` (router-level, unconditional),
`requireDecisionCapability(<cap>, {shadow:true})` (route-level, shadow-only —
matches the repo-wide pattern on 8 other route files under the unset
`CAPABILITY_ENFORCE` flag). Real blocking enforcement for `decide()`
ownership is inline in the controller.

## Remaining non-MVP debt (found, documented, deliberately NOT fixed — out of scope)

- `server/src/routes/decisions.routes.ts` — 835-line dead duplicate router,
  never imported. Left untouched.
- `decision_impacts.is_blocker` type conflict (`INTEGER` in migrations
  292/297 vs `BOOLEAN` in `728_beta_missing_tables_2.sql`'s
  `CREATE TABLE IF NOT EXISTS`) is a genuine, pre-existing, cross-cutting
  schema issue. This packet's fix (`::text IN ('1','true')`) is robust to
  either variant at its 4 call sites in `DecisionController.ts`, but the
  underlying migration conflict itself is unresolved, and the same pattern
  may exist elsewhere in `PostgresDatabase.ts`'s `ALWAYS_BOOLEAN_COLUMNS`
  list (~150 entries, not audited).
- `GET /api/decisions/bottlenecks` was found silently returning empty
  results against real Postgres (invalid SQLite-flavored SQL + an
  error-swallowing legacy DB shim + the same `is_blocker` conflict) —
  unrelated to this packet's core scope. Fixed on a **separate branch**,
  `wip/mw-dec-bottlenecks-followup` @ `1f546ff718`, per Codex's explicit
  instruction not to mix it into MW-DEC-001. **Not independently re-tested
  against real Postgres by this line** — needs its own verification pass
  before merge.
- Comment **editing** UI was intentionally not implemented on the frontend
  (add/delete only); the backend `PUT` endpoint exists and works.
- i18n: **resolved in the Codex re-review round.** Real PL+EN translations
  for all 97 keys are now in `public/locales/{en,pl}/translation.json`
  (commit `7b65e6554b`). Other locales (ja/ar/de/es/jp) remain out of scope.
- Frontend test coverage: **resolved in the Codex re-review round.** 14
  real-mount tests under `tests/components/MyWork/Decision/` (commit
  `07729c3e6d`), including a proven red→green test for the
  no-premature-success guarantee.
- Decision-creation flow (`decisionId === null`) is explicitly NOT
  implemented in the new frontend component — it renders an honest "not
  supported yet" state. Only the existing-decision detail/collaborate/decide
  flow is covered.
- Case 16 (true mid-transaction fault injection — killing the DB connection
  between the `UPDATE` and the `INSERT` inside the transaction) is not
  covered by any test; both the PG-test agent and the final falsification
  reviewer documented this as a known black-box-testing limitation rather
  than faking a pass.
- `getDecisions`'s org-filter guard is `if (orgId) {...}` rather than an
  explicit `if (!orgId) return 401` — unreachable today only because
  `requireOrgAccess()` middleware already rejects requests without a valid
  org id; flagged as an open question, not independently exploitable through
  the mounted route, not fixed (pre-existing code, outside this diff).

Two of the above were also flagged as standalone background-task suggestions
by the final falsification reviewer for separate follow-up (the
`is_blocker`/dead-router schema issue, and the `bottlenecks` endpoint).
