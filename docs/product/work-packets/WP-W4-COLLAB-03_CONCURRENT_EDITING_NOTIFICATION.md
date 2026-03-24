# WP-W4-COLLAB-03 — Concurrent Editing Model and Notification Spine Analysis

> Packet: WP-W4-COLLAB-03
> Wave: 4 — Collaboration and workspace hardening
> Track: D — Collaboration and shared work
> Status: completed
> Owner: Product + Engineering
> Scope: concurrent editing model, conflict resolution, locking strategies, notification spine, awareness model, AI actor concurrent editing, and offline/reconnect behavior as platform capabilities for all workspace tools
> Depends on: WP-W1-MP-01 (room/presence/event baseline), WP-W1-MP-02 (version/replay/audit spine)

---

## 1. Concurrent editing strategy per resource type

### 1.1 Governing principle

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §4:

`one collaboration platform, many artifact-specific collaboration contracts`

Different artifact families require different concurrency strategies. The platform provides the shared runtime (room, presence, events, versioning); each artifact family declares its `collaboration_mode`, `merge_strategy`, `lock_strategy`, `offline_policy`, `versioning_policy`, and `comment_anchor_strategy` through the concurrency strategy registry (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.4).

### 1.2 Strategy matrix

| Resource type | Collaboration mode | Concurrency strategy | Rationale |
|---|---|---|---|
| **Rich text / block documents** (Notebook) | Controlled co-editing | CRDT or OT at block/paragraph level | Benchmark signal from Google Docs and Notion: text collaboration requires operation-level merge. Notebook is not blocked on full CRDT for v8 baseline (`MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §6.2), but controlled co-editing with block-level anchors is required. |
| **Canvas objects** (Whiteboard, Mind Map, Process Flow) | Realtime co-editing with selective locks | Object-level CRDT + region/object-level advisory locks | Canvas surfaces need simultaneous manipulation of independent objects. Per-object CRDT state allows concurrent edits on different nodes/stickies. Advisory locks prevent two users from editing the same object simultaneously. Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.2. |
| **Structured data** (Table) | Field/row-level concurrency | Field-level last-write-wins with row-level optimistic locking | Tables need stricter concurrency than freeform surfaces. Row-level optimistic locking prevents lost updates on the same record. Field-level LWW allows different users to edit different columns of the same row. Schema changes require exclusive lock. Source: `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §10. |
| **Graph structures** (Mind Map nodes/edges, Process Flow) | Node/edge-level concurrency | Per-node/per-edge CRDT state with structural change review | Graph topology changes (add/remove node, reparent) are higher-risk than property edits. Property edits on different nodes are freely concurrent. Structural changes that affect topology should trigger review or confirmation when another user is editing the affected subgraph. |
| **Outputs** (Reports, Presentations) | Section/slide-anchored review + co-editing | Section-level optimistic locking with review gates | Outputs are polished deliverables. Free concurrent editing risks quality regression. Section-level locks allow parallel work on different sections. AI-generated sections require explicit review before becoming shared truth. Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §6.3. |
| **Formal workflow objects** (Initiatives, Tasks, Decisions) | Review-first mutation | Server-authoritative writes with approval semantics | These are governance-bearing artifacts. Concurrent free editing is inappropriate. Changes go through proposal → review → commit. Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.2. |
| **Interview artifacts** | Structured collaboration roles | Role-gated mutation with review overlay | Interview has distinct roles (interviewer, reviewer, owner, expert). Edits are role-constrained, not freely concurrent. Source: `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §6.4. |
| **Tool/workshop sessions** | Facilitated concurrent input | Phase-gated input with facilitator control | Concurrent input is structured by workshop phases (brainstorm, vote, synthesize). The facilitator controls phase transitions. Participant input is concurrent within a phase but phase transitions are serialized. Source: `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §8. |

### 1.3 Registry contract

Each artifact-family adapter must declare its strategy through the concurrency strategy registry. The registry entry structure (derived from `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.4):

| Field | Description |
|---|---|
| `resource_type` | Artifact family identifier. |
| `collaboration_mode` | `realtime_coediting`, `controlled_coediting`, `review_first`, `facilitated_input`, `role_gated`. |
| `merge_strategy` | `crdt_object_level`, `crdt_block_level`, `ot_block_level`, `field_lww`, `server_authoritative`. |
| `lock_strategy` | `none`, `advisory_object`, `optimistic_row`, `optimistic_section`, `exclusive_schema`, `exclusive_document`. |
| `offline_policy` | `queue_and_merge`, `queue_and_review`, `reject_on_reconnect`, `stale_warning`. |
| `versioning_policy` | Auto-snapshot cadence, snapshot granularity, retention tier. |
| `comment_anchor_strategy` | Anchor granularity: `block`, `node`, `edge`, `cell`, `row`, `section`, `slide`, `range`. |

---

## 2. Conflict resolution model

### 2.1 Conflict taxonomy

Conflicts arise when two or more actors attempt to modify the same logical unit concurrently. The platform defines a conflict taxonomy that adapters use to classify and resolve conflicts:

| Conflict class | Description | Typical resource types |
|---|---|---|
| **Concurrent property edit** | Two actors edit the same property of the same object simultaneously. | Canvas objects, table cells, document blocks. |
| **Structural conflict** | Two actors make incompatible structural changes (e.g. one deletes a node while another edits it). | Graph structures, document block reordering. |
| **Schema conflict** | Two actors attempt concurrent schema modifications. | Table (column add/rename/delete). |
| **State transition conflict** | Two actors attempt incompatible state transitions on a workflow object. | Initiatives, tasks, decisions. |
| **AI proposal vs human edit** | An AI proposal targets state that a human has since modified. | All resource types with AI support. |

### 2.2 Resolution strategies

| Strategy | Mechanism | When applied |
|---|---|---|
| **CRDT auto-merge** | Conflict-free replicated data types resolve concurrent edits deterministically without coordination. Each operation is commutative and convergent. | Canvas object properties, document block content (where CRDT is adopted). |
| **OT transform** | Operational transformation rebases concurrent operations against each other. Server acts as sequencer. | Rich text editing within blocks (alternative to CRDT where OT is already implemented). |
| **Last-write-wins (field-level)** | The most recent write to a specific field prevails. Earlier concurrent writes are silently overwritten. | Table cell edits on different fields of the same row. Acceptable only where field independence is guaranteed. |
| **Optimistic lock with retry** | The edit carries a version reference. If the server version has advanced, the edit is rejected and the client must refresh and retry. | Table row edits, section-level output edits, schema changes. |
| **Advisory lock with conflict warning** | A soft lock signals that another user is editing the same region. The system warns but does not block. The user may proceed, risking a merge conflict that requires manual resolution. | Canvas objects where strict locking would harm fluidity. |
| **Review-first gating** | Changes are submitted as proposals. No concurrent free editing. Conflicts are resolved through the review/approval process. | Formal workflow objects (initiatives, tasks, decisions). |
| **AI staleness detection** | AI proposals carry `state_version_ref`. If the object advances past that version, the proposal is marked stale. User may re-request or force-apply. | All AI proposals per WP-W1-MP-02 §7. |

### 2.3 Resolution priority hierarchy

When multiple resolution strategies could apply, the platform follows this priority:

1. **Safety first**: if a conflict involves governance-bearing data (decisions, approvals, published outputs), review-first gating always wins.
2. **Deterministic merge preferred**: where CRDT or OT can resolve automatically without data loss, prefer automatic resolution.
3. **User notification required**: if automatic resolution is not possible and data may be lost, the user must be notified and given a choice (accept server version, merge manually, or stash local changes).
4. **AI proposals never override human edits silently**: per `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8, AI must not mutate shared objects silently.

### 2.4 Conflict event flow

When a conflict is detected:

1. The platform emits an `edit.conflict` event to the room (per WP-W1-MP-01 §3.2).
2. The event payload includes: `conflict_class`, `affected_sub_object_path`, `actor_ids` involved, `resolution_strategy` applied or `requires_user_action`.
3. If automatic resolution succeeds, a follow-up `edit.committed` event confirms the merged state.
4. If user action is required, the conflicting client receives a conflict resolution prompt with options: accept server state, retry edit, or view diff.

---

## 3. Locking strategies

### 3.1 Lock taxonomy

| Lock type | Granularity | Behavior | Use case |
|---|---|---|---|
| **No lock** | — | Fully concurrent; conflicts resolved through merge strategies. | CRDT-backed canvas objects, CRDT-backed text blocks. |
| **Advisory object lock** | Single canvas object (node, sticky, shape) | Signals that a user is editing this object. Other users see a visual indicator. Does not prevent edits but warns of potential conflict. | Whiteboard objects, mind map nodes during property editing. |
| **Optimistic row lock** | Table row | Edit carries row version. Server rejects if version has advanced. Client must refresh and retry. | Table row edits. |
| **Optimistic section lock** | Report section, presentation slide | Edit carries section version. Same optimistic semantics as row lock. | Report and presentation co-editing. |
| **Exclusive schema lock** | Entire table schema | Only one user may modify schema at a time. Others see "schema edit in progress" and are blocked from schema changes (data edits continue). | Table column add/rename/delete/reorder. |
| **Exclusive document lock** | Entire document | Full exclusive access. Used only for critical operations like restore, bulk import, or format migration. | Version restore (per WP-W1-MP-02 §3.2), bulk data import. |
| **Phase lock (facilitation)** | Workshop phase | The facilitator controls phase transitions. Participant input is gated by the current phase. Not a traditional data lock but a workflow-level access gate. | Tool/workshop sessions. |

### 3.2 Lock lifecycle

All locks (except "no lock") follow a common lifecycle managed by the platform:

| Event | Semantics |
|---|---|
| `lock.acquired` | A lock is taken. Payload: `lock_type`, `lock_scope` (sub-object path), `holder_id`, `holder_client_id`, `ttl`. |
| `lock.released` | A lock is released. Payload: `lock_scope`, `previous_holder_id`, `release_reason` (explicit, timeout, disconnect). |
| `lock.expired` | A lock's TTL elapsed without renewal. Treated as automatic release. |
| `lock.denied` | A lock acquisition was denied because another holder already has it. |

Source: WP-W1-MP-01 §3.2 defines `lock.acquired` and `lock.released` as canonical collaboration event types.

### 3.3 Lock TTL and stale-lock recovery

- Every lock carries a TTL (time-to-live). If the holder does not renew or release within the TTL, the lock expires automatically.
- Lock renewal piggybacks on the heartbeat mechanism (WP-W1-MP-01 §2.3). If the holder's presence goes stale, their locks are released.
- Stale-lock recovery is server-side to prevent ghost locks from crashed clients.
- Recommended default TTL: aligned with the stale-presence cleanup threshold (e.g. 2× heartbeat interval).

### 3.4 Lock visibility

- Active locks are broadcast to all room members as awareness signals.
- Frontend renders lock indicators: avatar badge on locked objects, "editing" indicator on locked rows/sections, "schema change in progress" banner for exclusive schema locks.
- Lock state is ephemeral (not persisted in the durable event stream beyond `lock.acquired`/`lock.released` events). Lock state is reconstructed from the event stream if needed for audit.

---

## 4. Notification spine

### 4.1 Governing principle

From `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.9:

`comments, multiplayer, notifications and AI agents belong to one collaborative experience family`

The notification spine converts collaboration events into user-facing notifications. It is not a separate system — it consumes the same durable event stream established in WP-W1-MP-02 §1.

From `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.5:

`the platform should prefer summary over repetition, routing over broadcast, triage over endless notification volume`

### 4.2 Notification trigger taxonomy

| Collaboration event | Notification type | Recipients | Priority |
|---|---|---|---|
| `comment.created` (with @mention) | Mention notification | Mentioned user(s) | High |
| `comment.created` (on owned/watched resource) | Comment notification | Resource owner, thread participants, watchers | Medium |
| `comment.reply` | Reply notification | Thread participants | Medium |
| `review.requested` | Review request | Designated reviewer(s) | High |
| `review.completed` | Review outcome | Review requester, resource owner | High |
| `thread.unresolved` (after threshold) | Unresolved thread reminder | Thread owner, mentioned assignees | Medium |
| `ai.proposal_submitted` | AI proposal pending review | Room members with edit+ permission | Medium |
| `ai.proposal_stale` | Stale proposal warning | Requesting user | Low |
| `version.restored` | Restore notification | All active room members, resource owner | High |
| `edit.conflict` (requires user action) | Conflict resolution needed | Affected editor(s) | High |
| `member.joined` (to watched resource) | Collaborator joined | Resource owner (if preference enabled) | Low |
| `facilitation.invite` | Workshop invitation | Invited participants | High |
| `facilitation.phase_changed` | Phase transition | All session participants | Medium |
| `publish.ready` | Publish readiness | Resource owner, designated approvers | High |

### 4.3 Notification routing model

The notification spine routes notifications through a multi-channel delivery model:

| Channel | Use case | Delivery semantics |
|---|---|---|
| **In-app realtime** | User is currently active in the platform. | Delivered via the realtime gateway as a notification event. Appears in notification center and optionally as a toast/banner. |
| **In-app inbox** | Durable notification record. | Persisted to the user's inbox. Supports read/unread, snooze, and action states. Source: `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.2 — internal communication should materialize as inbox items. |
| **Email digest** | User is not currently active. | Batched delivery on configurable cadence (immediate for high priority, digest for medium/low). |
| **Push (future)** | Mobile notification. | Deferred to mobile expansion (Wave 8+ per `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.9). |

### 4.4 Notification deduplication and batching

- Multiple events of the same type on the same resource within a short window are batched into a single notification (e.g. "3 new comments on [resource]" instead of 3 separate notifications).
- If the user is currently present in the room where the event occurred, in-app realtime delivery is sufficient; inbox/email notifications are suppressed or deferred.
- Notification preferences are user-configurable per notification type and per resource.

### 4.5 Notification-to-work conversion

From `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.2, notifications should be convertible into:

- Follow-up task
- Approval request
- Decision candidate
- Note or knowledge capture

The notification spine must support action affordances on notifications: "Create task from this", "Mark as resolved", "Snooze", "Escalate".

### 4.6 Event-to-notification pipeline

```
Collaboration Event Stream (WP-W1-MP-02)
    │
    ▼
Notification Trigger Evaluator
    │  - matches event type to notification rules
    │  - resolves recipient list from room membership, resource ownership, mentions, watchers
    │  - applies deduplication and batching window
    │  - applies user notification preferences
    │
    ▼
Notification Dispatch
    │  - in-app realtime (via gateway)
    │  - in-app inbox (persisted)
    │  - email (queued)
    │
    ▼
Notification Record (durable)
    │  - notification_id, recipient_id, event_ref, channel, state (unread/read/actioned/snoozed)
```

### 4.7 AI role in notifications

From `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §6:

AI may:
- Summarize notification thread state
- Extract action items from notification context
- Suggest next review step

AI may not:
- Silently reassign accountability
- Silently resolve governance disputes
- Silently dismiss or suppress notifications

---

## 5. Awareness model

### 5.1 Awareness layers

The awareness model provides collaborators with real-time understanding of who is doing what. It operates in layers of increasing specificity:

| Layer | Signal | Persistence | Source |
|---|---|---|---|
| **Presence** | Who is in this room | Ephemeral (heartbeat-based) | WP-W1-MP-01 §2 |
| **Cursor/viewport** | Where is each collaborator looking | Ephemeral (best-effort) | WP-W1-MP-01 §3.2 (`cursor.moved`) |
| **Selection** | What has each collaborator selected | Ephemeral (best-effort) | WP-W1-MP-01 §3.2 (`selection.changed`) |
| **Typing indicator** | Who is actively typing/editing | Ephemeral (best-effort) | WP-W1-MP-01 §3.2 (`typing.indicator`) |
| **Active section indicator** | Which section/region is each collaborator working in | Ephemeral, derived from cursor/selection | Adapter-level derivation |
| **Lock indicator** | Which objects/regions are locked by whom | Ephemeral (lock lifecycle) | §3 of this document |
| **Edit activity** | Who recently committed an edit | Durable (event stream) | WP-W1-MP-01 §3.2 (`edit.committed`) |

### 5.2 Awareness signals per resource type

| Resource type | Cursor | Selection | Typing | Active section | Lock indicator |
|---|---|---|---|---|---|
| Rich text (Notebook) | Text cursor position | Text range highlight | Yes | Block/paragraph | Block advisory lock |
| Canvas (Whiteboard, Mind Map) | Pointer position on canvas | Selected object(s) highlight | N/A (no typing) | Viewport region | Object advisory lock |
| Table | Active cell highlight | Selected row/range | Yes (cell editing) | Active row/column | Row optimistic lock |
| Output (Report, Presentation) | Section cursor | Section/slide highlight | Yes (section editing) | Active section/slide | Section optimistic lock |
| Graph (Process Flow) | Pointer on canvas | Selected node(s)/edge(s) | N/A | Active subgraph region | Node/edge advisory lock |

### 5.3 Awareness delivery

- Awareness signals use the ephemeral event tier (best-effort, no persistence) per WP-W1-MP-01 §3.3.
- Delivery frequency is throttled to prevent flooding: cursor updates are batched (e.g. max 10 updates/second per client), typing indicators debounce after inactivity.
- Awareness events are broadcast to all room members except the originator.
- If the realtime gateway is degraded, awareness signals are the first to be dropped (graceful degradation).

### 5.4 Frontend rendering

Consistent awareness rendering across all surfaces (from `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §8.1–8.2):

| Element | Rendering |
|---|---|
| Presence avatars | Colored avatar stack in the resource header. One avatar per user (Decision 6). |
| Remote cursors | Colored cursor/pointer with user name label. Color is consistent per user across all surfaces. |
| Selection highlights | Semi-transparent colored overlay matching the user's cursor color. |
| Typing indicator | Animated indicator near the user's cursor position or in the collaborator list. |
| Active section | Subtle border or background tint on the section/region where a collaborator is working. |
| Lock badge | Lock icon with holder's avatar on locked objects/rows/sections. |
| "Someone is editing" | Text label on locked regions showing the holder's name. |

### 5.5 Awareness and privacy

- Awareness signals are scoped to the room. They are never visible outside the room's organizational and resource boundaries.
- Users cannot opt out of presence visibility while actively participating in a room (presence is a collaboration contract), but they may choose to observe without editing (presence type: `observer`).
- Cursor and selection sharing may be user-configurable in future iterations, but the platform baseline assumes full awareness for all active editors.

---

## 6. AI actor concurrent editing

### 6.1 Governing principles

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8:

- AI proposals must bind to shared object state version.
- AI authorship must be explicit.
- AI suggestions must be reviewable by a team.
- AI must not mutate shared objects silently.
- Personal AI draft and team-visible AI proposal must be separate states.

From Decision 5 (DECISION_LOG_WAVE_1.md):

- AI is visible as an explicit, non-human collaborator only when performing room-visible work.
- Background AI not performing visible room work must not appear as an active collaborator.

### 6.2 AI concurrent editing model

AI does not participate in the same concurrent editing model as human collaborators. Instead, AI operates through a proposal-based interaction:

| Phase | AI behavior | Room visibility | Conflict model |
|---|---|---|---|
| **Generation** | AI generates a proposal based on the current state version. This is background computation. | Not visible in room. No presence. | No conflict — AI reads a snapshot, does not hold locks. |
| **Personal draft** | The requesting user reviews the AI output privately before sharing. | Not visible to other collaborators. | No conflict — personal draft is isolated. |
| **Proposal submission** | User promotes the AI draft to a team-visible proposal. AI appears momentarily as `ai_agent` presence. | Visible to all room members. `ai.proposal_submitted` event emitted. | Staleness detection activates: if `state_version` has advanced, proposal is marked stale. |
| **Team review** | Room members review the AI proposal. | Proposal is visible as a pending review item. | Human edits during review advance `state_version`, potentially staling the proposal. |
| **Acceptance** | A user with appropriate permission accepts the proposal. Changes are applied to shared state. | `ai.proposal_accepted` event. Post-acceptance snapshot captured. | Acceptance is a server-authoritative write. If state has advanced since proposal, user must confirm force-apply or re-request. |
| **Rejection** | A user rejects the proposal. | `ai.proposal_rejected` event. | No state change. |

### 6.3 Interaction with human edits in progress

| Scenario | Behavior |
|---|---|
| Human is editing region X; AI proposal also targets region X | AI proposal is submitted with its `state_version_ref`. If the human commits before the proposal is reviewed, the proposal becomes stale. The reviewing user sees a staleness warning and may re-request. |
| Human commits edit; AI proposal was generated against pre-edit state | Proposal is marked stale via `ai.proposal_stale` event. |
| AI proposal is accepted while another human is editing the same region | The accepting user sees a confirmation dialog (similar to restore confirmation per Decision 17). The editing user receives a state-refresh signal. |
| Multiple AI proposals pending simultaneously | Each proposal carries its own `state_version_ref`. Accepting one advances the version, staling others that target overlapping regions. |

### 6.4 AI lock behavior

- AI does not acquire locks. AI proposals are non-blocking.
- AI proposals do not prevent human edits from proceeding.
- The only "blocking" effect is the review step: a team-visible proposal creates a review obligation, but it does not lock the underlying resource.

### 6.5 Audit trail for AI concurrent editing

Per WP-W1-MP-02 §5.3 and §7:

- Room-visible AI work is recorded with `actor_type: ai_agent`.
- Background AI work is not recorded in the collaboration event stream.
- AI-assisted human edits are recorded with `actor_type: human` and an optional `ai_assist_ref` in the payload.
- The audit trail distinguishes: human edit, AI suggestion, AI-applied change.

---

## 7. Offline/reconnect behavior

### 7.1 Governing principles

From `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.5:

- Reconnect semantics are required.
- Pending local changes handling is required.
- Stale-presence recovery is required.
- Conflict-aware resume after reconnect is required.
- Explicit degraded state when live collaboration is unavailable is required.

From WP-W1-MP-01 §5:

- Users can continue working in single-user mode when the gateway is down.
- On reconnect, clients must re-authenticate, re-join the room, receive state catch-up, and reconcile local pending changes.

### 7.2 Offline behavior per collaboration mode

| Collaboration mode | Offline editing allowed | Local change handling | Reconnect behavior |
|---|---|---|---|
| **CRDT-backed** (canvas, text) | Yes — local CRDT state continues to accept operations. | Operations are queued locally. | On reconnect, local operations are synced to server. CRDT merge resolves conflicts automatically. |
| **Optimistic lock** (table, output sections) | Limited — user may continue editing but cannot commit. | Edits are queued locally with a "pending sync" indicator. | On reconnect, queued edits are submitted with their version references. If version has advanced, user sees conflict resolution prompt. |
| **Review-first** (workflow objects) | No concurrent editing offline. | User may draft changes locally but cannot submit proposals. | On reconnect, user may submit their drafted proposal. If the object state has changed, the proposal is submitted against the current version (user must review diff). |
| **Facilitated sessions** | No — facilitation requires live coordination. | If disconnected during a session, the user's input for the current phase is preserved locally. | On reconnect, the user rejoins the session at the current phase. Missed phase transitions are caught up from the event stream. |

### 7.3 Degraded-state signals

From WP-W1-MP-01 §5.5, users must see consistent degraded-state indicators:

| State | User-facing signal | Behavior |
|---|---|---|
| `connection_degraded` | Banner: "Realtime collaboration temporarily unavailable. Your changes are saved locally." | Awareness signals stop. Edits continue locally. |
| `unsynced_local_changes` | Indicator on the resource: "X changes pending sync." | User sees which edits have not been confirmed by the server. |
| `reconnecting` | Transient banner: "Reconnecting…" | Automatic reconnect attempts with exponential backoff. |
| `reconnected` | Brief confirmation: "Back online. Syncing changes…" | State catch-up and conflict resolution proceed. |
| `sync_conflict` | Conflict resolution dialog. | User must choose: accept server state, merge manually, or view diff. |

### 7.4 Reconnect sequence

1. **Re-authenticate**: client re-establishes authenticated connection to the gateway.
2. **Re-join room**: client sends join request with `last_known_sequence_number`.
3. **State catch-up**: server sends missed durable events since `last_known_sequence_number` and current member list.
4. **Local change reconciliation**: adapter-specific. CRDT adapters merge automatically. Optimistic-lock adapters attempt to commit queued edits. Review-first adapters prompt user to re-submit.
5. **Presence restoration**: client's presence is restored in the room. Other members see the user rejoin.
6. **Lock recovery**: any locks held by the user before disconnection have been released by stale-lock cleanup. The user must re-acquire locks if needed.

### 7.5 Data safety guarantees

- **No silent data loss**: if local changes cannot be merged automatically, the user is always prompted. The platform never silently discards local edits.
- **Pre-reconnect snapshot**: for CRDT-backed resources, the local state before reconnect merge is preserved as a local recovery point (client-side). For optimistic-lock resources, queued edits are preserved until explicitly discarded by the user.
- **Stale presence cleanup**: per WP-W1-MP-01 §2.4, disconnected users are cleaned up server-side. The system never shows a user as present when they are disconnected.

---

## 8. Downstream dependency map

| Dependent wave/packet | Dependency on this analysis |
|---|---|
| **Wave 4 — WP-W4-COLLAB-01 (Room/presence/event platform)** | The concurrent editing strategies defined here determine which event types and lock semantics the platform layer must support. |
| **Wave 4 — WP-W4-COLLAB-02 (Tool-specific feature completeness)** | Tool-specific collaboration features must conform to the concurrency strategy declared for their resource type in §1.2. |
| **Multiplayer Waves 3–9 (per MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md)** | Each wave's artifact-family adapter must implement the concurrency strategy, lock model, and offline policy declared in this analysis. |
| **Wave 10 — Notifications, policy, support, observability** | The notification spine (§4) defines the event-to-notification pipeline that Wave 10 must implement. Notification trigger taxonomy and routing model are inputs. |
| **AI multiplayer safety (cross-cutting)** | The AI concurrent editing model (§6) defines the proposal-based interaction pattern that all AI-enabled collaboration surfaces must follow. |
| **Canvas OS Stage 6** | Canvas surfaces must implement the canvas-specific concurrency strategy (object-level CRDT + advisory locks) and awareness model defined here. |
| **WP-W1-MP-01 / WP-W1-MP-02 (platform baseline)** | This analysis consumes and extends the room/presence/event baseline and version/replay/audit spine. No conflicts with those baselines were found. |

---

## 9. Open questions and conflicts

### 9.1 No conflicts detected between canonical docs

After reading all canonical docs and supporting anchors, no direct contradictions were found within the scope of this packet. The documents are consistent on:

- The need for artifact-family-specific concurrency strategies (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.4).
- The requirement that AI must not mutate shared objects silently (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8).
- The notification doctrine preferring routing over broadcast (`INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.5).
- The event vocabulary and lock events already defined in WP-W1-MP-01.
- The AI proposal binding and staleness model in WP-W1-MP-02 §7.
- Decisions 5, 6, 16, and 17 from the Wave 1 Decision Log.

### 9.2 Open questions requiring attention

| # | Question | Context |
|---|---|---|
| 1 | **CRDT vs OT selection for rich text**: The canonical docs mention both CRDT and OT as valid strategies for text collaboration (`MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.2) but do not mandate one over the other. This is an engineering decision with significant implementation implications. The concurrency strategy registry must record the chosen approach before Notebook collaboration (Wave 7) begins. | `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.2 |
| 2 | **Advisory lock escalation to exclusive**: Should advisory locks be escalatable to exclusive locks if a conflict is detected? The canonical docs do not address lock escalation. This analysis proposes advisory locks remain advisory; exclusive locks are a separate acquisition. Product confirmation needed. | Derived from §3.1 |
| 3 | **Notification preference defaults**: The notification spine defines types and channels but does not specify default preference settings per notification type. Product must define which notifications are on-by-default and which are opt-in. | `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.5 |
| 4 | **Cross-resource notification aggregation**: When a user is mentioned in comments across multiple related resources (e.g. a workspace and its child artifacts), should notifications aggregate across resources or remain per-resource? The canonical docs do not specify. | Implied by `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md` §4.5 |
| 5 | **Offline editing duration limit**: Should there be a maximum offline editing duration after which local changes are considered too stale to merge? The canonical docs require offline support but do not define a staleness threshold for offline edits. | `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.5 |
| 6 | **Table field-level LWW and audit**: Last-write-wins at field level means some concurrent edits are silently overwritten. This is acceptable for low-risk data but may conflict with audit expectations for governance-sensitive table data. Should certain table columns be flagged as requiring optimistic locking instead of LWW? | `MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §10 |

### 9.3 Items not requiring escalation

The following items are noted but do not require escalation because they are explicitly deferred to later waves:

- Specific CRDT library or OT engine selection (engineering decision, not product doctrine).
- Notification UI design and interaction patterns (UX concern for implementation phase).
- Mobile push notification channel (deferred to mobile expansion per `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.9).
- Facilitation-specific notification types beyond the baseline (Wave 4 facilitation hardening).

---

## 10. Packet output

- **Status**: completed
- **Completed**:
  - Concurrent editing strategy per resource type with strategy matrix and registry contract (8 resource types covered)
  - Conflict resolution model with taxonomy (5 conflict classes), resolution strategies (7 strategies), and priority hierarchy
  - Locking strategies with taxonomy (7 lock types), lifecycle, TTL/stale-lock recovery, and visibility model
  - Notification spine with trigger taxonomy (14 notification types), routing model (4 channels), deduplication/batching, notification-to-work conversion, and event-to-notification pipeline
  - Awareness model with 7 awareness layers, per-resource-type signal matrix, delivery semantics, and frontend rendering contract
  - AI actor concurrent editing model with 6-phase interaction lifecycle, human-AI conflict scenarios, lock behavior, and audit trail
  - Offline/reconnect behavior with per-collaboration-mode offline policies, degraded-state signals, reconnect sequence, and data safety guarantees
  - Downstream dependency map covering all subsequent waves and cross-cutting concerns
- **Remaining**: none within packet scope
- **Blockers or risks**:
  - CRDT vs OT selection for rich text must be resolved before Notebook collaboration wave
  - Notification preference defaults need product decision before notification spine implementation
  - Table field-level LWW vs optimistic locking for governance-sensitive columns needs product alignment
- **Questions requiring escalation**:
  - CRDT vs OT selection for rich text (question #1) — needs engineering + product alignment
  - Cross-resource notification aggregation policy (question #4) — needs product UX decision
  - Table field-level LWW audit implications for governance-sensitive data (question #6) — needs product + compliance alignment
