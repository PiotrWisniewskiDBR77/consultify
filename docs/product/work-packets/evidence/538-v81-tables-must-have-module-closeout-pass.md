# 538 - V8.1 Tables must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Tabele` must-have closure for the current wave

## Scope truth

- `Tabele` already had broad capability across:
  - schema
  - views
  - row editing
  - realtime indicators
  - metadata-first platform bridge
  - legacy graph persistence fallback
- The key must-have gap was not feature breadth.
- The key gap was operator truth:
  - load failure could still look like an empty table
  - locked mode could still look like a broken editor instead of intentional read-only

## Problem before closeout

- Legacy table hydration in `useTablePersistence` only emitted `toast.error`, then cleared rows/edges/extensions.
- The shell could therefore leave the user in an empty table state that looked like “there is no data.”
- The platform bridge already tracked `error`, but `IdeaTableTool` did not surface that state as an honest user-facing recovery path.
- `locked` mode disabled actions, but did not clearly explain that the table was intentionally read-only.

## What landed

### 1. One visible load-failure contract for table shell

- `src/components/MyWork/table/useTablePersistence.ts`
  - now stores `loadError`
  - exposes `refresh`
  - clears the load error on retry

- `src/components/MyWork/table/useTablePlatformIntegration.ts`
  - now exposes bridge `error` to the shell

- `src/components/MyWork/IdeaTableTool.tsx`
  - now resolves one effective load error across legacy/platform modes
  - renders a visible retryable `EmptyStateInline` when data fails to load
  - explicitly tells the user this does not mean the table is empty

### 2. Explicit read-only contract

- `src/components/MyWork/IdeaTableTool.tsx`
  - now shows a visible read-only banner when `locked`
  - makes it explicit that review is available but editing and saving are disabled

## Automated verification

Passed:

- `npx vitest run tests/components/MyWork/IdeaTableTool.honesty.test.tsx tests/components/MyWork/TableRealtimeStatusIndicator.test.tsx`

Coverage includes:

- table shell shows a visible retryable load error instead of an empty state
- retry action calls refresh
- table shell shows an explicit read-only banner in locked mode
- existing realtime degraded-state indicator tests remain green

## Manual acceptance checklist

- Open `Tabele` on a disposable idea and confirm normal load still works.
- Simulate hydrate/platform load failure and confirm the module shows:
  - a visible unavailable state
  - retry action
  - wording that does not imply the table is empty
- Open the same surface in `locked` mode and confirm the module clearly states it is read-only.
- Confirm disabled actions in locked mode now feel intentional rather than broken.

## Residual risk

- This closeout does not claim that every advanced table sub-surface is fully productized.
- It closes the main shell honesty gap shared by both the legacy and metadata-first runtime paths.
- Wider table breadth such as deeper interface/form/distribution governance remains outside this must-have shell pass.

## Status

- `Tabele` no longer hide load failures behind an empty table shell.
- `Tabele` no longer hide read-only authority behind silent disabled controls.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
