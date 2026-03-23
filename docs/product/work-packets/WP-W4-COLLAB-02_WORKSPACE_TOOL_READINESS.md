# WP-W4-COLLAB-02 — Workspace Tool Collaboration Readiness Audit

> Packet: WP-W4-COLLAB-02
> Wave: 4 — Collaboration and workspace hardening
> Track: D — Collaboration and shared work
> Status: completed
> Owner: Product + Engineering
> Scope: per-tool collaboration readiness audit for the five workspace tools against the multiplayer platform baseline

---

## 1. Readiness matrix (all tools)

This matrix evaluates each workspace tool against the collaboration primitives defined in the multiplayer platform baseline (`WP-W1-MP-01`).

### 1.1 Platform primitives reference

The platform baseline defines these collaboration primitives that every tool must eventually support:

| Primitive | Platform definition |
|---|---|
| `CollaborationRoom` | Resource-bound room with lifecycle (`active`, `idle`, `closed`, `error`). |
| `Presence` | Typed presence states: `viewer`, `editor`, `facilitator`, `observer`, `ai_agent`. |
| `Cursor/selection sharing` | Ephemeral `cursor.moved` and `selection.changed` events. |
| `Edit events` | `edit.started`, `edit.committed`, `edit.conflict` per adapter. |
| `Locking` | `lock.acquired` / `lock.released` for sub-resource selective locking. |
| `Awareness` | Typing indicators, viewport sharing, attention cues. |
| `Degraded state` | Graceful fallback to single-user mode with clear banners. |
| `Reconnect` | State catch-up, pending-change reconciliation, stale-presence cleanup. |
| `Authorization` | Room join inherits resource permission model. |
| `Facilitation` | Reserved `facilitator` presence type; session roles. |

### 1.2 Tool-by-tool readiness summary

| Primitive | Idea Workspace | Whiteboard | Mind Map / Process Flow | Table | Notebook |
|---|---|---|---|---|---|
| Room binding | `partial` — collab_sessions seam exists (V4-IDEA-02) | `partial` — inherits workspace room | `partial` — inherits workspace room | `scaffold` — no room seam yet | `scaffold` — no room seam yet |
| Presence | `partial` — V4 presence tracking exists | `partial` — session seams for follow/spotlight | `scaffold` — collaboration overlays listed as partial | `missing` — no presence layer | `missing` — no presence layer |
| Cursor sharing | `missing` — not implemented | `missing` — not implemented | `missing` — not implemented | `missing` — not implemented | `missing` — not implemented |
| Selection sharing | `scaffold` — shared selection grammar defined in doctrine | `scaffold` — selection grammar defined | `scaffold` — node/edge selection defined | `missing` — no selection broadcast | `missing` — no selection broadcast |
| Edit events | `partial` — collab_session_events exist (V4) | `partial` — draw/object events exist locally | `scaffold` — graph persistence exists | `scaffold` — REST save path only | `scaffold` — REST save path only |
| Locking | `missing` — not implemented | `missing` — not implemented | `missing` — not implemented | `missing` — critical gap for cell/row work | `missing` — not implemented |
| Awareness | `partial` — V4 session state | `partial` — follow/spotlight seams | `missing` — no awareness layer | `missing` — no awareness layer | `missing` — no awareness layer |
| Degraded state | `missing` — no degraded-state handling | `missing` — no degraded-state handling | `missing` — no degraded-state handling | `missing` — no degraded-state handling | `missing` — no degraded-state handling |
| Reconnect | `partial` — V4 reconnect seam | `scaffold` — no explicit reconnect | `missing` — no reconnect handling | `missing` — no reconnect handling | `missing` — no reconnect handling |
| Authorization | `partial` — workspace sharing exists | `partial` — inherits workspace sharing | `partial` — inherits workspace sharing | `partial` — sharing/audit seams exist | `partial` — sharing exists |
| Facilitation | `scaffold` — doctrine defines it as shared concern | `partial` — timer/voting/follow/spotlight seams | `missing` — no facilitation | `missing` — no facilitation | `missing` — no facilitation |

### 1.3 Readiness verdict per tool

| Tool | Overall collaboration readiness | Verdict |
|---|---|---|
| Idea Workspace (shell) | `partial` | Strongest historical seams from V4; needs normalization to platform primitives. |
| Whiteboard | `partial` | Facilitation seams are strategically strong; needs cursor sharing, locking, and platform convergence. |
| Mind Map / Process Flow | `scaffold` | Collaboration listed as partial/draft in contract freeze; needs full platform integration from scratch. |
| Table | `scaffold-to-missing` | Broad data platform but no collaboration layer; cell locking and concurrent editing are critical gaps. |
| Notebook | `scaffold-to-missing` | Rich content tool with no multiplayer seams; needs controlled co-editing model. |

---

## 2. Idea Workspace readiness

### 2.1 What exists

The Idea Workspace shell is the collaboration container for all four canvas tools. It has the strongest historical collaboration seams:

- **V4 collaboration sessions** (`collab_sessions` from V4-IDEA-02): WebSocket-authenticated session objects with shared state.
- **V4 session events** (`collab_session_events`): event records within collaboration sessions.
- **V4 realtime presence** (`realtime_presence` from V4-ENT-06): partial presence tracking per channel.
- **V4 realtime channels** (`realtime_channels` from V4-ENT-06): partial channel infrastructure.
- **Workspace sharing**: permission model exists for workspace-level access control.
- **Shared graph persistence**: `IdeaWorkspaceGraph` provides one substrate for all canvases.

Per the orchestration doctrine (§16): "Collaboration should be treated as a shared workspace concern, not as an afterthought inside one canvas."

### 2.2 What is missing

- **Platform room normalization**: V4 `collab_sessions` must be normalized to `CollaborationRoom` with canonical identity (`resource_type: workspace`, `resource_id`). Per WP-W1-MP-01 §6.2, this is a "normalize" decision.
- **Typed presence**: V4 presence must be upgraded to support `viewer`, `editor`, `facilitator`, `observer`, `ai_agent` types.
- **Cursor and selection sharing**: no ephemeral cursor/selection broadcast exists at the workspace shell level.
- **Degraded-state handling**: no graceful fallback banners or single-user mode transitions.
- **Reconnect with state catch-up**: V4 reconnect seam exists but does not implement sequence-number-based catch-up per platform spec.

### 2.3 Tool-specific collaboration features for V8

- **Cross-canvas presence**: users collaborating in the same idea workspace must see each other even when on different canvases. The workspace shell must aggregate presence across all four canvas rooms.
- **Canvas-switch awareness**: when a collaborator switches from Whiteboard to Mind Map, other users should see the canvas context change in the presence indicator.
- **Shared comment anchoring**: comments must be anchored to workspace objects (nodes, stickies, steps, rows) and visible across canvas views where the same object appears.
- **AI actor visibility**: per Decision 5 (Wave 1), AI agents performing room-visible work must appear as `ai_agent` presence with distinct avatar.

### 2.4 Migration path

1. Normalize `collab_sessions` → `CollaborationRoom` (resource_type: `workspace`).
2. Normalize `collab_session_events` → platform event vocabulary.
3. Normalize `realtime_presence` → typed presence model with heartbeat and stale cleanup.
4. Normalize `realtime_channels` → platform gateway room routing.
5. Add cross-canvas presence aggregation as a workspace-shell-level adapter concern.

### 2.5 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| V4 seam normalization breaks existing runtime | Medium | Incremental migration with adapter shim; run V4 and platform paths in parallel during transition. |
| Cross-canvas presence adds latency | Low | Presence is ephemeral; best-effort delivery is acceptable per platform spec. |
| Shared graph concurrent writes | High | Depends on WP-W4-COLLAB-03 (conflict resolution); must not ship collaboration without conflict strategy. |

---

## 3. Whiteboard readiness

### 3.1 What exists

Whiteboard has the strongest facilitation seams of any workspace tool:

- **Workshop session seams**: timer, voting, `followMe`, and spotlight behaviors exist (WHITEBOARD_V8_READINESS_AUDIT §4, §6).
- **Session role vocabulary**: `facilitator`, `participant`, `observer` are defined in WHITEBOARD_V8_SSOT §7.6.
- **Shared workspace placement**: Whiteboard lives inside the Idea Workspace shell and inherits its collaboration context.
- **Object families**: sticky, text, frame, image, link, summary, metric — all persisted through shared graph.
- **Draw mode**: persisted drawing paths exist.
- **Comments and activity seams**: present.

### 3.2 What is missing

- **Cursor sharing**: no live cursor broadcast. This is critical for a whiteboard-class product — users must see where collaborators are pointing, drawing, and selecting.
- **Selection sharing**: no ephemeral selection broadcast for multi-user awareness.
- **Object-level locking**: no lock semantics for objects being edited. Two users moving the same sticky simultaneously will conflict.
- **Platform room integration**: facilitation session state (`WhiteboardSessionState` per SSOT §7.6) must be expressed through the platform room model, not as a parallel session system.
- **Degraded-state handling**: no fallback for when realtime is unavailable.
- **Large-board performance under collaboration**: performance guardrails (SSOT §7.10) become more critical with multiple users rendering the same viewport.

### 3.3 Tool-specific collaboration features for V8

- **Live cursor sharing with user identity**: colored cursors showing each collaborator's pointer position and active tool (select, hand, draw).
- **Object edit indicators**: visual signal when another user is editing a sticky note, text block, or frame.
- **Facilitation runtime on platform primitives**: `WhiteboardSessionState` must use `CollaborationRoom` lifecycle. Facilitator role maps to platform `facilitator` presence type.
- **Voting as room events**: vote casting and results must flow through the platform event vocabulary, not a separate channel.
- **Follow-me as presence extension**: the existing `followMe` seam should use the platform `cursor.moved` event with a `follow_target` flag.
- **Spotlight as awareness event**: spotlight should broadcast viewport focus through the platform awareness layer.
- **AI clustering proposals in shared context**: when AI proposes clustering (SSOT §7.4), the proposal must be visible to all room members as a reviewable event, not only to the requesting user.

### 3.4 Migration path

1. Bind Whiteboard to a `CollaborationRoom` (resource_type: `workspace`, sub-resource context: `whiteboard`).
2. Map existing facilitation session seams to platform room lifecycle and presence types.
3. Implement cursor sharing adapter using platform `cursor.moved` events.
4. Implement object-level edit indicators using `edit.started` / `edit.committed` events.
5. Migrate voting, follow, and spotlight to platform event vocabulary.
6. Add performance budget for multi-user viewport rendering.

### 3.5 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Cursor sharing bandwidth on large boards | Medium | Throttle cursor events; use viewport-aware fan-out (only send cursors visible in recipient's viewport). |
| Facilitation session migration breaks existing seams | Medium | Preserve V4 facilitation seams (`tool_facilitation_sessions`, `tool_facilitation_votes`, `tool_facilitation_roles`) as inputs per WP-W1-MP-01 §6.2; normalize incrementally. |
| Concurrent object manipulation conflicts | High | Depends on WP-W4-COLLAB-03 conflict resolution strategy. Object-level locking is the recommended interim approach for Whiteboard. |
| AI proposals visible to all users before acceptance | Medium | Use platform proposal governance: AI proposals are `ai_agent`-authored events with explicit review state. |

---

## 4. Mind Map and Process Flow readiness

These two tools share the same Idea Workspace canvas substrate and have similar collaboration profiles. They are assessed together per the Wave 4 rollout order.

### 4.1 What exists

**Mind Map:**

- Canvas system switching inside workspace (`trusted` per contract freeze).
- Save/reload of map graph (`trusted`).
- Basic node operations: create, select, duplicate, delete, focus, promote/demote (`trusted`).
- AI expansion through `propose → review → apply` (`trusted`).
- Artifact link persistence on nodes (`trusted`).
- Collaboration overlays, comments, and history trust surface (`partial` per contract freeze).

**Process Flow:**

- Shared workspace placement (`real`).
- Lane-based process editing (`real`).
- Multiple modes: classic, automation, VSM (`real`).
- Basic validators and process coaching seams.
- AI-assisted entry points and process summaries.
- Comments and activity seams (inherited from workspace).

### 4.2 What is missing

**Both tools share these gaps:**

- **No cursor sharing**: users cannot see where collaborators are working in the map/flow.
- **No node/edge locking**: concurrent editing of the same node or edge will conflict.
- **No selection sharing**: no awareness of what other users have selected.
- **No degraded-state handling**.
- **No reconnect with state catch-up**.
- **Collaboration overlays listed as `partial`/`draft`**: the contract freeze explicitly lists "Collaboration overlays, comments, and history trust surface" as `partial` for Mind Map and "traceability into downstream execution artifacts" as `partial` for Process Flow.

**Mind Map specific:**

- **Branch-level collaboration**: users working on different branches simultaneously need branch-aware locking or conflict resolution.
- **Subtree operations under collaboration**: fold, detach, convert operations on subtrees must be safe when other users are working on child nodes.

**Process Flow specific:**

- **Lane-aware collaboration**: when multiple users edit different lanes, the system must prevent cross-lane conflicts on shared edges.
- **Validation under collaboration**: the rules engine (PROCESS_FLOW_V8_SSOT §8.2) must handle validation state that changes due to another user's concurrent edits.
- **BPMN round-trip under collaboration**: import/export must be safe when collaboration is active (lock or queue).

### 4.3 Tool-specific collaboration features for V8

**Mind Map:**

- **Node-level edit indicators**: show which user is editing which node.
- **Branch-level awareness**: highlight which branch a collaborator is focused on.
- **Subtree lock for structural operations**: when a user initiates fold/detach/convert on a subtree, acquire a temporary lock on the affected nodes.
- **AI proposal visibility**: AI expansion proposals must be visible to all room members.

**Process Flow:**

- **Step/edge edit indicators**: show which user is editing which step or connection.
- **Lane-level awareness**: show which lane a collaborator is working in.
- **Validation state broadcast**: when validation results change due to a concurrent edit, broadcast the updated problems list.
- **Import/export lock**: acquire a room-level lock during BPMN import/export to prevent concurrent modifications.

### 4.4 Migration path

1. Both tools inherit the workspace `CollaborationRoom` binding.
2. Implement node/step-level `edit.started` / `edit.committed` events through the platform adapter.
3. Implement cursor sharing using platform `cursor.moved` events.
4. Implement selective locking for structural operations (subtree operations in Mind Map, import/export in Process Flow).
5. Add validation-state broadcast for Process Flow as a durable collaboration event.
6. Mind Map Stage 7 (contract freeze) explicitly targets "harden collaboration, auditability, and QA" — this aligns with Wave 4 timing.

### 4.5 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Graph-level conflicts on shared substrate | High | Both tools use `IdeaWorkspaceGraph`; conflict resolution must be graph-aware. Depends on WP-W4-COLLAB-03. |
| Subtree operations invalidating concurrent work | High | Subtree lock with clear UX signal ("User X is reorganizing this branch"). |
| Process validation thrashing under concurrent edits | Medium | Debounce validation broadcast; show "validation updating…" state. |
| Mind Map contract freeze Stage 7 not yet reached | Medium | Collaboration features should be planned as part of Stage 7 closure, not as a separate effort. |

---

## 5. Table readiness

### 5.1 What exists

Table has the broadest feature surface but the weakest collaboration foundation:

- **Broad field type coverage** (`real`).
- **Formulas and rollups** (`real`).
- **Relations and cross-table primitives** (`real`).
- **Many view types** (`real`).
- **Forms and interface seams** (`real`).
- **Sharing, audit, and lineage seams** (`real`).
- **AI schema proposal direction**.

No collaboration-specific seams exist. Table operates through standard REST persistence with no realtime layer.

### 5.2 What is missing

- **Room binding**: Table has no `CollaborationRoom` integration. This is the most fundamental gap.
- **Presence**: no presence layer at all. Users cannot see who else is viewing or editing the same table/view.
- **Cell-level locking**: this is the single most critical collaboration feature for Table. Without it, concurrent cell edits will silently overwrite each other.
- **Row-level locking**: for record detail editing, row-level locks prevent conflicting updates to the same record.
- **View-level awareness**: users working in different saved views of the same table need awareness of each other's filter/sort/group context.
- **Schema change governance under collaboration**: schema changes (add/remove/rename field) while other users are actively editing must be handled safely. Per TABLE_V8_SSOT §8.12, schema evolution should support proposal/review/diff/approval — this becomes critical under collaboration.
- **Cursor and selection sharing**: no cell/row selection broadcast.
- **Degraded-state handling**: no fallback.
- **Reconnect**: no reconnect handling.

### 5.3 Tool-specific collaboration features for V8

- **Cell-level locking with visual indicators**: when a user is editing a cell, other users see a lock indicator with the editor's identity. The lock is released on commit or timeout.
- **Row-level locking for record detail**: when a user opens record detail for editing, a soft lock prevents conflicting field edits.
- **Presence bar**: show active collaborators in the table header, with indication of which view each user is working in.
- **Selection sharing**: highlight which row/cell range other users have selected.
- **Schema change broadcast**: when a field is added, removed, or modified, all active collaborators receive a real-time notification and their view refreshes.
- **Form submission awareness**: when a form submission creates a new record, active table users see the new row appear in real time.
- **Interface co-viewing**: users viewing the same interface see each other's presence.

### 5.4 Migration path

1. Create `CollaborationRoom` binding for Table (resource_type: `table`, resource_id: base or table ID).
2. Implement presence adapter for Table with view-context metadata.
3. Implement cell-level and row-level locking using platform `lock.acquired` / `lock.released` events.
4. Implement selection sharing using platform `selection.changed` events.
5. Implement schema-change broadcast as a durable collaboration event.
6. Add degraded-state handling (banner + single-user fallback).
7. Add reconnect with state catch-up (sequence-number-based).

### 5.5 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Cell-level locking granularity vs performance | High | Lock only the active cell, not the entire row. Use short lock TTL with auto-release. |
| Schema changes during active collaboration | High | Schema changes must acquire a table-level lock and notify all collaborators before applying. Align with TABLE_V8_SSOT §8.12 governed schema evolution. |
| Formula/rollup recomputation under concurrent edits | Medium | Queue recomputation; show "computing…" state for affected cells. |
| Large table performance with presence overlay | Medium | Presence overlay is lightweight (header bar); cell indicators only for visible viewport. |
| No existing realtime seams to normalize | Low (but high effort) | Table starts from scratch for collaboration; no V4 seams to migrate. Clean implementation on platform primitives. |

---

## 6. Notebook readiness

### 6.1 What exists

Notebook is a rich-text content tool with no collaboration seams:

- **Rich editor surface** with slash commands, AI command blocks, research mode, voice mode.
- **Embedded references** (inline chips with expand preview).
- **Backlinks** ("Used in" platform-wide).
- **Create-from-note** promotion flows.
- **Right panel**: Tools / Context-Links / AI Suggestions.
- **Tagging** (manual + AI-suggested).

Per NOTEBOOK_V3.md §9, collaboration features are explicitly not in v3 scope. The document states: "Notebook NIE jest: systemem wersjonowanym, systemem zatwierdzania (approval workflow)."

### 6.2 What is missing

- **Room binding**: no `CollaborationRoom` integration.
- **Presence**: no presence layer.
- **Co-editing model**: this is the most architecturally complex gap. Rich-text co-editing requires either CRDT or OT strategy. Per WP-W1-MP-01 §8.3, "CRDT vs OT strategy per artifact family" is deferred to Wave 2+ as an adapter-level concern.
- **Cursor sharing**: no cursor position broadcast in the text editor.
- **Block-level locking**: as an alternative to full CRDT co-editing, block-level (paragraph/section) locking could provide a simpler collaboration model.
- **Selection sharing**: no text selection broadcast.
- **Degraded-state handling**: no fallback.
- **Reconnect**: no reconnect handling.
- **Version history**: explicitly out of v3 scope but needed for collaboration (to resolve conflicts and support undo across users).

### 6.3 Tool-specific collaboration features for V8

- **Block-level co-editing or locking**: two collaboration models are possible:
  - **Model A (CRDT)**: full character-level co-editing with automatic conflict resolution. Higher complexity, best UX.
  - **Model B (block locking)**: paragraph/section-level locking where only one user edits a block at a time. Lower complexity, acceptable UX for structured notes.
  - Recommendation: start with **Model B** (block locking) for V8 Wave 4, with CRDT as a later enhancement.
- **Cursor and caret sharing**: show each collaborator's cursor position in the text.
- **Presence bar**: show active collaborators in the notebook header.
- **AI command visibility**: when one user triggers an AI command, other collaborators should see the "AI working…" state on the affected block.
- **Comment anchoring**: comments anchored to text ranges, visible to all collaborators.
- **Create-from-note awareness**: when a user triggers "Create from note," other collaborators see the promotion action.

### 6.4 Migration path

1. Create `CollaborationRoom` binding for Notebook (resource_type: `notebook`, resource_id: note ID).
2. Implement presence adapter for Notebook.
3. Implement block-level locking using platform `lock.acquired` / `lock.released` events.
4. Implement cursor/caret sharing using platform `cursor.moved` events.
5. Add degraded-state handling.
6. Add reconnect with state catch-up.
7. Plan CRDT upgrade path for later wave (depends on WP-W1-MP-01 §8.3 CRDT strategy decision).

### 6.5 Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Rich-text co-editing conflict resolution | High | Block-level locking avoids the hardest CRDT problems for V8. Full CRDT is a later enhancement. |
| Block locking UX friction | Medium | Clear visual indicators ("User X is editing this section"); auto-release on blur/timeout. |
| AI command blocks under collaboration | Medium | AI commands lock the target block; result is broadcast as a durable event. |
| Notebook v3 explicitly excludes versioning | Medium | Collaboration requires at minimum operational versioning for conflict recovery. This is a scope expansion that must be acknowledged. |
| No historical seams to build on | Low (but high effort) | Clean implementation on platform primitives, similar to Table. |

---

## 7. Migration path summary

### 7.1 Common migration steps (all tools)

All five tools must complete these platform integration steps:

1. **Room binding**: create or normalize `CollaborationRoom` binding with canonical `resource_type:resource_id` identity.
2. **Presence adapter**: implement typed presence with heartbeat, stale cleanup, and reconnect per WP-W1-MP-01 §2.
3. **Event vocabulary mapping**: map tool-specific collaboration events to the platform event vocabulary per WP-W1-MP-01 §3.2.
4. **Authorization integration**: ensure room join authorization inherits from the tool's existing permission model per WP-W1-MP-01 §4.
5. **Degraded-state handling**: implement connection-degraded banner, unsynced-changes indicator, and reconnecting state per WP-W1-MP-01 §5.5.
6. **Support diagnostics**: expose room health, active collaborators, and event lag to operator surfaces per WP-W1-MP-01 §5.4.

### 7.2 Tool-specific migration

| Tool | Primary migration task | Complexity |
|---|---|---|
| Idea Workspace | Normalize V4 `collab_sessions` → `CollaborationRoom`; add cross-canvas presence | Medium |
| Whiteboard | Normalize facilitation seams → platform room; add cursor sharing | Medium-High |
| Mind Map | Implement collaboration from Stage 7 baseline; add node-level events | Medium |
| Process Flow | Implement collaboration from partial baseline; add lane-aware events | Medium |
| Table | Build collaboration layer from scratch on platform primitives | High |
| Notebook | Build collaboration layer from scratch; decide CRDT vs block-locking | High |

### 7.3 V4 seam disposition

Per WP-W1-MP-01 §6.2, the following V4 seams are inputs to this migration:

| V4 Seam | Disposition | Target tool |
|---|---|---|
| `collab_sessions` | Normalize → CollaborationRoom | Idea Workspace (shell) |
| `collab_session_events` | Normalize → platform event vocabulary | Idea Workspace (shell) |
| `realtime_channels` | Normalize → platform gateway | Idea Workspace (shell) |
| `realtime_presence` | Normalize → platform presence service | Idea Workspace (shell) |
| `tool_session_presence` | Normalize → platform presence (adapter) | All canvas tools |
| `tool_facilitation_sessions` | Normalize → Whiteboard facilitation adapter | Whiteboard |
| `tool_facilitation_votes` | Normalize → Whiteboard voting adapter | Whiteboard |
| `tool_facilitation_roles` | Normalize → platform presence types | Whiteboard |
| `tool_facilitation_outcomes` | Normalize → Whiteboard output adapter | Whiteboard |

---

## 8. Priority and rollout order

### 8.1 Canonical order from V8 Master Program

Per V8_IMPLEMENTATION_MASTER_PROGRAM §8.5 (Wave 4), the rollout order is:

1. Idea Workspace
2. Whiteboard
3. Mind Map and Process Flow
4. Table
5. Notebook

### 8.2 Rationale for this order

| Position | Tool | Rationale |
|---|---|---|
| 1 | Idea Workspace | The collaboration shell. All other tools inherit its room, presence, and gateway integration. Must be first. |
| 2 | Whiteboard | Strongest facilitation seams; highest user expectation for realtime collaboration (workshop use case). V4 facilitation seams provide a head start. |
| 3 | Mind Map / Process Flow | Share the same canvas substrate as Whiteboard; can reuse cursor/selection/event patterns established in step 2. Mind Map contract freeze Stage 7 explicitly targets collaboration hardening. |
| 4 | Table | No existing collaboration seams; requires cell/row locking which is a new pattern. High complexity but lower urgency (table work is more often sequential than simultaneous). |
| 5 | Notebook | Highest architectural complexity (rich-text co-editing). Block-locking model reduces initial complexity. Lowest collaboration urgency in the consulting workflow (notes are typically personal before sharing). |

### 8.3 Dependencies

```
Wave 1 (completed)
  └── WP-W1-MP-01: Platform baseline (room, presence, events, gateway)
  └── WP-W1-MP-02: Version/replay/audit spine

Wave 4
  └── WP-W4-COLLAB-01: Multiplayer platform architecture (prerequisite)
  └── WP-W4-COLLAB-02: This packet (tool readiness audit)
  └── WP-W4-COLLAB-03: Conflict resolution (prerequisite for shipping)
  │
  ├── Step 1: Idea Workspace shell collaboration
  │     └── Depends on: WP-W4-COLLAB-01 (platform), WP-W4-COLLAB-03 (conflicts)
  │
  ├── Step 2: Whiteboard collaboration
  │     └── Depends on: Step 1 (workspace room), WP-W4-COLLAB-03
  │
  ├── Step 3: Mind Map + Process Flow collaboration
  │     └── Depends on: Step 1 (workspace room), Step 2 (cursor/event patterns)
  │
  ├── Step 4: Table collaboration
  │     └── Depends on: WP-W4-COLLAB-01 (platform), WP-W4-COLLAB-03 (locking)
  │
  └── Step 5: Notebook collaboration
        └── Depends on: WP-W4-COLLAB-01 (platform), WP-W4-COLLAB-03 (conflicts)
        └── Depends on: CRDT/OT strategy decision (from Wave 2 spine)
```

---

## 9. Risk assessment

### 9.1 Cross-cutting risks

| # | Risk | Severity | Affected tools | Mitigation |
|---|---|---|---|---|
| R1 | Platform baseline (WP-W4-COLLAB-01) not ready when Wave 4 begins | Critical | All | Wave 4 cannot start tool collaboration without the platform layer. Ensure WP-W4-COLLAB-01 is a hard prerequisite. |
| R2 | Conflict resolution strategy (WP-W4-COLLAB-03) not defined | Critical | All | No tool should ship collaboration without a conflict strategy. Block shipping, not development. |
| R3 | Shared graph concurrent writes across canvases | High | Idea Workspace, Whiteboard, Mind Map, Process Flow | All four canvas tools share `IdeaWorkspaceGraph`. Conflict resolution must be graph-aware, not just object-aware. |
| R4 | Performance degradation under multi-user load | High | Whiteboard, Table | Whiteboard large-board rendering and Table large-dataset rendering are already performance concerns in single-user mode. Multi-user adds cursor/presence/event overhead. |
| R5 | V4 seam normalization introduces regressions | Medium | Idea Workspace, Whiteboard | Run V4 and platform paths in parallel during transition. Feature-flag the new collaboration layer. |
| R6 | CRDT/OT strategy not decided for Notebook | Medium | Notebook | Block-locking model is the recommended V8 interim. CRDT can be a later enhancement. |
| R7 | Facilitation seam migration breaks workshop flows | Medium | Whiteboard | Preserve V4 facilitation seams as fallback during migration. |
| R8 | Collaboration scope expansion for Notebook v3 | Medium | Notebook | Notebook v3 explicitly excludes versioning and approval. Collaboration requires at minimum operational versioning. This scope expansion must be acknowledged and approved. |

### 9.2 Per-tool risk summary

| Tool | Highest risk | Risk level |
|---|---|---|
| Idea Workspace | Shared graph concurrent writes (R3) | High |
| Whiteboard | Performance under multi-user load (R4) | High |
| Mind Map / Process Flow | Shared graph concurrent writes (R3) | High |
| Table | Cell-level locking granularity and schema changes under collaboration | High |
| Notebook | CRDT/OT strategy uncertainty (R6) and scope expansion (R8) | Medium-High |

---

## 10. Open questions and conflicts

### 10.1 No conflicts detected between canonical docs

After reading all ten canonical docs and three supporting anchors, no direct contradictions were found. The documents are layered consistently:

- The orchestration doctrine (§16) defines collaboration as a shared workspace concern — this aligns with the platform baseline approach.
- The Whiteboard SSOT (§7.6) defines facilitation session state — this aligns with the platform's reserved `facilitator` presence type.
- The Mind Map contract freeze lists collaboration as Stage 7 — this aligns with Wave 4 timing.
- The Table SSOT and readiness audit do not mention collaboration primitives — this confirms the "build from scratch" assessment.
- The Notebook v3 SSOT explicitly excludes versioning — this creates a scope tension (not a contradiction) with collaboration requirements.

### 10.2 Open questions requiring escalation

| # | Question | Context | Recommended resolution |
|---|---|---|---|
| Q1 | **Notebook versioning scope**: Notebook v3 explicitly excludes versioning, but collaboration requires at minimum operational versioning for conflict recovery. Should versioning be added to Notebook scope for V8? | NOTEBOOK_V3.md §9 vs collaboration requirements | Recommend adding minimal operational versioning (not full version history UI) to Notebook scope for V8 collaboration. |
| Q2 | **CRDT vs block-locking for Notebook**: WP-W1-MP-01 defers CRDT/OT strategy to Wave 2+ adapter level. Should Notebook commit to block-locking for V8, or wait for the CRDT strategy decision? | WP-W1-MP-01 §8.3 | Recommend block-locking for V8 with CRDT upgrade path. |
| Q3 | **Cross-canvas presence aggregation**: Should the workspace shell show one unified collaborator list across all canvases, or per-canvas presence? | IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md §16 | Recommend unified list with canvas-context indicator per collaborator. |
| Q4 | **Table room granularity**: Should a `CollaborationRoom` bind to the base, the table, or the view? Different granularities affect locking and presence semantics. | TABLE_V8_SSOT §6 (base → table → field → view → record → interface → form) | Recommend room-per-base with table/view context in presence metadata. Locking operates at cell/row level within the room. |
| Q5 | **AI proposal visibility scope under collaboration**: When one user requests an AI proposal (e.g., AI clustering in Whiteboard, AI schema change in Table), should the proposal be visible to all room members immediately, or only after the requesting user accepts? | Cross-cutting: WHITEBOARD_V8_SSOT §7.4, TABLE_V8_SSOT §8.13, Decision 5 (Wave 1) | Recommend: personal draft until user explicitly shares or accepts. Accepted proposals become room-visible events. |

### 10.3 Scope tension (not a conflict)

The Notebook v3 SSOT was written before the V8 multiplayer program. Its explicit exclusion of versioning and approval workflows reflects v3 scope, not a doctrinal prohibition. The V8 collaboration program may extend Notebook scope as needed, but this should be an explicit decision, not an implicit assumption.

---

## 11. Packet output

- **Status**: completed
- **Completed**:
  - Per-tool collaboration readiness matrix against all platform primitives
  - Detailed readiness assessment for all five workspace tools
  - Tool-specific collaboration features required for V8
  - Migration path from V4 seams and module-specific collaboration to platform primitives
  - Priority ordering aligned with V8 Master Program §8.5 Wave 4
  - Risk assessment (8 cross-cutting risks, per-tool risk summary)
  - 5 open questions requiring escalation
- **Key findings**:
  - Idea Workspace and Whiteboard have the strongest historical seams (V4) but need normalization to platform primitives
  - Table and Notebook have no collaboration layer and must build from scratch on platform primitives
  - Cell-level locking for Table and co-editing model for Notebook are the two highest-complexity collaboration challenges
  - All four canvas tools share `IdeaWorkspaceGraph`, making graph-aware conflict resolution (WP-W4-COLLAB-03) a hard prerequisite
  - Notebook v3 scope explicitly excludes versioning, creating a scope tension that requires explicit resolution
- **Blockers or risks**:
  - WP-W4-COLLAB-01 (platform architecture) and WP-W4-COLLAB-03 (conflict resolution) are hard prerequisites
  - Shared graph concurrent writes across canvases is the highest cross-cutting risk
  - CRDT/OT strategy for Notebook remains unresolved (block-locking recommended as interim)
- **Questions requiring escalation**:
  - Q1: Notebook versioning scope expansion for V8 collaboration
  - Q2: CRDT vs block-locking commitment for Notebook
  - Q3: Cross-canvas presence aggregation model
  - Q4: Table room granularity (base vs table vs view)
  - Q5: AI proposal visibility scope under collaboration
