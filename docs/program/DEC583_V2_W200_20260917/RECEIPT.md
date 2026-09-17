# DEC-583 v2 — organization people directory minimization

Status: READY FOR CTO REVIEW.

Base: `1b662df8cd2cac255f008d40a6dd13d3718d879d` (`origin/integracja/20260911`).
Branch: `codex/dec583-v2-w200-20260917`.

## Scope

- MEMBER in the active organization can read the people directory needed for names.
- MEMBER receives minimized person payload: id, displayName/name, avatar/avatarUrl; no email.
- ADMIN/OWNER/SUPERADMIN retain full payload including email.
- Cross-organization access remains blocked by the existing active membership gate.
- Shared shaping helper: `server/src/services/orgPersonPayloadPolicy.ts`.

## Route coverage table

| Surface | Route | Validator/gate | Controller/service/repository path | DEC-583 behavior |
| --- | --- | --- | --- | --- |
| Organization members | `GET /api/organizations/:orgId/members` | `OrganizationController.getMembers` active member check | `getActiveMembers` + `shapeOrgPersonPayload` | MEMBER allowed, no email; OWNER full; non-member 403 |
| Users search | `GET /api/users/search` | `verifyToken`, org context | direct `users` query + `shapeOrgPersonPayload` | MEMBER search results omit email; admin roles include it |
| Teams list | `GET /api/teams` | `verifyToken`, org context | batched `team_members` query + `shapeOrgNestedUser` | nested member.user omits email for MEMBER |
| Team detail | `GET /api/teams/:id` | `verifyToken`, org-scoped team lookup | `team_members` query + `shapeOrgNestedUser` | nested member.user omits email for MEMBER |
| Chat project members | `GET /api/chat-projects/:id/members` | project membership / org-visible gate | `chat_project_members` query + `shapeOrgPersonPayload` | member row omits email for MEMBER |
| Assessment workflow users | `GET /api/assessment-workflow-v2/:assessmentId/users` | `requireAssessmentPermission('canManageTeam')` | direct `users` query + `shapeOrgPersonPayload` | user row omits email for MEMBER |
| Execution owner name resolver | client hook `useOrganizationMemberNames` | active org/user in app store | `OrganizationApi.getOrganizationMembers` | MEMBER calls directory once and uses minimized payload for names |

## Evidence

- `npm ls @types/node --depth=0` => `@types/node@22.19.3`.
- Focused vitest: `server/src/controllers/__tests__/OrganizationController.membership.test.ts` + `src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx` — 35 tests PASS.
- `git diff --check` PASS.
- Server TSC: exit 0; TypeScript errors 0, node_modules 0, changed-file hits 0.
- Front TSC: exit 2; TypeScript errors 169, node_modules 5, changed-file hits 0.

## W200 stage-2 RealPG measurement

Local database: `consultify_dec583_w200` on local-only Postgres `127.0.0.1:6454` in container `cx-codex-dec583-realpg`. The database was created only for this measurement and populated by the existing repository migration runner on a fresh schema.

Commands and results:

- `NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...@127.0.0.1:6454/consultify_dec583_w200 npm exec vitest -- run tests/security/initiative-object-ownership.mounted.pg.test.ts tests/security/task-object-ownership.mounted.pg.test.ts tests/security/decision-object-ownership.mounted.pg.test.ts --retry=0 --no-file-parallelism` — PASS, 3 files / 29 tests.
- `NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...@127.0.0.1:6454/consultify_dec583_w200 npm exec vitest -- run --config vitest.acceptance.config.ts tests/acceptance/admin-members-active.mounted.pg.test.ts --retry=0 --no-file-parallelism` — PASS, 1 file / 3 tests.
- Tenant-guard mutation: temporarily changed `OrganizationController.getMembers` from `getActiveMembers(orgId)` to `getMembers(orgId)`, then reran `admin-members-active.mounted.pg.test.ts`; expected RED observed, 1 file failed, 2 failed / 1 passed. Failures proved revoked membership leaked into the body and a revoked JWT-admin received 200 instead of 403. The mutation was reverted immediately.

## Limits

- No screenshots per current channel rule.
- No staging/demo/Railway/deploy/protected-ref push.
- No package migration was authored; only the existing migration runner was executed against the local disposable test database above.
