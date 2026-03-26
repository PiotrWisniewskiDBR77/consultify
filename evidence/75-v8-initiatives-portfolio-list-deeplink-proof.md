# V8 Initiatives Portfolio List + Deep-Link Detail Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `bd18d743-28d2-4055-b6ea-fa06351c0307`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Initiatives` via `/initiatives`

## What was verified

Runtime continuity proof:
- the isolated `B-07d` packet was deployed from a clean worktree and the staging build/healthcheck completed successfully
- opening the live `Initiatives` portfolio surface now hits the governed V8 portfolio read directly from the operator-facing UI:
  - `GET /api/v8/planning/initiatives/portfolio?statuses=REVIEW,PROMOTED,PLANNING,APPROVED,SCHEDULED` -> `200`
  - `GET /api/v8/planning/initiatives/portfolio` -> `200`
- no legacy `GET /api/initiatives/portfolio` request appeared in the live browser network capture for the same surface load

Deep-link detail route exercise:
- the new deep-link flow was exercised on staging through fresh browser tabs using:
  - `/initiatives?open=init-review-crm&mode=doc`
  - `/initiatives?open=init-draft-erp&mode=doc`
- Railway runtime logs confirm that both requests were routed through the new governed detail endpoint:
  - `GET /api/v8/planning/initiatives/init-review-crm` -> `404`
  - `GET /api/v8/planning/initiatives/init-draft-erp` -> `404`
- this proves the live surface now targets the governed V8 detail route for deep links instead of the legacy `/api/initiatives/:id` path, but the tested ids were not valid staging records for the current tenant

Real staging-id follow-up:
- a known real staging initiative id from the prior snapshot proof was then exercised through:
  - `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`
- Railway runtime logs confirm that this live deep-link path now hits the governed detail route for a real staging record:
  - `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e`
- the same open-document flow also fans back out into legacy initiative reads:
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items`
  - `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `500`
- the same real-id flow also still triggers `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`

## Scope note

This evidence advances `B-07d` but does not close it:
- portfolio list continuity is now browser-proven on the governed V8 path
- deep-link detail continuity is now route-proven on the governed V8 path, but the open-document flow is still split-brain because a real staging id fans back out into legacy initiative detail reads and subresources
- broader PM lifecycle writes, list/detail parity breadth, and workflow continuity still remain outside this bounded proof

Conclusion:
- the live `Initiatives` surface now has browser-proven governed V8 portfolio list continuity and live exercised governed deep-link detail routing for both invalid and real staging ids
- `B-07d` remains `yellow` because the detail/document path still re-enters legacy `/api/initiatives/*` reads, including a real runtime `500` on legacy `task-dependencies`, so broader PM detail/workflow continuity is not yet closure-ready
