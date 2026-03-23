# V8 Program — Wave 4 Decision Log

> Status: Closed
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 4 escalation items from packets WP-W4-COLLAB-01, WP-W4-COLLAB-02, WP-W4-COLLAB-03

---

## Multiplayer platform hardening

### Decision W4-1 — Standalone Whiteboard/Table outside Idea Workspace

- Target model must support both: embedded inside Idea Workspace and standalone resource with its own room binding.
- Wave 4 priority: first-class implementation inside Idea Workspace.
- Room model must not assume Idea-only existence.
- Rule: embedded surface → room bound to workspace artifact; standalone surface → room bound to standalone resource identity.

### Decision W4-2 — Facilitation pause/resume UX

- Live facilitation needs explicit `paused_degraded` semantics.
- Short transient disconnect → no auto-pause yet.
- Facilitator disconnect or serious room degradation beyond grace window → session enters paused state; timer stops; votes and phase state preserved; explicit resume required.
- Participants see: session paused, why it paused, whether to wait/refresh/rejoin.
- Rule: `no silent continuation of timed facilitation during degraded room control`.

---

## Workspace tool readiness

### Decision W4-3 — Notebook versioning scope

- Expand scope for at least operational versioning.
- V8 collaboration baseline requires: durable snapshots, compare/restore support, authorship/audit continuity.
- Does not require full rich publishing-grade version suite on day one.
- Rule: `collaboration without operational versioning is not acceptable`.

### Decision W4-4 — CRDT vs block-locking for Notebook

- Wave 4 commitment = block-locking first.
- Simpler, governable model first.
- CRDT for richer Notebook collaboration evaluated later.
- Rule: `governability and reviewability beat maximum editing sophistication in the first collaboration baseline`.

### Decision W4-5 — Cross-canvas presence aggregation

- Unified presence at Idea Workspace level, with active-surface detail.
- Default UX: who is present in the workspace + who is active on which canvas/surface.
- Not fully isolated per-canvas presence only.
- Rule: `one workspace presence story, surface-aware detail`.

### Decision W4-6 — Table room granularity

- Default room granularity = one room per table.
- View state is sub-context inside that room.
- Do not start with one room per base as the default concurrency unit.
- Base-level aggregation can exist later for overview/presence rollup.
- Rule: `table is the primary collaboration object, view is a filtered perspective`.

### Decision W4-7 — AI proposal visibility under collaboration

- AI proposals start as personal draft by default.
- Become room-visible only when explicitly shared/proposed into collaborative review.
- No immediate room-wide visibility by default.
- Rule: `personal AI draft → explicit shared AI proposal → team review`.

---

## Concurrent editing and notification

### Decision W4-8 — CRDT vs OT for rich text

- Does not block Wave 4 Notebook baseline (block-locking first).
- Richer rich-text concurrency model deferred.
- When revisited: choose the model that best preserves audit/review/governance semantics, not the most academically advanced.
- Rule: defer final CRDT vs OT choice beyond first Notebook collaboration slice.

### Decision W4-9 — Cross-resource notification aggregation

- Aggregation by context, not blind per-resource flood.
- Default doctrine: route over broadcast; aggregate related signals across connected resources where user benefits; preserve drill-down to per-resource detail.
- Example: one workspace or initiative notification cluster summarizes related room/thread/review activity.
- Rule: `aggregated awareness at high level, precise detail on entry`.

### Decision W4-10 — Table field-level LWW audit

- Silent LWW not acceptable for governance-sensitive columns.
- Governance-sensitive fields must use: explicit authority rule, review/manual resolution path, or blocking semantics where needed.
- Silent LWW acceptable only for low-risk, non-governance fields.
- Rule: `business-meaningful field conflicts must be visible and durable`.

---

## Accepted working assumptions

- One collaboration platform with surface-aware routing.
- Platform seam elimination remains mandatory.
- AI actors operate through proposals, not direct concurrent edits.
- Cursor sharing is a required baseline primitive.
- Different resource families need distinct concurrency strategies.
- Notification spine follows `routing over broadcast`.

## Additional guidance

- Shared `IdeaWorkspaceGraph` is a top-tier risk area — isolate as dedicated implementation concern.
- 30+ tool-specific events acceptable only if they inherit one shared event vocabulary and do not fragment the platform model.

---

## Wave 4 closure

Wave 4 is formally closed as of 2026-03-23 with 3 completed packets and 10 binding decisions.

---

## Related packets

- `WP-W4-COLLAB-01_MULTIPLAYER_PLATFORM_HARDENING.md`
- `WP-W4-COLLAB-02_WORKSPACE_TOOL_READINESS.md`
- `WP-W4-COLLAB-03_CONCURRENT_EDITING_NOTIFICATION.md`
