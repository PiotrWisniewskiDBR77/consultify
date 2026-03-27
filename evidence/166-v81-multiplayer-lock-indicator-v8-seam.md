# V8.1 Multiplayer Lock Indicator V8 Seam

Date: 2026-03-26
Lane: `Multiplayer / collaboration`
Taxonomy: `T2`
Status: `active`

## Goal

Move one visible workspace tool lock indicator slice onto the governed V8 multiplayer read bridge so the
active `IdeaTableTool` surface no longer relies only on bespoke or implicit edit cues for visible lock
awareness.

## What changed

1. Governed workspace lock indicator
   - extended `src/components/MyWork/table/CollaborationPresence.tsx`
   - added `WorkspaceLockIndicator`, which resolves the governed workspace room through
     `V8MultiplayerApi.getRoomBinding('workspace', workspaceId)` and reads active locks through
     `V8MultiplayerApi.getRoomLocks(roomId)`
   - the indicator filters self-held and expired locks, then renders a bounded header-level lock count plus
     scope chips for the first active governed locks

2. Active workspace header wiring
   - updated `src/components/MyWork/IdeaTableTool.tsx`
   - added the governed lock indicator next to the governed workspace presence indicator on the live table
     header surface
   - kept the packet scoped to read-only lock visibility; no acquire/release mutation path was broadened

3. Regression coverage
   - added `tests/components/MyWork/WorkspaceLockIndicator.v8.test.tsx`
   - re-ran `tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx`
   - re-ran existing governed multiplayer bridge coverage in
     `tests/unit/services/v8-multiplayer-api.test.ts` and
     `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the second active user-facing multiplayer split-brain slice on the same workspace surface:

- the workspace header now has governed V8-first visibility for both active presence and active locks
- lock awareness is now driven by the same persisted V8 room truth already proven on the operator path
- the bounded lane no longer depends on broader websocket or bespoke helper parity to show visible
  collaboration state on one real workspace tool surface

## Verification

Passed:

- `tests/components/MyWork/WorkspaceLockIndicator.v8.test.tsx`
- `tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx`
- `tests/unit/services/v8-multiplayer-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx tests/components/MyWork/WorkspaceLockIndicator.v8.test.tsx tests/unit/services/v8-multiplayer-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx --maxWorkers=1 --maxConcurrency=2`

Result: `12` tests passing.

## Residual note

Broader realtime transport, heartbeat/write semantics, lock lifecycle mutations, and legacy `CellCursor`
editing cues still exist in the repository, but they are broader collaboration parity work rather than
absence of a bounded governed V8-first collaboration indicator lane on the active workspace header surface.
