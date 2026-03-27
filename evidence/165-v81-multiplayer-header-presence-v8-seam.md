# V8.1 Multiplayer Header Presence V8 Seam

Date: 2026-03-26
Lane: `Multiplayer / collaboration`
Taxonomy: `T2`
Status: `active`

## Goal

Move one visible workspace tool header presence indicator onto the governed V8 multiplayer read bridge so
the active `IdeaTableTool` header no longer depends only on bespoke `Api.getIdeaPresence()` polling for
its visible collaboration indicator.

## What changed

1. Governed workspace indicator
   - extended `src/components/MyWork/table/CollaborationPresence.tsx`
   - added `WorkspacePresenceIndicator`, which resolves the governed workspace room via
     `V8MultiplayerApi.getRoomBinding('workspace', workspaceId)` and then reads persisted presence from
     `V8MultiplayerApi.getRoomPresence(roomId)`
   - the indicator deduplicates presence rows by user, filters stale rows and the current user, and renders
     a bounded header-level online indicator without claiming broader co-editing parity

2. Header wiring and flag discipline
   - updated `src/components/MyWork/IdeaTableTool.tsx`
   - replaced hardcoded `current-user` / `Me` header context with real `useAppStore` user and organization
     state
   - gated the new header indicator behind `useV8FeatureFlag('v8_multiplayer_enabled')`
   - kept legacy `CollaborationPresence` polling alive only as a compatibility path for existing
     `CellCursor` semantics, while suppressing its old header rendering when the governed indicator is on

3. Regression coverage
   - added `tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx`
   - confirmed existing governed multiplayer bridge coverage still passes in
     `tests/unit/services/v8-multiplayer-api.test.ts` and
     `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the first active user-facing multiplayer split-brain slice:

- the workspace header now has a governed V8-first collaboration presence indicator instead of relying only
  on bespoke idea-level polling
- the packet stays bounded to `UI-09` header presence and does not overclaim websocket or lock parity
- the next multiplayer packet can focus on lock indicators rather than reopening presence truth on the same
  header surface

## Verification

Passed:

- `tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx`
- `tests/unit/services/v8-multiplayer-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification commands:

- `npx vitest run tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx --maxWorkers=1 --maxConcurrency=2`
- `npx vitest run tests/unit/services/v8-multiplayer-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx --maxWorkers=1 --maxConcurrency=2`

Result: `10` tests passing.

## Residual note

`Multiplayer / collaboration` is not yet ready for bounded `T2` acceptance after this packet alone.
Governed workspace header presence is now in place, but visible lock indicators, heartbeat/write semantics,
and broader collaborative editing behavior still remain outside the governed V8-first path.
