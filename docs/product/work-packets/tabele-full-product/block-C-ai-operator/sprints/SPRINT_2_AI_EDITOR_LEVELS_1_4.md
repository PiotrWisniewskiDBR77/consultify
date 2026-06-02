# Sprint 2 — AI Editor Levels 1–4 (Block C)

**Sprint ID:** `C-S2`
**Owner:** Agent A
**Status:** `EXECUTED — GO`
**Estimate:** ~1 day
**Epic:** EPIC-T10
**Executed:** 2026-05-08

## Goal

Full implementation of cell, record, column, structure level handlers with prompt builders, validation, audit logging, and end-to-end test coverage.

## Pre-sprint risk check

C-S2 (cross-tenant LLM context), C-S3 (proposal replay).

## Deliverables

- `cell.ts` — single cell refinement; ACL filter on context records.
- `record.ts` — fill missing fields on a record.
- `column.ts` — bulk column fill across visible records.
- `structure.ts` — schema mutation proposals (compatible with `MutationExecutor`).
- Unit tests per handler.

## Files

### Created

- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/llmProvider.ts`
  — `LlmProvider` interface + deterministic stub provider + live OpenAI provider
  + `setLlmProviderForTests()` injection point. Production uses live when
  `OPENAI_API_KEY` is set, stub otherwise. Includes the canonical
  `PROMPT_INJECTION_GUARD` constant reused by all handlers.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/operations.ts`
  — Zod schemas for every operation envelope (`op_cell_set`,
  `op_record_update`, `op_record_create`, `op_column_fill`,
  `op_schema_add_field`, `op_schema_rename_field`, `op_schema_retype_field`,
  `op_schema_drop_field`) + discriminated union + handler output schema.
  Validation runs at every handler exit so malformed LLM JSON cannot
  smuggle bad operations into `tp_schema_proposals`.
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/handlerHelpers.ts`
  — shared cross-tenant guard (`assertTableInOrganization`), context
  loaders (`loadTableFields`, `loadRecord`, `loadRecords`), JSON parsing,
  prompt fence (`fenceUntrusted` wraps user prompts in
  triple-backtick UNTRUSTED blocks), confidence clamp.
- 4 handler test files in
  `consultify/server/src/services/tablePlatform/TableAiEditorLevels/__tests__/`
  (`cellLevel.test.ts` 8 tests, `recordLevel.test.ts` 6 tests,
  `columnLevel.test.ts` 6 tests, `structureLevel.test.ts` 7 tests —
  **27 / 27 PASS**).

### Updated

- The 4 level handler files (now full impl, were stubs):
  - `cellLevel.ts` — sets one cell, builds `op_cell_set` with before/after
    diff. Returns empty operations on missing context, tenant mismatch,
    unknown field, missing record, LLM failure, or null `after`.
  - `recordLevel.ts` — fills missing fields on a record. Auto-detects
    null/empty fields when caller doesn't pass `targetFields`. Drops LLM
    proposals targeting fields outside the candidate set.
  - `columnLevel.ts` — bulk fills one column across `visibleRecordIds`.
    Hard-cap at 200 visible records. Drops LLM proposals targeting
    records outside the visible set (LLM-injection defense).
  - `structureLevel.ts` — schema mutation proposals. Surfaces explicit
    data-loss warnings (`structure_drop_data_loss_risk`,
    `structure_retype_data_risk`) for destructive operations. Drops
    proposals referencing unknown field IDs.
- `TableAiEditorLevels/index.ts` — `LevelStubInput` extended with
  `workspaceId`, `actorUserId`, optional `llmProvider` (test injection).
- `TableAiEditorService.ts` — passes `workspaceId` + `actorUserId` to
  `dispatchLevelStub` so handlers can enforce cross-tenant ACL.

## Sprint Exit Gate

- [x] 4 handlers ship full impl + tests.
- [x] Cross-tenant defense verified (`assertTableInOrganization` runs
      before any LLM call; tests prove handler returns empty + warning
      on org/ws mismatch).
- [x] No auto-execute path: handlers PROPOSE only, applyProposal still
      stub-only until C-S5 wires `MutationExecutor`.
- [x] Cross-tenant LLM context audit clean — handlers only load records
      from the tableId after the tenant guard passes; column handler
      additionally constrains to caller-supplied `visibleRecordIds`.
- [x] Recommendation: **GO** to S3.

## Execution Log (2026-05-08)

### Architecture decisions

1. **Injectable `LlmProvider`**. Default: live OpenAI when `OPENAI_API_KEY`
   set, deterministic stub otherwise. Tests inject their own provider
   so every handler test runs offline in <10 ms. Production wiring lands
   in C-S5 when the frontend connects.
2. **Zod-validated operation envelopes** (`operations.ts`). Every handler
   validates its emitted operation array via `safeParse` before returning.
   Invalid envelopes are dropped with a `*_invalid_envelope` warning;
   the orchestrator never persists malformed operations.
3. **`MutationExecutor`-compatible structure operations**. Structure-level
   operations use the same envelope shape (`op_schema_add_field`, etc.)
   that `chatToSchema/MutationExecutor.ts` consumes, so when
   `applyProposal` finally wires the executor (C-S5+), structure
   proposals flow through the same battle-tested mutation pipeline as
   chat-to-schema. No new schema-mutation path was introduced.
4. **LLM-injection defense at every level**. Handlers explicitly drop
   any LLM-emitted operation whose target ID was not part of the loaded
   context (e.g. column handler drops `recordId` outside `visibleRecordIds`,
   structure handler drops unknown `fieldId`s). Prompt-injection guard
   `PROMPT_INJECTION_GUARD` wraps every untrusted user prompt in a
   triple-backtick fence — same convention used by
   RelationExplainabilityService.
5. **Destructive-op opt-in warning**. Structure-level retype/drop always
   surface `structure_*_risk` warnings so the UI can render a
   "this will lose data" confirmation before apply.

### Validation

- ESLint: 0 errors across all new/edited files.
- Vitest: **27 / 27 PASS** for the 4 new handler test files.
  Combined Block C: **52 / 52 PASS** (C-S1 25 + C-S2 27).
- Cross-tenant defense covered by `*_tenant_violation` test in every
  handler — an org/workspace mismatch returns empty operations + warning
  before any LLM call is issued.
- LLM failure path covered (`*_llm_failure` warning + empty operations
  on provider exception).
- Malformed JSON path covered — `safeJson` returns `{}`, handlers emit
  empty operations.

### Deferred to C-S3 / C-S5

- View / relational / methodological / source handlers — C-S3.
- Real `MutationExecutor` wiring inside `applyProposal` — C-S5 when the
  frontend `TabeleAiEditorPanel` provides the apply button.
- Refinement endpoint `POST /tables/:id/ai-editor/refine/:proposalId` —
  C-S5 (frontend-driven; cap 3 refinements per session).
- ChatToSchema pipeline reuse for structure handler at apply time — C-S5
  (today the structure handler emits the operation envelope shape
  `MutationExecutor` already consumes).
