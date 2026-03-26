# V8 Initiatives Gate Readiness + Resources Cutover Proof

Date: 2026-03-26

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `46202517-f696-4e58-a255-add686cfd473`

Deployment verification:
- the bounded `gate-readiness-check + resources` read-bridge batch was deployed from the isolated `consultify-b07d-v8-planning-proof` worktree
- Railway build logs for deployment `46202517-f696-4e58-a255-add686cfd473` show image push completion and a successful `/ping` healthcheck
- Railway control-plane status converged to active `SUCCESS` before the final fresh-tab proof

Local validation before deploy:
- `tests/unit/services/v8-planning-api.test.ts` passed
- `server/src/routes/v8/__tests__/planning.routes.test.ts` passed
- no new lint diagnostics on the edited files

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: fresh-tab `Initiatives` deep-link document open

## What was verified

Fresh real-id deep-link exercised:
- `/initiatives?open=7a06c7e4-17fc-4239-a670-dde84efe3e4e&mode=doc`

Final fresh-tab browser network capture from the active deployment shows the new governed V8 reads for the bounded governance/runtime batch:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check` -> `200`

Companion governed V8 reads still present in the same fresh-tab open flow:
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/comments` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/history` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/task-dependencies` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/watchers` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/stakeholders` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-roles` -> `200`
- `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/status-history` -> `200`

Corresponding legacy reads for the newly cut over batch were not observed in the same fresh-tab open flow:
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/resources`
- no legacy `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/gate-readiness-check`

Residual legacy reads still present in the same document open flow:
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/raid` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/kpis` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/tools` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/intangible-assets` -> `200`
- `GET /api/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/budget-items` -> `200`

## Scope note

This evidence materially advances `B-07d` but does not close it:
- the real initiative document flow is now staging-proven on governed V8 paths for `resources` and `gate-readiness-check`
- the temporary rate-limit blocker recorded in `evidence/80-v8-initiatives-gate-readiness-resources-blocked-proof.md` is now superseded by a clean cooldown retest
- broader initiative document continuity still remains split-brain because the same real document path still depends on legacy `raid`, KPI, tools, budget-items, and intangible-assets

Conclusion:
- the live `Initiatives` document flow is materially improved again: resources and gate-readiness now load from governed V8 endpoints on staging
- `B-07d` remains `yellow` because several remaining document reads still fan back into legacy truth beyond this bounded batch
