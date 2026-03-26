# V8 Initiatives Governance Read Cutover Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `49556581-b1ed-4fc5-93e7-0b1f88eba31c`

Deployment verification:
- the bounded governance-read batch was deployed from the isolated `consultify-b07d-v8-planning-proof` worktree
- Railway build logs for deployment `49556581-b1ed-4fc5-93e7-0b1f88eba31c` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status lagged briefly after the healthcheck window, then converged to active `SUCCESS` for the new deployment before the final browser proof

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh-tab `Initiatives` deep-link document open

## What was verified

Fresh real-id deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Final fresh-tab browser network capture from the active deployment shows governed V8 reads for the bounded governance batch:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`

Corresponding legacy governance reads were not observed in the same fresh-tab open flow:
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies`

Residual legacy reads still present in the same document open flow:
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check` -> `200`

## Scope note

This evidence advances `B-07d` but does not close it:
- the initiative document governance/read-only batch is now staging-proven on governed V8 paths
- the previously split governance reads (`watchers`, `stakeholders`, `gate-roles`, `status-history`) no longer re-enter legacy truth in the captured fresh-tab open flow
- broader initiative document continuity still remains split-brain because the real document path still depends on legacy core detail, RAID, comments, history, resources, KPIs, tools, intangible-assets, budget-items, and gate-readiness

Conclusion:
- the live `Initiatives` document flow is materially improved again: governance metadata and task-dependency reads now load from governed V8 endpoints on staging
- `B-07d` remains `yellow` because the real initiative document path still fans out into multiple legacy subresource reads beyond the governance batch
