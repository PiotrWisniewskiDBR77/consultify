# V8 Initiatives Detail + Comments/History Retry Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `108d094f-8497-41c2-a7e4-51f50acde299`

Deployment verification:
- the bounded detail/comments/history batch was deployed from the isolated `consultify-b07d-v8-planning-proof` worktree
- Railway build logs for deployment `108d094f-8497-41c2-a7e4-51f50acde299` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status later converged to active `SUCCESS` for deployment `108d094f-8497-41c2-a7e4-51f50acde299`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh-tab `Initiatives` deep-link document open

## What was verified

Fresh real-id deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Repo/runtime delta in this batch:
- `InitiativeDocumentView` now requests initiative core detail through `V8PlanningApi.getInitiative(initiativeId)` before legacy fallback
- `InitiativeDocumentView` now requests initiative `history` and `comments` through `V8PlanningApi.getHistory()` / `V8PlanningApi.getComments()` before legacy fallback
- `/api/v8/planning/initiatives/:initiativeId/history` and `/api/v8/planning/initiatives/:initiativeId/comments` are now exposed on the server read bridge
- targeted client and V8 route tests passed locally before deploy

Live staging retry result from the active deployment:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e` -> `429`
- subsequent legacy fallback `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e` -> `429`
- because the core detail read was rate-limited during the fresh active-deployment retry, the document did not complete a clean open flow and no closure-grade live proof for the new V8 `comments` / `history` reads could be captured in the same retry window

What this proves:
- the active staging frontend now attempts the governed V8 initiative detail route first on the real document deep-link flow
- the remaining blocker for this batch is no longer "frontend never tries the V8 detail route"
- a clean closure proof for `detail/comments/history` is still missing because the active retry window was interrupted by `429`

## Scope note

This evidence advances `B-07d` repo/runtime truth but does not close the packet:
- the bounded V8-first detail/comments/history bridge is implemented and deployed
- the live active deployment proves the real document flow now attempts the governed V8 detail path first
- the packet remains `yellow` because the fresh staging retry was interrupted by `429`, so `detail/comments/history` do not yet have the same clean 200/no-legacy-cutover proof already achieved for the governance batch

Conclusion:
- the next closure move for `B-07d` is not rediscovery; it is a clean staging retest window for the new detail/comments/history V8-first path, plus the remaining legacy document reads (`raid`, `resources`, `kpis`, `tools`, `intangible-assets`, `budget-items`, `gate-readiness-check`)
