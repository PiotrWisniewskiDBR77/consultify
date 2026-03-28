# 494 - broader Multiplayer degraded-state visibility seam

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: landed

## What changed

The active collaboration overlay no longer disappears silently when realtime is unavailable.

Instead, `src/components/MyWork/mindmap/CollaborationOverlay.tsx` now surfaces an explicit degraded-state pill that tells the user:

- realtime connection is degraded,
- the workspace is in single-user mode.

This keeps the existing "workspace remains usable" fallback, but makes the runtime state honest on the visible collaboration surface.

## Why this is the right bounded packet

The accepted bounded `T2` lane already closed header presence and lock visibility.

The smallest remaining visible broader multiplayer seam was not "all realtime transport" but the fact that the richer collaboration overlay still hid the degraded state entirely even though the runtime was already falling back to single-user behavior.

## Regression coverage

Added `tests/components/CollaborationOverlay.degraded-state.test.tsx` to verify that the real component renders the degraded-state messaging when realtime is not connected.

## Residual after this packet

This packet does not claim:

- full websocket transport migration,
- reconnect orchestration parity,
- or fine-grained co-editing semantics.

Those remain inside the broader `Multiplayer / collaboration` lane for later bounded reassessment.
