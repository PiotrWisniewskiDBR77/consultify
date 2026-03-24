# WP-W1-MP-01 — Multiplayer Platform Baseline Analysis

> Packet: WP-W1-MP-01
> Wave: 1 — Platform and governance spine
> Track: A — Platform and runtime foundations / D — Collaboration and shared work
> Status: completed
> Owner: Product + Engineering
> Scope: normalized multiplayer platform vocabulary and historical seam reuse map

---

## 1. Canonical room model

### 1.1 Room identity

A `CollaborationRoom` is the atomic unit of shared realtime state in Consultify.

| Property | Definition |
|---|---|
| `room_id` | Platform-generated unique identifier (UUID). |
| `resource_type` | The artifact family the room is bound to (e.g. `workspace`, `notebook`, `report`, `presentation`, `table`, `tool_session`, `interview`). |
| `resource_id` | The specific artifact instance this room serves. |
| `org_id` | Tenant scope — rooms never cross organization boundaries. |
| `room_state` | Lifecycle state: `active`, `idle`, `closed`, `error`. |
| `created_at` | Timestamp of room creation. |
| `closed_at` | Timestamp of room closure (nullable). |

Key rule from canonical docs:

`room identity must be resource-aware but not module-owned`

This means the room model belongs to the shared multiplayer platform layer, not to any individual module. Modules bind to rooms through resource references, but the room lifecycle, membership, and event semantics are platform-governed.

### 1.2 Resource binding

One room binds to exactly one resource instance. The binding is:

- **1:1** — one artifact instance has at most one active room at a time.
- **Resource-typed** — the room knows which artifact family it serves, enabling adapter dispatch.
- **Scope-inherited** — the room inherits organizational and project scope from the bound resource.

Sub-resource anchoring (e.g. a specific node, cell, slide, or block) is not a separate room. It is handled through event payloads and comment/review anchor references within the room.

### 1.3 Lifecycle

| Transition | Trigger | Behavior |
|---|---|---|
| `(none) → active` | First participant joins or requests collaboration on a resource. | Room is created, membership tracking begins. |
| `active → idle` | All participants disconnect and stale-cleanup window elapses. | Room remains addressable but stops broadcasting. |
| `idle → active` | A participant reconnects or a new participant joins. | Room resumes broadcasting. |
| `active → closed` | Explicit close by owner/admin, or resource deletion. | Room becomes read-only for audit; no new joins. |
| `active → error` | Gateway detects unrecoverable state (e.g. split-brain, persistence failure). | Room enters degraded mode; support diagnostics triggered. |

### 1.4 Ownership

Room ownership follows the permission model of the bound resource:

- The resource owner is the implicit room owner.
- Room ownership does not create a separate permission hierarchy — it inherits from the artifact's existing role and scope policy.
- Platform-level operations (force-close, diagnostics, audit inspection) are reserved for operator/support roles.

---

## 2. Presence model

### 2.1 Presence types

The canonical presence model defines typed presence states per room member:

| Presence type | Meaning |
|---|---|
| `viewer` | User has the room open but is not actively editing. |
| `editor` | User is actively editing the bound resource. |
| `facilitator` | User holds the facilitator role in a workshop/session context (Wave 4 concern, but the type must be reserved now). |
| `observer` | User has read-only access and is watching. |
| `ai_agent` | An AI actor is operating within the room (personal or shared proposal context). |

Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.1 explicitly requires `viewer`, `editor`, `facilitator`, `observer` as role-aware presence states.

### 2.2 Presence payload

Each presence record carries:

| Field | Description |
|---|---|
| `user_id` | Authenticated user identity. |
| `room_id` | Room this presence belongs to. |
| `presence_type` | One of the types above. |
| `cursor_state` | Optional — cursor position, viewport, or focus region (ephemeral). |
| `last_heartbeat` | Timestamp of last heartbeat received. |
| `connected_at` | Timestamp of initial connection to this room. |
| `client_id` | Disambiguates multiple tabs/devices for the same user. |

### 2.3 Heartbeat

- Clients send periodic heartbeat signals to the gateway.
- Recommended interval: configurable, platform-default (e.g. 10–30 seconds).
- Heartbeat carries: `client_id`, `room_id`, `timestamp`, optional `cursor_state` update.

### 2.4 Stale cleanup

- If no heartbeat is received within the stale threshold (e.g. 2× heartbeat interval), the presence is marked `stale`.
- Stale presence is removed from the active collaborator list after a cleanup grace period.
- Stale cleanup fires a `presence.stale_removed` event so other participants see the departure.
- The cleanup must be server-side to prevent ghost presence from crashed clients.

### 2.5 Reconnect behavior

- On reconnect, the client re-authenticates and re-joins the room.
- If the room is still `active`, the client receives current room state (member list, recent events).
- If the client had pending local changes, conflict-aware resume applies (artifact-family-specific adapter responsibility).
- Presence is restored without requiring other participants to take action.

Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.5 explicitly requires reconnect semantics, pending local changes handling, stale-presence recovery, and conflict-aware resume.

---

## 3. Realtime gateway and event vocabulary

### 3.1 Gateway semantics

The canonical architecture requires one realtime gateway, not per-module socket paths.

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §7.1:

`Backend should converge toward one collaboration gateway, one presence service, one event bus for collaboration events, one adapter layer per resource family`

The gateway is responsible for:

- WebSocket connection management (connect, disconnect, reconnect).
- Room join/leave orchestration.
- Heartbeat processing.
- Event fan-out to room members.
- Adapter dispatch to resource-family-specific handlers.

The gateway must support multiple artifact families without changing its core semantics for each one.

### 3.2 Event vocabulary

The platform defines a canonical set of event types. All events carry: `event_id`, `room_id`, `actor_id`, `actor_type` (human | ai), `timestamp`, `event_type`, `payload`.

#### Room lifecycle events

| Event type | Semantics |
|---|---|
| `room.created` | Room instantiated for a resource. |
| `room.closed` | Room closed (explicit or resource deletion). |
| `room.error` | Room entered error state. |

#### Membership events

| Event type | Semantics |
|---|---|
| `member.joined` | A participant joined the room. |
| `member.left` | A participant left the room (explicit or stale cleanup). |
| `presence.updated` | A participant's presence type or cursor state changed. |
| `presence.stale_removed` | A stale presence was cleaned up server-side. |

#### Collaboration events

| Event type | Semantics |
|---|---|
| `edit.started` | A participant began editing a region/object. |
| `edit.committed` | An edit was persisted to shared state. |
| `edit.conflict` | A concurrent edit conflict was detected (adapter-specific resolution). |
| `lock.acquired` | A selective lock was taken on a sub-resource (where applicable). |
| `lock.released` | A selective lock was released. |

#### Awareness events

| Event type | Semantics |
|---|---|
| `cursor.moved` | Ephemeral cursor/viewport update. |
| `selection.changed` | Ephemeral selection region update. |
| `typing.indicator` | Ephemeral typing signal. |

#### System events

| Event type | Semantics |
|---|---|
| `connection.degraded` | Gateway detects connectivity issues for a participant. |
| `connection.restored` | Connectivity restored after degradation. |
| `sync.behind` | Client state is behind server state (needs catch-up). |

### 3.3 Delivery guarantees

- **Ephemeral events** (cursor, selection, typing): best-effort, no persistence. Dropped events are acceptable.
- **Durable events** (room lifecycle, membership, edit commits): at-least-once delivery with idempotency keys. These events are persisted to the collaboration event stream.
- **Ordering**: events within a single room are ordered by server-assigned sequence number. Cross-room ordering is not guaranteed.

### 3.4 Fan-out

- Events are broadcast to all active members of the room except the originator (for ephemeral events) or including the originator (for durable events, as confirmation).
- The gateway must not leak events across rooms or across organization boundaries.

---

## 4. Authorization path

### 4.1 Who can join

Room join authorization inherits from the bound resource's permission model:

| Permission level on resource | Room access |
|---|---|
| `owner` / `admin` | Full room access; can edit, comment, facilitate. |
| `editor` | Can join as `editor` or `viewer`. |
| `commenter` | Can join as `viewer`; can post comments but not edit. |
| `viewer` | Can join as `viewer` or `observer` only. |
| `no access` | Cannot join the room. |

Source: `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §7.3 explicitly states permissions must be checked for joining a room, posting presence, commenting, editing, starting facilitation, casting votes, restoring a version, and approving an AI change.

### 4.2 Role projection into rooms

The platform does not create a parallel permission system for rooms. Instead:

- The user's effective role on the resource (resolved through organization role, project role, and artifact-level sharing) is projected into the room as the user's maximum allowed presence type.
- Role changes on the resource propagate to the room in near-realtime (e.g. if a user's edit access is revoked, their presence type downgrades or they are removed).

### 4.3 Permission inheritance

- Rooms inherit scope from: `organization → project → artifact → sub-artifact`.
- The multiplayer platform does not override or extend this hierarchy — it consumes it.
- AI actors in rooms are subject to the same permission model: an AI agent operating in a room must have an explicit permission context (which user authorized it, what scope it operates in).

Source: `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4 defines the visibility lifecycle `private work → reviewable share → team-visible artifact → published output → governed archive`. The room authorization path must respect which stage the artifact is in.

---

## 5. Degraded-state model

### 5.1 Outage behavior

When the realtime gateway or presence service is unavailable:

| Scenario | Behavior |
|---|---|
| Gateway down | Users can continue working in single-user mode. Edits are saved locally or through standard REST persistence. Collaboration features (presence, live cursors, realtime events) are unavailable. |
| Presence service down | Users can still edit, but presence avatars and "who is here" indicators are absent. The system must display a clear degraded-state banner. |
| Event bus down | Edits persist through the standard save path, but realtime fan-out stops. Users may see stale state until the bus recovers. |

### 5.2 Reconnect

- On reconnect after outage, the client must:
  1. Re-authenticate.
  2. Re-join the room.
  3. Receive a state catch-up (current member list, missed durable events since last known sequence number).
  4. Reconcile any local pending changes with current server state (adapter-specific).

### 5.3 Partial presence

- If some participants are connected and others are not, the room remains `active`.
- Disconnected participants are cleaned up through the stale-presence mechanism.
- The system must never show a user as present when they are actually disconnected.

### 5.4 Support visibility

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.9 and `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.11:

Support and operator surfaces must be able to inspect:

- Room health (active, idle, error).
- Active collaborators per room.
- Stale presence incidents.
- Socket/reconnect failure counts.
- Event lag (time between event emission and delivery).
- Degraded-state duration and frequency.

These diagnostics are part of the platform baseline, not a later hardening concern.

### 5.5 Frontend degraded-state signals

Users must see consistent states (from `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §8.2):

- `connection degraded` — banner indicating realtime features are temporarily unavailable.
- `unsynced local changes` — indicator that local edits have not yet been confirmed by the server.
- `reconnecting…` — transient state during reconnect attempts.

---

## 6. Historical seam reuse map

### 6.1 Source seams

The following V4 historical seams are identified in the canonical docs as inputs to the shared platform:

| V4 Seam | Origin | Description |
|---|---|---|
| `realtime_channels` | V4-ENT-06 | Partial realtime channel infrastructure for WebSocket communication. |
| `realtime_presence` | V4-ENT-06 | Partial presence tracking per channel. |
| `collab_sessions` | V4-IDEA-02 | Collaboration session objects with WebSocket auth and shared session state. |
| `collab_session_events` | V4-IDEA-02 | Event records within collaboration sessions. |
| `crdt_documents` | V4-IDEA-03 | CRDT document storage direction (out of scope for this packet but noted for completeness). |
| `crdt_updates` | V4-IDEA-03 | CRDT update records (out of scope for this packet). |
| `tool_facilitation_sessions` | V4-TOOL-04 | Facilitation sessions with votes, roles, outcomes (out of scope — Wave 4). |
| `tool_facilitation_votes` | V4-TOOL-04 | Vote collection in facilitation (out of scope — Wave 4). |
| `tool_facilitation_roles` | V4-TOOL-04 | Facilitator/participant/observer roles (out of scope — Wave 4). |
| `tool_facilitation_outcomes` | V4-TOOL-04 | Exportable workshop outcomes (out of scope — Wave 4). |
| `tool_session_presence` | V4-TOOL-05 | Tool-session presence and edit locks. |
| `deck_collab_sessions` | V4-DECK-06 | Deck/presentation collaboration sessions. |

### 6.2 Reuse, normalize, or discard decisions

| V4 Seam | Decision | Rationale |
|---|---|---|
| `realtime_channels` | **Normalize → platform gateway** | The channel concept maps directly to the `CollaborationRoom` + gateway model. Channel creation, subscription, and teardown logic should be absorbed into the platform room lifecycle. Module-specific channel naming conventions must be replaced with the canonical `resource_type:resource_id` room identity. |
| `realtime_presence` | **Normalize → platform presence service** | Presence tracking logic should be extracted from any module-local usage and consolidated into the shared presence model with typed presence states, heartbeat, and stale cleanup. Any module-specific presence fields become adapter-level extensions, not core presence properties. |
| `collab_sessions` | **Normalize → CollaborationRoom + RoomMembership** | The `collab_sessions` concept is semantically equivalent to the `CollaborationRoom` with its membership tracking. Session creation, auth, and state management should be absorbed. The WebSocket auth path from V4-IDEA-02 should be reused as the basis for the platform gateway auth. |
| `collab_session_events` | **Normalize → platform event vocabulary** | Session events should be mapped to the canonical event types defined in §3.2. Any module-specific event types that don't map to the canonical vocabulary become adapter-level events, not platform events. |
| `tool_session_presence` | **Normalize → platform presence (adapter extension)** | Tool-session presence should use the shared presence model. Edit locks from V4-TOOL-05 map to the `lock.acquired` / `lock.released` event types in the platform vocabulary. |
| `deck_collab_sessions` | **Normalize → CollaborationRoom (presentation adapter)** | Deck collaboration sessions should not remain a separate collaboration model. They should become a `CollaborationRoom` bound to `resource_type: presentation` with a presentation-specific adapter. |
| `crdt_documents`, `crdt_updates` | **Preserve for Wave 2** | These are version/replay spine concerns. They should not be discarded but are explicitly out of scope for this baseline packet. |
| `tool_facilitation_*` | **Preserve for Wave 4** | Facilitation seams should not be discarded. They are strong inputs for the facilitation runtime in Wave 4. The platform baseline must reserve the `facilitator` presence type to ensure forward compatibility. |

### 6.3 Normalization principle

From `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §2:

`these historical seams are inputs, not the final target architecture`

The normalization rule is:

- **Reuse**: implementation patterns, auth flows, and infrastructure where they align with the platform target.
- **Normalize**: naming, identity, lifecycle, and event semantics into the canonical platform vocabulary.
- **Discard**: module-local ownership assumptions, divergent naming conventions, and any patterns that would prevent platform convergence.

---

## 7. Downstream dependency map

The following later waves and packets depend on the platform baseline established by this packet:

| Dependent wave/packet | Dependency on this baseline |
|---|---|
| **Wave 2 — Version, replay and audit spine** | Requires the room model and event vocabulary to build durable collaboration history. Event stream persistence from this baseline is the foundation for version snapshots and replay. |
| **Wave 3 — Idea Workspace multiplayer baseline** | Requires room-per-workspace, shared presence, and the realtime gateway to deliver multi-user workspace behavior. |
| **Wave 4 — Whiteboard and workshop facilitation** | Requires the presence model (with reserved `facilitator` type) and room model. Facilitation runtime builds on top of the room lifecycle. |
| **Wave 5 — Mind Map and Process Flow collaboration** | Requires room model, presence, and event vocabulary for per-node/per-edge collaboration. |
| **Wave 6 — Table collaboration** | Requires room model and event vocabulary for row/cell/view-level collaboration. Lock semantics from this baseline are especially critical. |
| **Wave 7 — Notebook collaboration** | Requires room model and presence for controlled co-editing. |
| **Wave 8 — Reports and Presentations collaboration** | Requires room model for section/slide-anchored review and co-editing. |
| **Wave 9 — Tools, Interview, structured review** | Requires room model and presence for session-based collaboration. |
| **Wave 10 — Notifications, policy, support, observability** | Requires the event vocabulary and room diagnostics from this baseline to build notification fan-out and collaboration observability. |
| **AI multiplayer safety (cross-cutting)** | Requires the room model and event vocabulary to bind AI proposals to shared object state versions and to distinguish personal AI draft from team-visible AI proposal. Source: `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4. |
| **Canvas OS Stage 6** | `CANVAS_OS_CONTRACT_FREEZE.md` Stage 6 requires "collaboration, review, and replay are durably persisted" — this depends directly on the room model and event persistence from this baseline. |

---

## 8. Open questions and conflicts

### 8.1 No conflicts detected between canonical docs

After reading all four canonical docs and three supporting anchors, no direct contradictions were found. The documents are layered consistently:

- `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` defines the doctrine and capability families.
- `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` defines the structural changes required.
- `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` defines the rollout sequence.
- `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` defines the AI visibility lifecycle that the room model must respect.
- `CANVAS_OS_CONTRACT_FREEZE.md` defines stage acceptance that aligns with the wave structure.

### 8.2 Open questions requiring attention

| # | Question | Context |
|---|---|---|
| 1 | **Heartbeat interval and stale threshold**: The canonical docs require heartbeat and stale cleanup but do not specify concrete intervals. These are implementation decisions, but they should be declared in a platform configuration contract before Wave 1 implementation begins. | `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.1 |
| 2 | **AI actor presence semantics**: The docs require AI authorship to be explicit and AI proposals to bind to state versions, but the exact presence model for AI actors in rooms (do they appear in the collaborator list? with what avatar? with what presence type?) is not fully specified. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8, `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4 |
| 3 | **Multi-tab / multi-device presence**: The docs do not explicitly address whether the same user on multiple tabs/devices should appear as one presence or multiple. This packet proposes `client_id` disambiguation, but the UX decision (show one avatar or many?) needs product confirmation. | Implied by presence model requirements |
| 4 | **Room idle-to-closed timeout**: The lifecycle defines `idle` and `closed` states but does not specify how long a room should remain `idle` before automatic closure. This affects resource cleanup and support diagnostics. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.1 |
| 5 | **Ephemeral vs durable event boundary for edit operations**: The docs clearly separate ephemeral awareness from durable collaboration truth (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §6.3), but the exact boundary for edit operations (e.g. is every keystroke durable, or only committed saves?) will vary by artifact family adapter. The platform should define a contract for adapters to declare this boundary. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §6.3 |

### 8.3 Items not requiring escalation

The following items are noted but do not require escalation because they are explicitly deferred to later waves per the canonical rollout program:

- CRDT vs OT strategy per artifact family (Wave 2+, adapter-level).
- Facilitation role semantics (Wave 4).
- Comment and review anchor model (Wave 2–3, builds on room baseline).
- Notification fan-out (Wave 10).

---

## 9. Packet output

- **Status**: completed
- **Completed**:
  - Canonical room model with identity, resource binding, lifecycle, and ownership
  - Presence model with types, heartbeat, stale cleanup, and reconnect behavior
  - Realtime gateway semantics and full event vocabulary with delivery guarantees
  - Authorization path with role projection and permission inheritance
  - Degraded-state model with outage behavior, reconnect, partial presence, and support visibility
  - Historical seam reuse map (V4 → platform target) with reuse/normalize/discard decisions for all in-scope seams
  - Downstream dependency map covering all 10 subsequent waves plus AI safety and Canvas OS
- **Remaining**: none within packet scope
- **Blockers or risks**:
  - Heartbeat/stale-cleanup intervals need platform configuration contract before implementation
  - AI actor presence UX needs product decision before Wave 1 implementation
  - Multi-tab presence display needs product confirmation
- **Questions requiring escalation**:
  - AI actor presence semantics in rooms (question #2 above) — needs product + AI core alignment
  - Multi-tab/multi-device presence display policy (question #3 above) — needs product UX decision
