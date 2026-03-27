# V8.1 Idea Workspace Notebook Upload Capture Seam

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

Notebook file upload now resolves through one shared capture seam on the live client path.

Changes:

- `Api.uploadNotebookFile()` now uses `notebookCaptureUpload()` and then resolves the
  created notebook page through the existing page contract
- legacy `/api/my-work/notebook/upload` no longer owns separate extraction/insert logic;
  it delegates to `notebookService.capture()` and preserves its historical response shape

## Why this matters

Previously there were two parallel upload authorities:

- `/api/my-work/notebook/upload`
- `/api/notebook/capture/upload`

After this packet, the live UI no longer chooses between them ad hoc, and the legacy
route is reduced to a compatibility shim instead of a second implementation.

## Verification

Passed:

- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

## Residual note

An additional heavy integration test was intentionally not kept because the available
My Work integration harness hit environment-level DB permission issues unrelated to this
packet. The bounded unit/client verification for the live seam remains green.
