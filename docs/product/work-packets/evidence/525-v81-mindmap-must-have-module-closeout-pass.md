# 525 - V8.1 Mind map must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Mind map` Packet 6 - `Mindmap Interaction Grammar Freeze`

## Problem before closeout

- Inline node growth actions were not fully honest: some node buttons emitted `mm_*` add actions while the map listener only handled canonical `add_*` actions.
- Shortcut truth drifted from UI truth:
  - sibling creation was shown as `Enter` in parts of the UI,
  - the actual shortcut was `Shift+Enter`,
  - the keyboard hook could still swallow keys even when no handler existed.
- `Cmd/Ctrl+K` had two owners on the same surface:
  - global workspace command palette,
  - mindmap command palette.
- Connect mode had weaker exit clarity than select/pan and could leave users in a mode with no explicit return gesture except other controls.

## What landed

### 1. Canonical node quick-action grammar

- Added `mindmapInteractionGrammar.ts` as a small SSOT for mindmap interaction normalization.
- Normalized `mm_add_child` / `mm_add_sibling` into the canonical node quick-action names handled by the map runtime.
- This closes the trust gap where inline `+` affordances could visually exist but not follow the same runtime contract.

### 2. Honest shortcuts and help

- Updated sibling-create labels from `Enter` to `Shift+Enter` in:
  - `IdeaRecommendationMap`
  - `FloatingNodeToolbar`
- `useKeyboardShortcuts` now only intercepts keys that actually have handlers on the current surface.
- Added filtered shortcut help so the map help modal shows only shortcuts that are truly wired for this workspace.

### 3. Single `Cmd/Ctrl+K` owner on mindmap

- Global workspace `CommandPalette` is now disabled while the active tool is `mindmap`.
- This leaves the mindmap-specific command palette as the only `Cmd/Ctrl+K` owner on that surface.

### 4. Clearer connect-mode exit

- Clicking the canvas pane while in `connect` now returns the interaction mode to `select`.
- The connect button in the left toolbar now acts as an explicit exit when already connecting.

## Automated verification

Passed:

- `npx vitest run tests/unit/mindmap/canvasLeftToolbar.test.tsx tests/unit/mindmap/mindmapInteractionGrammar.test.ts tests/unit/components/MyWork/useKeyboardShortcuts.test.tsx`
- `npx vitest run tests/unit/components/MyWork/ideaWorkspaceState.test.ts tests/components/MyWork/IdeasMindMap.redirect.test.tsx tests/components/MyWork/ideaEntryTypes.test.ts`

New / expanded coverage:

- `tests/unit/mindmap/mindmapInteractionGrammar.test.ts`
  - canonical normalization for `mm_add_child` / `mm_add_sibling`
  - connect button toggles back to select when already active
- `tests/unit/components/MyWork/useKeyboardShortcuts.test.tsx`
  - only wired shortcuts are shown
  - `Enter` is no longer swallowed when no open handler exists
- `tests/unit/mindmap/canvasLeftToolbar.test.tsx`
  - connect button now works as an explicit mode exit

## Manual acceptance checklist

- Open a mindmap and click inline `+` on a selected branch node and idea node.
- Confirm both child and sibling growth actions work without relying on the floating toolbar.
- Open shortcut help with `?` and confirm only actually wired map shortcuts are listed.
- Confirm sibling creation is described as `Shift+Enter`, not `Enter`.
- Press `Cmd/Ctrl+K` on the mindmap and confirm only one palette opens.
- Enter connect mode, then click empty canvas and confirm the mode returns to select.
- Enter connect mode again and click the connect button itself; confirm it exits to select.

## Residual risk

- This pass closes the highest-value grammar/trust seams, but it does not yet redesign the deeper visual density of the mindmap surface.
- There is still more potential work in the broader Packet 6 scope around calmer editing, overlay reduction, and longer uninterrupted branch-building ergonomics.
- Full repo `type-check` still reports pre-existing unrelated failures outside this packet:
  - `src/components/Landing/EpicHeroSection.tsx`
  - `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`

## Status

- `Mind map` Packet 6 is materially closer to must-have acceptance.
- Current closure status at time of write: code landed, targeted tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
