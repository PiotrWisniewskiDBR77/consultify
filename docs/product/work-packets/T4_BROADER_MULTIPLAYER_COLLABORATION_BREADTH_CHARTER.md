# T4 Charter - broader `Multiplayer / collaboration` breadth

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: broader `Multiplayer / collaboration` breadth
> Taxonomy: `T4`
> Priority: high
> Last updated: 2026-03-28

---

## 1. Goal

Promote the broader `Multiplayer / collaboration` residual from visible backlog into active execution and close the remaining split-brain between the accepted bounded `T2` header-indicator lane and a coherent broader realtime collaboration experience on active workspace surfaces.

The accepted `T2` lane deliberately stopped after governed workspace header presence and lock visibility landed on `IdeaTableTool`. It explicitly left realtime degraded-state visibility, transport/runtime continuity, and broader co-editing semantics outside that bounded scope.

---

## 2. In scope

- broader realtime / collaboration breadth on live workspace surfaces
- residual split-brain mapping across governed V8 collaboration truth, bespoke websocket clients, and visible collaboration overlays
- bounded packets chosen only after the remaining active collaboration residual stays explicit
- focused regression coverage for any promoted broader multiplayer packet
- evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- reopening the accepted bounded `T2` header presence / lock indicator packets
- pretending full websocket transport migration or full co-editing semantics can be closed in one packet
- broad room lifecycle redesign or platform-gateway architecture work
- Notes, Sync, Partner, or other already accepted/bounded non-multiplayer lanes

---

## 4. First bounded packet

### Packet name

`multiplayer degraded-state visibility seam`

### Why this packet starts first

- the active collaboration overlay already claims to "gracefully fall back to single-user mode" but, on disconnect, it silently disappears instead of showing the user what happened
- the architecture docs already call out degraded-state visibility as part of the expected realtime behavior, so this is a real user-facing seam rather than a speculative polish tweak
- it closes one visible collaboration runtime seam without smuggling full websocket transport or co-editing mutation parity into the same packet

### Packet scope

- surface explicit degraded realtime status on one active collaboration overlay
- keep the active workspace usable in single-user mode when realtime is unavailable
- add focused regression for degraded-state visibility
- keep transport redesign, reconnect orchestration, and full collaborative editing semantics outside this packet

---

## 5. Lane acceptance target

This broader lane is not done after one degraded-state packet.

The lane will be accepted only when:

1. the remaining broader `Multiplayer / collaboration` residuals are broken into honest bounded packets,
2. those packets land with real runtime and visible surface continuity,
3. no smaller real packet remains,
4. and the lane can be accepted without silently broadening into a full realtime platform rewrite.
