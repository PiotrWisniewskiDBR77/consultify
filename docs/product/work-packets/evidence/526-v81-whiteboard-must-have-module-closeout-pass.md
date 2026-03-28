# 526 - V8.1 Whiteboard must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Whiteboard` Phase C bounded closeout - `WB-1 interaction grammar`

## Problem before closeout

- `Whiteboard` had real capability, but the active mode contract was still too implicit.
- Users could switch between `board` and `draw`, but the surface did not explain clearly:
  - what is currently active,
  - what is temporarily locked,
  - how to exit draw mode safely,
  - which shortcuts are actually available on this surface.
- There was no small, trustworthy whiteboard-specific help slice that matched the real runtime.

## What landed

### 1. Whiteboard interaction grammar SSOT

- Added `src/components/MyWork/whiteboard/whiteboardInteractionGrammar.ts`.
- This helper now defines:
  - mode label,
  - toggle label,
  - mode helper copy,
  - explicit exit hint,
  - the minimal trusted whiteboard shortcut list.

### 2. Honest mode framing in `IdeaWhiteboardTool`

- `IdeaWhiteboardTool` now reads its mode copy from the SSOT instead of ad-hoc labels.
- The surface now shows:
  - clear active mode text,
  - explicit exit hint,
  - one short explanation of what the active mode does.
- Draw mode now explains that the board layer is temporarily locked to avoid accidental movement.
- Board mode now explains the normal editing contract and save behavior.

### 3. Whiteboard help that matches reality

- Added a bounded whiteboard help entry point in the toolbar.
- Added whiteboard-local keyboard help driven by the real shortcut list:
  - `?`
  - `Escape`
  - `Ctrl/Cmd+S`
- Added keyboard handling so:
  - `?` toggles the help,
  - `Escape` closes help first,
  - `Escape` also exits draw mode back to board mode.

## Automated verification

Passed:

- `npx vitest run tests/unit/mywork/whiteboardInteractionGrammar.test.ts tests/unit/mywork/whiteboardNodes.test.ts tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts`

New / expanded coverage:

- `tests/unit/mywork/whiteboardInteractionGrammar.test.ts`
  - draw mode has explicit exit semantics,
  - locked board mode is described honestly,
  - whiteboard help exposes only the trusted shortcut slice.

Existing whiteboard guardrails still green:

- `tests/unit/mywork/whiteboardNodes.test.ts`
- `tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts`

## Manual acceptance checklist

- Open an idea and switch to `Whiteboard`.
- Toggle from `board` to `draw` and confirm:
  - the active mode label changes,
  - the helper copy explains that board elements are temporarily locked,
  - the exit hint mentions `Esc` / `Canvas`.
- Press `Escape` in draw mode and confirm the board returns to `board` mode.
- Press `?` and confirm whiteboard help opens with only the small trusted shortcut set.
- Press `Escape` while help is open and confirm help closes before changing other state.
- In board mode, confirm the helper copy reflects normal element editing instead of drawing semantics.
- In locked mode, confirm the helper copy honestly says the board is read-only.

## Residual risk

- This pass closes the interaction grammar/trust seam, but it does not yet close the wider whiteboard program:
  - richer facilitation polish,
  - export truth,
  - multiplayer parity,
  - broader workshop narrative cleanup.
- Full repo `type-check` still reports pre-existing unrelated failures outside this packet:
  - `src/components/Landing/EpicHeroSection.tsx`
  - `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`

## Status

- `Whiteboard` now has a bounded must-have trust close for `WB-1 interaction grammar`.
- Current closure status: code landed, targeted tests green, manual acceptance still required.
