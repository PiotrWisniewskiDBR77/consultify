# TBL-FU-C5-2 — Programmatic right-rail active-tool control

**Filed during:** C-S5 (Block C · AI Operator frontend)
**Priority:** P2
**Owner:** Frontend (shared shell)
**Status:** OPEN

## Context

`<TabeleQaPanel>` exposes an `onOpenInAiEditor(suggestion)` callback.
C-S5's `useTabeleRightRailPanels` connector hook records the suggestion
as a "preset" (level + prompt + context) and forces a key-bumped
remount of `<TabeleAiEditorPanel>` with the prefilled props.

What's still missing: the right-rail panel that's actually active
remains the QA Report panel until the user clicks the AI Editor icon.
The handoff therefore costs the user one extra click + a quick mental
check ("did the AI Editor pick up my preset?").

## Scope

Add a controlled `activeRightRailToolId` prop pair (`controlled value`
+ `onChange`) to `<ExecutiveModuleShell>` and `<RightRail>` so the
caller can drive the active tool from outside.

Then, in `useTabeleRightRailPanels`, when a preset is recorded, call
`setActiveTool('ai-editor')` so the AI Editor opens automatically.

## Acceptance criteria

- `<ExecutiveModuleShell>` accepts an optional
  `activeRightRailToolId` prop. When supplied, the shell becomes
  controlled; when omitted, it stays uncontrolled (current behaviour).
- `<TabeleMelsView>` exposes the same prop and forwards it.
- `useTabeleRightRailPanels` returns
  `{ rightRailPanels, activeToolId, setActiveTool }` so callers can
  drive the active tool.
- QA → AI Editor handoff opens the editor in zero clicks.
- Tests: a `<TabeleMelsView>` test asserts that supplying
  `activeRightRailToolId="qa-report"` opens the QA panel without a
  click.

## Why this is a follow-up, not part of C-S5

`<ExecutiveModuleShell>` is shared across Tabele / Wordy / Excele /
Prezentacje. Making it dual-mode (controlled / uncontrolled) is a
program-wide UI change that deserves its own review and visual
regression pass. The C-S5 ship-blockers (panels, API, tests) are all
landed; this is purely UX polish.

## Effort estimate

~0.5 day for the controlled prop pair + 1 hour for the QA → AI Editor
hookup.
