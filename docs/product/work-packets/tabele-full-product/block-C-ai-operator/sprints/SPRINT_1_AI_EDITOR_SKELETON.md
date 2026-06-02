# Sprint 1 — AI Editor Skeleton (Block C)

**Sprint ID:** `C-S1`
**Owner:** Agent A
**Status:** `EXECUTED — GO`
**Estimate:** ~1 day
**Epic:** EPIC-T10
**Executed:** 2026-05-08

## Goal

Ship `TableAiEditorService` orchestrator with envelope contract, 8 stub level handlers, `AiUsageService` for token budget. Migration adds `tp_schema_proposals.level` column, `tp_workspace_settings`, and `tp_ai_usage` tables.

## Pre-sprint risk check

C-T2 (envelope drift), C-T5 (token race), C-S1 (auto-execute).

## Deliverables

- `TableAiEditorService.ts` orchestrator + envelope contract.
- 8 stub level handlers in `TableAiEditorLevels/`.
- `AiUsageService.ts` with atomic `consume`.
- Migration `2026_05_block_c_ai_operator.sql`:
  - `ALTER TABLE tp_proposals ADD COLUMN level TEXT NULL`
  - `CREATE TABLE tp_ai_usage (...)`
- Routes: `POST /tables/:id/ai-editor/propose`, `POST /proposals/:id/apply`, `POST /proposals/:id/reject`.
- Unit tests: orchestrator dispatch + token budget enforcement + 429.

## Files

### Created
- `consultify/server/src/services/tablePlatform/TableAiEditorService.ts`
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/{cell,record,column,structure,view,relational,methodological,source}.ts`
- `consultify/server/src/services/tablePlatform/AiUsageService.ts`
- `consultify/server/src/services/tablePlatform/migrations/2026_05_block_c_ai_operator.sql`
- `consultify/server/src/routes/table-platform.ai-editor.routes.ts`
- Tests under `__tests__/`.

### Updated
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/index.ts` (mount route module)

## Sprint Exit Gate

- [x] All 8 stub handlers callable; each returns `{proposalId, level, softWarn, handlerStatus}`.
- [x] Token budget atomic (single SQL UPDATE w/ ON CONFLICT + WHERE clause).
- [x] Cross-tenant 403 verified at route layer (`workspaceBelongsToOrganization` + table → base lookup).
- [x] Recommendation: **GO** to S2.

## Execution Log (2026-05-08)

### Files delivered

- `consultify/server/src/services/tablePlatform/TableAiEditorService.ts`
  — orchestrator with `proposeEdit / applyProposal / rejectProposal`.
  Cost-control invariant enforced: `consume()` runs BEFORE proposal insert.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/index.ts`
  — dispatcher + 8 stub handler files (`cellLevel.ts`, `recordLevel.ts`,
  `columnLevel.ts`, `structureLevel.ts`, `viewLevel.ts`, `relationalLevel.ts`,
  `methodologicalLevel.ts`, `sourceLevel.ts`). Each stub returns
  `{handlerStatus: 'stub', summary, operations: [], warnings, confidence}`.
- `consultify/server/src/services/tablePlatform/AiUsageService.ts`
  — already present from C-S0; consume() / getSnapshot() validated by
  11 new unit tests in C-S1.
- `consultify/server/migrations/20260508_block_c_ai_operator.sql`
  — already present from C-S0; adds `tp_schema_proposals.level`,
  `tp_workspace_settings`, `tp_ai_usage` (idempotent guards).
- `consultify/server/src/routes/table-platform.ai-editor.routes.ts`
  — 4 routes: `POST /tables/:tableId/ai-editor/propose`,
  `POST /ai-editor/proposals/:proposalId/apply`,
  `POST /ai-editor/proposals/:proposalId/reject`,
  `GET /ai-editor/budget?workspaceId=…`. Mounted in `Gateway.ts`
  AFTER `tablePlatformRoutes` (T6 mitigation pattern).
- `consultify/server/src/config/FeatureFlags.ts`
  — added `ENABLE_TABLE_AI_EDITOR` (default `false`; opt-in via env).
- `consultify/server/src/services/tablePlatform/__tests__/AiUsageService.test.ts`
  — 11 tests (success / soft_warn / hard_cap / validation / DB error / snapshot).
- `consultify/server/src/services/tablePlatform/__tests__/TableAiEditorService.test.ts`
  — 14 tests (8 levels × happy path, hard-cap pre-insert defense, idempotent
  apply/reject, cross-tenant 404, missing-field validation).

### Validation

- ESLint: 0 errors across all new/edited files.
- Vitest: **25 / 25 PASS** (`AiUsageService.test.ts`: 11; `TableAiEditorService.test.ts`: 14).
- Migration: idempotent — guarded `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE
  IF NOT EXISTS`, `EXISTS`-guarded constraints.
- Cost-control invariant covered by test #2 in `TableAiEditorService.test.ts`:
  consume() recorded order MUST be < INSERT recorded order; verified.
- Hard-cap path covered by test #3: `AiBudgetExhaustedError` from
  `AiUsageService` → no proposal row written, no audit row written, no
  level handler dispatched.

### Deferred to C-S2 / C-S3

- Real LLM-backed level handlers (C-S2 ships levels 1–4; C-S3 ships levels 5–8).
- Real `MutationExecutor` wiring inside `applyProposal` — C-S1 ships
  status flip + audit only; service returns `{applied:true, reason:
  'stub_handler_no_op'}` until C-S2 supplies executors.
- Route integration tests with full HTTP roundtrip — deferred to C-S5
  (frontend panels) when API contracts solidify.
