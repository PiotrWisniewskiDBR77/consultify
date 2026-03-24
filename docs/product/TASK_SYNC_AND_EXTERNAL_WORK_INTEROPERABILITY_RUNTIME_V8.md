# Task Sync And External Work Interoperability Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical doctrine for syncing tasks, decisions, inbox work and adjacent execution objects with external PM and collaboration systems

---

## 1. Why this document exists

`consultify` already has broad sync and connector planning, but project management needs one explicit runtime contract for external work interoperability.

This document exists to answer:

- what PM objects may sync outside `consultify`
- which systems matter first
- what bidirectional sync means
- how conflicts, authority and provenance should work

---

## 2. Core statement

External task interoperability must make `consultify` easy to use alongside enterprise work systems without destroying local truth.

Rule:

`sync must be explicit, mapped, traceable and reversible in meaning`

Rule:

`sync is not copy-paste replication; it is governed translation between business objects`

---

## 3. Canonical PM objects in scope

The package should explicitly support interoperability for:

- `Task`
- `Decision`
- `InboxItem`
- `Initiative milestone`
- `Execution alert`
- `Review action`

Not every provider must support every object.

But every provider must declare:

- supported objects
- directionality
- field authority
- conflict behavior

---

## 4. Priority external systems

### 4.1 P0

- `Jira`
- one enterprise alternative: `Asana` or `Monday`
- `Slack`
- `Microsoft Teams`
- `Outlook / Microsoft 365`
- `Google Workspace`

### 4.2 P1

- `ClickUp`
- `Linear`
- `Azure DevOps`
- `Notion`
- richer email-based work capture

---

## 5. Provider depth doctrine

`consultify` must not describe all PM connectors as if they were equally deep.

The package should use four explicit depth tiers:

### 5.1 Tier A - enterprise parity

Meaning:

- strong object mapping
- strong OAuth lifecycle
- bidirectional task sync
- explicit conflict model
- operator-grade diagnostics

Target providers:

- `Jira`
- one non-Jira enterprise peer: `Asana` or `Monday`

### 5.2 Tier B - strong structured interoperability

Meaning:

- durable connector
- clear object mapping
- strong import and publish support
- narrower bidirectional depth than Tier A

Target providers:

- `ClickUp`
- `Linear`

### 5.3 Tier C - scoped PM adjacency

Meaning:

- selected use cases only
- import, publish or limited mirror
- not a full external PM system-of-record replacement

Target providers:

- `Notion`
- email-origin work capture
- communication-system callbacks

### 5.4 Tier D - benchmark or future scope

Meaning:

- visible in roadmap
- not yet promised as mature runtime parity

Rule:

`settings, cards and docs must always expose connector depth honestly`

---

## 6. Sync modes

The PM layer should distinguish four modes:

### 6.1 Import

External object becomes a local object or signal.

Examples:

- email becomes `InboxItem`
- Slack escalation becomes `InboxItem`
- Jira issue becomes linked `Task`

### 6.2 Publish

Local object is sent outward for visibility or collaboration.

Examples:

- decision-required notice to Slack
- review action to Teams
- initiative milestone to calendar

### 6.3 Bidirectional sync

Local and external objects stay linked across updates under declared field authority.

Examples:

- task title, status, due date, assignee, comments

### 6.4 Mirror with local authority

External system is visible and updated, but `consultify` remains the deciding source for chosen fields.

---

## 7. Canonical object mapping rules

For each connector, the product must define:

- object type mapping
- identifier mapping
- status mapping
- assignee mapping
- due-date authority
- comment and review scope
- attachment and link behavior
- provenance stamps

Examples:

- `Task <-> Jira Issue`
- `Task <-> Monday Item`
- `Task <-> Asana Task`
- `Task <-> ClickUp Task`
- `Decision -> Slack or Teams notification thread`
- `InboxItem <- email or chat escalation`

---

## 8. External to InboxItem ingestion

External work must not jump directly into authoritative PM objects without governed intake.

Canonical rule:

`external signal -> ingestion candidate -> InboxItem -> triage -> Task or Decision or dismissal`

Supported ingress families should include:

- email threads
- Slack or Teams mentions, approvals and escalation callbacks
- Jira, Asana, Monday, ClickUp or Linear task events where configured
- calendar response or review-window exceptions
- external failure notices from connector runs

Every ingestion path must declare:

- source family
- object identity and dedupe key
- confidence of classification
- whether the item is actionable or FYI
- whether the item is safe to auto-materialize into `InboxItem`
- whether human triage is mandatory before promotion

Canonical inbox ingestion classes:

- `work request`
- `decision needed`
- `review needed`
- `delivery failure`
- `schedule conflict`
- `status mismatch`
- `external escalation`
- `fyi update`

Forbidden behavior:

- auto-creating authoritative `Task` from noisy external chatter without triage
- silently collapsing multiple unrelated external messages into one local work item
- bypassing inbox when the external system is not authoritative for the target object

---

## 9. Decision and inbox interoperability

The PM sync story is incomplete if it covers only formal tasks.

The package must also support:

- `Decision` publication to external collaboration channels
- `Decision` review callbacks where supported
- external messages and escalations materializing as governed `InboxItem`
- inbox-origin work promotion to `Task` or `Decision`

Rule:

`external communication may trigger local work, but must not bypass triage and review`

---

## 10. Authority and conflict doctrine

Every bidirectional mapping must declare:

- source of truth per field
- conflict winner
- stale-write behavior
- retry behavior
- operator recovery path

Minimum authority examples:

- local priority may remain authoritative
- external status may be authoritative if the connector is configured that way
- due dates may be single-owner only

Forbidden behavior:

- silent overwrite without conflict trace
- hidden reassignment of accountable owner
- fake “bidirectional” language when only webhook or outbound publication exists

---

## 11. Conflict classes and replay doctrine

The sync runtime must distinguish conflict classes explicitly.

Minimum conflict classes:

- `field_authority_conflict`
- `concurrent_edit_conflict`
- `status_model_conflict`
- `identity_or_mapping_conflict`
- `permission_or_scope_conflict`
- `deleted_or_missing_target_conflict`
- `stale_snapshot_conflict`

Every conflict should expose:

- the affected business object
- the external object
- the conflicting fields
- the last known winning authority
- the run in which the conflict appeared
- the next allowed actions

Replay doctrine:

- replay may target one item, one run or one connector scope
- replay must preserve audit lineage to the original failed attempt
- replay must state whether it reuses payload, re-fetches source or re-evaluates mappings
- replay must never silently overwrite a previously raised human-reviewed conflict

Dead-letter doctrine:

- unrecoverable sync items move to explicit dead-letter state
- dead-letter items remain visible to operators and support
- dead-letter items may be dismissed, remapped, replayed or escalated

---

## 11A. Per-object sync status model

> Ratified per Decision 8 (DECISION_LOG_WAVE_1.md). Cross-checked against CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md in WP-W1-PMSYNC-02.

### 11A.1 Canonical per-object sync status enum

Each synced business object must expose a sync status distinct from the parent connector health state:

| State | Meaning |
|---|---|
| `synced` | Object is current; last sync succeeded within staleness threshold. Connector must be `healthy`. |
| `syncing` | Sync operation is in progress for this object. Connector must be `healthy` or `refreshing`. |
| `stale` | Last successful sync exceeds staleness threshold; data may be outdated. May be caused by connector `degraded_reauth_needed`, `disconnected`, or elapsed time. |
| `conflict` | A conflict has been detected and awaits resolution. Conflict class from CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4 must be attached. |
| `error` | Sync failed for a non-conflict reason. Error class (see §11A.2) must be attached. |
| `dead_letter` | Unrecoverable sync failure; item moved to dead-letter queue for operator inspection. Connector state is independent. |
| `not_linked` | Object exists locally but has no external sync binding. No connector relationship. |

### 11A.2 Error class enum (non-conflict failures)

| Error class | Description |
|---|---|
| `auth_failure` | Parent connector auth is degraded. |
| `permission_denied` | Token valid but insufficient scope for this object/operation. |
| `provider_outage` | External system temporarily unreachable. |
| `mapping_failure` | Object or field mapping is invalid or incomplete. |
| `business_conflict` | Pointer to conflict class from CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4. |
| `rate_limited` | Provider rate limit exceeded; retry scheduled. |
| `target_not_found` | External object has been deleted or moved. |

### 11A.3 Separation doctrine

| Layer | Enum | Source of truth |
|---|---|---|
| **Connector health** | `not_connected`, `authorizing`, `connected_unverified`, `healthy`, `refreshing`, `degraded_reauth_needed`, `revoked`, `disconnected` | CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md §8 |
| **Object sync status** | `synced`, `syncing`, `stale`, `conflict`, `error`, `dead_letter`, `not_linked` | This section |
| **Conflict class** | 9 canonical classes | CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4 |
| **Error class** | 7 classes per §11A.2 | This section |

Rule:

`connector health and object sync status are separate enums; a healthy connector may have objects in conflict, error or dead_letter state`

---

## 12. Operator and support surfaces for PM sync

PM sync is only trustworthy if operators can inspect work-level failures.

The operator surface must support:

- lookup by `Task`, `Decision`, `InboxItem`, connector, run or external object ID
- current sync state per business object
- last successful and failed run per object
- field-level authority and mapping visibility
- conflict queue
- retry and replay controls
- dead-letter inspection
- user-facing explanation preview

The support surface must support:

- incident reconstruction
- support notes
- escalation to platform operators
- explanation of whether the issue is auth, mapping, provider outage, permission or true business conflict

The user-facing surface must support:

- honest sync state
- what changed
- what failed
- whether action is needed from the user, admin or operator

---

## 13. AI and sync

AI may support external work interoperability by:

- proposing field mappings
- proposing conflict resolution
- classifying imported work
- deduplicating candidate work items
- drafting external updates

But:

- AI must not silently remap authorities
- AI must not silently merge unrelated tasks
- AI must not auto-close conflicting work without review

---

## 14. Provider-specific minimum promises

### 14.1 Jira

Must reach Tier A first:

- project and issue-type mapping
- rich field mapping
- assignee mapping
- comment and review scope where enabled
- strong webhook plus polling fallback model
- conflict and replay support

### 14.2 Asana or Monday

One provider must reach Tier A parity with Jira, not remain a card in roadmap only.

Must define:

- workspace, team or board ownership
- status and assignee mapping
- section or group semantics
- date authority
- callback and webhook model

### 14.3 ClickUp

Should reach strong Tier B depth:

- list or space mapping
- task and status mapping
- assignee and due-date sync
- clear limitations on comments, docs and custom fields

### 14.4 Linear

Should reach strong Tier B depth:

- issue and team mapping
- label or cycle awareness where justified
- status and assignee sync
- clear limitations on initiative hierarchy equivalence

Rule:

`provider parity means concrete runtime promise, not benchmark inspiration alone`

---

## 15. What complete PM sync coverage means

PM sync coverage should be considered complete only when all of the following are true:

- at least two serious PM systems are supported at high quality, not Jira-only
- external work can enter `Inbox` in governed form
- `Task` mappings are explicit and auditable
- `Decision` and review communication are supported as first-class flows
- directionality is honestly labeled per provider
- operators have health, retry, replay and conflict tooling
- OAuth and reauth lifecycle is first-class for the serious providers

---

## 16. Current judgment

Current package judgment:

- `broad architectural sync coverage exists`
- `PM-specific interoperability doctrine was previously too distributed`
- `task sync is directionally strong but not yet sealed as multi-tool runtime canon`

This document closes that gap at the product-contract level.

---

## 17. Recommended implementation priorities

1. Harden `Jira` as the first enterprise-quality PM connector.
2. Add one equivalent non-Jira connector at the same product depth.
3. Add `external -> InboxItem` ingestion for email and collaboration escalations.
4. Define explicit `Decision` externalization and callback patterns.
5. Ensure the support surface exposes mapping, run history, retry, replay and conflict state per business object.
6. Add deep but honest provider contracts for `ClickUp` and `Linear`.
7. Tie all serious PM connectors to one explicit OAuth and reauth lifecycle.

---

## 18. Related canonical docs

- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`
- `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md`
- `CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
