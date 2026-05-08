# Sprint 1 — AI Editor Skeleton (Block C)

**Sprint ID:** `C-S1`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T10

## Goal

Ship `TableAiEditorService` orchestrator with envelope contract, 8 stub level handlers, `AiUsageService` for token budget. Migration adds `tp_proposals.level` column and `tp_ai_usage` table.

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

- [ ] All 8 stub handlers callable; each returns `{proposalId}` only.
- [ ] Token budget atomic; cross-call race tested.
- [ ] Cross-tenant 403 verified.
- [ ] Recommendation: `GO` to S2.
