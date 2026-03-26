# V8 Initiatives Task-Dependencies Cutover Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `181944f6-7f36-4584-a3a7-b1398127fd35`

Deployment verification:
- the bounded `task-dependencies` bridge packet was deployed from the isolated `consultify-b07d-v8-planning-proof` worktree
- Railway build logs for deployment `181944f6-7f36-4584-a3a7-b1398127fd35` show:
  - frontend build completed successfully
  - image push completed successfully
  - staging healthcheck on `/ping` succeeded
- Railway `deployment list` / `service status` stayed temporarily stale after the healthcheck window, so the deployment state in CLI read-back lagged the build log truth during capture

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Initiatives` deep-link document open

## What was verified

Deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Live browser network capture for the resulting document open flow shows:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `200`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` request was observed in the same capture
- governed planning continuity still remains visible through:
  - `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`
  - `GET /api/v8/planning/initiatives/portfolio` -> `200`

Residual legacy fan-out still present in the same open-document flow:
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check` -> `200`

## Scope note

This evidence improves `B-07d` but does not close it:
- the previously failing legacy `task-dependencies` path is now cut over to the governed V8 planning namespace in the live document flow
- the confirmed legacy `task-dependencies` `500` is no longer present in the captured staging open flow
- broader initiative document parity still remains split-brain because many other document subresource reads continue to hit legacy `/api/initiatives/:id/*`

Conclusion:
- the live `Initiatives` document open flow is improved: `task-dependencies` now comes from governed V8 and no longer reproduces the captured legacy failure
- `B-07d` remains `yellow` because the real initiative document path still fans out into multiple legacy initiative subresource reads beyond `task-dependencies`
