# 493 - broader Multiplayer collaboration breadth split-brain map

Date: 2026-03-28
Lane: broader `Multiplayer / collaboration` breadth
Status: active

## Why a broader lane exists

The accepted bounded `T2` multiplayer lane closed one visible governed collaboration slice only:

- workspace header presence indicators,
- workspace header lock indicators.

That bounded acceptance intentionally left the broader realtime collaboration residual outside scope.

## Split-brain map

### 1. Runtime posture vs visible user feedback

- `src/components/MyWork/mindmap/CollaborationOverlay.tsx` already opens an authenticated websocket path and says it "gracefully falls back to single-user mode"
- but the live UI returns `null` when disconnected and no other users are present, so the user gets no explicit degraded-state readback
- the architecture docs (`WP-W1-MP-01_MULTIPLAYER_PLATFORM_BASELINE.md`, `WP-W4-COLLAB-01_MULTIPLAYER_PLATFORM_HARDENING.md`) expect visible degraded-state handling when realtime is unavailable

### 2. Governed V8 collaboration truth vs bespoke surface clients

- the accepted `T2` lane proved governed readback for room bindings, presence rows, and locks through `/api/v8/multiplayer`
- active workspace collaboration surfaces still rely on bespoke websocket clients and local reconnect logic for richer runtime behavior
- this means the broader lane is now about runtime continuity and user-visible collaboration state, not about reopening the old bounded header-indicator seam

### 3. Broader realtime semantics vs the smallest honest packet

- full websocket transport migration, heartbeat/write semantics, and fine-grained co-editing behavior remain larger residuals
- before touching any of that, the smallest honest user-facing seam is degraded-state visibility on the active collaboration overlay

## First bounded packet decision

Promote `multiplayer degraded-state visibility seam` first:

- show explicit degraded/single-user state on the active collaboration overlay,
- preserve the workspace as usable in single-user mode,
- leave reconnect orchestration and broader realtime semantics for later packets.
