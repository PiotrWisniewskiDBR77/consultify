# 502 - broader Notes notebook capture upload authority continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

The active notebook upload CTA now prefers a governed V8-first capture seam instead of starting on the legacy notebook capture route.

Specifically:

- `server/src/routes/v8/my-work.routes.ts` now exposes `POST /api/v8/my-work/notebook/capture/upload`
- `src/services/api/v8/my-work.ts` now routes notebook capture upload through the V8 namespace
- `src/services/api.ts` now makes `Api.uploadNotebookFile()` V8-first, while keeping legacy fallback only for unsupported statuses

The success contract remains unchanged for the UI:

- capture returns a created `pageId`
- the client still resolves the created note through governed notebook page readback

## Why this is the right bounded packet

After the accepted bounded `T3` notes lane, the smallest active split-brain on the notebook surface was not all attachments or all outputs.

It was the fact that:

- notebook core CRUD already preferred governed V8 seams
- notebook convert already preferred governed V8 seams
- but the visible notebook upload CTA still initiated capture through the legacy notebook namespace before switching back to governed readback

That made capture upload authority continuity the thinner, more honest first broader-notes packet.

## Regression coverage

Added / extended focused proof for the real seam:

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

Targeted verification passed:

- `npm exec vitest run server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts tests/unit/services/v8-my-work-api.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts`

## Residual after this packet

This packet does not claim:

- broader notebook attachment browsing redesign,
- full object-linked outputs breadth closure,
- or wider notebook/output architecture cleanup.

Those remain inside the broader `Notes` lane for later bounded reassessment.
