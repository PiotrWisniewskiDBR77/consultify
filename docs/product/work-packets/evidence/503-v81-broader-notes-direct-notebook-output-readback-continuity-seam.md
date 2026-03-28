# 503 - broader Notes direct notebook output readback continuity seam

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: landed

## What changed

The active notebook context surface now reads back direct outputs created from the same note instead of only showing outputs discovered through initiative backlinks.

Specifically:

- `NotebookContextPanel` now accepts the active note's `convertedTo` payload
- direct notebook-origin report/presentation outputs are resolved into the same linked outputs section
- the linked outputs surface now merges:
  - direct outputs converted from the active note,
  - outputs linked through initiative backlinks

## Why this is the right bounded packet

After the first broader-notes packet moved notebook capture upload onto a governed V8-first seam, the next thinner visible notes/output split-brain was on the same active notebook surface:

- notebook convert continuity had already landed earlier,
- notebook pages already kept `convertedTo` readback,
- but the visible notebook context panel still ignored those direct outputs and only surfaced initiative-derived outputs.

That made direct notebook output readback continuity smaller and more honest than a broader artifact-registry redesign or full attachment/output breadth push.

## Regression coverage

Extended `tests/components/MyWork/NotebookContextPanel.outputs.test.tsx` to verify that the real linked outputs surface now renders a direct converted notebook output and opens the correct target.

Targeted verification passed:

- `npm exec vitest run tests/components/MyWork/NotebookContextPanel.outputs.test.tsx`

## Residual after this packet

This packet does not claim:

- broader notebook-origin outputs readback for every materialized tool-session path,
- full notebook attachment breadth closure,
- or wider object-linked outputs propagation across every remaining surface.

Those remain inside the broader `Notes` lane for later bounded reassessment.
