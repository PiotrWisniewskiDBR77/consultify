# Business Work Canvas Stage 43 - Visible Diff Preview

Status: `PASSED`
Date: 2026-05-03
Owner: Product + Engineering

## Purpose

Stage 43 makes proposal-first Canvas edits easier to trust. Users should not approve a document mutation from only a generic message. The preview must show a compact, readable summary of what Markdown lines will be removed and added.

## Completed Scope

- `CanvasDiffSummary` now supports `addedLineSamples` and `removedLineSamples`.
- Backend Canvas operation diffs include short added/removed Markdown line samples.
- The frontend operation preview renders the samples when available.
- The existing apply/reject approval path remains unchanged.
- Version snapshots and read-back behavior continue to use the existing Canvas operation runtime.
- Targeted frontend and backend tests cover the new diff sample contract.

## Safety Contract

- Diff samples are Markdown line samples, not native block JSON dumps.
- Preview does not mutate the draft.
- Apply still requires explicit user approval.
- Reject keeps the draft unchanged.
- The implementation does not introduce a second document format or a separate diff runtime.

## Quality Gate

Stage 43 passes because:

- operation preview still shows the existing diff summary,
- representative removed and added lines are visible when provided,
- backend responses expose the same sample fields,
- apply/reject behavior is unchanged,
- targeted validation passes.

Stage 43 would fail if:

- users had to approve edits without seeing concrete changed content,
- raw native block internals were exposed in the diff preview,
- diff preview became a hidden mutation path outside governed Canvas operations.
