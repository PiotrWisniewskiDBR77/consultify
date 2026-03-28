# 524 - V8.1 Idea Workspace must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Idea Workspace` Packet 5 - `Workspace Entry And Shell Coherence`

## Problem before closeout

- `Idea Workspace` behaved like one shared hub state instead of one state per open idea tab.
- Switching from idea A to idea B could momentarily reuse the previous idea's active canvas, panel state, or selection context.
- The shell relied on scattered cues for "where am I now?" instead of one clear active-canvas signal inside the workspace itself.
- The next useful action was implied across multiple surfaces instead of being stated plainly in the workspace.

## What landed

### 1. Per-idea continuity in `MyWorkHub`

- Added `ideaWorkspaceState.ts` as the minimal SSOT for per-idea workspace state in the hub.
- `MyWorkHub` now caches workspace state by idea id instead of treating active tool/panel/selection as one global idea state.
- Draft-to-real-id promotion now migrates cached state, so a freshly created idea does not lose its workspace context after save.
- Closing an idea tab now clears only that idea's cached workspace state.

### 2. Honest active-canvas clarity in `IdeaMapWorkspace`

- Added a persistent in-workspace header showing:
  - workspace identity,
  - current canvas label in user language,
  - draft/save state,
  - one explicit next-step hint.
- Reused the same human-readable canvas label mapping across toolbar, focus mode, and hub chat context.
- Removed developer-ish raw tool names from the focus indicator.

### 3. Stronger next-step guidance

- Added one direct next-step line that adapts to:
  - current selection,
  - current active panel,
  - current active canvas.
- This gives users one obvious move without hunting through Tools, Context, AI Suggestions, and canvas chrome.

## Automated verification

Passed:

- `npx vitest run tests/unit/components/MyWork/ideaWorkspaceState.test.ts tests/components/MyWork/IdeasMindMap.redirect.test.tsx tests/components/MyWork/ideaEntryTypes.test.ts`

New test coverage:

- `tests/unit/components/MyWork/ideaWorkspaceState.test.ts`
  - default state for new idea drafts,
  - per-idea patching without cross-tab bleed,
  - draft id -> real id state migration,
  - state cleanup on tab close.

Existing idea guardrails still green:

- `tests/components/MyWork/IdeasMindMap.redirect.test.tsx`
- `tests/components/MyWork/ideaEntryTypes.test.ts`

## Manual acceptance checklist

- Open idea A, switch canvas, open a side panel, then open idea B.
- Confirm idea B opens with its own canvas state instead of reusing idea A state.
- Go back to idea A and confirm its previous canvas/panel context is preserved.
- Open a new idea draft, save it so it gets a real id, and confirm the workspace state survives the id swap.
- Confirm the workspace header always shows:
  - idea title,
  - active canvas label,
  - save status,
  - one clear next action.
- Toggle focus mode and confirm the focus label uses the human canvas name, not raw ids like `mindmap` or `process_flow`.

## Residual risk

- This pass closes the highest-value shell/trust seams, but it does not yet redesign the deeper multi-canvas interaction grammar from Packet 6.
- Full end-to-end component coverage for the real `MyWorkHub` + `IdeaMapWorkspace` integration is still thinner than in the notebook lane.
- Full repo `type-check` still reports pre-existing unrelated failures outside this packet:
  - `src/components/Landing/EpicHeroSection.tsx`
  - `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`

## Status

- `Idea Workspace` Packet 5 is materially closer to must-have acceptance.
- Current closure status: code landed, targeted tests green, manual acceptance still required.
