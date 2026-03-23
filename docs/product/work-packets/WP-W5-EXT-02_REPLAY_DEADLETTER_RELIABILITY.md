# WP-W5-EXT-02 — Replay, Dead-Letter and Edge Reliability Analysis

> Packet: WP-W5-EXT-02
> Wave: 5 — External-world and operator hardening
> Status: completed
> Produced by: worker agent (bounded)
> Sources: see §9 context pack

---

## 1. Dead-letter queue model

### 1.1 Canonical definition

A dead-letter record captures a sync item that the runtime cannot safely process after exhausting all retry attempts. The concept is established across three canonical sources:

- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md` §5 — defines `DeadLetterRecord` as a first-class runtime object.
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` §5 — defines dead-letter doctrine: if runtime cannot safely process an event or job, it must create a dead-letter record.
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` §6A — defines dead-letter as a terminal conflict state for the current sync attempt, not a permanent discard.

All three sources are consistent. Dead-letter is not a garbage bin; it is a durable, operator-visible holding state with a mandatory recovery path.

### 1.2 Dead-letter record schema

Synthesized from `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md` §5 and `CONNECTOR_EVENT_CATALOG_V8.md` §3 (envelope fields):

| Field | Source | Description |
|---|---|---|
| `dead_letter_id` | Runtime model | Unique identifier for the dead-letter record |
| `original_job_ref` | Runtime model §5 | Reference to the `ConnectorJob` that produced this dead-letter |
| `original_payload_ref` | Runtime model §5 | Reference to the original payload blob for forensic inspection |
| `event_name` | Event catalog §3 | The canonical event that triggered the failed processing |
| `connector_id` | Event catalog §3 | The connector installation that owns this item |
| `installation_id` | Event catalog §3 | Installation context |
| `org_id` | Event catalog §3 | Tenant context |
| `provider_key` | Event catalog §3 | Provider family identifier |
| `object_type` | Event catalog §3 | Business object type (Task, Decision, InboxItem, etc.) |
| `object_ref` | Event catalog §3 | Business object identifier |
| `reason` | Runtime model §5 | Structured reason for dead-lettering (maps to error class or conflict class) |
| `error_class` | WP-W1-PMSYNC-01 §3.5 | Canonical error classification: `auth_failure`, `permission_denied`, `provider_outage`, `mapping_failure`, `business_conflict`, `rate_limited`, `target_not_found` |
| `conflict_class` | WP-W1-PMSYNC-02 §2.6 | If reason is a conflict: one of the 9 canonical conflict classes |
| `replay_eligibility` | Runtime model §5 | Whether this item can be replayed (`eligible`, `blocked`, `requires_fix`) |
| `retry_count` | Event catalog §3 | Number of attempts before dead-lettering |
| `last_attempt_at` | Derived from attempt model | Timestamp of the final failed attempt |
| `dead_lettered_at` | Runtime event | Timestamp when the item entered dead-letter state |
| `correlation_id` | Event catalog §3 | Correlation chain for tracing |
| `operator_note` | Runtime model §5 | Free-text operator annotation for support context |
| `resolution_state` | Sync modes §6A | One of: `pending_review`, `replayed`, `dismissed`, `escalated`, `remapped` |

### 1.3 Entry conditions

An item enters dead-letter state when any of the following conditions are met:

| Condition | Source |
|---|---|
| Retry threshold exhausted for a retriable error | Edge reliability §3 (`dead_letter_after_threshold` retry class) |
| Non-retriable error encountered | Edge reliability §3 (`do_not_retry` class) |
| Unrecoverable conflict with `high` severity | Sync modes §4A (severity model, Decision 18) |
| Schema or mapping failure that cannot be auto-resolved | Event contracts §3 (breaking change without migration) |
| Circuit breaker open and item has exceeded maximum queue time | Edge reliability §4 |

### 1.4 Classification on entry

Every dead-letter record must be classified at creation time with:

1. **Error class** — from the canonical error classification (WP-W1-PMSYNC-01 §3.5).
2. **Conflict class** — if the failure is a business conflict, from the 9-class vocabulary (WP-W1-PMSYNC-02 §2.6).
3. **Replay eligibility** — whether the item can be replayed after a fix, or is permanently unresolvable.
4. **Severity** — inherited from the conflict severity model (`low`, `medium`, `high`) per Decision 18.

### 1.5 Relationship to per-object sync status

When an item enters dead-letter, the corresponding business object's `sync_state` transitions to `dead_letter` (WP-W1-PMSYNC-02 §3.3). This is an object-level terminal state that is independent of the parent connector's health state — a connector may be `healthy` while individual objects are dead-lettered due to business conflicts.

---

## 2. Replay semantics

### 2.1 Canonical replay doctrine

`CONNECTOR_EVENT_CATALOG_V8.md` §6 defines the core replay doctrine:

- Replay must preserve: original event name, original source timestamps, replay reason, replay operator, replay time.
- Replay must never silently erase the original event trail.

`CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md` §2 defines `ReplayRequest` as a first-class runtime object.

### 2.2 Replay triggers

| Trigger | Type | Description |
|---|---|---|
| Operator-initiated replay | Manual | Operator inspects dead-letter item, fixes underlying issue, triggers replay |
| `replay_after_fix` resolution | Manual | Conflict resolved via fix (auth, permission, mapping); replay preserves audit lineage to original attempt (Sync modes §6, Decision 18) |
| Webhook replay | Manual/Automated | `connector.webhook.replayed` event (Event catalog §4.4) |
| Scheduled retry escalation | Automatic | Item in `dead_letter_after_threshold` class that becomes eligible after provider recovery |
| Bulk replay | Manual | Operator selects multiple dead-letter items sharing a common root cause and replays as a batch |

### 2.3 Replay request schema

Derived from `ReplayRequest` (Runtime model §2) and replay doctrine (Event catalog §6):

| Field | Description |
|---|---|
| `replay_request_id` | Unique identifier |
| `dead_letter_id` | Reference to the dead-letter record being replayed |
| `original_event_name` | Preserved from the original event |
| `original_occurred_at` | Preserved from the original event timestamp |
| `replay_reason` | Structured reason: `auth_fixed`, `mapping_corrected`, `provider_recovered`, `permission_granted`, `manual_override`, `schema_migrated` |
| `replay_operator` | Identity of the operator or system that initiated replay |
| `replay_requested_at` | Timestamp of replay request |
| `replay_status` | `queued`, `running`, `succeeded`, `failed`, `re_dead_lettered` |
| `correlation_id` | Links to original correlation chain |
| `new_job_ref` | Reference to the new `ConnectorJob` created for this replay |

### 2.4 Replay execution rules

1. **Idempotency requirement** — Every replay must be safe to process more than once (Event catalog §5: "webhook and sync-triggered writes must be safe to process more than once").
2. **Duplicate suppression** — The replay system must check the `idempotency_key` from the original event to prevent double-application if the original actually succeeded but was not acknowledged.
3. **Audit trail preservation** — A replayed item creates a new `ConnectorJobAttempt` linked to a new `ConnectorJob`, with explicit back-reference to the original dead-letter record and original job.
4. **Failure handling** — If replay fails, the item returns to dead-letter with an incremented retry count and updated `last_attempt_at`. The `resolution_state` transitions to `re_dead_lettered` if the replay itself fails.

### 2.5 Replay eligibility rules

Not all dead-letter items are replay-eligible. Eligibility depends on the error/conflict class:

| Error/conflict class | Replay eligible? | Condition for replay |
|---|---|---|
| `auth_failure` | Yes, after fix | Connector must return to `healthy` state |
| `permission_denied` | Yes, after fix | Scope must be restored or expanded |
| `provider_outage` | Yes, automatic | Provider health check must pass |
| `mapping_failure` | Yes, after fix | Mapping must be corrected by operator |
| `rate_limited` | Yes, automatic | Rate limit window must have elapsed |
| `target_not_found` | Conditional | Only if object is restored or remapped |
| `simultaneous_edit` | Yes | Conflict must be resolved first |
| `schema_mismatch` | Yes, after fix | Schema migration must be applied |
| `missing_mapping` | Yes, after fix | Mapping must be configured |
| `identity_ambiguity` | Yes, after remap | Identity must be disambiguated |
| `deleted_remote_object` | Conditional | Only if object is restored externally |
| `deleted_local_object` | Conditional | Only if object is restored locally |
| `field_authority_conflict` | Yes | Authority must be declared or conflict resolved |
| `stale_snapshot_conflict` | Yes, automatic | Fresh snapshot must be obtained |

### 2.6 Replay event contract

When a replay occurs, the following canonical events are emitted:

- `connector.runtime.retry_scheduled` — when replay is queued (Event catalog §4.6)
- `connector.webhook.replayed` — when a webhook event is replayed (Event catalog §4.4)
- `connector.sync.started` → `connector.sync.succeeded` or `connector.sync.failed` — standard sync lifecycle for the replay job (Event catalog §4.2)
- `connector.runtime.dead_lettered` — if replay fails and item returns to dead-letter (Event catalog §4.6)

---

## 3. Edge reliability (rate limiting, circuit breakers, backoff)

### 3.1 Canonical reliability controls

`CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` §2 defines six standardized controls:

| Control | Purpose |
|---|---|
| Timeouts | Bounded wait time for external API calls |
| Retries | Automatic retry with classification-aware policy |
| Rate limits | Respect provider rate limits; enforce platform-side limits |
| Circuit breakers | Prevent cascading failure when a provider is degraded |
| Ingress validation | Validate webhook payloads before processing |
| Backpressure handling | Manage queue depth when processing cannot keep up |

### 3.2 Retry classification model

`CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` §3 defines four canonical retry classes:

| Retry class | Behavior | Dead-letter path |
|---|---|---|
| `safe_retry` | Immediate retry, idempotent operation, low risk | After max attempts → dead-letter |
| `retry_with_backoff` | Exponential backoff with jitter, transient failure expected | After max attempts → dead-letter |
| `do_not_retry` | Non-retriable error (e.g., 400 Bad Request, permanent auth revocation) | Immediate dead-letter |
| `dead_letter_after_threshold` | Retry up to threshold, then dead-letter for operator review | Dead-letter after N attempts |

Mapping retry classes to error classes:

| Error class | Default retry class |
|---|---|
| `auth_failure` | `do_not_retry` (requires human intervention for reauth) |
| `permission_denied` | `do_not_retry` (requires scope change) |
| `provider_outage` | `retry_with_backoff` |
| `mapping_failure` | `do_not_retry` (requires operator fix) |
| `rate_limited` | `retry_with_backoff` (respecting provider Retry-After headers) |
| `target_not_found` | `dead_letter_after_threshold` (may be transient replication lag) |
| `business_conflict` | `do_not_retry` (requires conflict resolution) |

### 3.3 Circuit-breaker model

`CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` §4 defines the three-state circuit-breaker doctrine:

| State | Meaning | Behavior |
|---|---|---|
| `closed` | Provider healthy | All requests pass through normally |
| `open` | Provider degraded | Requests are fast-failed; no external calls made; items queued or dead-lettered depending on queue time |
| `half_open` | Recovery probe | Limited number of probe requests sent; if successful, breaker closes; if failed, breaker reopens |

Circuit-breaker scope: per `connector_id` × `provider_key` combination. A single degraded Jira workspace does not open the breaker for all Jira installations.

Operator visibility requirement (Edge reliability §4): "Operator surfaces must expose when a connector is degraded because of breaker policy." This means:

- The connector's runtime status must reflect breaker state.
- The operator dashboard must show: breaker state, time in current state, failure count that triggered opening, last probe result.
- Items queued behind an open breaker must be visible as `pending_breaker_recovery`, not silently dropped.

### 3.4 Backoff strategy

For `retry_with_backoff` class, the recommended strategy is exponential backoff with jitter:

| Parameter | Recommended baseline |
|---|---|
| Initial delay | 1s |
| Multiplier | 2x |
| Max delay | 5 min |
| Jitter | ±25% randomization |
| Max attempts before dead-letter | 5 (configurable per connector family) |

Provider-specific overrides: if a provider returns a `Retry-After` header, the runtime must respect it as a floor (never retry sooner than the provider requests).

### 3.5 Rate limiting

Two dimensions of rate limiting:

1. **Provider-side rate limits** — The runtime must track and respect provider-imposed rate limits (typically returned as HTTP 429 with `Retry-After`). Per-provider rate limit budgets should be maintained to avoid hitting limits reactively.

2. **Platform-side rate limits** — The platform must enforce its own rate limits to protect against:
   - Runaway sync loops
   - Bulk operations that could exhaust provider quotas
   - Webhook ingress floods

Platform rate limits should be configurable per connector family and per org tenant.

### 3.6 Provider health detection

The runtime must maintain a provider health model that aggregates:

| Signal | Weight | Description |
|---|---|---|
| HTTP error rate | High | Percentage of 5xx responses in a sliding window |
| Latency percentile | Medium | p95 latency exceeding baseline by >3x |
| Rate limit hits | Medium | Frequency of 429 responses |
| Auth failures | High | Token refresh failures not caused by credential expiry |
| Circuit-breaker state | Direct | Current breaker state is a direct health indicator |

Health states per provider installation:

| Health | Meaning |
|---|---|
| `healthy` | All signals within normal bounds |
| `degraded` | Some signals elevated; sync continues with increased monitoring |
| `unhealthy` | Circuit breaker open or critical signals exceeded; sync paused |
| `unknown` | No recent signals (new installation or long idle period) |

---

## 4. Event contract for sync failures

### 4.1 Failure events in the canonical catalog

`CONNECTOR_EVENT_CATALOG_V8.md` §4 defines the following failure-related events:

| Event | Family | Trigger |
|---|---|---|
| `connector.sync.failed` | Sync lifecycle (§4.2) | Sync job failed completely |
| `connector.sync.partial` | Sync lifecycle (§4.2) | Sync job completed with some items failed |
| `connector.publish.failed` | Publish lifecycle (§4.3) | Publish operation failed |
| `connector.webhook.rejected` | Webhook lifecycle (§4.4) | Webhook payload failed validation |
| `connector.conflict.detected` | Conflict lifecycle (§4.5) | Conflict detected during sync |
| `connector.runtime.retry_scheduled` | Runtime (§4.6) | Retry queued for a failed item |
| `connector.runtime.dead_lettered` | Runtime (§4.6) | Item moved to dead-letter after retry exhaustion |
| `connector.support.note_added` | Support (§4.6) | Operator added a support note to a failed item |

### 4.2 Failure event envelope

Every failure event must carry the canonical envelope from Event catalog §3, with the following fields mandatory for failure events:

| Field | Requirement for failure events |
|---|---|
| `event_id` | Required |
| `event_name` | Required — must use canonical names from §4.1 |
| `event_version` | Required |
| `connector_id` | Required |
| `installation_id` | Required |
| `org_id` | Required |
| `provider_key` | Required |
| `object_type` | Required — which business object failed |
| `object_ref` | Required — which specific object |
| `occurred_at` | Required |
| `correlation_id` | Required — links to the originating sync/publish/webhook chain |
| `idempotency_key` | Required — enables safe replay |
| `status` | Required — `failed`, `partial`, `rejected`, `dead_lettered` |
| `error_class` | Required for failures — from canonical error classification |
| `run_id` | Required — links to the `ConnectorJob` |
| `retry_count` | Required — current attempt number |

### 4.3 Event naming rule

Event catalog §2 rule: "event names must describe business meaning, not only transport mechanics."

This means failure events must not use generic names like `connector.error` or `connector.retry`. They must use the specific lifecycle event names that describe what business operation failed.

### 4.4 Partial sync event contract

`connector.sync.partial` deserves special attention. When a sync job succeeds for some items but fails for others, the event must include:

- Total items attempted
- Items succeeded
- Items failed (with per-item error class)
- Items dead-lettered
- Items skipped (e.g., due to circuit breaker)

This enables operator dashboards to show sync health at the batch level, not just pass/fail.

---

## 5. Schema evolution handling

### 5.1 Canonical evolution doctrine

`CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md` §4 defines the preferred evolution path:

1. Additive fields first
2. Soft deprecation
3. Explicit cutover window
4. Durable audit of producer and consumer versions

### 5.2 Compatibility classification

`CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md` §3 classifies changes as:

| Classification | Meaning | Dead-letter risk |
|---|---|---|
| Backward compatible | New version can process old payloads | None — existing items remain processable |
| Forward compatible | Old version can process new payloads | None — new fields are ignored |
| Breaking | Old and new versions are incompatible | High — items in flight may become unprocessable |

### 5.3 Breaking change impact on dead-letter and replay

When a provider API introduces a breaking change:

1. **In-flight items** — Items already queued or in dead-letter with the old schema may become unprocessable. The runtime must detect schema version mismatch and classify these as `schema_mismatch` conflict class.

2. **Dead-letter items** — Existing dead-letter items referencing the old schema must retain their original `payload_ref` for forensic inspection. They should be flagged with a `schema_version_at_capture` field to indicate they were captured under a previous schema.

3. **Replay of old-schema items** — Replay of items captured under an old schema version must go through a migration path:
   - If a migration function exists for the version pair, apply it automatically.
   - If no migration exists, mark the item as `replay_blocked_schema_migration_required` and surface to operator.

### 5.4 Provider API change detection

The runtime should detect provider API changes through:

| Detection method | Description |
|---|---|
| Response schema validation | Compare actual API response structure against expected schema |
| New/missing fields | Detect fields present in response but not in mapping, or expected fields absent from response |
| Status code changes | Detect new error codes or changed semantics |
| Deprecation headers | Monitor provider deprecation headers (e.g., `Sunset`, `Deprecation`) |
| Webhook payload changes | Validate incoming webhook payloads against registered schema |

When a change is detected:

- Log a `connector.runtime.schema_drift_detected` event (proposed addition to event catalog).
- If the change is backward compatible, continue processing with a warning.
- If the change is breaking, halt processing for affected object types and surface to operator.
- Do not silently drop or transform data without audit trail.

### 5.5 Version tracking

Every event contract must define (Event contracts §2):

- Event name
- Version
- Payload schema
- Producer
- Consumer class
- Delivery guarantees

The runtime must maintain a version registry that tracks which schema version each connector installation is currently operating against, enabling targeted migration when versions change.

---

## 6. Retention and cleanup policies

### 6.1 Canonical retention categories

`CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md` §6 defines four retention categories:

| Category | Description | Recommended baseline |
|---|---|---|
| Hot run history | Recent job runs, attempts, results | 30 days (aligned with Decision 3 snapshot retention baseline) |
| Dead-letter records | Failed items awaiting operator action | 90 days minimum; items with `pending_review` resolution state must not be auto-purged |
| Payload blobs | Original payloads referenced by dead-letter and job records | Tied to dead-letter retention; purged only after dead-letter record is resolved and retention period expires |
| Operator audit notes | Support annotations on dead-letter and conflict items | Permanent for resolved items (part of audit trail); tied to dead-letter retention for unresolved items |

### 6.2 Dead-letter retention rules

| Rule | Rationale |
|---|---|
| Unresolved dead-letter items must not be auto-purged | Operator must explicitly resolve (replay, dismiss, escalate, remap) before cleanup |
| Resolved dead-letter items retain metadata for 90 days | Enables post-incident analysis and pattern detection |
| Payload blobs for resolved items may be purged after 30 days | Reduces storage while preserving metadata |
| Dead-letter items associated with active support incidents are exempt from retention limits | Support must be able to investigate without time pressure |

### 6.3 Replay request retention

| Category | Retention |
|---|---|
| Successful replay requests | 30 days (metadata only; payload ref points to resolved dead-letter) |
| Failed replay requests | Tied to the dead-letter record they reference |

### 6.4 Event retention

Canonical events (Event catalog §7) are used by operator dashboards, support diagnostics, runtime jobs, conflict handling, and external object lineage. Event retention should follow:

| Event category | Retention |
|---|---|
| Failure and conflict events | 90 days minimum (aligned with dead-letter retention) |
| Success events | 30 days (hot history) |
| Auth lifecycle events | 90 days (security audit trail) |

### 6.5 Cleanup process

Cleanup must be:

- Automated via scheduled jobs, not manual.
- Auditable — cleanup actions themselves must be logged.
- Configurable per org tenant (some orgs may require longer retention for compliance).
- Safe — cleanup must never delete items that are referenced by unresolved dead-letter records, active support incidents, or pending replay requests.

---

## 7. Downstream dependency map

### 7.1 What depends on this analysis

| Downstream packet/wave | Dependency |
|---|---|
| **WP-W5-EXT-03 — Operator support surfaces** | Requires dead-letter queue model, replay request schema, and provider health model to build operator dashboards |
| **Wave 5 — PM sync baseline** | Requires retry classification and circuit-breaker model to implement sync job execution |
| **Wave 5 — Auth lifecycle (WP-W5-EXT-01)** | Shares error classification; auth failures feed into dead-letter and retry systems |
| **Wave 6 — Provider-specific hardening** | Requires schema evolution handling and provider health detection for Tier A/B providers |
| **Connector Implementation Plan Wave G** | Operator excellence wave builds on dead-letter visibility, replay tooling, and retention policies defined here |

### 7.2 What this analysis depends on (upstream)

| Upstream source | Dependency |
|---|---|
| **WP-W1-PMSYNC-01** | Error classification, per-object sync status model, conflict-class vocabulary |
| **WP-W1-PMSYNC-02** | Corrected canonical conflict vocabulary (9 classes), ratified per-object sync status enum |
| **Decision 18** | Conflict severity model, dead-letter doctrine reference in SYNC_MODES, `replay_after_fix` and `escalate` resolution paths |
| **CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md** | Runtime object definitions (ConnectorJob, ConnectorJobAttempt, DeadLetterRecord, ReplayRequest) |
| **CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md** | Retry classes, circuit-breaker doctrine, dead-letter doctrine |
| **CONNECTOR_EVENT_CATALOG_V8.md** | Event envelope, canonical events, idempotency and replay doctrine |
| **CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md** | Schema evolution rules, compatibility classification |

### 7.3 Cross-cutting integration points

| Integration point | Description |
|---|---|
| **Per-object sync status** | Dead-letter state is a first-class value in the ratified per-object sync status enum |
| **Operator surfaces** | Dead-letter queue, replay actions, circuit-breaker state, and provider health must all be exposed on operator runtime surface (WP-W1-PMSYNC-01 §5.1 surface #2) |
| **Support diagnostics** | Dead-letter records with full correlation chains enable incident reconstruction on support incident surface (WP-W1-PMSYNC-01 §5.1 surface #3) |
| **Event-driven architecture** | All failure, retry, and dead-letter transitions emit canonical events that feed dashboards and alerting |

---

## 8. Open questions and conflicts

### 8.1 No inter-document conflicts found

All five canonical docs and three supporting anchors are consistent on the dead-letter, replay, and edge reliability model. The documents define the concepts at different levels of specificity but do not contradict each other.

### 8.2 `connector.runtime.schema_drift_detected` event not in catalog

This analysis proposes a new event (`connector.runtime.schema_drift_detected`) for provider API change detection (§5.4). This event is not present in `CONNECTOR_EVENT_CATALOG_V8.md`. It is a natural extension of the `connector.runtime.*` family but requires explicit addition to the catalog.

**Escalation item:** Propose adding `connector.runtime.schema_drift_detected` to the canonical event catalog.

### 8.3 Retry attempt thresholds not specified in canonical docs

`CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` defines retry classes but does not specify numeric thresholds (max attempts, backoff parameters). This analysis proposes baseline values (§3.4) but these are recommendations, not canonical doctrine.

**Escalation item:** Should retry thresholds (max attempts, backoff parameters) be canonicalized in the edge reliability doc, or left as per-connector-family configuration?

### 8.4 Dead-letter retention period not canonically specified

`CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md` §6 states that retention should be defined separately for dead-letter records but does not specify durations. This analysis proposes 90 days as a baseline (§6.1), aligned with the general principle from Decision 3 (30-day snapshot baseline) but extended for dead-letter items that require longer operator investigation windows.

**Escalation item:** Should dead-letter retention baseline (90 days proposed) be canonicalized in the runtime jobs doc?

### 8.5 Bulk replay not addressed in canonical docs

The canonical docs define replay at the individual item level. This analysis identifies bulk replay (§2.2) as a necessary operational capability when a common root cause (e.g., provider outage recovery, auth restoration) affects many dead-letter items simultaneously. No canonical doc addresses bulk replay semantics.

**Escalation item:** Should bulk replay semantics be added to the replay doctrine in the event catalog doc?

### 8.6 Provider health model not canonically defined

`CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md` defines circuit breakers and timeouts but does not define a structured provider health model. This analysis proposes one (§3.6) based on the signals implied by the canonical controls. The health model is a synthesis, not a canonical definition.

**Escalation item:** Should a structured provider health model be added to the edge reliability doc?

---

## 9. Packet output

### 9.1 Context pack

**Canonical docs read:**
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
- `CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`
- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`

**Supporting anchors read:**
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.6 Wave 5
- `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md`
- `WP-W1-PMSYNC-02_CONFLICT_CROSSCHECK_AND_RATIFICATION.md`
- `DECISION_LOG_WAVE_1.md`

### 9.2 Status

- **Status:** completed
- **Completed:**
  - Dead-letter queue model (schema, entry conditions, classification, relationship to per-object sync status)
  - Replay semantics (triggers, request schema, execution rules, eligibility matrix, event contract)
  - Edge reliability controls (retry classification with error-class mapping, circuit-breaker model, backoff strategy, rate limiting, provider health detection)
  - Event contract for sync failures (8 failure events, envelope requirements, partial sync contract)
  - Schema evolution handling (breaking change impact on dead-letter/replay, provider API change detection, version tracking)
  - Retention and cleanup policies (4 retention categories with baselines, dead-letter-specific rules, cleanup process)
  - Downstream dependency map (5 downstream dependents, 7 upstream sources, 4 cross-cutting integration points)
- **Remaining:** None within packet scope
- **Blockers or risks:**
  - Retry thresholds and retention durations are proposed baselines, not yet canonical (low risk — consistent with all sources)
  - Provider health model is synthesized, not canonically defined (medium risk — needed for operator surfaces)
- **Questions requiring escalation:**
  1. Should `connector.runtime.schema_drift_detected` be added to the canonical event catalog?
  2. Should retry thresholds be canonicalized or left as per-connector-family configuration?
  3. Should dead-letter retention baseline (90 days) be canonicalized in the runtime jobs doc?
  4. Should bulk replay semantics be added to the replay doctrine?
  5. Should a structured provider health model be added to the edge reliability doc?
