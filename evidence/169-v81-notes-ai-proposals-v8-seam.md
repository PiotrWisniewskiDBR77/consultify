# V8.1 Notes AI Proposals V8 Seam

Date: 2026-03-26
Lane: `Notes` adjuncts
Taxonomy: `T3`
Status: `active`

## Goal

Move the visible notebook AI proposal review workflow onto a governed V8-first seam so the active
`NotebookContent` surface no longer depends only on legacy notebook AI proposal routes.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/my-work.routes.ts`
   - added governed notebook AI proposal routes under:
     - `POST /api/v8/my-work/notebook/pages/:id/ai-proposals`
     - `GET /api/v8/my-work/notebook/pages/:id/ai-proposals`
     - `POST /api/v8/my-work/notebook/ai-proposals/:proposalId/resolve`
   - each V8 route delegates to the existing `notebookService` proposal logic instead of duplicating proposal behavior

2. Frontend V8-first notebook adjunct continuity
   - extended `src/services/api/v8/my-work.ts`
   - updated `src/services/api.ts`
   - `Api.notebookCreateAIProposal()`, `Api.notebookGetAIProposals()`, and
     `Api.notebookResolveAIProposal()` now prefer the governed V8 notebook namespace first and only fall
     back for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
   - extended `tests/unit/services/v8-my-work-api.test.ts`
   - extended `tests/unit/services/api-my-work-notebook-fallback.test.ts`

## Why this matters

This closes the first active notes-adjunct split-brain slice on the live notebook surface:

- the visible AI proposal strip in `NotebookContent` now sits on the governed notebook namespace instead of
  the legacy notebook proposal routes
- the packet stays bounded to proposal list/create/resolve continuity without reopening notebook core CRUD
- the next notes adjunct packet can focus on notebook convert breadth instead of proposal review truth

## Verification

Passed:

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts tests/unit/services/v8-my-work-api.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts --maxWorkers=1 --maxConcurrency=2`

Result: `28` tests passing.

## Residual note

`Notes` adjuncts are not yet ready for bounded `T3` acceptance after this packet alone. Notebook AI proposal
continuity is now governed, but notebook convert breadth and any remaining upload/attachment adjunct drift
still remain outside the governed V8-first path.
