# V8 Initiatives Gate Readiness + Resources Blocked Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `46202517-f696-4e58-a255-add686cfd473`

Deployment verification:
- the bounded `gate-readiness-check + resources` read-bridge batch was deployed from the isolated `consultify-b07d-v8-planning-proof` worktree
- Railway build logs for deployment `46202517-f696-4e58-a255-add686cfd473` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status later converged to active `SUCCESS` for deployment `46202517-f696-4e58-a255-add686cfd473`

Local validation before deploy:
- `tests/unit/services/v8-planning-api.test.ts` passed
- `server/src/routes/v8/__tests__/planning.routes.test.ts` passed
- no new lint diagnostics on the edited files

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh-tab `Initiatives` deep-link document open

## What was verified

Repo/runtime delta in this batch:
- `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check` is now exposed on the V8 read bridge
- `/api/v8/planning/initiatives/:initiativeId/resources` is now exposed on the V8 read bridge
- `InitiativeDocumentView` now requests both reads through `V8PlanningApi` before legacy fallback

Pre-activation browser capture during rollout lag:
- the document still opened, but the network capture showed legacy `GET /api/initiatives/:id/resources` and legacy `GET /api/initiatives/:id/gate-readiness-check`
- no governed V8 calls for those two endpoints were observed in that pre-convergence window

Post-activation fresh-tab retest from the active deployment:
- two separate fresh tabs opened `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`
- both tabs landed in the `InitiativesHub` retry/dismiss error state instead of opening the document flow
- browser network capture from those post-activation tabs did not show the expected document request chain; one tab showed only `GET /api/health` `200`, another showed no captured XHR requests
- because the document never completed a clean open flow after deployment activation, no closure-grade live proof for the new V8 `gate-readiness-check` / `resources` reads could be captured

## Scope note

This evidence does not advance `B-07d` to the next closure state:
- the repo/runtime bridge is implemented and deployed
- the expected live staging cutover proof for `gate-readiness-check` and `resources` is still missing
- the immediate blocker is now a new post-deploy `InitiativesHub` load-error state on fresh deep-link tabs, not lack of local test coverage

Conclusion:
- the next move for `B-07d` is to debug the fresh-tab `InitiativesHub` retry/dismiss runtime failure on the active staging deployment
- only after that blocker is cleared can `gate-readiness-check` and `resources` be re-proven for clean V8 cutover
