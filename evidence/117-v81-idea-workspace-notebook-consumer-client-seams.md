# V8.1 Idea Workspace Notebook Consumer Client Seams

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

Remaining live notebook consumers were moved off direct route calls and onto shared
client seams.

Covered in this packet:

- `TaskDetailView` note suggestions now use `Api.getNotebookPages()`
- `InitiativeDetailModal` note suggestions now use `Api.getNotebookPages()`
- `ActionItemsPanel` action extraction now uses `Api.streamNotebookActionExtraction()`

## Why this matters

These surfaces previously kept their own direct `/api/my-work/notebook/*` behavior even
after the notebook client contract was already being normalized elsewhere.

This packet narrows the remaining live consumer drift:

- note suggestion surfaces now follow the shared notebook page client
- action extraction streaming now has one reusable client seam instead of a component-local
  transport implementation

## Verification

Passed:

- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
