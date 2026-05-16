# C-S5 Validation Matrix — Executed

**Date:** 2026-05-08
**Sprint:** C-S5 — AI Editor + QA Frontend
**Status:** PASS (14 / 14 new + 2 / 2 regression)

## Test inventory

### TabeleQaPanel

| # | Description                                                          | Result |
|---|----------------------------------------------------------------------|--------|
| 1 | Renders QaHealthBar + axis cards + suggestions for an initial report | PASS   |
| 2 | "Recompute" triggers `recomputeQaReport(tableId, 'on_demand')`       | PASS   |
| 3 | Optimistically removes a dismissed suggestion                        | PASS   |
| 4 | "Open in AI Editor" forwards the suggestion to the parent callback   | PASS   |
| 5 | Empty-suggestions state renders the "great shape" banner             | PASS   |

### TabeleAiEditorPanel

| # | Description                                                | Result |
|---|------------------------------------------------------------|--------|
| 1 | Renders all 8 level cards                                  | PASS   |
| 2 | Methodological + source disabled for non-super-admin       | PASS   |
| 3 | "Propose" calls `proposeAiEdit(tableId, {level, prompt})`  | PASS   |
| 4 | Apply success clears the active proposal + clears prompt   | PASS   |
| 5 | Reject calls `rejectAiProposal` and hides the diff card    | PASS   |

### useTabeleRightRailPanels

| # | Description                                                | Result |
|---|------------------------------------------------------------|--------|
| 1 | No panels when tableId is missing                          | PASS   |
| 2 | No panels when both kill switches are off (default)        | PASS   |
| 3 | Both panels render with forced enable + tableId+ws         | PASS   |
| 4 | AI Editor omitted when workspaceId is missing              | PASS   |

### Regression

| # | Description                                                 | Result |
|---|-------------------------------------------------------------|--------|
| 1 | Legacy `KimiWorkspaceShell` mounts when MELS flag is OFF    | PASS   |
| 2 | `TabeleMelsView` mounts when MELS flag is ON                | PASS   |

## Coverage notes

- **Menu 3 placement:** verified by composition — the new panels are
  rendered ONLY through `<TabeleMelsView>`'s `rightRailPanels` slot, no
  parallel toolbars or canvas widgets exist.
- **Optimistic dismissal lifecycle:** test #3 of `TabeleQaPanel`
  asserts the suggestion disappears synchronously and the API call
  fires with the expected fingerprint argument.
- **Cross-panel handoff:** `useTabeleRightRailPanels` test #3 verifies
  both panels render together. The QA → AI Editor preset path is
  unit-tested via the level / prompt / context propagation through
  `TabeleAiEditorPanel`'s `initialLevel` / `initialPrompt`
  / `initialContext` props.
- **Kill switch defense in depth:** tests #1, #2, #4 cover all branches
  of `useTabeleRightRailPanels` — no panel renders unless both the
  flag is on AND the tableId/workspaceId are populated.
- **DBR77 monochrome:** confirmed via grep for `#[0-9a-fA-F]{3,8}` in
  the new components — zero matches.
- **Lint:** 0 errors across all 11 new + 2 modified files.

## Out of scope (NOT validated here)

- E2E HTTP path through the route layer — owned by C-S7 closeout.
- Visual review (Anygravity P0 trial #2) — owned by D-S5.
- Full PL i18n — filed as `TBL-FU-C5-1`.
- Programmatic right-rail tool switching — filed as `TBL-FU-C5-2`.
- Backend `/ai-editor/proposals/:id` fetch endpoint for ops preview —
  filed as `TBL-FU-C5-3`.
