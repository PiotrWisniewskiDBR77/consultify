# 505 - broader Notes notebook output-menu persistence continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

Notebook outputs created from the row-level notebook `ConvertToOutputMenu` now persist back onto the source notebook page as durable `convertedTo` readback instead of existing only as a transient materialized-session success path.

Specifically:

- `ConvertToOutputMenu` now appends the created output back to the source notebook page after a successful notebook-origin conversion
- the shared notebook API now exposes `appendNotebookConvertedOutput()` to merge and dedupe persisted `convertedTo` entries
- both legacy and V8 notebook page update routes now accept `convertedTo` writes and persist them to `converted_to_json`

## Why this is the right bounded packet

After notebook capture upload authority continuity and direct notebook output readback continuity were landed, the next visible split-brain on the same notebook surface was narrower than attachment breadth or broader artifact propagation:

- active-note convert flow already persisted notebook `convertedTo`,
- notebook context readback now honored persisted direct outputs,
- but row-level notebook output creation through `ConvertToOutputMenu` still created outputs without durable notebook readback continuity after refresh.

That made notebook output-menu persistence continuity the next honest packet inside the active broader-notes lane.

## Regression coverage

Added or extended focused regression coverage for the real code paths involved:

- `tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

Targeted verification passed:

- `npx vitest run tests/unit/services/api-my-work-notebook-fallback.test.ts tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

## Residual after this packet

This packet does not claim:

- full notebook attachment breadth closure,
- notebook-origin output propagation across every remaining surface,
- or broader artifact-registry redesign for every tool-session-backed output path.

Those remain inside the broader `Notes` lane for the next bounded reassessment.
