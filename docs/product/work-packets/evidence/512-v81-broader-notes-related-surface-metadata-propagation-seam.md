# 512 - Broader Notes - related surface metadata propagation seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## Why this packet existed

The active notebook editor already surfaced upload provenance and converted-output truth, but nearby notebook readback surfaces still flattened those notes back to title-plus-snippet only.

That left a broader output-propagation split-brain:

- `NotebookContent` knew whether a note came from an uploaded file and whether it had already produced outputs,
- but `Task`, `Decision`, and `Initiative` note suggestion/readback cards did not carry that same notebook truth forward,
- so adjacent product surfaces still behaved like notebook metadata stopped at the editor boundary.

This packet closes that wider propagation seam across nearby related-note surfaces.

## What landed

- `src/components/MyWork/notebook/NotebookMetadataBadges.tsx` now provides one shared renderer for notebook upload-source and converted-output badges.
- `src/components/MyWork/TaskDetailView.tsx` now shows notebook metadata badges on both suggested-note cards and related-note readback rows.
- `src/components/MyWork/DecisionDetailView.tsx` now carries notebook capture/output metadata into the related-notes strip instead of collapsing entries to title-only buttons.
- `src/components/InitiativeDetailModal.tsx` now shows the same notebook metadata badges on suggested-note cards.

## Regression coverage

Targeted verification passed:

- `tests/components/MyWork/notebookMetadataBadges.test.tsx`

This regression proves the shared renderer surfaces both upload provenance and converted-output summaries together instead of regressing back to empty or title-only note cards.

## Explicitly not claimed

This packet does not claim:

- full notebook attachment management,
- source-file download actions outside the notebook editor,
- or broader notebook output propagation across every distant module surface in the app.
