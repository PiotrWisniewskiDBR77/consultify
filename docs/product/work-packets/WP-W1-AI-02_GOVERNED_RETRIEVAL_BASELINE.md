# WP-W1-AI-02 — Governed Retrieval and Connector Baseline Analysis

> Status: Completed
> Packet: WP-W1-AI-02
> Wave: 1 — Platform and governance spine
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
> - `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
> - `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
> - `KNOWLEDGE_RAG_V8_SSOT.md`
> - `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
> Supporting anchors:
> - `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.3
> - `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md`
> - `DECISION_LOG_WAVE_1.md` (Decisions 2, 4)

---

## 1. Enterprise search gateway model

### 1.1 Design rationale

Three canonical docs converge on one requirement: all AI consumers must share a single governed retrieval entry point.

- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §7: "Chat, execution and worker consumers use one governed enterprise search gateway."
- `KNOWLEDGE_RAG_V8_SSOT.md` §10.4: "All consumers should use one orchestrated retrieval service that understands scopes, enforces policy, merges results, logs usage."
- `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.3: "retrieval becomes one governed enterprise service, not many consumer-specific search behaviors."

No canonical doc authorizes any AI consumer to build its own retrieval path. The gateway is the sole entry point.

### 1.2 Gateway contract

The `EnterpriseSearchGateway` is a platform service that accepts retrieval requests from registered consumers and returns policy-filtered, ranked, and traced results.

| Aspect | Specification |
|---|---|
| **Entry point** | Single service endpoint; all consumers route through it |
| **Consumer registration** | Each consumer declares `consumer_class` (from ContextSnapshot: `chat`, `execution`, `retrieval`, `background`, `worker`) at request time |
| **Scope input** | `ContextSnapshot.effective_scope_ref` + `organization_id` + `project_id` + `privacy_mode` — supplied by the caller from the active snapshot |
| **Pre-filtering** | Mandatory before ranking: tenant boundary, source ACL, scope type, visibility, sensitivity (`KNOWLEDGE_RAG_V8_SSOT.md` §8.1) |
| **Ranking** | Hybrid retrieval (keyword + semantic + rerank) applied only to the pre-filtered candidate set (`AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4.1) |
| **Result envelope** | Each result carries `source_ref`, `connector_id`, `freshness_state`, `sensitivity_label`, `acl_match_status`, `citation_binding_ref` |
| **Trace output** | Every request produces a `RetrievalTrace` record (§6) |

### 1.3 Consumer registration model

Consumers do not self-register at runtime. The platform defines a fixed set of `consumer_class` values. Each consumer must declare its class in every retrieval request so the gateway can apply consumer-specific preset defaults and audit differentiation.

| Consumer class | Canonical source | Retrieval characteristics |
|---|---|---|
| `chat` | `KNOWLEDGE_RAG_V8_SSOT.md` §8.2 | Interactive; scope priority: session → user_private → organization → system |
| `execution` | `AGENT_EXECUTION_V8_SSOT.md` §9.1 | Run-bound; scope priority: organization → project/artifact context → system |
| `background` | `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.4 | Non-interactive; may use `RetrievalScopeToken` per Decision 2 |
| `worker` | `KNOWLEDGE_RAG_V8_SSOT.md` §9.4 | Restricted to org-safe assigned corpora + system; never arbitrary user-private memory |

### 1.4 Decision 2 compliance

Per `DECISION_LOG_WAVE_1.md` Decision 2:

- **User-visible or run-visible retrieval** → the gateway requires a full `ContextSnapshot` reference. The caller must supply `snapshot_id`.
- **Non-interactive platform jobs** (indexing, refresh, precomputation) → may supply a `RetrievalScopeToken` carrying `organization_id`, `effective_scope_ref`, and `consumer_class = background`.

The gateway validates this rule: if `consumer_class` is `chat`, `execution`, or `worker`, a valid `snapshot_id` must be present. If absent, the request is rejected with error class `MISSING_CONTEXT_SNAPSHOT`.

---

## 2. Connector registry and ACL model

### 2.1 ConnectorRegistry

The canonical connector lifecycle is defined in `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4:

`connector registration → source auth → source mapping → ingest → classify → ACL projection → chunk/embed/index → retrieve → cite/log → refresh/archive`

The `ConnectorRegistry` is the platform catalog of all authenticated external source connections. Every connector entry must carry the minimum metadata defined in the canonical doc (§4.1):

| Field | Type | Description |
|---|---|---|
| `connector_id` | uuid | Unique identifier |
| `connector_type` | enum | Provider family (e.g., `google_drive`, `sharepoint`, `jira`, `notion`) |
| `credential_owner_ref` | ref | User or service principal that owns the credential |
| `source_system_id` | string | External system identifier |
| `source_acl_hash` | hash | Hash of the last-known external ACL state |
| `sensitivity_label` | enum | `public` · `internal` · `confidential` (from `KNOWLEDGE_RAG_V8_SSOT.md` §9.3) |
| `freshness_state` | enum | See §2.3 |
| `last_synced_at` | timestamp | Last successful sync completion |
| `last_verified_at` | timestamp | Last ACL/auth verification |
| `index_version` | integer | Monotonic; increments on re-index |
| `drift_state` | enum | See §2.3 |
| `organization_id` | uuid | Tenant owner — mandatory for isolation |
| `scope_mapping` | ref | Maps connector content to Knowledge RAG scope types |

### 2.2 ACL model

The canonical rule is absolute: "no connector content may enter ranking before tenant, source ACL, role and project visibility checks" (`AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4).

ACL projection operates in three layers:

| Layer | What it enforces | Source of truth |
|---|---|---|
| **Tenant boundary** | Content from connector X in org A is never retrievable by org B | `organization_id` on connector + `organization_id` on ContextSnapshot |
| **Source ACL** | External system permissions are projected into internal effective access. If a user lost access in the source system, retrieval must reflect that before the next retrieval decision | `SourceACLProjector` component; `source_acl_hash` tracks drift |
| **Scope/sensitivity gate** | Content is gated by `scope_type`, `visibility`, and `sensitivity_label` per the Knowledge RAG retrieval policy order (`KNOWLEDGE_RAG_V8_SSOT.md` §8) | `effective_scope_ref` from ContextSnapshot + `sensitivity_label` on connector |

**ACL refresh rule** (from `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §8 acceptance criteria): "Revoked access is reflected before the next retrieval decision." This means the `SourceACLProjector` must run either:
- On every retrieval request (real-time check), or
- On a schedule tight enough that stale ACL windows are bounded and declared.

The chosen strategy is a platform decision. This analysis requires that whichever strategy is chosen, the maximum ACL staleness window must be declared and visible to operators.

### 2.3 Freshness and drift tracking

Freshness and drift are distinct concepts:

| State | Definition | Canonical source |
|---|---|---|
| `fresh` | Content was synced within the connector's declared freshness SLA | `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md` §5.4 |
| `stale` | Content has not been synced within the freshness SLA but the connector is healthy | Derived from `last_synced_at` vs SLA threshold |
| `drifted` | The source system state has changed but the index has not yet caught up | `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4.1 `drift_state` |
| `disconnected` | The connector credential is revoked, expired, or the source system is unreachable | `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §3 |
| `archived` | The connector has been intentionally disabled; content is excluded from retrieval | End-of-lifecycle state |

The gateway must use `freshness_state` and `drift_state` in its pre-filtering and result metadata:
- `disconnected` or `archived` connectors are excluded from retrieval entirely.
- `stale` or `drifted` content may still be returned but must carry a freshness warning in the result envelope.
- Operators must be able to see freshness state per connector (`CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §4).

---

## 3. Denied-result and blocked-source trace

### 3.1 Why this is required

`AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4.1 requires "blocked-source and denied-result traces visible to operators." `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.3 requires "support can explain why a source was used, blocked or stale."

Without this trace, support cannot diagnose why an answer lacked expected information — the most common enterprise retrieval complaint.

### 3.2 Trace model

Every retrieval request that passes through the gateway produces a `DeniedResultTrace` alongside the successful results. This trace captures sources that were considered but excluded.

| Field | Type | Description |
|---|---|---|
| `trace_id` | uuid | Unique trace identifier |
| `retrieval_request_id` | ref | Links to the parent retrieval request |
| `snapshot_id` | ref | ContextSnapshot that governed this retrieval |
| `denied_entries[]` | array | One entry per denied source/result |

Each `denied_entry`:

| Field | Type | Description |
|---|---|---|
| `source_ref` | ref | The connector or source that was denied |
| `connector_id` | uuid | Which connector owned the source |
| `denial_reason` | enum | See below |
| `denial_detail` | string | Human-readable explanation |
| `freshness_state_at_denial` | enum | Freshness state when denial occurred |
| `sensitivity_label` | enum | Sensitivity of the denied source |

### 3.3 Denial reason taxonomy

| Reason | Description |
|---|---|
| `TENANT_BOUNDARY` | Source belongs to a different organization |
| `ACL_DENIED` | User does not have access in the projected ACL |
| `SCOPE_MISMATCH` | Source scope type does not match the effective retrieval scope |
| `SENSITIVITY_BLOCKED` | Source sensitivity exceeds the allowed level for this consumer/context |
| `CONNECTOR_DISCONNECTED` | Connector is in disconnected state |
| `CONNECTOR_ARCHIVED` | Connector has been archived |
| `FRESHNESS_EXCLUDED` | Source excluded due to staleness policy (only when policy is set to exclude, not warn) |
| `PRIVACY_MODE` | Private mode is active and the source is not allowed under private-mode rules |
| `POLICY_BLOCKED` | An explicit admin policy blocks this source for this consumer class |

### 3.4 Visibility rules

- **Support operators** can view the full `DeniedResultTrace` for any retrieval within their tenant scope.
- **Superadmin** can view traces across tenants.
- **End users** see a simplified explanation: "Some sources were not included because of access or freshness policies" — never the raw trace.
- **Operators** can filter denied traces by `denial_reason` to diagnose systemic issues (e.g., mass ACL revocation, connector outage).

---

## 4. Search preset model

### 4.1 Design rationale

`AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §6 identifies a risk: "different AI consumers apply different search presets to the same source family." §7 requires "one retrieval preset model per consumer and task shape."

Search presets are shared configuration objects that define how retrieval behaves for a given consumer and task shape. They prevent each consumer from inventing its own ranking, scope, and filter configuration.

### 4.2 Preset structure

| Field | Type | Description |
|---|---|---|
| `preset_id` | uuid | Unique identifier |
| `preset_name` | string | Human-readable name |
| `consumer_class` | enum | Which consumer class this preset applies to |
| `task_shape` | enum | Task type hint (e.g., `personal_drafting`, `org_execution`, `worker_branded`, `deep_research`) |
| `scope_priority` | ordered list | Ordered scope types to search (from `KNOWLEDGE_RAG_V8_SSOT.md` §8.2) |
| `source_family_filter` | list | Which connector types / source families to include |
| `sensitivity_ceiling` | enum | Maximum sensitivity level allowed |
| `freshness_policy` | enum | `include_stale_with_warning` · `exclude_stale` · `no_freshness_gate` |
| `ranking_strategy` | enum | `hybrid` · `keyword_only` · `semantic_only` (default: `hybrid`) |
| `max_results` | integer | Maximum results to return |
| `rerank_enabled` | boolean | Whether reranking stage is applied |

### 4.3 Default presets (from canonical scope priority)

These defaults are derived directly from `KNOWLEDGE_RAG_V8_SSOT.md` §8.2:

| Task shape | Scope priority | Sensitivity ceiling | Freshness policy |
|---|---|---|---|
| `personal_drafting` | session → user_private → organization → system | `confidential` | `include_stale_with_warning` |
| `org_execution` | organization → project/artifact → system → user_private (when explicitly relevant) | `confidential` | `include_stale_with_warning` |
| `worker_branded` | organization (assigned) → system | `internal` | `exclude_stale` |
| `deep_research` | session → organization → system → external | `confidential` | `include_stale_with_warning` |

### 4.4 Governance

- Presets are platform-defined. Org admins may override `source_family_filter` and `sensitivity_ceiling` within platform bounds.
- No consumer may bypass the preset system by supplying raw filter parameters directly to the gateway.
- Preset changes are auditable and versioned.

---

## 5. Retrieval scope resolution

### 5.1 How ContextSnapshot feeds pre-filtering

The `ContextSnapshot.effective_scope_ref` is the primary input to the gateway's pre-filter stage. This field is resolved by the context resolver (defined in `WP-W1-AI-01`) before the retrieval request is made.

Resolution flow:

```
1. Caller captures or references a ContextSnapshot
2. ContextSnapshot.effective_scope_ref resolves to:
   - organization_id (tenant boundary)
   - project_id (project scope, if present)
   - scope_types allowed (from preset or explicit)
   - user_id (for user-private scope gating)
   - privacy_mode (restricts user-private reads/writes)
3. Gateway receives the snapshot reference
4. Gateway extracts pre-filter parameters from the snapshot
5. Pre-filter is applied BEFORE candidate generation
6. Only filtered candidates enter ranking
```

### 5.2 Decision 2 enforcement

Per `DECISION_LOG_WAVE_1.md` Decision 2, the gateway enforces two retrieval modes:

| Mode | Required context | When used |
|---|---|---|
| **Full snapshot mode** | Valid `snapshot_id` referencing a complete `ContextSnapshot` | All user-visible or run-visible retrieval (chat answers, execution run grounding, worker-generated content, support traces) |
| **Scope token mode** | `RetrievalScopeToken` with `organization_id` + `effective_scope_ref` + `consumer_class` | Non-interactive platform jobs only (indexing, refresh, precomputation) |

The gateway rejects any request where:
- `consumer_class` is `chat`, `execution`, or `worker` AND `snapshot_id` is absent → error `MISSING_CONTEXT_SNAPSHOT`
- `consumer_class` is `background` AND neither `snapshot_id` nor a valid `RetrievalScopeToken` is present → error `MISSING_SCOPE_CONTEXT`

### 5.3 Decision 4 compliance

Per `DECISION_LOG_WAVE_1.md` Decision 4, Wave 1 uses one `ContextSnapshot` family. There is no separate worker snapshot variant. Workers supply the same `ContextSnapshot` with `consumer_class = worker`, and the gateway applies worker-specific preset rules (§4.3: `worker_branded` preset restricts to org-assigned + system scopes only).

### 5.4 Scope pre-filter sequence

Derived from `KNOWLEDGE_RAG_V8_SSOT.md` §8:

1. **Tenant filter** — exclude all content where `organization_id` does not match.
2. **Scope type filter** — include only scope types allowed by the active preset's `scope_priority`.
3. **ACL filter** — exclude content where the user (from `initiator_user_id` or worker assignment) does not have projected access.
4. **Sensitivity filter** — exclude content above the preset's `sensitivity_ceiling`.
5. **Freshness filter** — apply the preset's `freshness_policy` (exclude or tag stale).
6. **Privacy mode filter** — if `privacy_mode = true`, exclude user-private durable memory reads per product contract.
7. **Connector health filter** — exclude content from `disconnected` or `archived` connectors.

Only after all seven filters are applied does the candidate set enter ranking.

---

## 6. Support-visible retrieval trace

### 6.1 Design principle

`AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §8: "Support can inspect both source provenance and routing explanation." `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.3: "support can explain why a source was used, blocked or stale."

Every retrieval-backed answer or run must produce a trace that support can inspect.

### 6.2 RetrievalTrace model

| Field | Type | Description |
|---|---|---|
| `trace_id` | uuid | Unique trace identifier |
| `snapshot_id` | ref | The ContextSnapshot that governed this retrieval |
| `consumer_class` | enum | Which consumer issued the request |
| `preset_id` | ref | Which search preset was active |
| `request_timestamp` | timestamp | When the retrieval was issued |
| `scope_resolution_summary` | object | Resolved tenant, project, scope types, sensitivity ceiling |
| `candidates_considered` | integer | Total candidates after pre-filter |
| `results_returned` | integer | Results after ranking |
| `results[]` | array | Per-result detail (see below) |
| `denied_trace_ref` | ref | Link to the `DeniedResultTrace` (§3) |
| `freshness_warnings[]` | array | Sources returned with freshness warnings |
| `total_latency_ms` | integer | End-to-end retrieval latency |

Each `result` entry:

| Field | Type | Description |
|---|---|---|
| `source_ref` | ref | Source identity |
| `connector_id` | uuid | Owning connector |
| `scope_type` | enum | Which scope the source belongs to |
| `sensitivity_label` | enum | Source sensitivity |
| `freshness_state` | enum | Freshness at retrieval time |
| `rank_position` | integer | Final rank after reranking |
| `citation_binding_ref` | ref | Link to the `CitationBinding` in the output trust layer |

### 6.3 What support must see

For any retrieval-backed answer or run, support must be able to answer these questions:

| Question | Answered by |
|---|---|
| What context was active? | `snapshot_id` → full ContextSnapshot (from WP-W1-AI-01) |
| Which preset governed retrieval? | `preset_id` |
| What sources were used? | `results[]` with `source_ref`, `connector_id`, `scope_type` |
| What sources were blocked and why? | `denied_trace_ref` → `DeniedResultTrace` (§3) |
| Were any sources stale? | `freshness_warnings[]` |
| What was the effective scope? | `scope_resolution_summary` |
| Was privacy mode active? | `snapshot_id` → `ContextSnapshot.privacy_mode` |

### 6.4 Trace access model

Consistent with `WP-W1-AI-01` §4.4:

- **Support operators** — full trace access within their tenant.
- **Superadmin** — cross-tenant trace access.
- **End users** — simplified: can see which sources were cited in their answer, but not the full retrieval trace or denied-result detail.

### 6.5 Trace retention

Per `DECISION_LOG_WAVE_1.md` Decision 3, the minimum retention baseline for Wave 1 is 30 days. Retrieval traces follow the same rule: retained at least 30 days, or longer if associated with an auditable run or sync incident.

---

## 7. Downstream dependency map

### 7.1 What this baseline provides to later packets

| Downstream packet/capability | Dependency on this baseline | Consequence if missing |
|---|---|---|
| **Tool governance / HITL (WP-W1-AI-04)** | Tool calls that retrieve information must go through the governed gateway; tool governance needs `consumer_class` and `effective_scope_ref` from the snapshot to evaluate retrieval-related tool permissions | Tool-initiated retrieval bypasses ACL and freshness checks |
| **Output trust and provenance (Closure Wave 6)** | `CitationBinding` in the trust layer references `RetrievalTrace.results[]`; without the trace, citations cannot be verified against actual retrieval | Citations become cosmetic — no verifiable link to what was actually retrieved |
| **Background/scheduled agent runtime (Closure Wave 3)** | Background jobs must use `RetrievalScopeToken` mode (per Decision 2); the gateway must support both full-snapshot and scope-token modes | Background retrieval either lacks governance or is forced to fabricate a full snapshot |
| **AI operations and release (Closure Wave 5)** | Release bundles may change retrieval behavior (model, ranking, presets); the trace must record which preset version was active | Cannot diagnose retrieval quality regressions after a release |
| **Connector implementation (provider-specific)** | Each new connector must register in the `ConnectorRegistry` with the metadata schema defined here; ACL projection rules must follow the three-layer model | New connectors invent their own ACL and freshness semantics |
| **Knowledge RAG working memory** | Working memory compaction and retrieval must route through the same gateway; scope and freshness rules apply equally | Working memory becomes an ungoverned retrieval side-channel |

### 7.2 What this baseline depends on

| Upstream dependency | Provided by | Status |
|---|---|---|
| `ContextSnapshot` object family | `WP-W1-AI-01` | Completed |
| `effective_scope_ref` resolution | `WP-W1-AI-01` §1.2 | Completed |
| `consumer_class` enum | `WP-W1-AI-01` §1.2 | Completed |
| Binding decisions 2 and 4 | `DECISION_LOG_WAVE_1.md` | Ratified |

---

## 8. Open questions and conflicts

### 8.1 ACL refresh strategy: real-time vs scheduled

- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §8 requires "revoked access is reflected before the next retrieval decision."
- Taken literally, this implies real-time ACL checks on every retrieval request.
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md` §5.4 requires freshness tracking but does not mandate real-time verification — it requires `last sync time` and `freshness state`.
- These are not contradictory but create an implementation tension: real-time ACL checks against external systems on every retrieval request may be impractical at scale.

**Recommendation:** Define a maximum ACL staleness window (e.g., 5 minutes for high-sensitivity connectors, 1 hour for low-sensitivity) and make this window visible to operators. Escalate as a platform decision if real-time is required for specific connector types.

### 8.2 Sensitivity label granularity

- `KNOWLEDGE_RAG_V8_SSOT.md` §9.3 defines three sensitivity levels: `public`, `internal`, `confidential`.
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §4.1 includes `sensitivity_label` in connector metadata but does not constrain the enum.
- No canonical doc defines whether sensitivity is per-connector, per-source-document, or per-chunk.

**Recommendation:** For Wave 1, sensitivity is per-connector (all content from a connector inherits its sensitivity label). Per-document sensitivity is deferred to a later wave when ingestion-time classification is mature.

### 8.3 Preset override boundaries

- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §7 requires "one retrieval preset model per consumer and task shape."
- It is unclear whether org admins should be able to create entirely new presets or only override specific fields of platform-defined presets.

**Recommendation:** Org admins may override `source_family_filter` and `sensitivity_ceiling` on platform-defined presets. Custom preset creation is deferred to a later wave to avoid preset sprawl.

### 8.4 External scope retrieval governance

- `KNOWLEDGE_RAG_V8_SSOT.md` §3.5 defines external scope (web search, external RAG providers, connector-loaded documents) with the rule "must stay distinguishable from internal memory."
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md` §4 distinguishes `import`, `connector`, `sync`, and `automation` — but web search does not fit cleanly into any of these categories.
- The gateway must handle external-scope retrieval, but the canonical docs do not fully define how web search results enter the governed pipeline.

**Recommendation:** For Wave 1, external-scope retrieval (web search) is treated as a special consumer-initiated source that does not pass through the `ConnectorRegistry`. It must still be tagged with `scope_type = external` in retrieval results and traces. Full external-scope governance is deferred to the enterprise retrieval hardening wave.

### 8.5 No conflicts detected between remaining canonical sources

The following pairs were checked and found consistent:
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §5 ↔ `KNOWLEDGE_RAG_V8_SSOT.md` §1.1 (clear ownership split: connectors doc owns connector lifecycle; Knowledge RAG owns scope and retrieval policy)
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §5 ↔ `KNOWLEDGE_RAG_V8_SSOT.md` §10.4 (trust doc owns output contract; Knowledge RAG owns retrieval logging — complementary, not overlapping)
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md` §5 ↔ `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §8 (operator surfaces doc describes the UI; connectors doc describes the data contract — aligned)
- `DECISION_LOG_WAVE_1.md` Decision 2 ↔ `WP-W1-AI-01` §6.2 (Decision 2 resolves the open question raised in WP-W1-AI-01 about snapshot granularity for retrieval)
- `DECISION_LOG_WAVE_1.md` Decision 4 ↔ `WP-W1-AI-01` §6.4 (Decision 4 resolves the worker context question — one snapshot family)

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Enterprise search gateway model with consumer registration, scope pre-filtering, and Decision 2 enforcement
  - Connector registry schema with minimum metadata fields from canonical docs
  - Three-layer ACL model (tenant boundary, source ACL projection, scope/sensitivity gate)
  - Freshness and drift state taxonomy with retrieval behavior per state
  - Denied-result and blocked-source trace model with nine-value denial reason taxonomy
  - Search preset model with four canonical default presets derived from Knowledge RAG scope priority
  - Retrieval scope resolution flow showing how ContextSnapshot.effective_scope_ref feeds seven-stage pre-filtering
  - Support-visible retrieval trace model with minimum fields and access rules
  - Downstream dependency map (six downstream consumers, four upstream dependencies)
  - Open questions and conflict analysis (4 items identified, 0 conflicts)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - ACL refresh strategy (§8.1) needs a platform decision on maximum staleness window before connector implementation begins
  - Sensitivity granularity (§8.2) is scoped to per-connector for Wave 1 but will need per-document support for enterprise-grade deployment
- **Questions requiring escalation:**
  1. What is the maximum acceptable ACL staleness window per connector sensitivity level? (§8.1)
  2. Should org admins be able to create custom search presets or only override fields on platform-defined presets? (§8.3)
  3. How should web search results enter the governed retrieval pipeline — through a pseudo-connector or as a separate external-scope path? (§8.4)
