# 508 - broader Notes direct assessment output readback continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

The notebook linked outputs surface now reads back direct `assessment` outputs created from the same note instead of ignoring them while only resolving report/presentation outputs.

Specifically:

- added assessment-origin direct output resolution for notebook `convertedTo` entries
- `NotebookContextPanel` now merges direct assessment outputs with direct report/presentation outputs and initiative-derived outputs
- `mywork-open-item` handling now opens assessments from notebook linked outputs using the same deep-link flow as other artifact types

## Why this is the right bounded packet

After the direct notebook output readback seam landed, one smaller real gap still remained inside the same surface:

- notebook conversion already supported `assessment`,
- persisted `convertedTo` already recorded `assessment`,
- but the notebook linked outputs surface still only resolved direct `report` and `presentation` outputs.

That made direct assessment output readback continuity more honest than jumping immediately to broader attachment breadth.

## Regression coverage

Focused regression coverage was extended for the real linked-output surface:

- `tests/components/MyWork/NotebookContextPanel.outputs.test.tsx`

Targeted verification passed:

- `npx vitest run tests/components/MyWork/NotebookContextPanel.outputs.test.tsx tests/unit/components/MyWork/notebookCaptureSourceSummary.test.ts tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

## Residual after this packet

This packet does not claim:

- notebook attachment breadth,
- full notebook-origin output propagation across every remaining surface,
- or a wider redesign of the outputs library taxonomy.

Those remain inside the broader `Notes` lane for the next reassessment.
