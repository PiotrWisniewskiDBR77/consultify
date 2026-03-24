# WP-W4-COLLAB-01 — Multiplayer Platform Hardening Analysis

> Packet: WP-W4-COLLAB-01
> Wave: 4 — Collaboration and workspace hardening
> Track: D — Collaboration and shared work
> Status: completed
> Owner: Product + Engineering
> Scope: analysis of how the Wave 1 multiplayer platform baseline (rooms, presence, events, version/replay) must be hardened and applied across the five workspace tools so that collaboration becomes a real platform capability rather than module-specific seams
> Depends on: WP-W1-MP-01 (room/presence/event baseline), WP-W1-MP-02 (version/replay/audit spine), Decision Log Wave 1 (Decisions 5-6)

---

## 1. Room model application per workspace tool

### 1.1 Platform baseline inherited

WP-W1-MP-01 §1 defines `CollaborationRoom` with: `room_id`, `resource_type`, `resource_id`, `org_id`, `room_state`, lifecycle transitions (`active → idle → closed → error`), and 1:1 resource binding. Sub-resource anchoring is handled through event payloads and anchor references within the room, not through separate rooms.

### 1.2 Per-tool room mapping

| Workspace tool | `resource_type` value | Resource identity | Room granularity | Notes |
|---|---|---|---|---|
| **Idea Workspace** | `workspace` | The workspace instance ID | One room per workspace instance | The workspace is the collaboration boundary. All four sub-surfaces (Mind Map, Whiteboard, Process Flow, Table) within one workspace share a single room. Sub-surface context is carried in event payloads via a `surface` field (e.g. `mindmap`, `whiteboard`, `process_flow`, `table`). |
| **Whiteboard** | `workspace` (when inside Idea Workspace) or `whiteboard` (standalone) | Workspace ID or standalone whiteboard ID | Inherits workspace room, or one room per standalone board | When Whiteboard is a sub-surface of Idea Workspace, it uses the workspace room. If standalone whiteboards exist outside a workspace context, they bind as `resource_type: whiteboard`. |
| **Mind Map / Process Flow** | `workspace` (when inside Idea Workspace) | Workspace ID | Inherits workspace room | Mind Map and Process Flow are always sub-surfaces of the Idea Workspace per current canon. They do not create independent rooms. |
| **Table** | `workspace` (when inside Idea Workspace) or `table` (standalone) | Workspace ID or standalone table ID | Inherits workspace room, or one room per standalone table | Same pattern as Whiteboard: workspace-embedded tables share the workspace room; standalone tables bind independently. |
| **Notebook** | `notebook` | Notebook instance ID | One room per notebook | Notebooks are independent artifacts. Each notebook gets its own room. |

### 1.3 Key hardening requirements

1. **Surface-aware event routing within workspace rooms**: The platform gateway must support event filtering by `surface` within a workspace room so that participants working on the Mind Map do not receive high-frequency ephemeral events from the Whiteboard and vice versa. Durable events remain room-wide.

2. **Room lifecycle alignment with workspace lifecycle**: When a workspace is archived or deleted, all associated rooms must transition to `closed`. The platform must enforce this through resource lifecycle hooks, not through module-specific cleanup code.

3. **Standalone vs embedded disambiguation**: The adapter layer must resolve whether a tool instance is workspace-embedded or standalone at room-join time. This determines `resource_type` and room identity. The resolution must be platform-governed (lookup against resource metadata), not hardcoded per module.

4. **Cross-surface presence visibility**: Within a workspace room, presence from all sub-surfaces must be aggregable into one workspace-level collaborator list, while also being filterable by current surface for in-context display.

---

## 2. Presence model hardening

### 2.1 Platform baseline inherited

WP-W1-MP-01 §2 defines five presence types: `viewer`, `editor`, `facilitator`, `observer`, `ai_agent`. Each presence record carries: `user_id`, `room_id`, `presence_type`, `cursor_state`, `last_heartbeat`, `connected_at`, `client_id`.

Decision 5: AI visible as `ai_agent` only when performing room-visible work.
Decision 6: One user = one avatar at top-level UX; `client_id` disambiguates tabs internally.

### 2.2 Per-tool presence semantics

| Workspace tool | Presence types used | Cursor state semantics | Tool-specific presence extensions |
|---|---|---|---|
| **Idea Workspace (container)** | `viewer`, `editor`, `observer`, `ai_agent` | Current surface indicator (`mindmap` / `whiteboard` / `process_flow` / `table`) | `active_surface` field in presence payload indicating which sub-surface the user is currently focused on. |
| **Whiteboard** | `viewer`, `editor`, `facilitator`, `observer`, `ai_agent` | Viewport position + pointer coordinates on the board canvas | `facilitator` becomes active during workshop sessions. Facilitator presence must be visually distinguished and must persist even if the facilitator navigates away briefly (grace window before downgrade). |
| **Mind Map / Process Flow** | `viewer`, `editor`, `observer`, `ai_agent` | Currently selected/focused node or edge ID | `focused_node_id` or `focused_edge_id` in cursor state. This enables "someone is looking at this node" indicators. |
| **Table** | `viewer`, `editor`, `observer`, `ai_agent` | Currently active cell reference (`row_id`, `field_id`) or active view ID | `active_cell` and `active_view` in cursor state. Enables per-cell "someone is editing here" indicators. |
| **Notebook** | `viewer`, `editor`, `observer`, `ai_agent` | Currently focused block ID and optional text cursor offset | `focused_block_id` and `cursor_offset` in cursor state. Enables block-level presence indicators. |

### 2.3 Hardening requirements

1. **Presence type transitions must be platform-enforced**: When a user switches from viewing to editing, the presence type change (`viewer → editor`) must go through the platform presence service with permission verification, not through client-side state alone. The platform must verify the user has edit permission before accepting the `editor` presence type.

2. **Facilitator exclusivity**: Within a workshop session on Whiteboard, only one user (or a declared set) may hold `facilitator` presence. The platform must enforce this constraint. Facilitator assignment and revocation are durable events (`facilitator.assigned`, `facilitator.revoked`), not ephemeral presence changes.

3. **Surface-scoped presence aggregation**: The workspace room must support two views of presence: (a) all collaborators across all surfaces, and (b) collaborators on the current surface. The platform presence service must support this filtering without requiring module-specific code.

4. **AI agent presence scoping**: Per Decision 5, an AI agent appears in presence only during room-visible work. For workspace rooms with multiple surfaces, the AI agent's presence must indicate which surface it is operating on (e.g. `ai_agent` on `mindmap` surface). Background AI work on other surfaces must not create presence.

5. **Stale cleanup per surface context**: If a user's heartbeat stops but they are still connected to the workspace room on a different surface, their presence on the original surface should be cleaned up, but their room membership should persist. This requires surface-aware stale detection, not just room-level stale detection.

---

## 3. Event vocabulary extension

### 3.1 Platform baseline inherited

WP-W1-MP-01 §3.2 defines the canonical event vocabulary across four categories: room lifecycle, membership, collaboration, awareness, and system events. WP-W1-MP-02 §1.2 adds version/audit events.

### 3.2 Tool-specific event extensions needed

The platform baseline vocabulary covers generic collaboration. The five workspace tools require additional event types that are not generic enough for the platform core but must follow the platform event envelope and delivery guarantees.

#### 3.2.1 Workspace-level events

| Event type | Semantics | Delivery | Rationale |
|---|---|---|---|
| `surface.switched` | A participant switched active surface within the workspace | Ephemeral | Drives cross-surface presence updates; no audit need. |
| `surface.content_linked` | A cross-surface reference was created (e.g. Mind Map node linked to Table row) | Durable | Cross-surface links are structural changes that affect workspace integrity. |

#### 3.2.2 Whiteboard-specific events

| Event type | Semantics | Delivery | Rationale |
|---|---|---|---|
| `board.object_created` | A board object (sticky, shape, connector, frame) was added | Durable | Structural change to shared canvas state. |
| `board.object_moved` | A board object was repositioned | Durable (debounced) | Position is part of shared state, but high-frequency moves during drag should be debounced before persistence. |
| `board.object_deleted` | A board object was removed | Durable | Structural change. |
| `board.object_edited` | Content of a board object changed (e.g. sticky text) | Durable | Content change to shared state. |
| `facilitation.session_started` | A workshop facilitation session began | Durable | Marks the start of a governed workshop phase. |
| `facilitation.session_ended` | A workshop facilitation session ended | Durable | Marks the end; triggers outcome capture. |
| `facilitation.phase_advanced` | Facilitator moved to next workshop phase | Durable | Phase progression is a structural workshop event. |
| `facilitation.vote_cast` | A participant cast a vote | Durable | Vote is a durable collaboration record. |
| `facilitation.timer_started` | Facilitator started a shared timer | Ephemeral | Timer state is transient; outcome matters, not the start signal. |
| `facilitation.follow_me_activated` | Facilitator activated follow-me/spotlight | Ephemeral | Viewport control signal; no audit need. |

#### 3.2.3 Mind Map / Process Flow events

| Event type | Semantics | Delivery | Rationale |
|---|---|---|---|
| `graph.node_created` | A node was added to the graph | Durable | Structural change. |
| `graph.node_edited` | Node content or properties changed | Durable | Content change. |
| `graph.node_deleted` | A node was removed | Durable | Structural change. |
| `graph.edge_created` | An edge/connection was added | Durable | Structural change. |
| `graph.edge_deleted` | An edge/connection was removed | Durable | Structural change. |
| `graph.branch_created` | A new branch was created (Mind Map) | Durable | Structural change with semantic meaning. |
| `graph.layout_changed` | Automatic or manual layout reflow occurred | Durable (debounced) | Layout is part of shared visual state. |

#### 3.2.4 Table-specific events

| Event type | Semantics | Delivery | Rationale |
|---|---|---|---|
| `table.row_created` | A row was added | Durable | Data change. |
| `table.row_deleted` | A row was removed | Durable | Data change. |
| `table.cell_edited` | A cell value changed | Durable | Data change. |
| `table.field_created` | A new field/column was added (schema change) | Durable | Schema change — higher governance weight. |
| `table.field_deleted` | A field/column was removed (schema change) | Durable | Schema change. |
| `table.field_modified` | Field type or configuration changed | Durable | Schema change. |
| `table.view_created` | A new view was created | Durable | View is a shared collaboration artifact. |
| `table.view_modified` | View filters, sorts, or grouping changed | Durable | View configuration is shared state. |
| `table.sort_or_filter_applied` | A transient sort/filter was applied by a user | Ephemeral | Personal view manipulation, not shared state change. |

#### 3.2.5 Notebook-specific events

| Event type | Semantics | Delivery | Rationale |
|---|---|---|---|
| `notebook.block_created` | A new block was added | Durable | Structural change. |
| `notebook.block_deleted` | A block was removed | Durable | Structural change. |
| `notebook.block_edited` | Block content changed | Durable (debounced) | Content change; high-frequency typing should be debounced. |
| `notebook.block_moved` | Block reordered within the document | Durable | Structural change. |
| `notebook.visibility_transitioned` | Notebook moved from private to shared or shared to published | Durable | Lifecycle milestone per `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4. |

### 3.3 Extension governance

All tool-specific events must:

1. Follow the platform event envelope: `event_id`, `room_id`, `actor_id`, `actor_type`, `timestamp`, `event_type`, `payload`, `sequence_number`, `idempotency_key`, `state_version_ref`.
2. Declare delivery tier (ephemeral or durable) at registration time.
3. Be registered in the platform event type registry — modules must not emit unregistered event types.
4. Carry `surface` context in the payload when emitted within a workspace room.

---

## 4. Version/replay applicability per tool

### 4.1 Platform baseline inherited

WP-W1-MP-02 defines: version snapshots (whole-object), snapshot triggers (explicit save, auto-cadence, pre-restore, AI proposal acceptance, session boundary, publish milestone), compare/restore semantics, replay segments, and actor attribution.

### 4.2 Per-tool versioning policy

| Workspace tool | Version strategy | Snapshot granularity | Auto-snapshot cadence | Compare/diff support | Restore support | Replay depth |
|---|---|---|---|---|---|---|
| **Idea Workspace** | Full version history | Whole-workspace snapshot (all surfaces serialized) | Every 5 min of active editing or every 20 committed edits (whichever comes first) — needs product confirmation | Structural diff across surfaces (nodes added/removed/moved, objects changed, table rows changed) | Full restore with pre-restore safety snapshot | Full replay with surface-filtered view |
| **Whiteboard** | Full version history | Whole-board snapshot (all objects, positions, frames) | Same cadence as workspace (inherited) when embedded; standalone: every 5 min or session boundary | Visual diff showing added/removed/moved objects | Full restore | Full replay; facilitation sessions create milestone snapshots |
| **Mind Map / Process Flow** | Full version history | Whole-graph snapshot (all nodes, edges, properties, layout) | Same cadence as workspace (inherited) | Structural diff: node/edge additions, deletions, content changes, branch changes | Full restore | Full replay with node-level filtering |
| **Table** | Full version history | Whole-table snapshot (schema + data + view definitions) | Every 5 min of active editing or every 50 cell edits | Schema diff (field changes) + data diff (row/cell changes) + view diff | Full restore with schema compatibility check | Full replay; schema changes create milestone snapshots |
| **Notebook** | Full version history | Whole-document snapshot (all blocks) | Every 5 min of active editing or session boundary | Block-level diff: additions, deletions, content changes, reorders | Full restore | Full replay with block-level filtering |

### 4.3 Hardening requirements

1. **Workspace-level snapshots must be atomic across surfaces**: When a workspace snapshot is triggered, it must capture the state of all four sub-surfaces atomically. Partial snapshots (e.g. Mind Map captured but Table missed) are not acceptable because cross-surface references would be inconsistent.

2. **Schema-aware restore for Table**: Restoring a table to a previous version may involve schema changes (fields added or removed since the snapshot). The table adapter must handle schema compatibility: if the current schema has fields not present in the snapshot, those fields should be nulled; if the snapshot has fields not in the current schema, the restore must re-create them. This is a table-adapter concern, not a platform concern, but the platform must provide the hook.

3. **Facilitation milestone snapshots**: When a facilitation session starts or ends on Whiteboard, a milestone snapshot must be captured automatically. This ensures workshop outcomes are recoverable independently of the auto-cadence schedule.

4. **Notebook visibility transition snapshots**: When a notebook transitions from private to shared (per `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4), a milestone snapshot must be captured. This creates a clear provenance boundary between personal draft and team-visible content.

5. **Diff rendering is adapter-specific**: The platform provides the snapshot pair and the event stream between them. Each tool adapter is responsible for producing a meaningful diff visualization. The platform defines the diff envelope; adapters define the diff algorithm and rendering.

---

## 5. Degraded-state handling per tool

### 5.1 Platform baseline inherited

WP-W1-MP-01 §5 defines degraded-state behavior: gateway down → single-user mode with REST persistence; presence service down → editing continues without presence indicators; event bus down → edits persist but realtime fan-out stops. Reconnect requires re-auth, re-join, state catch-up, and local change reconciliation.

### 5.2 Per-tool degraded-state behavior

| Workspace tool | Gateway down | Presence service down | Event bus down | Tool-specific degraded concerns |
|---|---|---|---|---|
| **Idea Workspace** | All surfaces fall back to single-user mode. Cross-surface references still work locally. Banner: "Collaboration temporarily unavailable — your changes are saved locally." | Editing continues on all surfaces. No collaborator avatars or "who is here" indicators. Banner: "Live presence unavailable." | Edits persist via REST. Other participants see stale state until recovery. | Workspace-level degraded state must propagate to all sub-surfaces simultaneously. A surface must not show "collaboration active" while the workspace room is degraded. |
| **Whiteboard** | Board editing continues in single-user mode. Objects are saved via REST. No live cursors or object movement broadcasting. | Board editing continues. No participant cursors or viewport indicators. | Object changes persist but are not broadcast. Other participants see stale board until recovery. | **Facilitation sessions must pause on gateway failure.** A facilitation session with live voting or timer cannot continue meaningfully without realtime state. The facilitator must see a clear "session paused — connectivity lost" state. Votes cast during outage must be queued and reconciled on recovery. |
| **Mind Map / Process Flow** | Graph editing continues in single-user mode. Node/edge changes saved via REST. | Editing continues without node-level presence indicators. | Changes persist but are not broadcast. | Graph structural changes during outage may create merge conflicts on reconnect (e.g. two users independently add edges to the same node). The adapter must handle structural conflict detection on reconnect. |
| **Table** | Table editing continues in single-user mode. Cell changes saved via REST. | Editing continues without cell-level "someone is editing" indicators. | Changes persist but are not broadcast. | **Concurrent cell edits during outage are the highest-risk scenario for Table.** Two users editing the same cell offline will produce a last-write-wins conflict on reconnect unless the adapter implements cell-level conflict detection. The degraded-state banner must warn: "Changes by others may not be visible until connectivity is restored." |
| **Notebook** | Block editing continues in single-user mode. | Editing continues without block-level presence. | Changes persist but are not broadcast. | Notebook's controlled co-editing model (not full CRDT) means degraded state is less risky than for canvas tools. The primary concern is block-level conflict on reconnect if two users edited the same block. |

### 5.3 Cross-cutting degraded-state requirements

1. **Consistent banner language**: All five tools must use the same degraded-state banner vocabulary from the platform (WP-W1-MP-01 §5.5). Module-specific wording is not allowed.

2. **Degraded-state propagation in workspace rooms**: If the workspace room enters degraded state, all sub-surfaces must reflect this simultaneously. A sub-surface must not independently determine its degraded state.

3. **Queued-event reconciliation on recovery**: When the event bus recovers, the platform must deliver queued durable events in sequence-number order. Tool adapters must handle the catch-up burst without UI disruption (e.g. progressive application, not a full-page refresh for each missed event).

4. **Facilitation-specific pause/resume**: The facilitation subsystem must define explicit pause/resume semantics for connectivity loss. This is unique to Whiteboard workshop sessions and does not apply to other tools.

---

## 6. Platform seam elimination map

### 6.1 What "seam" means in this context

A "seam" is any place where a tool currently implements collaboration behavior locally instead of consuming the shared multiplayer platform. Seams create:

- Divergent behavior across tools
- Duplicated code and maintenance burden
- Inconsistent UX for users
- Unsupportable collaboration failures

### 6.2 Identified seams requiring elimination

| # | Seam location | Current state | Target state | Affected tools | Priority |
|---|---|---|---|---|---|
| 1 | **Module-local WebSocket/channel management** | Historical V4 seams (`realtime_channels`, `collab_sessions`, `deck_collab_sessions`) created per-module channel logic. If any tool still manages its own WebSocket connection or channel subscription, this is a seam. | All tools connect through the platform realtime gateway. Room join/leave is handled by the platform. Tools never create or manage their own channels. | All five | P0 |
| 2 | **Module-local presence tracking** | Historical `realtime_presence` and `tool_session_presence` seams suggest per-module presence logic. If any tool maintains its own presence state outside the platform presence service, this is a seam. | All presence goes through the platform presence service. Tools provide cursor-state payloads but do not manage presence lifecycle. | All five | P0 |
| 3 | **Module-local version/snapshot storage** | Historical `my_idea_map_versions` and module-specific snapshot concepts suggest per-module version history. If any tool stores version history in its own schema outside the platform version framework, this is a seam. | All version snapshots use the platform `VersionSnapshot` model. Tools provide serialization/deserialization adapters but do not own snapshot storage or lifecycle. | Idea Workspace, Mind Map, Table | P0 |
| 4 | **Module-local comment/thread storage** | If any tool stores comments in its own table/schema instead of using the platform `CommentThread` + anchor model, this is a seam. | All comments use the platform anchored comment system. Tools provide anchor resolution (which node, cell, block a comment is attached to) but do not own thread persistence. | All five | P1 (depends on comment platform, which is a Wave 3+ concern but must be planned now) |
| 5 | **Module-local facilitation state** | Historical `tool_facilitation_sessions`, `tool_facilitation_votes`, `tool_facilitation_roles` are module-local. If Whiteboard implements facilitation as local-only state, this is a seam. | Facilitation uses the platform facilitation subsystem. Whiteboard consumes facilitation primitives (timer, voting, roles, phases) from the shared subsystem. | Whiteboard, potentially Mind Map for structured review sessions | P0 for Whiteboard |
| 6 | **Module-local event types without platform registration** | If any tool emits collaboration events that are not registered in the platform event type registry, those events are invisible to audit, replay, and support. | All tool-specific events (§3.2) are registered in the platform event type registry. Unregistered events are rejected by the gateway. | All five | P0 |
| 7 | **Module-local degraded-state handling** | If any tool implements its own connectivity detection, degraded-state banners, or reconnect logic outside the platform degraded-state model, this is a seam. | All tools consume degraded-state signals from the platform. Banner rendering uses shared UI primitives. Reconnect is handled by the platform gateway; tools only handle adapter-specific state reconciliation. | All five | P0 |
| 8 | **Module-local permission checks for collaboration actions** | If any tool checks collaboration permissions (can this user edit? can they comment?) using its own logic instead of the platform authorization path (WP-W1-MP-01 §4), this is a seam. | All collaboration permission checks go through the platform authorization path. Tools declare their resource type and the platform resolves effective permissions. | All five | P0 |

### 6.3 Elimination strategy

The seam elimination must follow this order:

1. **Audit**: inventory all existing module-local collaboration code in each tool. This requires a code-level audit (out of scope for this analysis packet but must be the first implementation step).
2. **Adapter creation**: for each tool, create the artifact-family collaboration adapter that bridges the tool's resource model to the platform primitives.
3. **Migration**: replace module-local seams with platform adapter calls. This must be done tool-by-tool in the order specified by `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.5: Idea Workspace → Whiteboard → Mind Map/Process Flow → Table → Notebook.
4. **Verification**: after migration, verify that the tool no longer has any direct collaboration infrastructure — all collaboration flows through the platform.
5. **Cleanup**: remove deprecated module-local collaboration code.

---

## 7. Downstream dependency map

| Dependent packet/wave | Dependency on this hardening analysis |
|---|---|
| **WP-W4-COLLAB-02 — Tool feature completeness** | Requires the room mapping (§1), presence semantics (§2), and event vocabulary (§3) per tool to define what collaboration features each tool must expose. |
| **WP-W4-COLLAB-03 — Concurrent editing conflict resolution** | Requires the per-tool versioning policy (§4) and degraded-state handling (§5) as inputs for defining conflict resolution strategies per artifact family. |
| **Wave 4 implementation (Idea Workspace first)** | Requires the seam elimination map (§6) as the migration checklist. Implementation cannot begin without knowing which seams to replace. |
| **Wave 8 — Reports and Presentations collaboration** | The room model pattern (§1), event extension governance (§3.3), and seam elimination strategy (§6.3) established here become the template for later output-surface collaboration. |
| **Wave 9 — Tools, Interview, structured review** | Facilitation subsystem hardening (§2.2, §3.2.2, §5.2 Whiteboard) must be complete before tool-session facilitation reuse in Wave 9. |
| **Wave 10 — Notifications, policy, support, observability** | The extended event vocabulary (§3) feeds notification triggers. Degraded-state diagnostics (§5) feed support observability. |

---

## 8. Open questions and conflicts

### 8.1 No conflicts detected between canonical docs

After reading all canonical docs and supporting anchors, no direct contradictions were found within the scope of this packet. The documents are consistent on:

- One room model, many artifact-specific adapters (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §4).
- Five presence types with `facilitator` reserved from Wave 1 (WP-W1-MP-01 §2.1).
- Event vocabulary extensibility through registered types (WP-W1-MP-01 §3.2).
- Whole-object snapshots with artifact-family-declared cadence (WP-W1-MP-02 §2.5).
- Degraded-state model with consistent frontend signals (WP-W1-MP-01 §5).
- Rollout order: Idea Workspace → Whiteboard → Mind Map/Process Flow → Table → Notebook (`V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.5, `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §15).

### 8.2 Open questions requiring attention

| # | Question | Context | Recommended resolution path |
|---|---|---|---|
| 1 | **Workspace room vs per-surface rooms**: Should a workspace have one room spanning all surfaces, or one room per surface? This analysis recommends one room per workspace (§1.2) with surface-aware event routing, but this has performance implications for large workspaces with many concurrent users across surfaces. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §9.1 says "shared room per workspace artifact" — supports single-room model. | Engineering spike needed to validate event fan-out performance with surface filtering before Wave 4 implementation. |
| 2 | **Auto-snapshot cadence values**: This analysis proposes 5-minute / 20-edit cadence for workspaces and 5-minute / 50-edit for tables (§4.2). These are reasonable defaults but need product confirmation. | WP-W1-MP-02 §2.5 defers cadence to artifact-family declaration. WP-W1-MP-02 open question #1 flags this. | Product decision needed before Wave 4 implementation. |
| 3 | **Standalone tool instances**: Can Whiteboard and Table exist as standalone artifacts outside Idea Workspace? Current canon is ambiguous — `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §9 describes them as workspace sub-surfaces, but the product may support standalone instances. | Affects room model (§1.2) and adapter design. | Product clarification needed. If standalone instances exist, the adapter must handle both embedded and standalone modes. |
| 4 | **Facilitation pause semantics on connectivity loss**: This analysis recommends pausing facilitation sessions on gateway failure (§5.2). The exact UX for pause/resume (auto-resume on reconnect? facilitator must manually resume?) needs product decision. | No canonical doc specifies facilitation pause behavior during outage. | Product UX decision needed before Whiteboard facilitation implementation. |
| 5 | **Debounce thresholds for high-frequency durable events**: Board object moves (§3.2.2) and notebook block edits (§3.2.5) need debouncing before persistence. The debounce window (e.g. 500ms, 1s, 2s) affects collaboration responsiveness vs event stream volume. | Not specified in canonical docs. | Engineering decision with product input on acceptable latency. |

### 8.3 Items not requiring escalation

The following items are noted but do not require escalation because they are explicitly deferred to other packets or later waves:

- Concurrent editing conflict resolution algorithms per tool (WP-W4-COLLAB-03).
- Individual tool feature completeness beyond collaboration (WP-W4-COLLAB-02).
- CRDT vs OT strategy per artifact family (adapter-level, later implementation).
- Notification fan-out from tool-specific events (Wave 10).
- Comment and review anchor model details (builds on platform comment system, not defined in this packet).

---

## 9. Packet output

- **Status**: completed
- **Completed**:
  - Room model application per workspace tool with resource binding, granularity, and hardening requirements
  - Presence model hardening with per-tool presence semantics, facilitator exclusivity, and surface-scoped aggregation
  - Event vocabulary extension with 30+ tool-specific event types across all five tools, with delivery tier classification and governance rules
  - Version/replay applicability per tool with versioning policy, snapshot cadence, diff/restore/replay depth
  - Degraded-state handling per tool with tool-specific concerns, facilitation pause semantics, and cross-cutting requirements
  - Platform seam elimination map identifying 8 seam categories with current state, target state, and elimination strategy
  - Downstream dependency map covering 6 dependent packets/waves
- **Remaining**: none within packet scope
- **Blockers or risks**:
  - Workspace room vs per-surface room performance validation needed before implementation (question #1)
  - Auto-snapshot cadence needs product confirmation (question #2)
  - Standalone vs embedded tool instance disambiguation needs product clarification (question #3)
- **Questions requiring escalation**:
  - Standalone Whiteboard/Table existence outside Idea Workspace (question #3) — needs product scope decision
  - Facilitation pause/resume UX on connectivity loss (question #4) — needs product UX decision

---

## Related canonical docs

- `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md`
- `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md`
- `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md`
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md`
- `WP-W1-MP-01_MULTIPLAYER_PLATFORM_BASELINE.md`
- `WP-W1-MP-02_VERSION_REPLAY_AUDIT_SPINE.md`
- `DECISION_LOG_WAVE_1.md`
