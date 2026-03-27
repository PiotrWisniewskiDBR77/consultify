# V8.1 Multiplayer / Collaboration T2 Acceptance

Date: 2026-03-26
Lane: `Multiplayer / collaboration`
Taxonomy: `T2`
Tranche: `Tranche 2`
Decision: `accepted`

## Acceptance basis

The bounded active `T2` packet for `Multiplayer / collaboration` is accepted as complete.

Accepted closure points:

1. the governed multiplayer runtime bridge already exposes persisted workspace room binding, presence, and
   locks through `/api/v8/multiplayer`
2. the operator-facing `UnifiedSyncHub` already proves governed workspace presence and active-lock truth on
   the live V8 multiplayer read lane
3. the active `IdeaTableTool` workspace header now consumes the governed V8 bridge for visible presence
   indicators
4. the active `IdeaTableTool` workspace header now consumes the governed V8 bridge for visible lock
   indicators
5. broader websocket transport, heartbeat/write semantics, lock lifecycle mutations, and fine-grained
   collaborative editing cues were explicitly kept outside this bounded lane and are no longer treated as
   blockers for `T2` acceptance

## Evidence chain

- `docs/product/work-packets/T2_MULTIPLAYER_COLLABORATION_CHARTER.md`
- `evidence/164-v81-multiplayer-collaboration-split-brain-map.md`
- `evidence/165-v81-multiplayer-header-presence-v8-seam.md`
- `evidence/166-v81-multiplayer-lock-indicator-v8-seam.md`

## Verification basis

Passed:

- `tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx`
- `tests/components/MyWork/WorkspaceLockIndicator.v8.test.tsx`
- `tests/unit/services/v8-multiplayer-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run tests/components/MyWork/WorkspacePresenceIndicator.v8.test.tsx tests/components/MyWork/WorkspaceLockIndicator.v8.test.tsx tests/unit/services/v8-multiplayer-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx --maxWorkers=1 --maxConcurrency=2`

Result: `12` tests passing.

## Residual note

Deeper realtime transport parity, live lock mutation lifecycle, cell-level governed editing cues, and
broader collaborative workflow semantics still remain in the repository, but they are broader parity work,
not absence of a working bounded V8-first multiplayer collaboration lane in the current closure program.
