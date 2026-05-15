# Demo Integration Rollout Plan - 2026-05-15

## Executive Verdict

Demo integration must continue as a controlled wave rollout, not as a bulk merge.

The current `demo.consultify.ai` baseline is:

- Branch: `origin/staging`
- Commit: `2e1f3d188` (`fix(collaboration): surface degraded canvas and table states`)
- Railway environment: `staging`
- Railway service: `consultify`
- Latest verified deployment: `1137410c-e347-425c-9d7f-b04a66e0e0d2`
- Runtime gate: `SUCCESS`, `/ping = pong`, homepage `HTTP 200`

Wave 3 is the stable demo baseline. Every later wave must preserve this baseline and must be independently testable, deployable, and reversible.

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

Status: `DONE` and deployed.

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

Validation evidence:

- Frontend scoped tests: `24/24` passing.
- Backend/integration scoped tests: `74/74` passing.
- Export trace service/integration tests: `39/39` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `dddfa771-4251-4c04-8333-8c070adc615d`, `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, no final runtime error logs, no final HTTP 5xx logs.

## Wave 3 - Table Studio / Work Canvas / My Work Collaboration

Status: `DONE` for the first safe degraded collaboration UX slice.

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

Delivered slice:

- Work Canvas deterministic action error mapping.
- Idea Table collaboration degraded presence messages.
- Workspace lock degraded readback.
- Workflow dashboard locked-state guard.
- Cell cursor accessibility status label.

Deferred from Wave 3:

- Large Table Studio Block D conversion/form-intake rollout.
- Additional migrations and public form routes.
- Broad My Work/Inbox redesign changes.

Validation evidence:

- Focused UI/unit tests: `16/16` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `1137410c-e347-425c-9d7f-b04a66e0e0d2`, `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, no final runtime error logs, no final HTTP 5xx logs.

## Wave 4 - Settings / AI Governance / Admin Controls

Status: `DONE` and deployed.

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

Delivered slice:

- AI memory preferences fail-closed backend route behavior.
- Coded AI governance and privacy error envelopes.
- Canonical AI memory and chat history settings surfaces.
- Superadmin AI governance unavailable/degraded states.

Validation evidence:

- Focused settings/governance tests: `58/58` passing.
- Production build: passing with larger Node heap.
- GitHub/Railway deployment: `7f94fcb7d` live on `demo.consultify.ai`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, `/api/health` reported `gitSha = 7f94fcb7dc48c51c7e72c4ce05f02968af9e32c4`.

## Wave 5 - Runtime Hardening / RBAC / Org Context / Middleware

Status: `IN_PROGRESS` via small manual slices.

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

### Wave 5.1 - Middleware Edge Guards

Status: `DONE` and deployed.

Source candidate:

- `8a816422b` - `fix(middleware): harden metrics, permissions, and org context edge paths`

Delivered slice:

- Metrics middleware records completion on `finish`/`close` as well as `end`, avoids double recording, and caps impossible latency jumps.
- Org context middleware sanitizes attached role values and avoids catch-path 500 writes after headers are already sent.
- Permission middleware denies excessive `requireAnyPermission` / `requireAllPermissions` key lists before DB checks and skips audit logging after headers are sent.

Hard stops preserved:

- No bulk middleware cherry-pick.
- No auth model rewrite.
- No tenant resolution rewrite.
- No `EFFECTIVE_ACCESS_ENFORCE` behavior change.
- No migration or schema change.

Validation evidence:

- Focused non-DB middleware gate: `36/36` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `73591801-158f-4fc3-af66-0f7bac343bc0`, `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, `/api/health` reported `gitSha = e089592f7a71aedbe3620deb5c0e9369035506a9`.
- DB-backed `orgContext.middleware.test.ts` was not used as a local blocker because local Postgres failed before test execution with `role "iris" does not exist`; equivalent new safety coverage was added with mocked DB dependencies.

### Wave 5.2 - API Version Input Guard

Status: `DONE` and deployed.

Source candidate:

- `d7e547713` - `fix(middleware): harden runtime guards across auth/version/quota`

Delivered slice:

- `requireVersion` now trims and clamps `minVersion` input before lookup.
- Unknown oversized minimum-version strings remain a no-op instead of expanding unbounded string work.
- No auth middleware, quota middleware, tenant resolution, or schema behavior changed.

Hard stops preserved:

- No bulk middleware cherry-pick.
- No auth fallback change.
- No quota policy change.
- No tenant/ACL model change.

Validation evidence:

- Focused API version middleware gate: `19/19` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `0c6aba50-ee61-4390-a9b3-4ede7a100b13`, `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, `/api/health` reported `gitSha = fde05d354afb041b849082bae22e96d451438182`.

### Wave 5.3 - Request Access Prototype Guard

Status: `DONE` and deployed.

Source candidate:

- `d7e547713` - `fix(middleware): harden runtime guards across auth/version/quota`

Delivered slice:

- `requestAccess` now ignores inherited `user.isSuperAdmin` and inherited `user.role` values.
- Own `user.isSuperAdmin`, `req.userRole`, and own `user.role` behavior remains unchanged.
- No auth middleware, tenant resolution, quota policy, or schema behavior changed.

Hard stops preserved:

- No bulk middleware cherry-pick.
- No auth token fallback change.
- No tenant/ACL model change.
- No database or migration change.

Validation evidence:

- Focused request access helper gate: `6/6` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `6c673c2b-3afb-42ef-8cc1-544265007a0e`, `SUCCESS`.
- Runtime: `/ping = pong`, `/api/health` reported `gitSha = 1dd0c4022bdee1c629a8fc99f9f9f176dfeed621`.

### Wave 5.4 - Deprecation Header Response Guard

Status: `DONE` and deployed.

Source candidate:

- `8e8a60ad9` - `fix(middleware): extend runtime hardening across access and quota guards`

Delivered slice:

- `deprecationHeader` now skips header writes when the response has already been committed.
- Successor `Link` header values are capped to a hard limit.
- No auth middleware, tenant resolution, quota policy, validation policy, or schema behavior changed.

Hard stops preserved:

- No bulk middleware cherry-pick.
- No auth/tenant behavior change.
- No rate-limit or quota behavior change.
- No database or migration change.

Validation evidence:

- Focused deprecation header gate: `3/3` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `892362cd-d8e2-4ded-bf84-beb2b05c4332`, `SUCCESS`.
- Runtime: `/ping = pong`, `/api/health` reported `gitSha = d9af1cc64fec9d0d291848bb510f9889af0f64ba`.

### Wave 5.5 - Security Header Disclosure Guard

Status: `DONE` and deployed.

Source candidate:

- `8e8a60ad9` - `fix(middleware): extend runtime hardening across access and quota guards`

Delivered slice:

- `securityHeaders` now removes `X-Powered-By` before setting security headers.
- Header removal is fail-soft if the response object throws.
- No rate-limit, validation, auth, tenant, quota, or schema behavior changed.

Hard stops preserved:

- No bulk middleware cherry-pick.
- No auth/tenant behavior change.
- No rate-limit or quota behavior change.
- No database or migration change.

Validation evidence:

- Focused security headers gate: `9/9` passing.
- Production build: passing with larger Node heap.
- Railway deployment: `f8e2e787-be4c-4f46-8c43-a9debef82022`, `SUCCESS`.
- Runtime: `/ping = pong`, homepage `HTTP 200`, `/api/health` reported `gitSha = 762aac530a4ef4658934ef18bd93918a0efdc426`.

## Wave 6 - Enterprise Closeout / Manual Test Gate

Status: `DEPLOYED_AFTER_REMEDIATION`; authenticated manual smoke still pending before final `GO`.

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

Wave 6 result:

- Previous verdict: `NO_GO / BLOCKED_P1`.
- Remediation verdict: `DEPLOYED_AFTER_REMEDIATION`.
- Branch freeze: current `origin/staging` was frozen for RC assessment at `012ed86d45a7082b93271fc1ddc945e65b88c00d`.
- Runtime baseline: `/api/health` reported `gitSha = 012ed86d45a7082b93271fc1ddc945e65b88c00d`, `/ping = pong`, homepage `HTTP 200`.
- Railway deployment: `8c5242b5-ed3e-4f67-943c-3521786e9ee2`, `SUCCESS`.
- Production build: passing with larger Node heap.
- Middleware regression gate: `73/73` passing across metrics, org-context safety, permission, API version, request access, deprecation header, and security headers tests.
- Critical auth/access-policy gate after remediation: `534/534` passing.
- Targeted blocker files after remediation: `203/203` passing.
- Remediation deployment: `d9264f24-4e2d-4b84-8e54-9f5587c035c0`, `SUCCESS`.
- Runtime after remediation: `/api/health` reported `gitSha = 77f727197b57c2dd4d91c8f287752b44f1cbb720`, `/ping = pong`, homepage `HTTP 200`.
- Live unauthenticated API probes returned controlled `401` responses with `{"error":"No token provided"}`.
- Live response headers did not expose `X-Powered-By`; CSP, HSTS, frame, content-type, and referrer controls were present.

Blocking findings:

- Resolved: `npm run test:unit:critical` now passes.
- Resolved by aligning tests to the current canonical role model: platform `superadmin` remains `superadmin`, manager-like application roles fall back to `team_member` / `USER`, and permission checks use the current `USER` fallback.
- Resolved by documenting trial AI onboarding behavior in tests: initial trial AI grace calls are allowed before onboarding completion, and calls are denied once the grace usage threshold is reached.

Residual risks:

- Runtime auth/access behavior was not changed during remediation; the fix was test-contract alignment only.
- Full manual tenant/ACL save/read-back smoke was not completed with authenticated test accounts in this pass; automated and unauthenticated runtime gates were used instead.

## Immediate Next Step

Run the final authenticated staging smoke before merge:

1. Use test accounts to validate tenant/ACL isolation.
2. Validate save/read-back/refresh on the agreed critical flows.
3. If no P0/P1 appears, change final merge verdict to `GO` or `GO_WITH_P2`.

Previous Wave 5 continuation command sequence:

First command sequence:

1. Inspect the next middleware candidate map.
2. Select one narrow slice with no auth model rewrite, no tenant resolution rewrite, and no schema change.
3. Run focused tests and production build.
4. Deploy only after green gates and verify `/ping`, homepage, and `/api/health`.

