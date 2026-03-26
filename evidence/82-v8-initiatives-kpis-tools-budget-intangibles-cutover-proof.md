# V8 Initiatives KPI + Tools + Budget + Intangible Assets Cutover Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `2398be85-edfe-4eb9-9e63-47b669170a44`

Deployment verification:
- the bounded `kpis + tools + budget-items + intangible-assets` read-bridge batch was deployed to staging
- Railway build logs for deployment `2398be85-edfe-4eb9-9e63-47b669170a44` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status still lagged on `BUILDING` during capture, but live staging traffic was already serving the new deployment

Local validation before deploy:
- `tests/unit/services/v8-planning-api.test.ts` passed
- `server/src/routes/v8/__tests__/planning.routes.test.ts` passed
- `server/src/services/v8/__tests__/featureFlagService.test.ts` passed
- no new lint diagnostics on edited files

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh deep-link `Initiatives` document open

## What was verified

Fresh real-id deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Bootstrap note:
- the first proof retry exposed a separate staging bootstrap regression on `GET /api/v8/admin/flags` caused by UUID-only validation of tenant org ids; this was fixed by allowing tenant-style org ids such as `dbr77`
- after redeploy, stale proof tabs were cleared and the document opened cleanly on the next cooldown retest

Final fresh-tab browser network capture from the active deployment shows the new governed V8 reads for the bounded financial/benefits document batch:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets` -> `200`

Companion governed V8 reads still present in the same fresh-tab open flow:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check` -> `200`

Corresponding legacy reads for the newly cut over batch were not observed in the same fresh-tab open flow:
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets`

Residual legacy reads still present in the same document open flow:
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid` -> `200`

## Scope note

This evidence materially advances `B-07d` but does not close it:
- the real initiative document flow is now staging-proven on governed V8 paths for KPI reads, tool reads, budget-item reads, and intangible-asset reads
- the temporary bootstrap regression on `/api/v8/admin/flags` is resolved for tenant-style organization ids and no longer blocks `Initiatives` proof
- broader initiative document continuity still remains split-brain because the same real document path still depends on legacy `raid`

Conclusion:
- the live `Initiatives` document flow is materially improved again: KPI, tool, budget, and intangible reads now load from governed V8 endpoints on staging
- `B-07d` remains `yellow`, but the remaining bounded blocker is now effectively narrowed to `raid`
