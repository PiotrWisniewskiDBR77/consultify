# V8.1 Idea Workspace Notebook Classify Client Seam

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

`NotebookContent` no longer performs a raw authenticated `fetch` for note classification.

Instead:

- classification now goes through `Api.classifyNotebookPage()`
- auth/header handling is centralized with the rest of the notebook client contract

## Why this matters

This does not yet solve full notebook V8/legacy split-brain, but it removes one local
client bypass inside the live notebook UI.

That narrows the mixed-truth surface and makes the next runtime/client packet easier to
close without hunting for component-level ad hoc requests.

## Verification

Passed:

- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
