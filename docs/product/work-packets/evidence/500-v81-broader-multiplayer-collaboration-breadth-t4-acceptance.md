# 500 - broader Multiplayer collaboration breadth T4 acceptance

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Taxonomy: `T4`
Status: accepted

## Acceptance decision

`broader Multiplayer / collaboration` breadth is accepted as bounded `T4` complete.

## Why acceptance is justified

1. the lane broke the honest broader collaboration residual into bounded packets across the active websocket collaboration overlay, the active table realtime path, and the legacy polling collaboration indicator on the live table surface
2. those packets landed with real visible runtime continuity, including degraded-state visibility, table realtime status readback, legacy presence degraded readback, websocket overlay reconnect continuity, and table reconnect continuity
3. the post-runtime-visibility residual assessment in `evidence/497-v81-broader-multiplayer-post-runtime-visibility-residual-assessment.md` confirmed that one more tiny visibility/readback packet was no longer the honest next step, and the remaining asks are now broader runtime/transport semantics rather than another smaller surface seam
4. accepting the lane here does not pretend to solve a full realtime platform rewrite: websocket transport migration, broader co-editing semantics, and wider runtime orchestration remain separate work rather than hidden residue inside this bounded lane

## What this acceptance covers

- explicit degraded-state visibility on the active websocket collaboration overlay used by live workspace surfaces
- honest connecting/reconnecting/degraded readback on the active table collaboration runtime
- degraded readback on the legacy polling collaboration indicator when presence readback is unavailable
- reconnect continuity that clears stale remote overlay state after socket drop and distinguishes initial connection from reconnect

## Remaining residual

The remaining asks are no longer one more bounded broader-multiplayer packet.

Anything further now belongs to a separately promoted wider realtime/collaboration runtime lane, not to the accepted bounded `broader Multiplayer / collaboration` lane.
