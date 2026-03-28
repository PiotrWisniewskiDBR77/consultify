# 496 - broader Multiplayer legacy presence degraded readback seam

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: landed

## What changed

The legacy/polling collaboration presence path on `IdeaTableTool` no longer fails silently.

When `CollaborationPresence` cannot read the legacy presence feed, it now renders explicit degraded readback:

- `Presence degraded`

instead of disappearing entirely and leaving the user with no explanation.

## Why this is the next honest bounded packet

After broader multiplayer added degraded-state visibility on websocket overlay surfaces and honest table-platform realtime status on the active table toolbar, the next thinner visible seam was still on the same table collaboration surface:

- the legacy polling presence path remained active when governed V8 collaboration indicators were not the visible path
- that path still swallowed fetch failures silently and removed all readback

This made degraded readback on the existing polling indicator smaller and more honest than a broader reconnect or transport redesign.

## Regression coverage

Added `tests/components/MyWork/CollaborationPresence.degraded.test.tsx` to verify that the real legacy collaboration presence component surfaces degraded readback when the presence poll fails.

## Residual after this packet

This packet does not claim:

- reconnect orchestration parity,
- transport migration,
- or co-editing mutation semantics.

Those remain inside the broader `Multiplayer / collaboration` lane for the next bounded reassessment.
