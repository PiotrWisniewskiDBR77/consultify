# WP-W1-PMSYNC-01 — PM Sync Shared Platform Truth Analysis

> Packet: WP-W1-PMSYNC-01
> Wave: 1 — Shared platform truth
> Status: completed
> Produced by: worker agent (bounded)
> Sources: see §8 context pack

---

## 1. Connector auth lifecycle states

### 1.1 Canonical state enum

The auth lifecycle for every serious connector must expose exactly these states, drawn from `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §8:

| State | Meaning |
|---|---|
| `not_connected` | No connection attempt has been made; connector slot exists but no credential context is present. |
| `authorizing` | OAuth or credential flow is in progress; the user has been redirected or a token exchange is pending. |
| `connected_unverified` | Credential received but the platform has not yet confirmed token validity, granted scopes, reachable workspace or provider account identity. |
| `healthy` | Token valid, scopes confirmed, workspace reachable, connector actively usable for sync operations. |
| `refreshing` | Token refresh cycle in progress; transient state between `healthy` and either `healthy` (success) or `degraded_reauth_needed` (failure). |
| `degraded_reauth_needed` | Refresh or token use has failed. The connector cannot perform sync operations until the authorized actor completes reauth. |
| `revoked` | The provider or admin has explicitly revoked access. Connector preserves audit trace and last-known mapping state but cannot operate. |
| `disconnected` | The connection has been intentionally removed by admin or operator. Audit trace and connector history are preserved. |

### 1.2 State machine transitions

```
[not_connected]
    │
    ▼  (user initiates connect)
[authorizing]
    │
    ├──(callback success)──▶ [connected_unverified]
    │                              │
    │                              ▼  (verification pass)
    │                         [healthy]
    │                              │
    │                              ├──(token nearing expiry)──▶ [refreshing]
    │                              │                                 │
    │                              │    ┌──(refresh success)─────────┘
    │                              │    │
    │                              │    ▼
    │                              │  [healthy]
    │                              │
    │                              ├──(refresh failure / scope revoked / workspace lost)
    │                              │    │
    │                              │    ▼
    │                              │  [degraded_reauth_needed]
    │                              │    │
    │                              │    ├──(actor completes reauth)──▶ [authorizing] ──▶ ...
    │                              │    ├──(admin revokes)──▶ [revoked]
    │                              │    └──(admin disconnects)──▶ [disconnected]
    │                              │
    │                              ├──(admin revokes)──▶ [revoked]
    │                              └──(admin disconnects)──▶ [disconnected]
    │
    └──(callback failure / user cancels)──▶ [not_connected]
```

### 1.3 Transition rules

- `refreshing` is transient; it must resolve to `healthy` or `degraded_reauth_needed` within a bounded timeout.
- The platform must distinguish transient provider failure from true credential expiry before moving to `degraded_reauth_needed` (source: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §4.5).
- `revoked` and `disconnected` are terminal for the current credential context; a new connection attempt starts from `not_connected`.
- No state may be labeled with vague terms like `error` or `warning` without the specific state meaning (source: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §8).

### 1.4 Visibility contract per audience

| Audience | Must see |
|---|---|
| **Admin** | Full state, scopes, last verification, reauth state, provider depth |
| **Operator** | State, last refresh success/failure, failure classification (provider outage / token expiry / missing scope / revoked access / callback issue), whether queued sync is paused because of auth |
| **Support** | Non-technical explanation, reauth task routing, distinction between auth failure vs mapping vs business conflict |
| **User** | Honest sync state, what failed, whether action is needed from user/admin/operator |

Sources: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §9, `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §3–§6.

### 1.5 Reauth journey contract

The canonical reauth journey is:

`auth degraded → explain reason → show impact → offer reauth → verify recovery → resume runs`

The surface must explain (source: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §7):
- Why reauth is needed
- Which provider account is affected
- What business objects are impacted
- Whether sync is paused, partially degraded or publish-only
- What happens after successful reauth

Reauth must preserve: mapping state, provider identity context, object linkage where still valid.

### 1.6 Ownership doctrine

Every serious connector must declare (source: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §5):
- Whether it is org-owned, user-owned or mixed
- Who can connect it
- Who can reauth it
- Whose token/credential context powers runtime operations
- What happens if the original actor loses access

---

## 2. Provider depth model

### 2.1 Tier definitions

The canonical tier model is defined across `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` §3 and `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §5. The two documents are consistent and define four tiers:

| Tier | Name | Meaning | Target providers |
|---|---|---|---|
| **A** | Enterprise parity | Strong object mapping, strong OAuth lifecycle, bidirectional task sync, explicit conflict model, operator-grade diagnostics | Jira, one peer: Asana or Monday |
| **B** | Strong operational interoperability | Durable connector, structured object mapping, strong import/publish, scoped bidirectional sync for core fields, visible limitations | ClickUp, Linear |
| **C** | Scoped PM adjacency | Selected use cases only (import, publish, limited mirror), no false promise of full PM parity | Notion, email-origin work capture, messaging callbacks |
| **D** | Benchmark or future scope | Visible in roadmap, not yet promised as mature runtime parity | (unnamed future providers) |

### 2.2 Parity dimensions

Provider parity must be judged across these dimensions (source: `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` §4):

1. Auth maturity
2. Ownership and scope model
3. Task object mapping
4. Assignee model
5. Status and workflow model
6. Due-date and schedule semantics
7. Comment or review semantics
8. Conflict handling
9. Replay and supportability
10. UI honesty about limits

### 2.3 Labeling rules

- Every provider card and settings surface must show the provider tier (source: `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` §6).
- Sync modes supported must be visible (import / publish / bidirectional / mirror-with-local-authority).
- OAuth completion status must be visible.
- Bidirectional sync availability must be visible.
- InboxItem ingestion support must be visible.
- Biggest current limitations must be stated.

### 2.4 Display contract

**Forbidden behaviors:**
- Showing all PM connectors as equal when only one is truly mature.
- Implying bidirectional sync for providers that only support import or publish.
- Hiding missing permissions until runtime failure.
- Allowing connector enablement when required scopes are missing without explicit degraded warning.

**Required behaviors:**
- Provider depth badges must be honest from the first shipped surface (source: `PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md` §3).
- Settings, cards and docs must always expose connector depth honestly (source: `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §5).

### 2.5 Honest limitations principle

The depth model exists specifically to prevent the anti-pattern of marketing breadth without runtime truth. The canonical rule is:

> `do not add broad PM connector marketing before auth, inbox ingestion, conflict handling and operator recovery are truly usable`

Source: `PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md` §2.

---

## 3. Business-object sync status model

### 3.1 Canonical PM objects in scope for sync

Source: `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §3:

- `Task`
- `Decision`
- `InboxItem`
- `Initiative milestone`
- `Execution alert`
- `Review action`

Not every provider must support every object, but every provider must declare: supported objects, directionality, field authority, conflict behavior.

### 3.2 Per-object sync health states

Each synced business object must expose the following health model:

| Property | Description |
|---|---|
| `sync_state` | One of: `synced`, `syncing`, `stale`, `conflict`, `error`, `dead_letter`, `not_linked` |
| `last_sync_success_at` | Timestamp of last successful bidirectional or directional sync for this object |
| `last_sync_attempt_at` | Timestamp of last sync attempt (success or failure) |
| `last_sync_error_class` | If failed: the conflict class or error classification (see §4) |
| `staleness_threshold` | Configurable per-connector; if `now - last_sync_success_at > threshold`, object is `stale` |
| `connector_auth_state` | Inherited from the parent connector; if `degraded_reauth_needed`, the object is impacted |
| `external_object_id` | Provider-side identifier for traceability |
| `external_object_url` | Deep link to the provider-side object where available |
| `field_authority_map` | Per-field source-of-truth declaration |
| `sync_direction` | `import`, `publish`, `bidirectional`, `mirror_local_authority` |

### 3.3 Sync state definitions

| State | Meaning |
|---|---|
| `synced` | Object is current; last sync succeeded within staleness threshold |
| `syncing` | Sync operation is in progress for this object |
| `stale` | Last successful sync exceeds staleness threshold; data may be outdated |
| `conflict` | A conflict has been detected and awaits resolution (see §4) |
| `error` | Sync failed for a non-conflict reason (auth, permission, provider outage, mapping failure) |
| `dead_letter` | Unrecoverable sync failure; item moved to dead-letter queue for operator inspection |
| `not_linked` | Object exists locally but has no external sync binding |

### 3.4 Staleness model

- PM surfaces should show when linked work is stale because auth degraded (source: `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §10).
- Staleness is not just a timestamp comparison; it must also reflect whether the parent connector is in `degraded_reauth_needed` or `disconnected` state.
- The staleness threshold should be configurable per connector family (PM connectors may tolerate shorter staleness than document connectors).

### 3.5 Error classification at object level

When a per-object sync fails, the error must be classified as one of:

| Error class | Description |
|---|---|
| `auth_failure` | Parent connector auth is degraded |
| `permission_denied` | Token valid but insufficient scope for this object/operation |
| `provider_outage` | External system temporarily unreachable |
| `mapping_failure` | Object or field mapping is invalid or incomplete |
| `business_conflict` | See conflict classes in §4 |
| `rate_limited` | Provider rate limit exceeded; retry scheduled |
| `target_not_found` | External object has been deleted or moved |

Source: synthesized from `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §9 (operator failure classification) and `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11.

---

## 4. Conflict-class vocabulary

### 4.1 Canonical conflict classes

Source: `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11. These are provider-agnostic:

| Conflict class | Definition | Typical trigger |
|---|---|---|
| `field_authority_conflict` | Both sides have updated a field where authority is declared, and the updates diverge | Concurrent title or description edit |
| `concurrent_edit_conflict` | Same field edited on both sides within the same sync window | Status changed locally and externally between polls |
| `status_model_conflict` | External status value has no valid mapping to local status model or vice versa | Provider uses a custom workflow state not mapped |
| `identity_or_mapping_conflict` | Object identity or mapping reference is broken or ambiguous | External object ID changed, project moved, or mapping stale |
| `permission_or_scope_conflict` | Sync operation blocked by insufficient permissions on one side | Token scope reduced after initial setup |
| `deleted_or_missing_target_conflict` | One side's object has been deleted or is no longer accessible | Jira issue archived, local task soft-deleted |
| `stale_snapshot_conflict` | Sync attempted with an outdated snapshot; the source data has changed since fetch | Long-running sync batch with intervening edits |

### 4.2 Conflict metadata contract

Every conflict instance must expose (source: `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11):

- The affected business object (type + ID)
- The external object (provider + ID)
- The conflicting fields
- The last known winning authority
- The run in which the conflict appeared
- The next allowed actions

### 4.3 Conflict severity model

Derived from the resolution urgency implied by the canonical docs:

| Severity | Meaning | Example |
|---|---|---|
| `blocking` | Sync for this object is halted until resolution | `identity_or_mapping_conflict`, `deleted_or_missing_target_conflict` |
| `degraded` | Sync continues for non-conflicting fields; conflicting field is frozen at last-known-good | `field_authority_conflict`, `concurrent_edit_conflict` |
| `informational` | Conflict logged but auto-resolved by declared authority rules | `stale_snapshot_conflict` with clear winner |

### 4.4 Resolution paths

| Path | Description |
|---|---|
| `auto_resolve_by_authority` | Declared field authority determines winner; no human intervention needed |
| `manual_review` | Conflict queued for operator or object owner to inspect and choose |
| `remap` | Mapping is broken; operator must update mapping configuration |
| `replay_after_fix` | Underlying issue fixed (auth, permission, mapping); replay the failed sync |
| `dismiss` | Operator acknowledges the conflict and marks it as accepted divergence |
| `escalate` | Conflict requires platform-level or cross-team decision |

### 4.5 Provider-agnostic naming rule

The canonical rule is:

> `sync failures can be classified without provider-specific wording only`

Source: `PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md` §5 Wave 1 definition of done.

All conflict classes, error classes and resolution paths must use the shared vocabulary above. Provider-specific details (e.g., "Jira transition ID mismatch") are attached as metadata, not as the primary classification.

---

## 5. Operator and support visibility baseline

### 5.1 Four required surfaces

Source: `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §2:

1. **Admin setup surface** — provider, connection state, scopes, mapping status, last verification, reauth state, provider depth
2. **Operator runtime surface** — active/queued/failed runs, retries, dead-lettered items, conflict cases, provider health, object-level replay actions
3. **Support incident surface** — incident reconstruction, lookup by object/run, affected business objects, support notes, replay/escalate, classify auth vs mapping vs provider vs business conflict
4. **User explanation surface** — why disconnected, why delayed, what failed, what user can do, whether reauth needed

### 5.2 Baseline requirements before provider rollout

Before any provider-specific implementation (Wave 4+), the platform must have:

| Capability | Rationale |
|---|---|
| Connector state visibility (all 8 auth states) | Operators must see real state, not vague "connected/error" |
| Per-object sync state display | Operators must inspect sync health at business-object level |
| Failure classification display | Support must distinguish auth / mapping / provider / business conflict |
| Conflict queue (read-only at minimum) | Conflicts must be visible even if replay is not yet built |
| Staleness indicators on PM surfaces | Users must see when linked work is stale due to auth or sync failure |
| Provider depth badge on connector cards | Honest labeling from first shipped surface |
| Reauth routing | Support must be able to route reauth task to the right owner |
| Run history per connector | At minimum: last success, last failure, error class |

### 5.3 What is NOT required at baseline (deferred to later waves)

- Full replay and dead-letter tooling (Wave 3)
- Object-level replay actions (Wave 3)
- Provider-specific diagnostic panels (Wave 4+)
- InboxItem ingestion visibility (Wave 2)

---

## 6. Downstream dependency map

### 6.1 What depends on this baseline

| Downstream wave/packet | Dependency on this baseline |
|---|---|
| **Wave 2 — External → InboxItem ingestion** | Requires shared sync status model and error classification to properly surface ingestion failures |
| **Wave 3 — Conflict and replay infrastructure** | Requires the conflict-class vocabulary and severity model defined here; builds replay/dead-letter on top of the conflict queue concept |
| **Wave 4 — Jira Tier A hardening** | Requires auth lifecycle states, provider depth enum, per-object sync status, conflict classes; Jira is the first provider to implement against these shared primitives |
| **Wave 5 — First non-Jira Tier A peer** | Same shared primitives; the peer provider must use the same state machine, depth model and conflict vocabulary |
| **Wave 6 — ClickUp/Linear Tier B** | Shared primitives at Tier B subset; depth labeling must already be in place |
| **Connector Implementation Plan Wave B** | Easy connection shell requires auth states and provider depth badges to be defined |
| **Connector Implementation Plan Wave D** | PM interoperability wave requires all four deliverables from this baseline |
| **Connector Implementation Plan Wave G** | Operator excellence wave builds on the visibility baseline defined here |

### 6.2 Hard dependency rule

Source: `PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md` §6:

> Wave 1 before Waves 4 to 6

This baseline is a hard prerequisite for all provider-specific work. No provider connector may ship without implementing against these shared primitives.

### 6.3 Cross-track dependency

Source: `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.2 and §13:

PM sync shared platform truth is one of three P0 packets in Wave 1 of the master program, alongside AI runtime spine and multiplayer platform baseline. It is listed as a cross-cutting foundation that unblocks later modules.

---

## 7. Open questions and conflicts

### 7.1 Tier D presence inconsistency

`TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §5 defines four tiers (A, B, C, D). `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` §3 defines three tiers (A, B, C) without mentioning Tier D.

**Assessment:** This is a minor inconsistency, not a true conflict. The Tier D concept ("benchmark or future scope") is additive and does not contradict the three-tier model. However, the canonical enum should be aligned to either three or four tiers before implementation.

**Recommendation:** Escalate for a one-line decision: should the shared enum include Tier D or stop at Tier C?

### 7.2 Sync status model not yet canonically defined at object level

The canonical docs define conflict classes (`TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11) and auth states (`CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §8), but no single doc defines the per-object sync health state enum (`synced`, `stale`, `conflict`, etc.) at the same level of authority.

**Assessment:** This analysis synthesizes the per-object model from multiple sources. The synthesis is consistent with all canonical docs but has not been explicitly ratified as its own canonical enum.

**Recommendation:** The per-object sync status model in §3 of this document should be reviewed and promoted to canonical status in a future doc update.

### 7.3 Wave numbering alignment between two planning docs

`PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md` uses Waves 1–6 for PM-specific delivery. `V8_IMPLEMENTATION_MASTER_PROGRAM.md` uses Waves 0–8 for the whole program. `CONNECTOR_IMPLEMENTATION_PLAN_V8.md` uses Waves A–G for the connector platform.

**Assessment:** These are three different but non-conflicting wave numbering schemes scoped to different planning levels. However, cross-referencing between them requires care.

**Recommendation:** No escalation needed, but any implementation tracker should maintain an explicit mapping between PM-sync waves, master-program waves and connector-plan waves.

### 7.4 Non-Jira Tier A peer selection not yet made

Multiple docs reference "Asana or Monday" as the first non-Jira Tier A peer, but the selection has not been made.

**Assessment:** This is an expected open decision for Wave 5, not a conflict. It does not block Wave 1 shared platform truth.

**Recommendation:** No escalation needed for this packet. The decision is correctly deferred.

### 7.5 `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` referenced but not in context pack

`DOCUMENTATION_REGISTRY.md` lists `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` as the highest authority for sync modes, field authority model, direction semantics, conflict classes and conflict-resolution policy. This document was not included in the context pack for this work packet.

**Assessment:** The conflict-class vocabulary in this analysis is drawn from `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11, which is consistent with what is referenced. However, there may be additional detail in the dedicated conflict-resolution doc.

**Recommendation:** Before promoting the conflict vocabulary to implementation-grade, verify alignment with `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`.

---

## 8. Packet output

- **Status:** completed
- **Completed:**
  - Connector auth lifecycle state machine (8 states, transitions, visibility per audience)
  - Provider depth model (4 tiers, 10 parity dimensions, labeling rules, display contract)
  - Business-object sync status model (7 sync states, staleness model, error classification)
  - Conflict-class vocabulary (7 classes, severity model, 6 resolution paths, provider-agnostic naming rule)
  - Operator and support visibility baseline (4 surfaces, 8 baseline capabilities)
  - Downstream dependency map (8 dependent waves/packets, hard dependency rule)
- **Remaining:**
  - None within packet scope
- **Blockers or risks:**
  - Per-object sync status enum is synthesized, not yet ratified as canonical (low risk — consistent with all sources)
  - `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` not cross-checked (medium risk — may contain additional conflict detail)
- **Questions requiring escalation:**
  - Should the shared provider depth enum include Tier D (benchmark/future) or stop at Tier C? (`TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` says 4 tiers; `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` says 3)
  - Should the per-object sync status model (`synced`, `stale`, `conflict`, etc.) be promoted to a canonical enum in a dedicated doc or added to an existing canonical doc?
  - Should `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` be added to the context pack for conflict-vocabulary validation before implementation begins?
