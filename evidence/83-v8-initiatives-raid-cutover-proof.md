# V8 Initiatives RAID Cutover Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `afb8c1e5-cba1-49c3-9f32-857bf8ab5f53`

Deployment verification:
- the bounded `raid` read-bridge batch plus the org-gate fallback fix were deployed to staging
- Railway build logs for deployment `afb8c1e5-cba1-49c3-9f32-857bf8ab5f53` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status still lagged on `BUILDING` during capture, but live staging traffic was already serving the new deployment

Local validation before deploy:
- `tests/unit/services/v8-planning-api.test.ts` passed
- `server/src/routes/v8/__tests__/planning.routes.test.ts` passed
- `server/src/services/v8/__tests__/featureFlagService.test.ts` passed
- `server/src/services/v8/__tests__/v8-auth-integration.test.ts` passed
- no new lint diagnostics on edited files

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh deep-link `Initiatives` document open

## What was verified

Fresh real-id deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Final fresh-tab browser network capture from the active deployment shows the remaining governed V8 planning reads now all resolving with `200`, including the final legacy holdout:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`

Legacy planning document reads were not observed in the same fresh-tab open flow:
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles`

## Scope note

This evidence closes the remaining bounded `B-07d` blocker:
- the real initiative document flow is now staging-proven on governed V8 paths for `raid` plus the full previously migrated planning-document support reads
- the org-gate fallback fix restores the intended staging behavior for tenant orgs without materialized per-org V8 flag rows
- no residual legacy planning document reads were observed in the final fresh-tab capture

Conclusion:
- the live `Initiatives` document flow is now fully browser-proven on governed V8 planning reads for the frozen read-scope packet
- `B-07d` can move from `yellow` to `green`
