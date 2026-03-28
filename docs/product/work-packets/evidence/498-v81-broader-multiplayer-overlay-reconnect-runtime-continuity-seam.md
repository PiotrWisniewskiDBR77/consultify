# 498 - broader Multiplayer overlay reconnect runtime continuity seam

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: landed

## What changed

The active websocket collaboration overlay now distinguishes between:

- initial connection establishment,
- active connection,
- reconnect after a dropped session,
- terminal degraded single-user mode.

It also clears stale remote users and session state when the websocket closes, so the overlay no longer keeps showing old collaboration state while it is already trying to reconnect.

## Why this is the next honest bounded packet

After the broader multiplayer visibility slice was closed, the next thinner runtime seam was not full transport redesign but the active overlay's reconnect behavior:

- it already scheduled reconnects,
- but it did not expose reconnect state honestly,
- and it could keep stale remote session data alive after disconnect.

That made reconnect runtime continuity on the existing overlay smaller and more honest than a broader gateway/runtime rewrite.

## Regression coverage

Updated `tests/components/CollaborationOverlay.degraded-state.test.tsx` to verify:

- `Connecting collaboration` during the initial join,
- `Reconnecting collaboration` plus `Single-user mode` after the websocket drops.

## Residual after this packet

This packet does not claim:

- full transport migration,
- global reconnect orchestration across all collaboration surfaces,
- or full co-editing semantics.

Those remain inside the broader `Multiplayer / collaboration` lane for later bounded reassessment.
