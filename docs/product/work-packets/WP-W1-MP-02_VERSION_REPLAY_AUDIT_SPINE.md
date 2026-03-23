# WP-W1-MP-02 — Version, Replay and Audit Spine Analysis

> Packet: WP-W1-MP-02
> Wave: 1 — Platform and governance spine
> Track: A — Platform and runtime foundations / D — Collaboration and shared work
> Status: completed
> Owner: Product + Engineering
> Scope: normalized version, replay, and audit spine for multiplayer collaboration — making collaboration durable, explainable, and safe before deeper co-editing spreads
> Depends on: WP-W1-MP-01 (room model, presence model, event vocabulary, gateway semantics)

---

## 1. Collaboration event stream

### 1.1 Purpose

The collaboration event stream is the durable persistence layer for all room-visible collaboration activity. It transforms the ephemeral event vocabulary defined in WP-W1-MP-01 §3.2 into a queryable, immutable audit record.

WP-W1-MP-01 established two delivery tiers:

- **Ephemeral events** (cursor, selection, typing): best-effort, no persistence.
- **Durable events** (room lifecycle, membership, edit commits): at-least-once with idempotency keys.

This packet defines the persistence model for the durable tier.

### 1.2 Event types persisted

All durable events from the WP-W1-MP-01 vocabulary are persisted:

| Category | Persisted event types |
|---|---|
| Room lifecycle | `room.created`, `room.closed`, `room.error` |
| Membership | `member.joined`, `member.left`, `presence.stale_removed` |
| Collaboration | `edit.committed`, `edit.conflict`, `lock.acquired`, `lock.released` |
| System (durable subset) | `connection.degraded`, `connection.restored`, `sync.behind` |

Additionally, this packet introduces version and audit event types:

| Event type | Semantics |
|---|---|
| `version.snapshot_created` | A version snapshot was captured (see §2). |
| `version.restored` | A previous version was restored (see §3). |
| `version.compare_requested` | A diff/compare operation was initiated (informational). |
| `ai.proposal_submitted` | An AI proposal was submitted against a specific state version (see §7). |
| `ai.proposal_accepted` | An AI proposal was accepted into shared truth. |
| `ai.proposal_rejected` | An AI proposal was rejected. |
| `ai.proposal_stale` | An AI proposal was marked stale due to state advancement (see §7). |

### 1.3 Event record structure

Every persisted event carries:

| Field | Description |
|---|---|
| `event_id` | Globally unique identifier (UUID). |
| `room_id` | Room this event belongs to. |
| `resource_type` | Artifact family of the bound resource. |
| `resource_id` | Specific artifact instance. |
| `org_id` | Tenant scope — events never cross organization boundaries. |
| `actor_id` | Identity of the actor (user ID or AI agent ID). |
| `actor_type` | `human` or `ai_agent` (per Decision 5). |
| `event_type` | Canonical event type from the vocabulary above. |
| `sequence_number` | Monotonically increasing per-room sequence number (from WP-W1-MP-01 §3.3). |
| `timestamp` | Server-assigned UTC timestamp. |
| `payload` | Event-type-specific structured data (JSON). |
| `idempotency_key` | Deduplication key for at-least-once delivery. |
| `state_version_ref` | The `state_version` of the shared object at the time of this event (nullable — not all events carry this). |

### 1.4 Persistence model

- **Storage**: append-only event log, partitioned by `org_id` and `resource_id`.
- **Immutability**: persisted events are never modified or deleted during their retention window. Corrections are modeled as new compensating events, not mutations.
- **Ordering**: events within a room are strictly ordered by `sequence_number`. Cross-room ordering is not guaranteed (consistent with WP-W1-MP-01 §3.3).
- **Indexing**: events must be queryable by `room_id`, `resource_id`, `actor_id`, `actor_type`, `event_type`, and `timestamp` range.

### 1.5 Retention

- Baseline retention: **aligned with Decision 3** from the Wave 1 Decision Log — minimum 30 days for operational baseline.
- Events associated with version snapshots, approved mutations, or auditable incidents retain durability through the version snapshot and audit lineage (§6), not through infinite event retention.
- Retention policy must be configurable per organization (enterprise tenants may require longer retention).
- Ephemeral events are explicitly excluded from the durable stream and carry no retention obligation.

### 1.6 Queryability

The event stream must support the following query patterns:

| Query pattern | Purpose |
|---|---|
| All events for a resource within a time range | Timeline reconstruction (§4). |
| All events by a specific actor on a resource | Actor attribution audit (§5). |
| All events of a specific type across a room | Filtered replay (§4). |
| All `ai.proposal_*` events for a resource | AI proposal lifecycle audit (§7). |
| All `version.*` events for a resource | Version history browsing (§2). |
| Event count and last event per room | Room health diagnostics (support). |

---

## 2. Version snapshot model

### 2.1 What constitutes a version

A version snapshot is a point-in-time capture of a shared object's complete state. It represents a recoverable, comparable checkpoint in the collaboration history.

A version is not every individual edit. It is a meaningful boundary that enables compare and restore.

### 2.2 Snapshot triggers

Version snapshots are created by the following triggers:

| Trigger | Description |
|---|---|
| **Explicit save** | A user explicitly saves or checkpoints the shared object. |
| **Auto-snapshot on cadence** | The platform captures periodic snapshots based on artifact-family-declared cadence (e.g. every N minutes of active editing, or every N committed edits). |
| **Pre-restore snapshot** | Before any restore operation, the current state is automatically captured as a safety snapshot. |
| **AI proposal acceptance** | When an AI proposal is accepted into shared truth, a post-acceptance snapshot is captured. |
| **Session boundary** | When a collaboration room transitions from `active` to `idle` (all participants leave), a snapshot is captured if the state has changed since the last snapshot. |
| **Publish or review milestone** | When an artifact transitions through a visibility lifecycle stage (e.g. `draft → shared`, `shared → published` per `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4). |

### 2.3 Snapshot structure

| Field | Description |
|---|---|
| `snapshot_id` | Globally unique identifier (UUID). |
| `resource_type` | Artifact family. |
| `resource_id` | Specific artifact instance. |
| `org_id` | Tenant scope. |
| `state_version` | Monotonically increasing version counter for this resource. This is the canonical version reference used by AI proposals (§7) and event attribution (§1.3). |
| `snapshot_trigger` | Which trigger caused this snapshot (from the table above). |
| `actor_id` | Who or what triggered the snapshot. |
| `actor_type` | `human` or `ai_agent` or `system` (system for auto-cadence and session-boundary snapshots). |
| `timestamp` | Server-assigned UTC timestamp. |
| `room_id` | Room active at snapshot time (nullable — snapshot may be taken outside active room). |
| `last_event_sequence` | The `sequence_number` of the last event in the room at snapshot time (links snapshot to event stream position). |
| `content_ref` | Reference to the stored snapshot content (see §2.4). |
| `metadata` | Structured metadata: participant count at snapshot time, snapshot size, artifact-family-specific properties. |

### 2.4 Snapshot content and storage

- **Content format**: the full serialized state of the shared object at snapshot time. Format is artifact-family-specific (JSON document, graph structure, table schema + data, etc.).
- **Storage**: snapshots are stored separately from the event stream. They are large objects compared to events.
- **Deduplication**: if the state has not changed since the last snapshot (e.g. session boundary with no edits), no new snapshot is created.
- **Compression**: snapshot content should be stored compressed. Delta encoding between consecutive snapshots is an optimization that adapters may implement but is not required for the platform baseline.

### 2.5 Granularity

Snapshot granularity is artifact-family-declared through the concurrency strategy registry described in `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.4:

| Artifact family | Expected granularity |
|---|---|
| Document (Notebook) | Whole-document snapshot. |
| Canvas (Mind Map, Whiteboard, Process Flow) | Whole-canvas snapshot (all nodes, edges, stickies, lanes). |
| Table | Whole-table snapshot (schema + data + view definitions). |
| Output (Report, Presentation) | Whole-output snapshot (all sections/slides). |
| Review-only objects | Whole-object snapshot. |

The platform provides the snapshot framework. Each artifact-family adapter declares its `versioning_policy` including auto-snapshot cadence and content serialization format.

---

## 3. Compare and restore semantics

### 3.1 Diff model

Compare operations produce a structured diff between two version snapshots of the same resource.

| Property | Definition |
|---|---|
| `source_snapshot_id` | The earlier snapshot. |
| `target_snapshot_id` | The later snapshot. |
| `diff_type` | `structural` (additions, deletions, moves) and/or `content` (text changes, value changes). |
| `diff_entries` | Array of change records, each identifying the sub-object path, change type, and before/after values. |
| `actor_summary` | Aggregated attribution: which actors contributed changes between the two snapshots (derived from the event stream between `source.last_event_sequence` and `target.last_event_sequence`). |

The diff format is artifact-family-specific in its detail but follows a common envelope. The platform defines the envelope; adapters define the diff algorithm for their content type.

### 3.2 Restore behavior

Restore replaces the current shared object state with the content of a selected version snapshot.

Restore sequence:

1. **Authorization check**: only users with `owner` or `admin` permission on the resource may restore (see §3.4).
2. **Pre-restore snapshot**: the current state is automatically captured as a safety snapshot (trigger: `pre-restore`). This ensures the state before restore is never lost.
3. **State replacement**: the shared object state is replaced with the content from the selected snapshot.
4. **State version increment**: the `state_version` counter increments (restore is a forward operation, not a rewind of the version counter).
5. **Event emission**: a `version.restored` event is emitted with payload containing `restored_from_snapshot_id`, `pre_restore_snapshot_id`, and the new `state_version`.
6. **Room notification**: all active room members receive the restore event and must refresh their local state.
7. **AI proposal invalidation**: any pending AI proposals that reference a `state_version` older than the new post-restore version are marked stale (see §7).

### 3.3 Conflict on restore

If the resource has an active collaboration room with participants currently editing:

- Restore is **not blocked** but requires explicit confirmation from the restoring user that active collaborators will see their in-progress work replaced.
- The platform emits a `version.restored` event to all room members.
- Active editors receive a state-refresh signal. Their local pending (uncommitted) edits are lost unless the artifact-family adapter supports local stash/recovery (adapter-level concern, not platform baseline).
- The pre-restore safety snapshot preserves the state including all committed edits up to the restore moment.

### 3.4 Permission requirements

| Operation | Required permission |
|---|---|
| View version history | `viewer` or above on the resource. |
| Compare two versions | `viewer` or above on the resource. |
| Restore a version | `owner` or `admin` on the resource. |
| View actor attribution in history | `viewer` or above (actor names visible per organization policy). |

Source: `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §7.3 explicitly lists restoring a version as a permission-checked collaboration action.

---

## 4. Replay support

### 4.1 Purpose

Replay enables reconstruction of collaboration history for audit, debugging, and understanding how a shared object evolved. It is not a real-time playback animation (that is a UX concern for later waves) — it is the ability to walk through the durable event sequence and version snapshots to reconstruct what happened.

### 4.2 Timeline reconstruction

A replay timeline for a resource is constructed by:

1. Querying the event stream for all durable events on `resource_id` within the requested time range.
2. Ordering events by `sequence_number`.
3. Overlaying version snapshots at their `last_event_sequence` positions to provide state checkpoints.
4. Presenting the result as an ordered timeline of events with snapshot anchors.

The combination of events + snapshots allows:

- **Forward replay**: start from a snapshot, apply subsequent events to understand incremental changes.
- **Reverse lookup**: start from current state, walk backward through events to find when a specific change occurred.
- **Jump-to-version**: navigate directly to any snapshot without replaying intermediate events.

### 4.3 Filtering

Replay must support filtering by:

| Filter | Purpose |
|---|---|
| `actor_id` | Show only changes by a specific user or AI agent. |
| `actor_type` | Show only human changes or only AI changes. |
| `event_type` | Show only specific event categories (e.g. only `edit.committed`, only `version.*`). |
| `time_range` | Limit to a specific time window. |
| `sub_object_path` | Show only changes affecting a specific node, cell, section, etc. (requires adapter-level event payload indexing). |

### 4.4 Replay segments

For large collaboration histories, the platform defines `ReplaySegment` as a bounded window of the event stream:

| Field | Description |
|---|---|
| `segment_id` | Unique identifier. |
| `resource_id` | Bound resource. |
| `start_sequence` | First event sequence number in this segment. |
| `end_sequence` | Last event sequence number in this segment. |
| `start_snapshot_id` | Snapshot at or before `start_sequence` (entry point for state reconstruction). |
| `event_count` | Number of events in this segment. |
| `actor_summary` | Actors who contributed within this segment. |

Segments enable paginated replay and prevent the need to load entire collaboration histories into memory.

### 4.5 Access model for replay

- Replay access follows the same permission model as version history viewing: `viewer` or above on the resource.
- Support/operator roles have elevated replay access for diagnostics (see §6).
- Replay data respects organization boundaries — replay for a resource in `org_id: X` is never accessible from `org_id: Y`.

---

## 5. Actor attribution

### 5.1 Attribution model

Every durable event and every version snapshot carries explicit actor attribution through `actor_id` and `actor_type`.

### 5.2 Actor types

| `actor_type` | Description | Source |
|---|---|---|
| `human` | An authenticated human user. `actor_id` is the user's platform identity. | Standard. |
| `ai_agent` | An AI actor performing room-visible work. `actor_id` is the AI agent's platform identity. | **Decision 5**: AI visible as `ai_agent` presence type only when performing room-visible work. |
| `system` | Platform-initiated actions (auto-snapshots, stale cleanup, retention enforcement). `actor_id` is a well-known system identity. | Derived from platform operations. |

### 5.3 Decision 5 compliance

Decision 5 from the Wave 1 Decision Log states:

> AI is visible as an explicit, non-human collaborator only when performing room-visible work. Background AI not performing visible room work must not appear as an active collaborator.

Compliance in the version/replay/audit spine:

- **Room-visible AI work** (e.g. submitting a proposal, applying an accepted change): recorded with `actor_type: ai_agent` and the AI agent's identity. These events appear in the collaboration event stream, version history, and replay.
- **Background AI work** (e.g. indexing, precomputation, retrieval refresh): **not recorded in the collaboration event stream**. Background AI does not emit room events, does not appear in version history actor summaries, and does not create presence in rooms.
- **AI-assisted human edits** (e.g. user accepts an AI suggestion in their local editor): recorded with `actor_type: human` as the primary actor, with an optional `ai_assist_ref` in the event payload linking to the originating AI proposal. The human is the author; the AI contribution is traceable but not the primary attribution.

### 5.4 Decision 6 compliance

Decision 6 states:

> Top-level UX: one user = one avatar. Runtime may store multiple session endpoints per user.

Compliance in the version/replay/audit spine:

- The event stream records `actor_id` (user identity), not `client_id` (session/tab identity).
- `client_id` is stored in the event payload for debugging purposes but is not surfaced in version history, replay timelines, or audit summaries.
- Actor attribution in version history and replay always aggregates to the user level, never showing duplicate entries for multi-tab sessions.

### 5.5 Authorship tracking

For version history browsing and audit, the platform provides:

- **Per-snapshot actor summary**: which actors contributed changes since the previous snapshot.
- **Per-event actor**: who performed each specific action.
- **Per-resource actor timeline**: aggregated view of all actors who have contributed to a resource, ordered by first and last contribution.

---

## 6. Audit-grade collaboration history

### 6.1 What support/operator must be able to inspect

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §11 and `MULTIPLAYER_COLLABORATION_AND_CONCURRENT_WORK_RUNTIME_V8.md` §5.10:

| Inspection capability | Description |
|---|---|
| **Who edited what and when** | Full event stream with actor attribution for any resource. |
| **Who approved what** | AI proposal acceptance events with approver identity. |
| **What AI suggested** | AI proposal submission events with proposal content reference. |
| **What was merged** | Edit commit events showing what changes became shared truth. |
| **What was blocked** | Edit conflict events, lock acquisition/release, and permission denial records. |
| **What changed during a session** | Event stream filtered by room lifecycle (between `room.created` / `member.joined` and `member.left` / `room.closed`). |
| **Version restore history** | All `version.restored` events with before/after snapshot references. |
| **AI proposal staleness** | All `ai.proposal_stale` events showing when and why proposals were invalidated. |

### 6.2 Retention for audit

- The collaboration event stream follows the baseline 30-day retention from Decision 3.
- **Version snapshots** associated with approved mutations, publish milestones, or restore operations are retained beyond the event stream baseline through the audit lineage.
- Organizations with compliance requirements may configure extended retention.
- Deletion of audit records requires explicit policy-aware deletion (not silent expiry). The platform must log deletion events themselves.

### 6.3 Access model

| Role | Access |
|---|---|
| Resource viewer | Can see version history and actor summaries for resources they have access to. |
| Resource owner/admin | Full version history, restore capability, detailed event timeline. |
| Organization admin | Cross-resource audit queries within their organization. |
| Support/operator | Elevated diagnostic access: room health, event lag, stale presence incidents, restore traces, AI proposal lifecycle. Scoped by organization. |
| Superadmin | Cross-organization audit access for platform-level diagnostics (incident reconstruction). |

### 6.4 Immutability guarantees

- Persisted events are append-only and immutable during their retention window.
- Version snapshots are immutable once created.
- Corrections to the collaboration record are modeled as new compensating events, never as mutations to existing records.
- The audit trail must support incident reconstruction for collaboration failures (from `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.9).

---

## 7. AI proposal binding to collaboration state

### 7.1 Problem statement

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8:

> AI proposals must bind to shared object state version. AI must not mutate shared objects silently. Personal AI draft and team-visible AI proposal must be separate states.

When multiple users collaborate on a shared object, an AI proposal generated against version N may become invalid if the object advances to version N+3 before the proposal is reviewed.

### 7.2 Proposal-to-version binding

Every AI proposal submitted to a collaboration room must include:

| Field | Description |
|---|---|
| `proposal_id` | Unique identifier for the proposal. |
| `resource_id` | The shared object the proposal targets. |
| `state_version_ref` | The `state_version` of the shared object at the time the AI generated the proposal. |
| `snapshot_id_ref` | The snapshot closest to the state the AI operated on (for content verification). |
| `actor_id` | The AI agent identity. |
| `actor_type` | `ai_agent`. |
| `requesting_user_id` | The human user who initiated the AI action. |
| `proposal_content` | The proposed changes (format is artifact-family-specific). |
| `proposal_state` | Lifecycle state: `pending_review`, `accepted`, `rejected`, `stale`. |

### 7.3 Staleness detection

A proposal becomes stale when:

- The shared object's `state_version` has advanced beyond `proposal.state_version_ref`.
- Specifically: if `current_state_version > proposal.state_version_ref`, the proposal is potentially stale.

Staleness handling:

| Scenario | Behavior |
|---|---|
| Object advanced by human edits | Proposal marked `stale`. User may choose to re-request the AI proposal against the current version or force-apply with explicit acknowledgment. |
| Object advanced by another AI proposal acceptance | Proposal marked `stale`. Same re-request or force-apply options. |
| Object restored to an earlier version | All pending proposals are marked `stale` (the state they targeted no longer exists as current truth). |

The platform emits `ai.proposal_stale` events when staleness is detected.

### 7.4 Proposal lifecycle events

| Event | Trigger |
|---|---|
| `ai.proposal_submitted` | AI agent submits a proposal to the room. Payload includes `state_version_ref`. |
| `ai.proposal_accepted` | A human user (with appropriate permission) accepts the proposal. A post-acceptance version snapshot is captured. |
| `ai.proposal_rejected` | A human user rejects the proposal. |
| `ai.proposal_stale` | The platform detects version advancement past the proposal's `state_version_ref`. |

### 7.5 Visibility rules (Decision 5 compliance)

- AI proposals submitted to a room are **room-visible work**. The AI agent appears in the room as `ai_agent` presence type during proposal submission.
- Background AI computation (generating the proposal content before submission) is **not room-visible**. The AI does not appear in the room during generation.
- Once the proposal is submitted, it is a durable collaboration record visible to all room members with appropriate permissions.

### 7.6 Personal AI draft vs team-visible AI proposal

From `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §10:

> personal AI proposal and shared AI proposal must be separate states

- **Personal AI draft**: generated for a single user, not yet submitted to the room. Not visible to other collaborators. Not recorded in the collaboration event stream. Exists only in the requesting user's local/personal state.
- **Team-visible AI proposal**: submitted to the room via `ai.proposal_submitted`. Visible to all room members. Recorded in the collaboration event stream. Subject to staleness detection and review.

The transition from personal draft to team-visible proposal is an explicit user action (the user chooses to "propose to team" or equivalent). This transition emits the `ai.proposal_submitted` event and makes the AI agent momentarily visible in the room per Decision 5.

---

## 8. Downstream dependency map

| Dependent wave/packet | Dependency on this spine |
|---|---|
| **Wave 3 — Idea Workspace multiplayer baseline** | Requires version snapshots for workspace history, replay for workspace audit, and AI proposal binding for multiplayer-safe AI proposal review in workspaces. |
| **Wave 4 — Whiteboard and workshop facilitation** | Requires version snapshots for workshop state capture, replay for workshop outcome reconstruction, actor attribution for facilitation audit. |
| **Wave 5 — Mind Map and Process Flow collaboration** | Requires server-side version browser (built on snapshot model), per-node replay (built on filtered event replay), and branch-safe AI proposals (built on proposal-to-version binding). |
| **Wave 6 — Table collaboration** | Requires durable version history for table state, compare/restore for table recovery, and conflict audit trail for concurrent structured edits. |
| **Wave 7 — Notebook collaboration** | Requires version compare and restore for controlled co-editing, authorship tracking for knowledge artifact provenance. |
| **Wave 8 — Reports and Presentations collaboration** | Requires provenance-safe edit history, draft/approved/published version milestones, and AI-generated section attribution. |
| **Wave 9 — Tools, Interview, structured review** | Requires actor attribution and audit trail for session-based collaboration and review outcomes. |
| **Wave 10 — Notifications, policy, support, observability** | Requires the durable event stream as the source for notification triggers, retention-aware history for policy enforcement, and replay diagnostics for support incident reconstruction. |
| **Canvas OS Stage 6** | `CANVAS_OS_CONTRACT_FREEZE.md` Stage 6 acceptance criterion — "collaboration, review, and replay are durably persisted" — is directly satisfied by this spine. |
| **AI multiplayer safety (cross-cutting)** | AI proposal binding to state version (§7) is the foundation for multiplayer-safe AI across all artifact families. |

---

## 9. Open questions and conflicts

### 9.1 No conflicts detected between canonical docs

After reading all four canonical docs and three supporting anchors, no direct contradictions were found within the scope of this packet. The documents are consistent on:

- The need for one shared version/replay framework (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.6).
- Actor attribution requirements including AI (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.8, §10).
- The visibility lifecycle that version milestones must respect (`AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4).
- The rollout order placing this spine before module-specific collaboration (`MULTIPLAYER_IMPLEMENTATION_WAVES_AND_ROLLOUT_PROGRAM_V8.md` §6).
- Decision 5 and Decision 6 from the Decision Log are unambiguous and incorporated throughout.

### 9.2 Open questions

| # | Question | Context |
|---|---|---|
| 1 | **Auto-snapshot cadence per artifact family**: The platform defines the snapshot framework, but each artifact family must declare its `versioning_policy` including auto-snapshot cadence. These policies need product confirmation before Wave 3+ implementation. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.4 |
| 2 | **Snapshot storage sizing and lifecycle**: Whole-object snapshots for large canvases or tables may be storage-intensive. The platform needs a snapshot pruning/compaction policy (e.g. keep all snapshots for 30 days, then compact to daily snapshots for 1 year). This is an operational decision not yet specified in canonical docs. | Derived from §2.4 |
| 3 | **Restore UX during active collaboration**: The restore-during-active-editing behavior (§3.3) requires product UX confirmation — specifically, the confirmation dialog and the experience for editors whose uncommitted work is displaced. | `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §5.6 |
| 4 | **AI proposal staleness threshold**: Should staleness be triggered on any version advancement, or only on version advancement that affects the same sub-object region as the proposal? Region-aware staleness is more precise but requires adapter-level diff analysis. Platform baseline uses whole-object version comparison; region-aware staleness may be a later optimization. | Derived from §7.3 |
| 5 | **Cross-resource replay**: Some audit scenarios may require replaying collaboration across multiple related resources (e.g. a workspace and its child artifacts). Cross-resource replay is not defined in this baseline and may need a later packet if enterprise audit requirements demand it. | Implied by `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md` §11 |

### 9.3 Items not requiring escalation

The following items are noted but do not require escalation because they are explicitly deferred to later waves:

- CRDT vs OT strategy per artifact family (adapter-level, later waves).
- Module-specific collaboration UX for version history browsing (Wave 3+).
- Notification fan-out from version/audit events (Wave 10).
- Snapshot delta encoding optimization (adapter-level, not platform baseline).

---

## 10. Packet output

- **Status**: completed
- **Completed**:
  - Collaboration event stream model with persisted event types, record structure, retention, and queryability
  - Version snapshot model with triggers, structure, storage, and artifact-family granularity
  - Compare and restore semantics with diff model, restore sequence, conflict handling, and permission requirements
  - Replay support with timeline reconstruction, filtering, replay segments, and access model
  - Actor attribution model with Decision 5 and Decision 6 compliance for human, AI, and system actors
  - Audit-grade collaboration history with inspection capabilities, retention, access model, and immutability guarantees
  - AI proposal binding to collaboration state version with staleness detection, lifecycle events, and personal-vs-team visibility rules
  - Downstream dependency map covering all subsequent waves plus Canvas OS and cross-cutting AI safety
- **Remaining**: none within packet scope
- **Blockers or risks**:
  - Auto-snapshot cadence per artifact family needs product declaration before Wave 3+ implementation
  - Snapshot storage sizing/compaction policy needs operational planning before production scale
  - Restore-during-active-collaboration UX needs product confirmation
- **Questions requiring escalation**:
  - Snapshot storage lifecycle and compaction policy (question #2) — needs engineering + operations alignment
  - Restore UX during active collaboration (question #3) — needs product UX decision
