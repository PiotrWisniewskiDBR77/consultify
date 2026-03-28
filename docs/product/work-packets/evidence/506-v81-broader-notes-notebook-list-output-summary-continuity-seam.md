# 506 - broader Notes notebook list output summary continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

The notebook list now summarizes multiple persisted converted outputs instead of only showing the first `convertedTo` entry on a notebook row.

Specifically:

- notebook rows now derive a compact converted-output summary from the persisted `convertedTo` payload
- the row badge shows up to two distinct converted output types plus `+N` for additional types
- repeated converted targets are deduped in first-seen order before rendering

## Why this is the right bounded packet

After notebook output-menu persistence continuity landed, the active notebook list still flattened multi-output notebook truth into a single-type badge.

That left a smaller live-surface split-brain than attachment breadth:

- notebook pages could now persist multiple converted outputs,
- notebook context readback could surface multiple linked outputs,
- but the list row summary still only showed `convertedTo[0]`.

Closing the list-row summary seam was therefore still an honest bounded packet inside the active broader-notes lane.

## Regression coverage

Added focused coverage for the real production summarizer used by the notebook list:

- `tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts`

Targeted verification passed:

- `npx vitest run tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

## Residual after this packet

This packet does not claim:

- full notebook attachment breadth,
- complete notebook-origin output propagation across every remaining surface,
- or broader artifact-registry redesign for non-notebook-origin object-linked outputs.

Those remain inside the broader `Notes` lane for the next bounded reassessment.
