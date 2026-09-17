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

## Limits

- RealPG `RUN_DB_TESTS=1` was not run in this package before this receipt; this remains the CTO W200 stage-2 measurement item.
- No screenshots per current channel rule.
- No staging/demo/Railway/deploy/protected-ref push.
- No migrations.
