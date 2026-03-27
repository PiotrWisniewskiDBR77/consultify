# V8.1 Notes Convert V8 Seam

Date: 2026-03-26
Lane: `Notes` adjuncts
Taxonomy: `T3`
Status: `active`

## Goal

Move the visible notebook convert workflow onto a governed V8-first seam so the active notebook surface no
longer depends only on the legacy notebook convert route.

## What changed

1. Backend V8 parity
   - added shared `server/src/services/notebookConversionService.ts`
   - extended `server/src/routes/v8/my-work.routes.ts`
   - added governed notebook convert continuity under:
     - `POST /api/v8/my-work/notebook/pages/:id/convert`
   - the new V8 route delegates to the shared notebook convert service rather than re-implementing the
     convert behavior inside the route

2. Frontend V8-first notebook adjunct continuity
   - extended `src/services/api/v8/my-work.ts`
   - updated `src/services/api.ts`
   - `Api.convertNotebookPage()` now prefers the governed V8 notebook namespace first and only falls back
     for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
   - extended `tests/unit/services/v8-my-work-api.test.ts`
   - extended `tests/unit/services/api-my-work-notebook-fallback.test.ts`

## Why this matters

This closes the second bounded notes-adjunct split-brain slice on the live notebook surface:

- the visible convert workflow now has a governed V8-first route and client seam instead of a legacy-only
  path
- the packet stays bounded to convert continuity without reopening notebook core CRUD or broad notebook
  upload/attachment breadth
- the active notes-adjunct lane now has both AI proposals and convert continuity on the governed notebook
  path

## Verification

Passed:

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts tests/unit/services/v8-my-work-api.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts`

Result: `32` tests passing.

## Residual note

Residual notebook upload/attachment breadth still exists in the repository, but it is now broader parity
work rather than absence of a governed V8-first path for the bounded visible notes-adjunct workflows.
