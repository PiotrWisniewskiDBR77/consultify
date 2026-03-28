# 514 - broader Notes live notebook attachment management seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## Problem

The broader-notes lane had already preserved the original upload-origin source file, but the active notebook surface still had no honest attachment-management lifecycle beyond that single source-file seam.

Users could not:

- add durable secondary attachments to a live notebook page,
- read back the current attachment set on the same notebook surface,
- remove obsolete notebook attachments,
- or download notebook attachments through the governed V8-first notebook contract.

That left wider notebook attachment management as the thinnest honest residual still inside the active broader-notes lane.

## What landed

This packet closes that residual on the active notebook surface by adding a bounded but real notebook attachment lifecycle:

- added durable notebook attachment persistence and file resolution in `server/src/services/notebookAttachmentService.ts`
- added `attachments_json` persistence on `notebook_pages` in `server/migrations/20260328_notebook_attachments.sql`
- exposed governed V8 and compatibility legacy routes for notebook attachment upload, download, and delete in:
  - `server/src/routes/v8/my-work.routes.ts`
  - `server/src/routes/my-work.routes.ts`
- extended notebook page readback so attachments are returned as public notebook metadata instead of hidden storage keys
- added V8-first shared API seams for notebook attachment upload, download, and delete in:
  - `src/services/api.ts`
  - `src/services/api/v8/my-work.ts`
- surfaced live notebook attachment management on the active notebook page through:
  - `src/components/MyWork/notebook/NotebookAttachmentsSection.tsx`
  - `src/components/MyWork/NotebookContent.tsx`

## Why this is the right bounded packet

This is larger than another badge/readback micro-fix, but still bounded:

- it stays on the active notebook page rather than widening into every remote note-consumer surface,
- it closes real runtime continuity for add/read/download/delete instead of only metadata display,
- and it does not claim a full notebook files platform or artifact-registry redesign.

## Regression coverage

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
  - added V8 route coverage for attachment upload, authenticated download, and delete
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
  - added V8-first fallback discipline coverage for notebook attachment upload, download, and delete

## Verification

- `npx vitest run "server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts"`
- `npx vitest run "tests/unit/services/api-my-work-notebook-fallback.test.ts"`
- `ReadLints` on touched backend/frontend files returned no diagnostics
- repository-wide `npx tsc --noEmit --pretty false` still reports pre-existing errors outside this packet in:
  - `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`

## Explicit non-claim

This packet does not claim:

- full cross-surface propagation of notebook attachments outside the active note surface,
- a generalized notebook files/workspace redesign,
- or materially wider distant output propagation across every downstream note consumer.
