# DEC-583 v3 — W206 organization person directory

Status: READY FOR CTO REVIEW.

Base after rebase: `9ad0a303c394e172a85e1a200f1de1462be41810` (`origin/integracja/20260911`, `linia-20260917-1900`).
Branch: `codex/a-dec583-v3-w206-20260917`.

## Scope

- Updated `useOrganizationMemberNames` tests to the W206 contract: an ordinary user may request the organization directory and receives minimal person data, not email.
- `useOrganizationMemberNames` now accepts minimal `displayName` / `display_name` payloads in addition to legacy `name`, snake_case names, camelCase names, and email fallback.
- `GET /api/users/:id` is tenant-scoped by `organization_id` on the first read.
- Same-org MEMBER gets minimal person payload without `email`; OWNER keeps full payload; existing foreign user id returns 403 instead of leaking a row.
- The route uses the existing `shapeOrgPersonPayload` helper, keeping DEC-583 payload policy in one place.

## Evidence

- Focused regression: `src/hooks/__tests__/useOrganizationMemberNames.access.test.tsx`, `server/src/controllers/__tests__/OrganizationController.membership.test.ts`, `server/src/routes/__tests__/usersPersonDirectory.routes.test.ts` — 3 files / 15 tests PASS.
- Nearby importer set: `src/hooks/__tests__/useOrganizationMemberNames.test.ts`, `src/hooks/__tests__/useOrganizationMemberNames.access.test.tsx`, `src/hooks/__tests__/useInitiativeNames.test.ts`, `src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx`, `server/src/routes/__tests__/usersPersonDirectory.routes.test.ts`, `server/src/controllers/__tests__/OrganizationController.membership.test.ts` — 6 files / 55 tests PASS.
- Broad grep importer attempt found 21 unique test files in this sparse worktree; one-process run produced unrelated harness failures (`h64` table-platform mock, `okrTrzyPoziomy` i18n mock, plus existing integration harnesses). Therefore the package evidence uses the six nearest importers above plus the direct route/controller tests.
- Mutation RED: removing `AND organization_id = ?` from `GET /api/users/:id` makes `usersPersonDirectory.routes.test.ts` fail on the scope assertion.
- Language gate: `BRAMKA JĘZYKOWA: OK (nic nie wzrosło)`, report `/tmp/dec583-v3-lang.txt`.
- `git diff --check` PASS.
- Front TypeScript: exit 2; 167 `error TS` total, 5 in `node_modules`, 0 changed-file hits.
- Server TypeScript: exit 0; 0 `error TS`, 0 in `node_modules`, 0 changed-file hits.

## Limits

- No migration.
- No staging/demo/Londyn/integracja push.
- No deploy, Railway, env, or staging writes.
- `src/components/Initiatives/InitiativesHub.tsx` was not touched per W207 reservation.
- Out-of-scope DLUG from W206 remains untouched: legacy unmounted `teams.routes.ts`, `pmo/project-members.routes.ts`, and `InterviewController.ts` assignee email.
