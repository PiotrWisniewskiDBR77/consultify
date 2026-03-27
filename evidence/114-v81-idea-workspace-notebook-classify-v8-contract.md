# V8.1 Idea Workspace Notebook Classify V8 Contract

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

Notebook classify now follows the same V8-first contract shape as the rest of the
notebook page flow:

- `V8MyWorkApi.classifyNotebookPage()` added
- `POST /api/v8/my-work/notebook/pages/:id/classify` added
- `Api.classifyNotebookPage()` now attempts V8 first and falls back to legacy only on the
  guarded notebook fallback statuses

## Why this matters

The previous cleanup removed the raw component fetch, but classify was still outside the
V8-first notebook contract.

After this packet:

- notebook classify is no longer a one-off side lane
- transient V8 failures do not silently downgrade to legacy
- non-supported V8 statuses still preserve bounded fallback behavior

## Verification

Passed:

- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
