# 499 - broader Multiplayer table reconnect runtime continuity seam

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: landed

## What changed

The active table collaboration runtime now distinguishes between:

- initial table realtime connect,
- connected,
- reconnecting after a dropped table socket,
- terminal degraded state.

`useTableRealtime` now keeps reconnect runtime truth separate from terminal failure, and the visible table status indicator reflects that with:

- `Realtime connecting`
- `Realtime reconnecting`
- `Realtime degraded`

## Why this is the next honest bounded packet

After overlay reconnect continuity landed, the next thinner active collaboration runtime seam was the table platform socket path:

- the hook already tracked connection lifecycle,
- but it collapsed reconnect attempts and terminal failure into the same `degraded` state,
- so the visible toolbar could not tell the user whether recovery was still in progress.

This made table reconnect runtime continuity smaller and more honest than a broader transport redesign.

## Regression coverage

Extended `tests/components/MyWork/TableRealtimeStatusIndicator.test.tsx` to verify the real status indicator now exposes the reconnecting state with `Recovery in progress`.

## Residual after this packet

This packet does not claim:

- global reconnect orchestration across all collaboration surfaces,
- transport migration,
- or co-editing mutation semantics.

Those remain inside the broader `Multiplayer / collaboration` lane for later bounded reassessment.
