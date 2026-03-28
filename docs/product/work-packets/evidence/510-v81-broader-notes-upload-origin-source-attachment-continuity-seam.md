# 510 - Broader Notes - upload-origin source attachment continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## Why this packet existed

After `507`, upload-origin notebook pages showed filename provenance, but the original uploaded file still disappeared from the live notebook experience after ingestion.

That left a real attachment-breadth split-brain:

- upload-origin notes visibly claimed a source file,
- but the active note had no governed way to retrieve that source artifact,
- and the broader attachment residual would have stayed fuzzy unless the first honest attachment seam was closed.

This packet closes only that thinner seam for upload-origin notes.

## What landed

- `server/src/services/notebookSourceFileService.ts` now persists the original uploaded notebook source file under a dedicated notebook-source upload directory, resolves stored files for download, and strips internal storage keys from public capture metadata.
- `server/src/services/notebookService.ts` now stores upload-origin source-file continuity at ingestion time once the final notebook page id exists.
- `server/src/routes/v8/my-work.routes.ts` and `server/src/routes/my-work.routes.ts` now expose authenticated `GET /notebook/pages/:id/source-file` download routes for accessible upload-origin notes.
- `src/services/api.ts` now provides a V8-first `downloadNotebookSourceFile()` helper with legacy fallback only for non-supported notebook statuses.
- `src/components/MyWork/NotebookContent.tsx` now exposes a live "download source" action on the active note header when the upload-origin source file is actually stored.
- `src/types/myWork.ts` and `src/services/api/v8/my-work.ts` now model stored-source-file notebook metadata explicitly.

## Regression coverage

Targeted verification passed:

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

The route regression also proves that internal storage keys stay server-only while the authenticated V8 download path still returns the original file content.

## Explicitly not claimed

This packet does not claim:

- arbitrary multi-file notebook attachments,
- notebook attachment create/delete/edit lifecycle beyond the original upload source file,
- attachment galleries across notebook list/context surfaces,
- or wider notebook-origin output propagation beyond the source-file seam.
