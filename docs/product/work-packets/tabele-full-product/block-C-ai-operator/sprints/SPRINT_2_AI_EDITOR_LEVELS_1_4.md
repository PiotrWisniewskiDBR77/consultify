# Sprint 2 — AI Editor Levels 1–4 (Block C)

**Sprint ID:** `C-S2`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T10

## Goal

Full implementation of cell, record, column, structure level handlers with prompt builders, validation, audit logging, and end-to-end test coverage.

## Pre-sprint risk check

C-S2 (cross-tenant LLM context), C-S3 (proposal replay).

## Deliverables

- `cell.ts` — single cell refinement; ACL filter on context records.
- `record.ts` — fill missing fields on a record.
- `column.ts` — bulk column fill across visible records.
- `structure.ts` — proxies through existing `ChatToSchemaService`.
- Unit tests per handler.
- Integration test for end-to-end proposal flow on cell + structure.

## Files

### Created
- `tests` for the 4 handler files (additions to existing test directory).
- `tests/integration/ai-editor-cell.test.ts`, `ai-editor-structure.test.ts`.

### Updated
- The 4 level handler files (now full impl, were stubs).
- `TableAiEditorService.ts` (refine helper).

## Sprint Exit Gate

- [ ] 4 handlers ship full impl + tests.
- [ ] Integration tests green.
- [ ] No auto-execute path (L7.2 review locally).
- [ ] Cross-tenant LLM context audit clean.
- [ ] Recommendation: `GO` to S3.
