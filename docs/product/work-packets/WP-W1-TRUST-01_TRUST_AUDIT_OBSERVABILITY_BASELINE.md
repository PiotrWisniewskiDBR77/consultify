# WP-W1-TRUST-01 — Trust, Audit and Observability Baseline Analysis

> Status: Completed
> Packet: WP-W1-TRUST-01
> Wave: 1 — Platform and governance spine
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
> - `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
> - `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md`
> - `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
> Supporting anchors:
> - `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7 (Wave 6 — trust contract)
> - `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md` §4 (support trace requirements)
> - `WP-W1-AI-02_GOVERNED_RETRIEVAL_BASELINE.md` §3 (denial traces), §6 (retrieval traces)
> - `WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md` §6 (audit trail)
> - `DECISION_LOG_WAVE_1.md` — Decisions 2, 3, 10, 12

---

## 1. Universal trust vocabulary

### 1.1 Design rationale

`AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §8 requires: "The system can distinguish grounded fact, generated synthesis and uncertain inference." `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7 requires: "one universal trust vocabulary." Currently, no canonical doc defines the exact vocabulary. This section closes that gap by normalizing the four trust classes that every AI consumer must use when labeling output claims.

### 1.2 Trust class definitions

| Trust class | Definition | When assigned | Example |
|---|---|---|---|
| `grounded_fact` | A claim directly supported by one or more retrieved sources with high binding strength. The evidence chain is complete: source → chunk → claim → output span. | Retrieval returned a matching source; the output span is a faithful representation of the source content; binding strength ≥ `strong`. | "Q3 revenue was €2.4M" backed by a synced financial report. |
| `synthesis` | A claim derived by combining, summarizing, or reasoning across multiple grounded sources. The individual sources are traceable but the combined conclusion is model-generated. | Multiple sources contribute to the claim; no single source contains the exact statement; the model performed aggregation, comparison, or inference across sources. | "Revenue grew 12% QoQ" computed from two quarterly reports. |
| `uncertain_inference` | A claim where the model infers beyond the available evidence. Sources may be partial, stale, conflicting, or absent for some aspect of the claim. The system cannot fully ground the statement. | Source coverage is incomplete; freshness state is `stale` or `drifted`; sources conflict on a material point; the model extrapolates beyond retrieved content. | "Based on current trends, Q4 is likely to exceed target" when only Q1–Q3 data is available. |
| `degraded` | A claim produced under degraded operating conditions: model fallback, retrieval failure, connector disconnection, policy-blocked sources, or timeout. The system operated below its normal trust baseline. | Provider fallback occurred; retrieval returned zero results due to connector failure; ACL check timed out; the model used a lower-capability fallback route. | Any output produced after a retrieval timeout or during a model degradation event. |

### 1.3 Assignment rules

1. **Default is `uncertain_inference`.** Every output claim starts as uncertain until evidence binding elevates it.
2. **Elevation to `grounded_fact`** requires at least one `EvidenceRef` with `binding_strength ≥ strong` and `verification_state = verified`.
3. **Elevation to `synthesis`** requires two or more `EvidenceRef` entries where the claim is a model-generated combination, each individual ref having `binding_strength ≥ moderate`.
4. **Demotion to `degraded`** is triggered by any runtime degradation flag: `degraded_mode_flag = true` on the trust metadata, retrieval returning zero results due to system failure (not policy denial), or model fallback to a lower-capability route.
5. **Trust class is per-claim, not per-output.** A single response may contain claims at different trust levels. The output envelope carries the lowest trust class as a summary indicator.

### 1.4 Canonical metadata fields

Derived from `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4.1:

| Field | Type | Required | Description |
|---|---|---|---|
| `trust_class` | enum | yes | One of: `grounded_fact`, `synthesis`, `uncertain_inference`, `degraded` |
| `evidence_refs[]` | `EvidenceRef[]` | no | Evidence bindings supporting this claim (empty for `degraded`) |
| `binding_strength` | enum (`strong` · `moderate` · `weak` · `none`) | yes | Strongest evidence binding for this claim |
| `verification_state` | enum (`verified` · `partially_verified` · `unverified`) | yes | Whether the evidence chain has been validated |
| `uncertainty_class` | enum | no | See §3 for the uncertainty taxonomy |
| `degraded_mode_flag` | boolean | yes | Whether the claim was produced under degraded conditions |
| `routing_trace_ref` | ref | yes | Link to the routing explanation for this output |
| `generated_at` | timestamp | yes | When the claim was produced |

### 1.5 Cross-consumer consistency rule

From `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §8: "Trust semantics are consistent across chat, execution and retrieval-powered outputs."

All AI consumers — chat, execution agent, background workers, report generators, presentation generators — must use this vocabulary. No consumer may invent local trust labels, rename these classes, or skip trust classification for high-value outputs.

---

## 2. Provenance ledger model

### 2.1 Design rationale

`AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7 requires: "one shared provenance ledger" and "one exact claim-to-source binding doctrine." `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4 defines the required trust objects: `EvidenceRef`, `CitationBinding`, `ProvenanceLedgerEntry`. This section normalizes these into a coherent ledger model.

### 2.2 Provenance chain

The provenance chain traces every high-value output claim back to its origins:

```
Source (connector/knowledge/system) 
  → Chunk (indexed fragment)
    → EvidenceRef (binding to a specific claim)
      → CitationBinding (output span ↔ evidence ref)
        → ProvenanceLedgerEntry (durable audit record)
```

### 2.3 Object model

#### `EvidenceRef`

A pointer from an output claim to a specific piece of evidence.

| Field | Type | Required | Description |
|---|---|---|---|
| `evidence_ref_id` | uuid | yes | Unique identifier |
| `source_object_ref` | ref | yes | The source object (document, record, knowledge entry) |
| `chunk_ref` | ref | no | Specific chunk within the source (if chunked retrieval was used) |
| `connector_id` | uuid | no | Owning connector (if external source) |
| `scope_type` | enum | yes | From `SourceRef.scope_type` (session, user_private, organization, system, external) |
| `freshness_at_retrieval` | timestamp | no | Freshness state of the source when it was retrieved |
| `binding_strength` | enum | yes | `strong` · `moderate` · `weak` · `none` |
| `verification_state` | enum | yes | `verified` · `partially_verified` · `unverified` |

#### `CitationBinding`

Links an output span to one or more evidence references.

| Field | Type | Required | Description |
|---|---|---|---|
| `citation_binding_id` | uuid | yes | Unique identifier |
| `output_span_ref` | ref | yes | Pointer to the specific span in the output (response, proposal, artifact section) |
| `evidence_refs[]` | `EvidenceRef[]` | yes | One or more evidence references supporting this span |
| `trust_class` | enum | yes | Resolved trust class for this span |
| `claim_summary` | string | no | Human-readable summary of the claim being made |

#### `ProvenanceLedgerEntry`

The durable audit record that preserves the full evidence chain for a high-value output.

| Field | Type | Required | Description |
|---|---|---|---|
| `ledger_entry_id` | uuid | yes | Unique identifier |
| `output_ref` | ref | yes | The output (response, proposal, artifact) this entry covers |
| `context_snapshot_ref` | uuid | yes | The `ContextSnapshot` active when the output was produced (from WP-W1-AI-01) |
| `retrieval_trace_ref` | uuid | no | Link to the `RetrievalTrace` (from WP-W1-AI-02 §6) |
| `execution_run_ref` | uuid | no | Link to the `ExecutionAgentRun` if output was produced by execution |
| `citation_bindings[]` | `CitationBinding[]` | yes | All citation bindings for this output |
| `routing_explanation_ref` | ref | yes | Link to the `RoutingExplanation` (§4.3) |
| `trust_summary` | object | yes | Aggregate trust profile: count per trust class, lowest trust class, degraded flag |
| `created_at` | timestamp | yes | When the ledger entry was created |

### 2.4 Provenance survival rule

From `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4.1: "how provenance survives transformation from retrieval result to summary to proposal to saved artifact."

When an output is transformed (e.g., a chat answer is promoted to a report section, or a proposal is applied as an artifact mutation), the provenance chain must be preserved:

1. **Promotion.** When an answer or proposal is promoted to an artifact, the new artifact carries a `provenance_origin_ref` pointing to the original `ProvenanceLedgerEntry`.
2. **Summarization.** When multiple claims are summarized, the summary's `CitationBinding` must reference all contributing `EvidenceRef` entries, not just the final summary text.
3. **Artifact save.** When an AI-generated artifact is saved, the artifact record must carry `provenance_ledger_ref` linking to the ledger entry that documents its evidence chain.

### 2.5 Snapshot reference binding (Decision 2 compliance)

Per `DECISION_LOG_WAVE_1.md` Decision 2: "User-visible retrieval => full ContextSnapshot." Every `ProvenanceLedgerEntry` must carry a `context_snapshot_ref` that points to a full `ContextSnapshot`, not a lighter scope token. This ensures that provenance is always traceable to the complete runtime context.

---

## 3. Uncertainty and degraded-trust language

### 3.1 Design rationale

`AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7 requires: "one uncertainty and degraded-trust language." `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4.1 requires: "how uncertainty is represented when support is partial, stale or conflicting." This section defines when and how the system communicates limitations honestly.

### 3.2 Uncertainty taxonomy

| Uncertainty class | Trigger condition | System behavior |
|---|---|---|
| `partial_evidence` | Some claims in the output have evidence, others do not. Coverage is incomplete. | Output marks unsupported claims as `uncertain_inference`. User-facing: "Some parts of this answer are based on available data; others are inferred." |
| `stale_source` | Evidence exists but the source freshness state is `stale` or `drifted`. | Output marks affected claims as `uncertain_inference` with `uncertainty_class = stale_source`. User-facing: "This information is based on data that may not be current." |
| `conflicting_sources` | Two or more sources provide contradictory information on a material point. | Output marks the conflicting claim as `uncertain_inference` with `uncertainty_class = conflicting_sources`. User-facing: "Sources disagree on this point." The output should present both positions when feasible. |
| `scope_limited` | The retrieval scope was narrower than the question requires (e.g., user asked about the whole org but only project-scoped data was available). | Output marks scope-limited claims as `uncertain_inference` with `uncertainty_class = scope_limited`. User-facing: "This answer is based on [project X] data only; broader organizational data was not in scope." |
| `model_extrapolation` | The model generated a conclusion that goes beyond any retrieved evidence. | Output marks the claim as `uncertain_inference` with `uncertainty_class = model_extrapolation`. User-facing: "This conclusion is generated by the AI and not directly supported by your data." |

### 3.3 Degraded-trust conditions

| Degraded condition | Trigger | System behavior |
|---|---|---|
| `provider_fallback` | Primary model unavailable; request routed to a fallback model with different capability profile. | `degraded_mode_flag = true`. Routing explanation records the fallback. User-facing: "This response was generated using an alternative model." Support-visible: full routing trace with fallback reason. |
| `retrieval_failure` | Retrieval returned zero results due to system failure (connector down, timeout), not policy denial. | `degraded_mode_flag = true`. Trust class for all retrieval-dependent claims set to `degraded`. User-facing: "Some data sources were temporarily unavailable." |
| `acl_timeout` | ACL verification timed out; the system cannot confirm the user's access to a source. | Per Decision 10: if the connector's sensitivity class requires a tighter ACL window than the elapsed time, the result is treated as `stale_acl` / degraded. User-facing: "Access verification is pending; some sources may be excluded." |
| `partial_tool_failure` | A tool call within an execution run failed, producing incomplete results. | `degraded_mode_flag = true` on the affected output section. User-facing: "Some steps could not be completed." Support-visible: failure class and recovery path from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §3. |
| `connector_disconnected` | A connector that would normally contribute to retrieval is in `disconnected` state. | Retrieval excludes the connector (per WP-W1-AI-02 §2.3). If the disconnected connector was material to the query, the output carries a freshness warning. User-facing: "Some connected sources are currently unavailable." |

### 3.4 ACL staleness windows (Decision 10 compliance)

Per `DECISION_LOG_WAVE_1.md` Decision 10:

| Sensitivity level | Maximum ACL refresh lag | Behavior when exceeded |
|---|---|---|
| `high` | 0–5 min | Result treated as `stale_acl` / degraded; not served as fully trusted retrieval |
| `medium` | ≤ 15 min | Result treated as `stale_acl` / degraded |
| `low` | ≤ 60 min | Result treated as `stale_acl` / degraded |

Rule: the higher the sensitivity, the closer to runtime-check, not cache-only.

### 3.5 Web search trust semantics (Decision 12 compliance)

Per `DECISION_LOG_WAVE_1.md` Decision 12:

- Web search results are a separate `external` scope, not the same governance class as tenant connectors.
- Web search results must be visibly tagged as `scope_type = external` in retrieval traces and citation bindings.
- Trust class for web search results defaults to `uncertain_inference` unless the source is on a platform-approved trust list.
- The system must not present web search results with the same trust indicators as internally governed connector content.

### 3.6 Honest communication principles

1. **Never hide uncertainty behind confident prose.** If the trust class is `uncertain_inference` or `degraded`, the output must contain a visible limitation indicator.
2. **Never conflate policy denial with absence.** If a source was blocked by ACL or policy (denial reason from WP-W1-AI-02 §3.3), the system says "some sources were not included due to access policies," not "no relevant information was found."
3. **Never present degraded output as normal.** If `degraded_mode_flag = true`, the output must carry a visible degradation indicator, even if the content appears reasonable.
4. **Scope disclosure before answer.** When the effective retrieval scope is narrower than the user's apparent intent, disclose the scope before presenting results.

---

## 4. Support trace model

### 4.1 Design rationale

`AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §5 and §8 require: "Support can inspect both source provenance and routing explanation." `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §9 requires operators to answer: what the user asked for, what run and proposal were created, what model or runtime path was used, why the action did not complete, what safe next step exists. `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7 requires: "one support trace that explains both evidence and execution path."

This section defines a unified support trace that joins context, retrieval, execution, tool use, and output trust into one inspectable record.

### 4.2 Unified `SupportTrace` model

The `SupportTrace` is a composite record assembled from the trace objects defined in earlier Wave 1 packets. It is not a new data store but a query-time join across existing trace records.

| Component | Source | What it provides |
|---|---|---|
| **Context trace** | `ContextSnapshot` (WP-W1-AI-01 §4) | Workspace, project, conversation, run, artifact identities; role; scope; privacy mode; drift events |
| **Retrieval trace** | `RetrievalTrace` (WP-W1-AI-02 §6) | Sources used, sources denied, preset active, scope resolution, freshness warnings |
| **Execution trace** | Run audit trail (WP-W1-AI-03 §6) | Goal, proposals, approval decisions, apply results, failure summaries |
| **Routing trace** | `RoutingExplanation` (§4.3 below) | Model selected, routing reason, fallback events, workload class |
| **Trust trace** | `ProvenanceLedgerEntry` (§2.3) | Citation bindings, evidence refs, trust class summary, degraded flag |

### 4.3 `RoutingExplanation`

The routing explanation makes model and runtime path selection visible to support and, when relevant, to users.

| Field | Type | Required | Description |
|---|---|---|---|
| `routing_explanation_id` | uuid | yes | Unique identifier |
| `execution_run_id` | uuid | no | Parent run (if execution context) |
| `conversation_id` | uuid | no | Parent conversation (if chat context) |
| `model_selected` | string | yes | Which model was used |
| `model_selection_reason` | string | yes | Why this model was selected (workload class, purpose, cost tier, capability match) |
| `fallback_occurred` | boolean | yes | Whether a fallback from the primary model occurred |
| `fallback_reason` | string | no | Why fallback was triggered (provider error, timeout, rate limit, capability mismatch) |
| `fallback_from` | string | no | Original model that was attempted |
| `workload_class` | string | yes | The workload class that governed routing |
| `purpose` | string | yes | The declared purpose of the AI interaction |
| `cost_tier` | string | no | Cost classification of the selected route |
| `latency_observed_ms` | integer | no | Observed latency for the model call |
| `created_at` | timestamp | yes | When the routing decision was made |

### 4.4 Support trace query model

Support operators must be able to query the unified trace by:

| Query dimension | Fields |
|---|---|
| **By run** | `execution_run_id` → returns full trace (context + retrieval + execution + routing + trust) |
| **By conversation** | `conversation_id` → returns all traces for turns in the conversation |
| **By user** | `initiator_user_id` + time range → returns traces for the user's interactions |
| **By organization** | `organization_id` + time range → returns traces across the tenant |
| **By failure** | `failure_class` (from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §3) → returns traces where failures occurred |
| **By trust class** | `trust_class = degraded` → returns all outputs produced under degraded conditions |
| **By routing** | `fallback_occurred = true` → returns all fallback events |

### 4.5 What support must be able to answer

For any important AI output, support must reconstruct (from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §9 and `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §8):

| Question | Answered by |
|---|---|
| What did the user ask for? | Context trace → conversation, goal summary |
| What context was active? | Context trace → `ContextSnapshot` (workspace, project, role, scope) |
| What sources were used? | Retrieval trace → `results[]` with source refs |
| What sources were blocked and why? | Retrieval trace → `DeniedResultTrace` |
| What model was used and why? | Routing trace → `RoutingExplanation` |
| Was there a fallback? | Routing trace → `fallback_occurred`, `fallback_reason` |
| What proposals were generated? | Execution trace → proposal audit records |
| Who approved what? | Execution trace → `resolved_by` (human vs policy) |
| What was applied and what failed? | Execution trace → apply results |
| How trustworthy is the output? | Trust trace → `ProvenanceLedgerEntry.trust_summary` |
| Were there degraded conditions? | Trust trace → `degraded_mode_flag`; routing trace → `fallback_occurred` |
| What is the safe next step? | Failure class → recovery path (from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §5) |

### 4.6 Trace access model

Consistent with WP-W1-AI-01 §4.4 and WP-W1-AI-02 §6.4:

| Role | Access |
|---|---|
| **Support operator** | Full unified trace within their tenant scope |
| **Superadmin** | Cross-tenant trace access |
| **End user** | Simplified view: which sources were cited, trust indicators on output, own run history with outcomes. Never the raw routing trace, denied-result detail, or internal resolution metadata. |

### 4.7 Trace retention (Decision 3 compliance)

Per `DECISION_LOG_WAVE_1.md` Decision 3:

- **Baseline retention:** 30 days for all trace components (context snapshots, retrieval traces, routing explanations, provenance ledger entries).
- **Long-term retention:** If a trace is associated with an approved mutation, an important auditable run, or a sync incident, long-term durability goes through audit/event lineage, not through infinite trace retention.
- **Correlation retention:** The unified support trace is a query-time join. As long as the component traces are retained, the unified view is available. Component retention follows the 30-day baseline.

---

## 5. Audit-grade output explanation

### 5.1 Design rationale

`AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4 canonical rule: "every high-value AI output must preserve enough evidence and execution context to explain what was used, what was inferred and what remains uncertain." This section defines what "audit-grade" means: the minimum set of information that must be reconstructable for any important output.

### 5.2 Definition of "important output"

Not every AI interaction requires full audit-grade explanation. The following outputs are classified as important:

| Output class | Why it is important | Examples |
|---|---|---|
| **Approved mutations** | A durable change was made to a governed artifact based on AI output | Execution run that created/updated an initiative, task, report section |
| **Published artifacts** | An AI-generated artifact was promoted from personal to shared or published | Report published to stakeholders, presentation shared with team |
| **Governance transitions** | An AI recommendation led to a workflow state change | Status change on an initiative, approval of a budget item |
| **Financial or compliance outputs** | Outputs with regulatory or financial implications | Financial analysis, compliance assessment, audit finding |
| **Escalated or disputed outputs** | An output that was flagged, disputed, or escalated by a user or operator | Any output where a user reported an issue or requested review |

### 5.3 Minimum reconstructable information

For every important output, the following must be reconstructable from persisted records:

| Category | What must be reconstructable | Source |
|---|---|---|
| **Context** | Which workspace, project, conversation, and run produced this output; who initiated it; what role and scope were active | `ContextSnapshot` (WP-W1-AI-01) |
| **Retrieval** | Which sources were used; which were denied and why; what freshness state applied; what preset governed retrieval | `RetrievalTrace` + `DeniedResultTrace` (WP-W1-AI-02) |
| **Evidence** | Which specific sources support which specific claims in the output; binding strength and verification state | `EvidenceRef` + `CitationBinding` (§2.3) |
| **Execution** | What proposals were generated; what was approved/rejected and by whom; what was applied and what failed | Run audit trail (WP-W1-AI-03 §6) |
| **Routing** | Which model was used; why it was selected; whether fallback occurred | `RoutingExplanation` (§4.3) |
| **Trust** | What trust class was assigned to each major claim; whether degraded conditions applied; what uncertainty was present | `ProvenanceLedgerEntry.trust_summary` + per-claim trust metadata (§1.4) |
| **Limitations** | What the system could not do or did not know; what scope limitations applied | Uncertainty taxonomy (§3.2) + scope disclosure |

### 5.4 Audit reconstruction rule

The system must support the following reconstruction query:

> Given an `output_ref` (response ID, proposal ID, or artifact version ID), return the complete evidence chain: context snapshot → retrieval trace → evidence refs → citation bindings → routing explanation → trust summary → failure/degradation events.

This reconstruction must be possible for at least 30 days after the output was produced (Decision 3 baseline). For important outputs associated with approved mutations, reconstruction must be possible for as long as the audit lineage is retained.

### 5.5 Non-repudiation

For approved mutations:

1. The approval record must carry `resolved_by` (user ref or policy ref) and `resolved_at` — from WP-W1-AI-03 §3.1.
2. The apply result must carry `changed_objects` and `context_snapshot_ref` at apply time — from WP-W1-AI-03 §6.3.
3. The provenance ledger entry must link the output to its evidence chain.
4. Together, these records establish: who asked, what was proposed, who approved, what was applied, and what evidence supported it.

---

## 6. Observability baseline

### 6.1 Design rationale

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 requires: "release observability tied to support-visible run traces." `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §8 requires: "support can reconstruct context, retrieval, tool use, release state and trust state for important runs." This section defines the minimum observability baseline for AI operations in Wave 1.

### 6.2 Health signals

The following health signals must be continuously monitored and available to operators:

| Signal | What it measures | Alert threshold (Wave 1 baseline) |
|---|---|---|
| **Retrieval success rate** | % of retrieval requests that return ≥ 1 result (excluding policy denials) | < 90% over 15-min window |
| **Retrieval latency p95** | 95th percentile retrieval latency | > 2000ms |
| **Model availability** | % of model calls that succeed without fallback | < 99% over 15-min window |
| **Fallback rate** | % of model calls that triggered a provider fallback | > 5% over 1-hour window |
| **Trust degradation rate** | % of outputs classified as `degraded` | > 10% over 1-hour window |
| **Connector health** | Count of connectors in `disconnected` or `drifted` state per org | Any `disconnected` connector for > 30 min |
| **ACL staleness** | Count of connectors exceeding their sensitivity-class ACL window (Decision 10) | Any high-sensitivity connector exceeding 5-min window |
| **Proposal approval latency** | Time from `proposals_ready` to approval decision | > 72h (Decision 13 expiration threshold) |
| **Apply failure rate** | % of approved proposals where apply failed | > 5% over 24-hour window |
| **Execution run failure rate** | % of runs reaching `failed` terminal state | > 10% over 24-hour window |

### 6.3 Operator dashboard requirements

The operator dashboard must provide:

| View | Content | Audience |
|---|---|---|
| **System health** | Real-time health signals (§6.2); connector status map; model availability; retrieval success rate | Platform operators |
| **Tenant health** | Per-org connector health; per-org retrieval and execution success rates; per-org trust degradation rate | Support operators |
| **Run inspector** | Unified support trace (§4.2) for a selected run; context → retrieval → execution → routing → trust chain | Support operators |
| **Failure queue** | Active failures grouped by failure class (from `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §3); recovery path suggestions | Support operators |
| **Trust overview** | Distribution of trust classes across recent outputs; degraded output trend; stale-source frequency | Platform operators, product |
| **Routing overview** | Model usage distribution; fallback frequency and reasons; workload class distribution | Platform operators |

### 6.4 Metrics for AI operations

| Metric | Granularity | Purpose |
|---|---|---|
| `outputs_by_trust_class` | per org, per consumer class, per hour | Track trust quality over time; detect regressions |
| `retrieval_denial_rate_by_reason` | per org, per denial reason, per hour | Identify systemic access or freshness issues |
| `model_fallback_events` | per model, per fallback reason, per hour | Track provider reliability; inform routing decisions |
| `connector_freshness_violations` | per connector, per sensitivity class | Track ACL and freshness compliance (Decision 10) |
| `proposal_to_apply_duration` | per org, per risk class | Track approval pipeline health |
| `audit_reconstruction_success_rate` | per org, per month | Verify that audit-grade reconstruction is achievable for important outputs |
| `degraded_output_ratio` | per org, per consumer class, per day | Track overall system reliability from the trust perspective |

### 6.5 Observability and release tracing

Per `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1, release observability must be tied to run traces. For Wave 1, this means:

- Every `RoutingExplanation` should carry enough information to identify the active model version and prompt version at the time of the interaction.
- When a release bundle changes routing, the observability layer must be able to compare trust metrics before and after the change.
- Full release bundle tracing (canary, rollback, deprecation) is out of scope for Wave 1 but the observability baseline must not preclude it.

---

## 7. Downstream dependency map

### 7.1 What this baseline provides to later work

| Downstream capability | Dependency on this baseline | Consequence if missing |
|---|---|---|
| **Wave 6 — Trust contract closure** (`AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.7) | This baseline defines the universal trust vocabulary, provenance ledger model, and uncertainty language that Wave 6 must operationalize into full UI and runtime contracts. | Wave 6 must invent the vocabulary from scratch, risking divergence from Wave 1 trace and audit infrastructure. |
| **Module-specific trust UI** (Reports, Presentations, Results) | Module UIs that display trust indicators must use the `trust_class` vocabulary and `CitationBinding` model defined here. | Each module invents its own trust display semantics. |
| **AI release bundles** (Closure Wave 5) | Release observability (§6.5) depends on the routing trace and trust metrics defined here. Release quality gates must reference trust degradation rate. | Release quality cannot be measured against trust baseline. |
| **Background and scheduled runtime** (Closure Wave 3) | Background runs must produce the same trust metadata and support traces as interactive runs. The observability baseline applies equally. | Background AI operates without trust visibility. |
| **Artifact lifecycle** (Closure Wave 7) | Artifact provenance survival (§2.4) defines how trust metadata persists through promotion, sharing, and publishing. | Artifact provenance breaks at the collaboration boundary. |
| **Connector implementation** (provider-specific) | New connectors must produce freshness and ACL states that feed into the trust and observability baseline. Decision 10 ACL windows apply. | New connectors operate outside the trust framework. |

### 7.2 What this baseline depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | `ContextSnapshot` object model; support trace fields; drift model | Completed |
| **WP-W1-AI-02 — Governed retrieval baseline** | `RetrievalTrace`; `DeniedResultTrace`; connector registry; freshness/drift states; search presets | Completed |
| **WP-W1-AI-03 — Execution proposal/approval spine** | Run audit trail; proposal schema; approval states; apply results | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 2, 3, 10, 12 | Full snapshot for user-visible retrieval; 30-day retention; ACL staleness windows; web search as separate external scope | Ratified |

---

## 8. Open questions and conflicts

### 8.1 Trust class assignment: automated vs. model-declared

- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4 defines the trust objects but does not specify whether trust class assignment is performed by the model (self-declared) or by a post-processing layer that inspects evidence bindings.
- Self-declaration is faster but less reliable (models may overstate confidence). Post-processing is more reliable but adds latency and complexity.

**Recommendation:** Wave 1 should use a hybrid approach: the model declares an initial trust class, and a post-processing validator checks evidence bindings. If the validator disagrees (e.g., model claims `grounded_fact` but no `EvidenceRef` with `binding_strength ≥ strong` exists), the validator downgrades the trust class. This avoids both blind trust in model self-assessment and the cost of fully independent classification.

### 8.2 Provenance ledger scope: all outputs vs. important outputs only

- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4 canonical rule says "every high-value AI output." §5.2 of this analysis defines "important output" classes.
- It is unclear whether lightweight interactions (quick chat answers, simple lookups) should also produce `ProvenanceLedgerEntry` records.

**Recommendation:** Wave 1 should produce lightweight trust metadata (trust class + evidence refs) for all outputs, but full `ProvenanceLedgerEntry` records only for important outputs (§5.2). This balances audit coverage with storage and performance costs. The threshold for "important" can be tightened in later waves.

### 8.3 Routing explanation visibility to end users

- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4.1 says "routed model choice and degraded mode become visible to support and, when relevant, to users."
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §5 says the support contract includes "understanding AI behavior changes over time."
- The phrase "when relevant, to users" is undefined. It is unclear what level of routing detail should be user-visible.

**Recommendation:** Users should see: (a) whether a fallback model was used (yes/no + simplified explanation), (b) whether degraded conditions applied. Users should NOT see: model identifiers, routing reasons, cost tiers, or internal workload class details. This is a product decision that should be ratified.

### 8.4 Trust vocabulary for Teresa (voice) outputs

- `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §6 defines voice-specific failure modes (speech interrupted, transcript partial, confirmation not received).
- The universal trust vocabulary (§1.2) does not include a voice-specific trust class.
- A voice output where the transcript is partial and untrusted should be classified as `degraded`, but the degradation reason is voice-specific, not covered by the general degraded conditions in §3.3.

**Recommendation:** Add `voice_transcript_partial` as a degraded condition in §3.3 (alongside `provider_fallback`, `retrieval_failure`, etc.). The trust class remains `degraded`; the degraded condition taxonomy is extended. This does not require a new trust class.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §5 (contracts and boundaries) ↔ `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §5 (contracts and boundaries): Clear ownership split. Trust doc owns the shared output trust contract; ops doc owns release control and operator workflow. No overlap.
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` §4 (trust objects) ↔ `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1 (snapshot fields): Trust metadata references the snapshot; the snapshot does not embed trust metadata. Complementary, not conflicting.
- `OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md` §9 (audit doctrine) ↔ WP-W1-AI-03 §6 (audit trail): Both require the same reconstruction capability. The operator doc defines the questions; the execution spine defines the data. Aligned.
- `DECISION_LOG_WAVE_1.md` Decision 10 (ACL staleness) ↔ WP-W1-AI-02 §8.1 (ACL refresh strategy): Decision 10 resolves the open question from WP-W1-AI-02 by defining explicit staleness windows per sensitivity level.
- `DECISION_LOG_WAVE_1.md` Decision 12 (web search) ↔ WP-W1-AI-02 §8.4 (external scope): Decision 12 resolves the open question by establishing web search as a separate external scope.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Universal trust vocabulary with four trust classes (`grounded_fact`, `synthesis`, `uncertain_inference`, `degraded`), assignment rules, and canonical metadata fields
  - Provenance ledger model with `EvidenceRef`, `CitationBinding`, and `ProvenanceLedgerEntry` objects, provenance survival rules, and Decision 2 compliance
  - Uncertainty and degraded-trust language with five uncertainty classes, five degraded conditions, Decision 10 ACL staleness windows, and Decision 12 web search trust semantics
  - Unified support trace model joining context, retrieval, execution, routing, and trust traces with query dimensions and access model
  - Audit-grade output explanation defining important output classes, minimum reconstructable information, and non-repudiation requirements
  - Observability baseline with ten health signals, six operator dashboard views, seven operational metrics, and release tracing direction
  - Downstream dependency map (six downstream consumers, four upstream dependencies)
  - Open questions and conflict analysis (4 items identified, 0 conflicts between canonical docs)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Trust class assignment mechanism (§8.1) needs engineering validation of the hybrid model-declared + post-processing approach
  - Routing explanation visibility to end users (§8.3) needs a product decision on what level of detail is appropriate
- **Questions requiring escalation:**
  1. Should trust class assignment be model-declared, post-processing validated, or hybrid? (§8.1)
  2. Should all outputs produce full `ProvenanceLedgerEntry` records, or only important outputs? (§8.2)
  3. What level of routing detail should be visible to end users (beyond fallback/degraded indicators)? (§8.3)
  4. Should `voice_transcript_partial` be added as a degraded condition for Teresa voice outputs? (§8.4)
