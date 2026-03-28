# 495 - broader Multiplayer table realtime status visibility seam

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: landed

## What changed

The active `IdeaTableTool` collaboration toolbar now exposes live table realtime runtime status instead of staying visually silent until remote presence appears.

When the table-platform socket is:

- still joining, the toolbar shows `Realtime connecting`
- disconnected after an active attempt, the toolbar shows `Realtime degraded` plus `Single-user mode`

This keeps the active table usable, but makes the collaboration runtime state honest on the visible table surface.

## Why this is the next honest bounded packet

After the first broader multiplayer packet landed degraded-state visibility on the richer websocket overlay surfaces, the next smaller user-facing seam was the active table collaboration path:

- `useTableRealtime` already tracked connection truth,
- `IdeaTableTool` already rendered collaboration indicators,
- but the user saw nothing about connection state unless remote presence rows happened to exist.

That made visible collaboration runtime truth thinner than a broader reconnect or transport rewrite.

## Regression coverage

Added `tests/components/MyWork/TableRealtimeStatusIndicator.test.tsx` to verify the real status indicator across:

- connecting,
- degraded,
- idle/connected hidden states.

## Residual after this packet

This packet does not claim:

- reconnect orchestration redesign,
- transport migration,
- or broader co-editing semantics.

Those remain inside the broader `Multiplayer / collaboration` lane for the next bounded reassessment.
