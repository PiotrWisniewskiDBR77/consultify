# 507 - broader Notes upload source readback continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

Notebook pages created from uploaded files now retain and surface their upload provenance on live notebook surfaces instead of dropping that source metadata after extraction.

Specifically:

- notebook capture now persists `fileOriginalname` and `fileMimetype` into notebook `capture_metadata`
- legacy and V8 notebook read contracts now return `captureSource` and parsed `captureMetadata`
- live notebook list rows and the active note header now show a compact upload-source badge for notebook pages created from uploaded files

## Why this is the right bounded packet

After notebook upload authority continuity landed, users could create notes from files but the visible notebook surfaces still lost the provenance of that uploaded source.

That was a thinner, more honest seam than broader attachment management:

- upload ingestion already worked,
- notebook read/write continuity already existed,
- but upload-origin notebook truth was not visible after readback.

## Regression coverage

Focused regression coverage was added for the production paths involved:

- `tests/unit/components/MyWork/notebookCaptureSourceSummary.test.ts`
- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

Targeted verification passed:

- `npx vitest run tests/unit/components/MyWork/notebookCaptureSourceSummary.test.ts tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

## Residual after this packet

This packet does not claim:

- notebook attachment storage and lifecycle management,
- broader attachment browsing/deletion on notebook surfaces,
- or full provenance redesign for every non-upload capture source.

Those remain inside the broader `Notes` lane.
