# WP-W5-EXT-03 — Operator Support Visibility and Admin Control Analysis

> Packet: WP-W5-EXT-03
> Wave: 5 — External-world and operator hardening
> Status: completed
> Produced by: worker agent (bounded)
> Sources: see §9 context pack

---

## 1. Operator dashboard requirements

### 1.1 Design rationale

`CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 defines the operator runtime surface. `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md` §5 establishes the four required surfaces and the baseline capabilities that must exist before any provider ships. `WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md` §6.3 defines the operator dashboard model for AI operations. Wave 5 must extend these baselines to cover external sync and connector health at production grade.

### 1.2 Required operator dashboard views

| View | Content | Source authority |
|---|---|---|
| **Connector fleet health** | All connectors across the tenant: auth state (8-state enum from WP-W1-PMSYNC-01 §1.1), provider depth tier, last sync success/failure, staleness indicators, drift state | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4; `CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` §3 |
| **Active/queued/failed runs** | Real-time view of sync runs: active, queued, failed, retrying. Filterable by connector, provider, error class | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 |
| **Dead-letter queue** | Items that exhausted retry policy and moved to dead-letter. Count, age, error class, affected business objects. Read-only inspection at minimum; replay actions when dead-letter tooling is available | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 |
| **Conflict queue** | Active conflicts grouped by conflict class (7 classes from WP-W1-PMSYNC-01 §4.1), severity, affected objects. Resolution status and next-action indicator | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4; WP-W1-PMSYNC-01 §4 |
| **Provider health** | External provider reachability, API response times, rate-limit status, known outages. Per-provider, not per-connector | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 |
| **Object-level sync status** | Per-business-object sync health (7-state enum from WP-W1-PMSYNC-01 §3.2: `synced`, `syncing`, `stale`, `conflict`, `error`, `dead_letter`, `not_linked`). Drill-down from connector to individual objects | WP-W1-PMSYNC-01 §3.2 |
| **Reauth queue** | Connectors in `degraded_reauth_needed` state. Who owns the credential, who can reauth, impact on queued sync, time in degraded state | WP-W1-PMSYNC-01 §1.4–§1.5 |

### 1.3 Connector fleet health signals

Extending the Wave 1 observability baseline (`WP-W1-TRUST-01` §6.2) with sync-specific signals:

| Signal | What it measures | Alert threshold |
|---|---|---|
| Connectors in degraded auth state | Count of connectors per org in `degraded_reauth_needed` or `revoked` | Any connector degraded > 1 hour |
| Sync run failure rate | % of sync runs reaching terminal failure per connector | > 10% over 4-hour window |
| Dead-letter queue depth | Count of items in dead-letter per connector | > 0 items older than 24 hours |
| Conflict queue depth | Count of unresolved conflicts per connector | > 10 unresolved conflicts |
| Provider API error rate | % of API calls to external provider returning errors | > 5% over 1-hour window |
| Staleness breach rate | % of synced objects exceeding staleness threshold | > 15% of linked objects per connector |
| Reauth pending duration | Time a connector has been in `degraded_reauth_needed` | > 4 hours |

### 1.4 Visibility contract per audience

Carried forward from WP-W1-PMSYNC-01 §1.4 and extended:

| Audience | Must see |
|---|---|
| **Platform operator** | Full fleet health, cross-tenant connector status, provider health, system-wide dead-letter and conflict queues |
| **Tenant operator / admin** | Tenant-scoped connector health, per-connector run history, object-level sync status, reauth queue, conflict queue |
| **Support** | Incident reconstruction surfaces (§2), failure classification, recovery paths, support notes |
| **End user** | Honest sync state per linked object, what failed, whether action is needed, reauth prompts when applicable |

---

## 2. Support incident surfaces

### 2.1 Design rationale

`CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 defines the support incident surface. `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §9 requires support to reconstruct: what the user asked for, what run was created, what runtime path was used, why the action did not complete, what safe next step exists. `WP-W1-TRUST-01` §4 defines the unified `SupportTrace` model for AI operations. Wave 5 must extend incident reconstruction to cover sync-specific failures.

### 2.2 Incident reconstruction capabilities

| Capability | Description | Source |
|---|---|---|
| **Lookup by object** | Given a business object (task, initiative, decision), show its full sync history: all sync attempts, successes, failures, conflict events, dead-letter entries | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Lookup by run** | Given a sync run ID, show: connector, provider, objects attempted, objects succeeded, objects failed, error classes, duration, retry attempts | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Lookup by connector** | Given a connector, show: auth state history, run history, failure timeline, conflict timeline, dead-letter timeline | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Affected business objects** | For any failure or conflict, show all business objects impacted: type, ID, external ID, external URL, current sync state, field authority map | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Failure classification** | Classify every incident as: `auth_failure`, `permission_denied`, `provider_outage`, `mapping_failure`, `business_conflict`, `rate_limited`, `target_not_found` (from WP-W1-PMSYNC-01 §3.5) | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Support notes** | Attach support notes to incidents, connectors, or individual sync failures. Notes are durable and visible to subsequent support operators | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |
| **Replay or escalate** | From the incident view, trigger replay (when dead-letter tooling is available) or escalate to admin/engineering | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 |

### 2.3 Sync-specific support trace extension

The Wave 1 unified `SupportTrace` (WP-W1-TRUST-01 §4.2) joins context, retrieval, execution, routing, and trust traces. For sync incidents, the trace must be extended with:

| Component | What it provides |
|---|---|
| **Connector trace** | Connector ID, provider, auth state at time of failure, active version, drift state |
| **Sync run trace** | Run ID, trigger (scheduled / webhook / manual), objects in scope, objects processed, objects failed |
| **Object sync trace** | Per-object: sync state before and after, error class, conflict class (if applicable), field-level diff |
| **Provider API trace** | HTTP status, response time, rate-limit headers, error payload (sanitized — no credentials) |
| **Dead-letter trace** | If object was dead-lettered: retry count, exhaustion reason, time in dead-letter |

### 2.4 Support query dimensions for sync

Extending WP-W1-TRUST-01 §4.4:

| Query dimension | Fields |
|---|---|
| **By connector** | `connector_id` → full connector history |
| **By provider** | `provider_type` + time range → all incidents for a provider |
| **By error class** | `error_class` → all sync failures of a given type |
| **By conflict class** | `conflict_class` → all conflicts of a given type |
| **By business object** | `object_type` + `object_id` → full sync history for one object |
| **By auth state** | `auth_state = degraded_reauth_needed` → all connectors awaiting reauth |
| **By dead-letter** | All dead-lettered items, filterable by connector, age, error class |

### 2.5 What support must be able to answer for sync incidents

Extending `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §9:

| Question | Answered by |
|---|---|
| Which connector failed? | Connector trace → connector ID, provider, auth state |
| What triggered the sync? | Sync run trace → trigger type (scheduled / webhook / manual) |
| Which objects were affected? | Object sync trace → affected business objects with external IDs |
| What class of failure occurred? | Failure classification → error class or conflict class |
| Is this an auth issue, a mapping issue, or a provider issue? | Failure classification → auth vs mapping vs provider vs business conflict |
| Is the provider currently reachable? | Provider health → current API status |
| Can the sync be retried safely? | Recovery path → idempotency check, retry eligibility |
| Who needs to act? | Reauth routing → credential owner; conflict routing → object owner or admin |
| What is the safe next step? | Recovery path from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §5 |

---

## 3. Admin control capabilities

### 3.1 Design rationale

`CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §3 defines the admin setup surface. `CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` §4–§5 defines the promotion lifecycle and rollback doctrine. `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.6 requires "stronger admin-facing control and diagnostics." This section maps the admin control capabilities required for production connector management.

### 3.2 Connector lifecycle controls

| Control | Description | Who can trigger | Governance |
|---|---|---|---|
| **Connect** | Initiate OAuth or credential flow for a new connector | Admin (org-owned) or authorized user (user-owned) per ownership doctrine (WP-W1-PMSYNC-01 §1.6) | Standard auth flow |
| **Disconnect** | Intentionally remove a connection. Preserves audit trace and connector history. Moves to `disconnected` state | Admin | Confirmation required; audit logged |
| **Pause sync** | Temporarily halt all sync runs for a connector without disconnecting. Auth remains valid; queued runs are held | Admin, operator | Reversible; audit logged |
| **Resume sync** | Resume sync runs for a paused connector | Admin, operator | Audit logged |
| **Force reauth** | Trigger reauth flow for a connector in `degraded_reauth_needed` or proactively before expiry | Admin (routes to credential owner) | Reauth journey per WP-W1-PMSYNC-01 §1.5 |
| **Force retry** | Retry a specific failed sync run or a specific failed object sync | Admin, operator | Idempotency check required; audit logged |
| **Revoke** | Explicitly revoke connector access. Moves to `revoked` state | Admin | Confirmation required; irreversible for current credential context |

### 3.3 Mapping and configuration controls

| Control | Description | Who can trigger |
|---|---|---|
| **Edit field mapping** | Modify field-level mapping between local and external objects | Admin |
| **Edit sync direction** | Change sync direction (import / publish / bidirectional / mirror-local-authority) per object type | Admin |
| **Edit staleness threshold** | Adjust the staleness threshold for a connector | Admin |
| **Edit retry policy** | Adjust retry count, backoff, and dead-letter threshold | Admin (within platform-allowed bounds) |
| **Edit conflict resolution policy** | Choose default resolution strategy per conflict class (auto-resolve-by-authority, manual-review, etc.) | Admin |

### 3.4 Dead-letter and conflict controls

| Control | Description | Who can trigger |
|---|---|---|
| **Inspect dead-letter item** | View full detail of a dead-lettered sync item: object, error history, retry history | Admin, operator, support |
| **Replay dead-letter item** | Re-attempt sync for a dead-lettered item after underlying issue is fixed | Admin, operator |
| **Bulk replay dead-letter** | Replay all dead-lettered items for a connector (after confirming underlying fix) | Admin |
| **Dismiss dead-letter item** | Acknowledge and close a dead-letter item as accepted loss | Admin |
| **Resolve conflict** | Choose resolution for a conflict: accept local, accept remote, manual merge, dismiss | Admin, object owner |
| **Escalate conflict** | Escalate a conflict to platform-level or cross-team decision | Admin, operator, support |

### 3.5 Admin control governance rules

1. **Audit trail required.** Every admin control action must produce a durable audit record: who, when, what, why (if provided).
2. **No hidden overrides.** Admin controls must not bypass governance. Pausing sync does not hide failures; disconnecting preserves history.
3. **Confirmation for destructive actions.** Disconnect, revoke, bulk replay, and dismiss require explicit confirmation.
4. **Policy-correct recovery.** Recovery paths must follow the canonical recovery actions from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §5. Admin controls do not create a parallel recovery path.
5. **Scope-limited.** Tenant admin controls are scoped to their organization. Platform-level controls (cross-tenant) require superadmin.

---

## 4. Diagnostics

### 4.1 Design rationale

Production connectors require diagnostic capabilities beyond status displays. Operators and admins must be able to actively probe, test, and inspect connector health. This section defines the diagnostic tooling required.

### 4.2 Health checks

| Diagnostic | Description | Trigger |
|---|---|---|
| **Connectivity test** | Verify that the platform can reach the external provider API. Returns: reachable (yes/no), response time, API version | On-demand by admin/operator; automated on schedule |
| **Auth verification** | Verify that the current token/credential is valid: token not expired, scopes confirmed, workspace reachable, provider account identity confirmed | On-demand by admin/operator; automated after reauth |
| **Mapping validation** | Verify that the current field mapping is valid against the external provider schema. Returns: valid fields, invalid/stale fields, unmapped required fields | On-demand by admin; automated on connector version change |
| **Scope verification** | Verify that the granted OAuth scopes match the required scopes for the configured sync direction and object types | On-demand by admin; automated on connect and reauth |

### 4.3 Sync status deep-dive

| Diagnostic | Description |
|---|---|
| **Object sync timeline** | For a selected business object: full timeline of sync events (attempts, successes, failures, conflicts, dead-letter entries) with timestamps and error details |
| **Field-level diff** | For a selected object in `conflict` state: side-by-side comparison of local values vs external values for each mapped field, with field authority indicators |
| **Run detail inspector** | For a selected sync run: full breakdown of objects processed, per-object outcome, duration, retry attempts, error classes |
| **Connector state history** | Full auth state transition history for a connector: every state change with timestamp, trigger, and actor |

### 4.4 Event trace inspection

Extending the Wave 1 support trace model (WP-W1-TRUST-01 §4) with sync-specific event traces:

| Trace type | Content | Retention |
|---|---|---|
| **Sync event log** | All sync events for a connector: run started, object synced, object failed, conflict detected, dead-lettered, replayed | 30-day baseline (aligned with Decision 3) |
| **Auth event log** | All auth state transitions: connected, refreshed, degraded, reauthed, revoked, disconnected | 30-day baseline; long-term for incidents |
| **Provider API log** | Sanitized API call log: endpoint, method, status, response time, rate-limit headers. No credentials or sensitive payloads | 30-day baseline |
| **Admin action log** | All admin control actions: pause, resume, force-retry, disconnect, mapping changes, policy changes | Long-term (audit requirement) |

### 4.5 Diagnostic access model

Consistent with WP-W1-TRUST-01 §4.6:

| Role | Access |
|---|---|
| **Platform operator / superadmin** | Full diagnostic access across tenants |
| **Tenant admin** | Full diagnostic access within their organization |
| **Support operator** | Read-only diagnostic access within assigned tenant scope; can trigger health checks but not configuration changes |
| **End user** | No direct diagnostic access; sees only the user explanation surface (§ in CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md §6) |

---

## 5. Connector promotion/demotion controls

### 5.1 Design rationale

`CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` §4 defines the canonical promotion lifecycle: `draft → reviewed → approved → promoted → active → deprecated → retired`. This section maps the operator and admin controls required to manage connector packages through this lifecycle.

### 5.2 Promotion lifecycle controls

| Control | Description | Who can trigger | Prerequisites |
|---|---|---|---|
| **Submit for review** | Move a connector package from `draft` to `reviewed` | Connector author / admin | All design-time assets present (provider definition, auth profile, mapping profile, sync definition, retry policy) |
| **Approve** | Move from `reviewed` to `approved` | Platform governance owner | Review checklist passed; no blocking issues |
| **Promote to staging** | Deploy connector package to staging environment | Platform operator | Approved status; staging environment available |
| **Promote to active** | Move from `promoted` to `active` in production | Platform operator | Staging validation passed; health checks green |
| **Deprecate** | Move from `active` to `deprecated`. Existing installations continue but no new installations allowed | Platform operator / admin | Deprecation reason documented; migration path communicated |
| **Retire** | Move from `deprecated` to `retired`. All installations must be migrated or disconnected | Platform operator | All installations migrated or disconnected; grace period elapsed |

### 5.3 Demotion and rollback controls

| Control | Description | Who can trigger | Governance |
|---|---|---|---|
| **Rollback** | Revert an active connector to its previous active version. Must preserve: previous active version, rollback reason, operator, impacted installations | Platform operator | Confirmation required; audit logged; impacted installations notified |
| **Emergency pause** | Immediately pause all sync for a connector package across all installations due to critical issue | Platform operator | Audit logged; incident created; affected admins notified |
| **Force demotion** | Move a connector from `active` back to `approved` or `reviewed` due to discovered issues | Platform governance owner | Documented reason; all installations paused; recovery plan required |

### 5.4 Drift detection and response

From `CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` §6, drift must be detectable across:

| Drift dimension | Detection method | Response |
|---|---|---|
| **Schema version** | Compare active connector schema version against provider's current API schema | Alert operator; flag affected mappings |
| **Mapping version** | Compare active mapping version against latest approved mapping | Alert admin; offer mapping update |
| **Auth requirements** | Detect when provider changes required scopes or auth method | Alert admin; trigger scope verification |
| **Runtime policy** | Detect when platform retry/rate-limit policy diverges from connector's declared policy | Alert operator; offer policy reconciliation |

### 5.5 Promotion visibility

| Audience | Must see |
|---|---|
| **Platform operator** | Full lifecycle state of all connector packages; version history; drift alerts; rollback history |
| **Tenant admin** | Active connector version; whether updates are available; deprecation notices; migration guidance |
| **Support** | Which connector version is active for a given installation; whether a recent promotion/rollback may explain an incident |

---

## 6. Wave 1 observability integration

### 6.1 Design rationale

Wave 5 connector and sync observability must integrate with — not duplicate — the Wave 1 observability baseline established in WP-W1-TRUST-01. This section maps how sync-specific signals feed into the existing observability infrastructure.

### 6.2 Integration with Wave 1 health signals

| Wave 1 signal (WP-W1-TRUST-01 §6.2) | Wave 5 sync extension |
|---|---|
| **Connector health** (count of disconnected/drifted connectors) | Extended to include: count by auth state (all 8 states), count by drift dimension, count by provider depth tier |
| **Retrieval success rate** | Sync-specific: sync run success rate per connector, per provider |
| **Trust degradation rate** | Sync-specific: % of synced objects in `stale`, `error`, or `dead_letter` state |

### 6.3 Integration with Wave 1 operator dashboard

| Wave 1 dashboard view (WP-W1-TRUST-01 §6.3) | Wave 5 sync extension |
|---|---|
| **System health** | Add: connector fleet health panel, provider health panel |
| **Tenant health** | Add: per-org connector health, per-org sync success rate, per-org conflict/dead-letter counts |
| **Run inspector** | Extend: sync run inspection with object-level detail, provider API trace |
| **Failure queue** | Extend: sync failure classes alongside AI failure classes; unified failure queue with source-type filter (AI vs sync) |

### 6.4 Integration with Wave 1 support trace

The unified `SupportTrace` model (WP-W1-TRUST-01 §4.2) must be extended with the sync-specific trace components defined in §2.3 of this document. The join model remains query-time; no new data store is required.

### 6.5 Integration with Decision 25 (routing explanation visibility)

`DECISION_LOG_WAVE_1.md` Decision 25 establishes: "brief explanation for users, full trace for operators." For sync operations, this translates to:

| Audience | Sync routing visibility |
|---|---|
| **User** | Which connector is active, sync direction, last sync status, whether action is needed |
| **Operator / support** | Full sync run trace, provider API trace, auth state history, conflict resolution history |

### 6.6 Shared metrics extension

Extending WP-W1-TRUST-01 §6.4 metrics:

| Metric | Granularity | Purpose |
|---|---|---|
| `sync_run_success_rate` | per connector, per provider, per hour | Track sync reliability |
| `sync_object_health_distribution` | per connector, per org, per hour | Track object-level sync quality |
| `conflict_resolution_rate` | per conflict class, per org, per day | Track conflict backlog health |
| `dead_letter_queue_age` | per connector, per org | Track dead-letter staleness |
| `reauth_pending_duration` | per connector, per org | Track auth recovery speed |
| `provider_api_error_rate` | per provider, per hour | Track external provider reliability |
| `connector_promotion_events` | per connector package, per month | Track connector lifecycle velocity |

---

## 7. Downstream dependency map

### 7.1 What this analysis provides to later work

| Downstream capability | Dependency on this analysis |
|---|---|
| **WP-W5-EXT-01 — Auth lifecycle** | Auth-related operator surfaces (reauth queue, auth state history, force-reauth control) defined here must align with the auth lifecycle detail in EXT-01 |
| **WP-W5-EXT-02 — Dead-letter/replay** | Dead-letter inspection, replay controls, and dead-letter queue dashboard defined here must align with the dead-letter/replay internals in EXT-02 |
| **Wave 5 PM sync baseline** | Operator dashboard and support surfaces defined here are the production-grade extension of the Wave 1 baseline (WP-W1-PMSYNC-01 §5) |
| **Wave 6 outputs and finance** | If finance or report connectors exist, they must use the same operator dashboard, support surfaces, and diagnostic tooling |
| **Wave 7 Organization/Admin hardening** | Admin control capabilities defined here must be surfaced through the Organization/Admin UI |
| **Connector Implementation Plan Wave G** | "Operator excellence" wave in the connector plan builds directly on the surfaces defined here |

### 7.2 What this analysis depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-PMSYNC-01** | Auth lifecycle states, provider depth model, per-object sync status, conflict vocabulary, 4 required surfaces, baseline capabilities | Completed |
| **WP-W1-TRUST-01** | Universal trust vocabulary, support trace model, observability baseline, operator dashboard model | Completed |
| **DECISION_LOG_WAVE_1.md** | Decision 25 (routing explanation visibility), Decision 3 (30-day retention baseline) | Ratified |
| **CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md** | Canonical surface definitions (admin setup, operator runtime, support incident, user explanation) | Canonical |
| **CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md** | Promotion lifecycle, rollback doctrine, drift doctrine | Canonical |
| **OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md** | Failure classes, recovery paths, audit doctrine | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Promotion lifecycle ownership: platform vs tenant

`CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` defines the promotion lifecycle but does not specify whether connector packages are managed at the platform level (one package shared across tenants) or at the tenant level (each tenant manages its own connector versions). The controls in §5 assume platform-level management, which is the standard pattern for SaaS connector platforms.

**Assessment:** Not a conflict — the canonical doc is silent on this point. The platform-level assumption is consistent with the design-time/runtime separation in the canonical doc.

**Recommendation:** Ratify that connector packages are platform-managed assets with tenant-level installation and configuration. Tenant admins configure their installation (mapping, sync direction, retry policy) but do not manage the connector package lifecycle.

### 8.2 Support note durability and scope

`CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 requires "add support note" but does not define note retention, visibility scope, or whether notes are per-incident, per-connector, or per-object.

**Assessment:** Not a conflict — the canonical doc establishes the requirement without specifying the model.

**Recommendation:** Support notes should be attachable to: connectors, sync runs, individual object sync failures, and dead-letter items. Notes should be durable (not subject to the 30-day trace retention baseline) and visible to all support operators within the tenant scope.

### 8.3 Emergency pause scope: per-installation vs per-package

§5.3 defines "emergency pause" as pausing all sync for a connector package across all installations. It is unclear whether tenant admins should also have a tenant-scoped emergency pause (pause all connectors of a given type within their org) vs only the per-connector pause defined in §3.2.

**Assessment:** Not a conflict — the canonical docs do not address this distinction.

**Recommendation:** Two levels of pause: (1) tenant admin can pause individual connector installations within their org (§3.2), (2) platform operator can emergency-pause a connector package across all tenants (§5.3). Both are needed for different incident scenarios.

### 8.4 No conflicts detected between canonical docs

The following pairs were checked:

- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 (operator runtime surface) ↔ `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §4 (operator support surfaces): Complementary. The connector doc defines sync-specific surfaces; the operator doc defines cross-cutting support surfaces. No overlap or contradiction.
- `CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md` §5 (rollback doctrine) ↔ `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4 (operator runtime surface): The promotion doc defines what rollback must preserve; the operator doc defines what operators must see. Aligned.
- `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §5 (recovery paths) ↔ `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 (support incident surface): The recovery doc defines canonical recovery actions; the connector doc defines the surface through which they are accessed. Aligned.
- Wave 1 baseline (WP-W1-PMSYNC-01 §5.2) ↔ Wave 5 extensions (this document): Wave 5 extends the baseline without contradicting it. All Wave 1 baseline capabilities remain required; Wave 5 adds production-grade depth.

---

## 9. Packet output

### 9.1 Context pack

Canonical docs read:
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
- `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md`
- `CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md`

Supporting anchors read:
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.6
- `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md`
- `WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md`
- `DECISION_LOG_WAVE_1.md`

### 9.2 Summary

- **Status:** completed
- **Completed:**
  - Operator dashboard requirements: 7 dashboard views, 7 health signals, visibility contract per 4 audience levels
  - Support incident surfaces: 7 reconstruction capabilities, sync-specific trace extension (5 components), 7 query dimensions, 9 support questions answered
  - Admin control capabilities: 7 lifecycle controls, 5 mapping/configuration controls, 6 dead-letter/conflict controls, 5 governance rules
  - Diagnostics: 4 health checks, 4 sync status deep-dive tools, 4 event trace types, diagnostic access model
  - Connector promotion/demotion controls: 6 promotion lifecycle controls, 3 demotion/rollback controls, 4 drift detection dimensions, promotion visibility per 3 audiences
  - Wave 1 observability integration: health signal extension, dashboard extension, support trace extension, shared metrics extension (7 new metrics)
  - Downstream dependency map: 6 downstream consumers, 6 upstream dependencies
  - Open questions and conflict analysis: 3 items identified, 0 conflicts between canonical docs
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Connector package management model (platform vs tenant) needs ratification (§8.1) — low risk, platform-level assumption is standard
  - Support note model needs specification (§8.2) — low risk, does not block dashboard or diagnostic work
- **Questions requiring escalation:**
  1. Should connector packages be ratified as platform-managed assets with tenant-level installation? (§8.1)
  2. What is the durability and scope model for support notes on sync incidents? (§8.2)
  3. Should tenant admins have a tenant-scoped emergency pause (all connectors of a type within their org) in addition to per-connector pause? (§8.3)
