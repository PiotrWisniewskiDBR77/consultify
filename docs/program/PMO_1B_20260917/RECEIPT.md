# PMO-1b — roles, stage SLA, escalation tick

BACKEND READY / SCREENSHOT HOLD FOR CTO REVIEW — PMO-1b backend contract is implemented and proven on a local RealPG restore of `staging-pre-wdrozenie28-20260918T0037.dump`; no staging/demo/prod data or Railway settings were touched.

## Scope delivered

- Additive migration `20262281_pmo1b_roles_sla_escalations.sql` adds only:
  - `initiative_stakeholders.pmo_role`,
  - `initiative_stakeholders.pmo_role_source`,
  - `initiative_stage_sla_policies`,
  - `initiative_stage_due_dates`,
  - `initiative_stage_escalation_events`.
- Rollback exists: `server/migrations/rollback/20262281_pmo1b_roles_sla_escalations.down.sql`.
- `initiative_stakeholders.role` is not altered, dropped, retyped, or semantically repurposed.
- Legacy role derivation is limited to unambiguous values: `SPONSOR→SPONSOR`, `OWNER→OWNER`, `CONTRIBUTOR→MEMBER`, `REVIEWER→PMO`, `INFORMED→VIEWER`, `NULL→VIEWER`.
- Ambiguous descriptive legacy values remain `pmo_role=NULL` and are not guessed.
- Stage SLA uses canonical lifecycle flow; rule 7→8 is `IN_EXECUTION→DELIVERED` through `INITIATIVE_STAGE_FLOW`.
- Job 46 now runs the existing decision escalation tick and PMO stage SLA tick; it still does not import or call `decisionEscalationChainService`.
- Manual tick endpoint exists at `POST /api/initiatives/stage-sla/tick`, admin-only, default dry-run, scoped to caller organization.
- Stakeholder read/write now exposes `pmoRole` and `pmoRoleSource` while preserving existing `role` compatibility.

## RealPG evidence

Local database: container `codex-pmo1b-full-pg`, `127.0.0.1:6458/consultify_pmo1b`, restored from `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie28-20260918T0037.dump`.

- Migration `UP/DOWN/UP`: PASS.
- Schema after final UP: `tables=3`, `pmo_cols=2`.
- Backfill count on restored dump: `NULL:45`, `SPONSOR:6`.
- Seeded proof due date: initiative `da588307-778c-4089-b86a-38b3a45793d7` (`API Gateway v2`), organization `a3e05d4a-5397-419d-b486-8e44366c0063`, stage `IN_EXECUTION→DELIVERED`, due `2026-09-16T02:11:33.667Z`.
- Dry run: `candidates=1`, route `sponsor`, target user `188a66b0-f284-4869-b26c-355df56d808a` because steering committee row had no user.
- Non-dry tick: `escalated=1`, `errors=0`.
- Readback event row: `57a88379-976a-40a1-ac1d-8da045e74eed|da588307-778c-4089-b86a-38b3a45793d7|pmo1b-due-proof|1|SPONSOR|188a66b0-f284-4869-b26c-355df56d808a|sponsor|PMO_STAGE_SLA_OVERDUE`.

Evidence files:

- `evidence/up1.log`
- `evidence/down.log`
- `evidence/up2.log`
- `evidence/tick-service.log`
- `evidence/event-row.log`

## Tests and static checks

- `vitest run server/src/services/pmo/__tests__/initiativeStageSlaService.test.ts server/src/services/pmo/__tests__/initiativeStageSlaMigration.contract.test.ts server/src/cron/__tests__/decisionEscalationSchedulerUniqueness.test.ts --retry=0`: 3 files / 7 tests PASS.
- `npm run type-check:server`: PASS.

## Known remaining evidence gap

W234 asks for ON/ON screenshots. This package currently has backend/API behavior proof and no product screen dedicated to PMO-1b SLA/initiative PMO roles. I did not create a bespoke table or touch the reserved `InitiativeDocumentView.tsx:1570-1590` region just to manufacture a screenshot. If CTO requires visual evidence before acceptance, the narrow next step is to expose PMO role/SLA readback in an existing canonical initiative side panel or PMO panel and capture light/dark there.
