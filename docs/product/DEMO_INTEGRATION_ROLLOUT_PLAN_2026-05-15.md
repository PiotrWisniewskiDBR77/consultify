# Demo Integration Rollout Plan - 2026-05-15

## Executive Verdict

Demo integration must continue as a controlled wave rollout, not as a bulk merge.

The current `demo.consultify.ai` baseline is:

- Branch: `origin/staging`
- Commit: `9d66fd509` (`fix(chat-shell): complete safe demo integration wave one`)
- Railway environment: `staging`
- Railway service: `consultify`
- Latest verified deployment: `1229bc69-5278-4083-8d7d-c397d7ff7417`
- Runtime gate: `SUCCESS`, `/ping = pong`, homepage `HTTP 200`

Wave 1 is the stable demo baseline. Every later wave must preserve this baseline and must be independently testable, deployable, and reversible.

## Operating Rules

1. No bulk merge of the rebuild branch.
2. No high-risk RBAC, auth, org-context, or permission middleware merge until later dedicated hardening.
3. Each wave must produce visible product value on demo.
4. Each wave must end with:
   - scoped code changes,
   - focused automated tests,
   - production build,
   - commit,
   - push to `origin/staging`,
   - Railway staging deploy,
   - runtime verification,
   - clear `GO`, `GO_WITH_P2`, or `NO_GO` verdict.
5. If cherry-pick conflicts expand into core middleware or schema risk, stop the cherry-pick and re-implement manually in a smaller scope.

## Hard Stops

Stop the wave and do not deploy if any of these occur:

- Auth, tenant isolation, or permission behavior becomes ambiguous.
- A migration is required but rollback and Railway staging impact are not understood.
- Production build fails for a code reason.
- Focused tests fail and the failure is not isolated to an obsolete test expectation.
- Railway deploy does not reach `SUCCESS`.
- Runtime logs show new 5xx patterns after deployment.
- Homepage or `/ping` fails.

## Wave 1 - Shell / Chat / Invite

Status: `DONE` and deployed.

Scope delivered:

- full-chat entry path from sidebar and mobile nav,
- `/chat` and `/chat/:conversationId` route sync hardening,
- invitation validation and account-mismatch UX,
- Teresa voice error toast lifecycle,
- Teresa voice auto-stop when active conversation is cleared,
- focused frontend/backend tests.

Validation evidence:

- Frontend scoped tests: `48/48` passing.
- Invitation backend tests: `16/16` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, no recent deployment error logs, no recent HTTP 5xx logs.

## Wave 2 - Results / Execution / Reports Runtime

Status: `NEXT`.

Goal:

Make visible business modules reflect the rebuild on demo, without pulling risky auth/RBAC/middleware changes.

Primary user-visible surfaces:

- `ResultsHub`
- `ExecutionHub`
- `ReportsAndPresentationsHub`
- reports, presentations, sheets, templates deeplinks
- canonical artifact/export trace paths
- loading and load-error states for module hubs

Candidate source commits:

- `7fd682dfb` - `fix(v8-results-exec): close pack-03 and advance pack-04 integration`
- `c1a541834` - `fix(v8-results-exec): close pack-04 reopen hardening and continuity`
- `bfe3bc218` - `fix(v8-results-exec): close pack-05 quality consistency across hubs and read contracts`

Execution approach:

1. Inspect candidate commit file maps.
2. Select only product/runtime files for Results, Execution, Reports, and shared hub loading/error states.
3. Avoid unrelated tracker docs, broad route guards, and unrelated migration/schema files unless directly required.
4. Prefer small manual patches when cherry-pick conflicts cross module boundaries.
5. Run focused tests for:
   - `ResultsHub`
   - `ExecutionHub`
   - `ReportsAndPresentationsHub`
   - deeplink behavior
   - export trace routes if backend touched
   - shared `ModuleHub` loading/error components
6. Run production build.
7. Deploy and verify Railway staging.

Wave 2 acceptance criteria:

- Results, Execution, and Reports screens load on demo without white screen.
- New/deep-link runtime strips and tabs work where included.
- Load and error states are user-visible and non-crashing.
- No new deployment error logs.
- No new HTTP 5xx pattern.

## Wave 3 - Table Studio / Work Canvas / My Work Collaboration

Status: `PLANNED`.

Goal:

Bring visible artifact work, tables, and canvas collaboration improvements onto demo.

Candidate scope:

- table platform relations and table fetch hardening,
- work canvas action error messages,
- My Work inbox/workflow degraded states,
- collaboration presence/lock UX,
- sync/workflow policy degraded copy.

Risk:

Medium. This touches collaborative runtime and cross-module artifact behavior.

Gate:

- Must not deploy unless table and canvas focused tests pass.
- Must inspect runtime logs for 4xx/5xx after first manual click-through.

## Wave 4 - Settings / AI Governance / Admin Controls

Status: `PLANNED`.

Goal:

Expose enterprise governance controls visibly and safely.

Candidate scope:

- AI memory settings,
- chat history settings,
- AI governance tabs,
- context policy fail-closed UI,
- settings route entries and sync resolver updates.

Risk:

Medium. Governance writes and privacy controls require fail-closed behavior.

Gate:

- No hidden writes.
- No raw sensitive payloads in logs or UI.
- Memory/privacy route tests must pass.

## Wave 5 - Runtime Hardening / RBAC / Org Context / Middleware

Status: `DEFERRED`.

Goal:

Integrate security and tenant correctness hardening after product-visible waves are stable.

Scope:

- permission middleware,
- org context middleware,
- metrics middleware,
- auth edge paths,
- audit and rate-limit behavior,
- fail-closed tenant checks.

Risk:

High. Previous cherry-pick attempts produced broad conflicts here.

Execution rule:

No bulk cherry-pick. Implement manually from audited diffs with one middleware family at a time.

Gate:

- Tenant/ACL tests must pass.
- Existing `effectiveAccess` model must not regress.
- Any uncertain authorization behavior must default to deny or stop the wave.

## Wave 6 - Enterprise Closeout / Manual Test Gate

Status: `PLANNED`.

Goal:

Move from demo-ready to release-candidate posture.

Scope:

- full manual test matrix,
- Railway runtime log review,
- HTTP 4xx/5xx triage,
- schema-gap decision,
- P2 residual register,
- final go/no-go release report.

Final verdict options:

- `GO` - no blocking residuals.
- `GO_WITH_P2` - demo/release candidate accepted with explicit P2 residuals.
- `NO_GO` - blocking product, security, tenant, deployment, or data issues remain.

## Immediate Next Step

Start Wave 2.

First command sequence:

1. Inspect diffs and conflict risk for candidate Wave 2 commits.
2. Apply the smallest viable Results/Execution/Reports slice.
3. Run scoped tests.
4. Build.
5. Deploy only after green gates.

