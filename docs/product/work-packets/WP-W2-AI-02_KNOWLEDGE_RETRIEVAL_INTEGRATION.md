# WP-W2-AI-02 — Knowledge + Retrieval Integration Analysis

> Status: Completed
> Packet: WP-W2-AI-02
> Wave: 2 — AI core integration
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `KNOWLEDGE_RAG_V8_SSOT.md`
> - `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
> - `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
> - `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
> Supporting anchors (Wave 1 deliverables):
> - `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md`
> - `WP-W1-AI-02_GOVERNED_RETRIEVAL_BASELINE.md`
> - `WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md`
> - `DECISION_LOG_WAVE_1.md` — Decisions 2, 10, 12, 23, 24
> Binding decisions incorporated: 2, 10, 12, 23, 24

---

## 1. Working memory integration with governed retrieval

### 1.1 Design rationale

Wave 1 established two independent baselines: the governed retrieval gateway (`WP-W1-AI-02`) and the working memory architecture (`KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`). Both documents reference a shared `RetrievalPolicyGateway` but neither specifies the integration contract between them. This section closes that gap.

The core claim of this analysis: **working memory and governed retrieval are not two parallel systems — they are two phases of one retrieval-to-context pipeline.** Retrieval produces candidates; working memory selects, compacts, and carries forward the active subset. The governed retrieval gateway is the sole entry point for all knowledge that enters working memory.

### 1.2 Integration architecture

The canonical layer sequence from `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §6.1 is:

```
consumer surface → working memory orchestrator → retrieval policy gateway → scope-specific retrievers → reranker → working set selector → prompt/context assembler → model/tool loop → compaction pipeline → run state ledger
```

The governed retrieval gateway from `WP-W1-AI-02` maps onto the middle of this pipeline:

| Working memory layer | Governed retrieval component | Integration point |
|---|---|---|
| Working Memory Orchestrator | — | Orchestrator calls the gateway; it does not bypass it |
| Retrieval Policy Gateway | `EnterpriseSearchGateway` (WP-W1-AI-02 §1.2) | Same component — the gateway IS the retrieval policy gateway |
| Scope-specific retrievers | Connector-backed retrievers + memory store retrievers | Gateway dispatches to scope-specific backends |
| Reranker | Hybrid ranking stage (WP-W1-AI-02 §1.2) | Ranking operates on the pre-filtered candidate set |
| Working Set Selector | — | Post-gateway: selects the minimal active subset from ranked results |

### 1.3 Invariant: no ungoverned retrieval side-channel

`WP-W1-AI-02` §7.1 explicitly warns: "Working memory compaction and retrieval must route through the same gateway; scope and freshness rules apply equally." This means:

1. **Working memory cannot fetch knowledge directly from memory stores.** All reads — whether from session memory, user-private memory, organization knowledge, or connector-backed sources — must pass through the `EnterpriseSearchGateway`.
2. **Evidence pins and active document sets cannot be refreshed outside the gateway.** When the working memory orchestrator needs to refresh a pinned document or re-retrieve a stale chunk, it must issue a new retrieval request through the gateway.
3. **Compaction outputs that reference source material must preserve the original retrieval trace.** When the compaction pipeline summarizes evidence, the summary must retain `retrieval_trace_ref` from the original retrieval.

### 1.4 ContextSnapshot as the shared contract

Per Decision 2: "user-visible or run-visible retrieval => full ContextSnapshot." Both the working memory orchestrator and the retrieval gateway consume the same `ContextSnapshot` (from `WP-W1-AI-01`). The orchestrator captures or inherits the snapshot at run creation; every retrieval request it issues carries the same `snapshot_id`.

This means:
- Scope resolution happens once per snapshot version, not once per retrieval call.
- If the user's context drifts (project switch, role change), a new snapshot version is created, and the orchestrator must re-resolve scope for subsequent retrievals.
- The working memory state is always traceable to a specific snapshot version.

---

## 2. Unified retrieval contract

### 2.1 Design rationale

Three canonical docs converge on one requirement: all AI consumers must share a single retrieval entry point.

- `KNOWLEDGE_RAG_V8_SSOT.md` §10.4: "All consumers should use one orchestrated retrieval service."
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §5: "Chat, Execution, Workers may consume enterprise search, but cannot define their own connector semantics."
- `WP-W1-AI-02` §1.1: "No canonical doc authorizes any AI consumer to build its own retrieval path."

### 2.2 Unified API surface

The unified retrieval contract serves three consumer families through one gateway:

| Consumer family | Consumer classes | Retrieval mode | Working memory involvement |
|---|---|---|---|
| **Interactive** | `chat`, `execution` | Full snapshot mode (Decision 2) | Full working memory orchestration: issue cards, evidence pins, compaction |
| **Worker** | `worker` | Full snapshot mode with restricted scope (org-assigned + system only) | Minimal working memory: assigned corpus, limited branching |
| **Background** | `background` | Scope token mode (Decision 2) | No working memory; stateless retrieval for indexing/refresh/precomputation |

### 2.3 Request contract

Every retrieval request to the unified gateway must carry:

| Field | Required for interactive | Required for worker | Required for background |
|---|---|---|---|
| `snapshot_id` | yes | yes | no |
| `scope_token` | no | no | yes (if no snapshot) |
| `consumer_class` | yes | yes | yes |
| `organization_id` | yes | yes | yes |
| `effective_scope_ref` | yes | yes | yes |
| `task_shape` | yes | yes | no |
| `working_memory_context_ref` | yes (optional) | no | no |
| `budget_hint` | yes (optional) | no | no |

The `working_memory_context_ref` is a new field that allows the orchestrator to pass the current working memory state summary to the gateway. This enables the gateway to:
- Avoid re-retrieving chunks already in the active document set.
- Prefer sources from the same document family as currently pinned evidence.
- Respect the orchestrator's budget constraints when selecting candidate count.

### 2.4 Response contract

Every retrieval response must include:

| Field | Description | Consumed by |
|---|---|---|
| `results[]` | Ranked, pre-filtered results with source refs, freshness state, sensitivity labels | Working set selector |
| `retrieval_trace_ref` | Link to the full `RetrievalTrace` (WP-W1-AI-02 §6) | Run state ledger, provenance chain |
| `denied_trace_ref` | Link to `DeniedResultTrace` (WP-W1-AI-02 §3) | Support trace, operator dashboard |
| `freshness_warnings[]` | Sources returned with freshness degradation | Working memory orchestrator (for trust class input) |
| `scope_resolution_summary` | Resolved tenant, project, scope types, sensitivity ceiling | Audit, support |
| `candidates_considered` | Total candidates after pre-filter | Observability metrics |

### 2.5 Consumer-specific behavior through presets, not forks

Per `WP-W1-AI-02` §4, consumer-specific retrieval behavior is achieved through search presets, not through separate retrieval paths. The four canonical presets (`personal_drafting`, `org_execution`, `worker_branded`, `deep_research`) govern scope priority, sensitivity ceiling, and freshness policy. The gateway selects the active preset based on `consumer_class` + `task_shape`.

No consumer may bypass the preset system by supplying raw filter parameters directly to the gateway (`WP-W1-AI-02` §4.4).

---

## 3. Memory lifecycle (ephemeral → session → durable)

### 3.1 Canonical memory layers

`AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md` §4 defines five memory layers:

| Layer | Lifecycle | Governed by | Retrieval path |
|---|---|---|---|
| **Ephemeral session memory** | Lives only for the duration of one conversation or run; auto-expires | Working memory orchestrator | Through gateway with `scope_type = session` |
| **Working memory** | Run-scoped active context; compacted after each step; evictable | Working memory orchestrator | Not directly retrievable — it is the output of retrieval, not a source |
| **User-private durable memory** | Persists across sessions; owned by one user; explicit write required | Memory lifecycle policy | Through gateway with `scope_type = user_private` |
| **Organization durable knowledge** | Persists across users; tenant-scoped; governed by org policy | Knowledge RAG governance | Through gateway with `scope_type = organization` |
| **Archived memory** | Retained for compliance/audit but excluded from active retrieval | Retention policy | Not retrievable in normal operation |

### 3.2 Promotion path

The canonical promotion path from `KNOWLEDGE_RAG_V8_SSOT.md` §7 and `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md` §4:

```
ephemeral session → [explicit write] → user-private durable
user-private durable → [explicit user/admin action + review] → organization durable
organization durable → [admin action] → archived
```

Critical rules:
1. **Session data does not become durable memory automatically** (`KNOWLEDGE_RAG_V8_SSOT.md` §6.1: "session data does not become durable user memory without policy-allowed write path").
2. **Private knowledge may be promoted to org scope only through explicit user or admin flow with review** (`KNOWLEDGE_RAG_V8_SSOT.md` §6.1 promotion rule).
3. **Working memory is never itself the durable memory layer** (`KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §11.3).

### 3.3 Integration with governed retrieval

Each memory layer is a retrieval source accessible through the gateway:

| Memory layer | Gateway scope type | Pre-filter rules |
|---|---|---|
| Ephemeral session | `session` | Only accessible within the originating conversation/run; same `snapshot_id` lineage |
| User-private durable | `user_private` | Only accessible by the owning user; blocked if `privacy_mode = true` per product contract |
| Organization durable | `organization` | Tenant-isolated; gated by role, project, sensitivity, document visibility |
| System knowledge | `system` | Platform-owned; never contaminated by tenant data; available to all orgs |
| External (web search) | `external` | Separate governance path per Decision 12; never silently promoted to internal memory |

### 3.4 Compaction and the retrieval trace chain

When the compaction pipeline (`KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §6.1) compresses resolved turns into structured summaries, the following provenance rules apply:

1. **Compacted summaries retain `evidence_ref` links** to the original retrieved chunks.
2. **Evidence pins that survive compaction** keep their original `retrieval_trace_ref`.
3. **Tool state digests** reference the raw payload location but do not carry it in prompt context.
4. **Handoff packs** include `source_context_refs` from the active snapshot, enabling the next consumer to re-retrieve if needed.

This ensures that even after aggressive compaction, the provenance chain from output → evidence → retrieval trace → source remains intact (Decision 24 compliance).

---

## 4. Source priority and ranking model

### 4.1 Canonical scope priority by task type

From `KNOWLEDGE_RAG_V8_SSOT.md` §8.2, refined by `WP-W1-AI-02` §4.3:

| Task type | Scope priority (highest → lowest) | Working memory bias |
|---|---|---|
| **Personal drafting** | session → user_private → organization → system | More recent turns; active attachments; concise issue summaries |
| **Org process / execution** | organization → project/artifact context → system → user_private (when explicitly relevant) | Stateful run memory; tool compaction; evidence pinning |
| **Virtual worker branded** | organization (assigned) → system | Minimal working memory; assigned corpus only |
| **Deep research** | session → organization → system → external | Stronger issue cards; evidence ledger; multi-stage summary tree |

### 4.2 Ranking across memory layers + enterprise search

Within a single retrieval request, the gateway must merge results from multiple source backends:

| Source backend | What it contains | Ranking treatment |
|---|---|---|
| **Session memory store** | Current chat history, attachments, run-local evidence | Recency-boosted; highest priority for continuity |
| **User-private memory store** | Personal instructions, preferences, saved insights | Relevance-ranked; lower priority than session for task-specific queries |
| **Organization knowledge store** | Org documents, policies, templates, approved patterns | Hybrid retrieval (keyword + semantic + rerank); primary source for execution tasks |
| **Connector-backed sources** | External system content (Google Drive, SharePoint, Jira, etc.) | Hybrid retrieval; freshness-gated; ACL-filtered |
| **System knowledge** | Platform methodology, help docs, product knowledge | Relevance-ranked; lowest priority unless explicitly requested |
| **External scope (web search)** | Web results | Separate trust class (Decision 12); never merged as if internal |

### 4.3 Merge and rerank strategy

The gateway's merge strategy must respect the scope priority order defined by the active preset:

1. **Pre-filter** each source backend independently (tenant, ACL, sensitivity, freshness, privacy mode, connector health — the seven-stage filter from `WP-W1-AI-02` §5.4).
2. **Retrieve** candidates from each allowed scope.
3. **Score** candidates using hybrid retrieval (keyword + semantic) within each scope.
4. **Merge** candidates across scopes, applying the preset's scope priority as a ranking boost.
5. **Rerank** the merged set using a cross-scope reranker (if `rerank_enabled = true` on the preset).
6. **Trim** to `max_results` per the preset.

The working set selector then further narrows this to the active subset needed for the current run step.

### 4.4 Active document family preference

Per `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §9.2: "Per issue, system should prefer one active family at a time." When the working memory orchestrator passes `working_memory_context_ref` to the gateway, the gateway should boost results from the same document family as currently pinned evidence. This prevents context fragmentation across unrelated source families within a single issue.

---

## 5. Freshness, staleness and ACL compliance

### 5.1 ACL staleness windows (Decision 10)

Per `DECISION_LOG_WAVE_1.md` Decision 10:

| Sensitivity level | Maximum ACL refresh lag | Behavior when exceeded |
|---|---|---|
| `high` | 0–5 min | Result treated as `stale_acl` / degraded; not served as fully trusted retrieval |
| `medium` | ≤ 15 min | Result treated as `stale_acl` / degraded |
| `low` | ≤ 60 min | Result treated as `stale_acl` / degraded |

These windows apply uniformly to all retrieval sources — connector-backed content, organization knowledge, and user-private memory. If a memory store does not have ACL verification timestamps, it must be treated as `low` sensitivity by default.

### 5.2 Freshness states across all retrieval sources

Extending `WP-W1-AI-02` §2.3 to cover memory layers:

| Source type | Freshness tracking mechanism | Staleness indicator |
|---|---|---|
| **Connector-backed** | `last_synced_at` + `freshness_state` + `drift_state` on `ConnectorRegistry` | `stale`, `drifted`, `disconnected` per WP-W1-AI-02 §2.3 |
| **Organization knowledge** | `last_modified_at` on document registry; `index_version` on chunk store | Stale if document modified but chunks not re-indexed |
| **User-private memory** | `last_modified_at` on memory entry | Stale if memory entry updated but embedding not refreshed |
| **Session memory** | Inherently fresh (created during current session) | Never stale within session lifetime |
| **System knowledge** | Platform release version; `last_updated_at` on system docs | Stale only if platform release introduces new content not yet indexed |
| **External (web search)** | No persistence; freshness is per-request | Always treated as point-in-time; no staleness concept |

### 5.3 Unified freshness contract

The retrieval gateway must expose freshness state in every result envelope. The working memory orchestrator uses this to:

1. **Tag evidence pins with freshness state** — a pin created from a `stale` source carries `freshness_warning = true`.
2. **Trigger re-retrieval** — if a pinned evidence source transitions from `fresh` to `stale` during a long-running run, the orchestrator may issue a refresh retrieval.
3. **Feed trust class assignment** — stale sources contribute to `uncertain_inference` trust class (per `WP-W1-TRUST-01` §3.2: `stale_source` uncertainty class).

### 5.4 ACL compliance for memory stores

Connector-backed sources have explicit ACL projection (`WP-W1-AI-02` §2.2). Memory stores require analogous enforcement:

| Memory layer | ACL enforcement mechanism |
|---|---|
| **Session memory** | Inherits from the originating user's session; no cross-user access possible |
| **User-private memory** | `owner_id` check: only the owning user may read; system processes with explicit authorization |
| **Organization knowledge** | Tenant boundary (`organization_id`) + role-based visibility + sensitivity gate + document-level permissions |
| **System knowledge** | No ACL gate (platform-owned, globally readable) |

The gateway applies these checks as part of the seven-stage pre-filter sequence (`WP-W1-AI-02` §5.4). Memory stores are not exempt from pre-filtering.

---

## 6. Trust class assignment for retrieval-backed outputs

### 6.1 Decision 23 compliance: hybrid trust assignment

Per `DECISION_LOG_WAVE_1.md` Decision 23: "trust is assigned by runtime contract, not by model self-report alone."

For retrieval-backed outputs, trust class assignment follows this pipeline:

```
retrieval results (with freshness, ACL, source metadata)
  → working memory (evidence pins with binding strength)
    → model generates output with initial trust hints
      → post-processing validator inspects evidence bindings
        → final trust class assigned
```

The validator checks:

| Check | Rule | Outcome if failed |
|---|---|---|
| Evidence binding exists | At least one `EvidenceRef` with `binding_strength ≥ strong` | Cannot be `grounded_fact`; downgrade to `synthesis` or `uncertain_inference` |
| Source freshness | All contributing sources are `fresh` | If any source is `stale` or `drifted`, add `uncertainty_class = stale_source` |
| ACL verification | All contributing sources passed ACL check within the sensitivity-class window (Decision 10) | If any source has `stale_acl`, downgrade to `degraded` |
| Scope coverage | Evidence covers the full scope of the claim | If evidence is partial, assign `uncertainty_class = partial_evidence` |
| Source conflict | No material contradiction between contributing sources | If conflict detected, assign `uncertainty_class = conflicting_sources` |
| External source | Any contributing source has `scope_type = external` | Default trust class is `uncertain_inference` unless source is on platform-approved trust list (Decision 12) |

### 6.2 Trust class propagation through working memory

When working memory compacts evidence into summaries:

1. **Compacted summaries inherit the lowest trust class** of their contributing evidence.
2. **Evidence pins carry trust metadata** — `trust_class`, `binding_strength`, `freshness_at_retrieval`.
3. **Handoff packs include a trust summary** — count per trust class, lowest trust class, any degraded flags.
4. **Issue card summaries** that reference evidence must preserve the evidence's trust class, not upgrade it through summarization.

### 6.3 Decision 24 compliance: provenance scope

Per `DECISION_LOG_WAVE_1.md` Decision 24: "lightweight provenance everywhere, full ledger where business meaning matters."

| Output type | Provenance level | What is recorded |
|---|---|---|
| **Ephemeral chat answer** | Lightweight | `trust_class` + `evidence_refs[]` + `retrieval_trace_ref` |
| **Execution run proposal** | Full ledger | `ProvenanceLedgerEntry` with complete evidence chain, citation bindings, routing explanation |
| **Saved artifact** | Full ledger | `ProvenanceLedgerEntry` + `provenance_origin_ref` linking to the producing run |
| **Working memory compaction output** | Lightweight | `trust_class` per compacted summary + links to original `evidence_refs` |
| **Handoff pack** | Lightweight | Trust summary + `source_context_refs` from active snapshot |

---

## 7. Downstream dependency map

### 7.1 What this analysis provides to later packets

| Downstream packet/capability | Dependency on this analysis | Consequence if missing |
|---|---|---|
| **Prompt OS composition (Wave 2)** | Prompt assembly must respect the unified retrieval contract and working memory budget model; the context assembler receives its input from the working set selector defined here | Prompt OS builds its own retrieval path, diverging from governed gateway |
| **Full memory policy engine (later wave)** | The memory lifecycle and promotion path defined here is the baseline that the policy engine must operationalize with configurable rules | Policy engine must invent the lifecycle model from scratch |
| **Background and scheduled runtime (Closure Wave 3)** | Background jobs use scope-token mode through the same gateway; freshness and ACL rules apply equally | Background retrieval operates outside the unified contract |
| **Multi-agent work manager (Phase E)** | Agent-to-agent handoff packs must follow the handoff format defined in working memory architecture; trust metadata must propagate across agent boundaries | Handoff breaks trust chain between agents |
| **Output trust closure (Wave 6)** | Trust class assignment pipeline defined here is the runtime implementation of the trust vocabulary from `WP-W1-TRUST-01` | Trust assignment is disconnected from retrieval quality signals |
| **Connector implementation (provider-specific)** | New connectors must produce freshness and ACL states that feed into the unified freshness contract (§5.2) | New connectors operate outside the freshness framework |

### 7.2 What this analysis depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | `ContextSnapshot` object model; identity chain; drift model | Completed (Wave 1) |
| **WP-W1-AI-02 — Governed retrieval baseline** | `EnterpriseSearchGateway`; connector registry; ACL model; search presets; retrieval traces; denied-result traces | Completed (Wave 1) |
| **WP-W1-TRUST-01 — Trust baseline** | Trust vocabulary; provenance ledger model; uncertainty taxonomy; support trace model | Completed (Wave 1) |
| **DECISION_LOG_WAVE_1.md** — Decisions 2, 10, 12, 23, 24 | Full snapshot for user-visible retrieval; ACL staleness windows; web search as external scope; hybrid trust assignment; provenance scope | Ratified |
| **KNOWLEDGE_RAG_V8_SSOT.md** | Knowledge scope taxonomy; ownership model; retrieval policy order; promotion rules | Canonical |
| **KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md** | Working memory object model; orchestrator architecture; compaction pipeline; consumer presets | Canonical |
| **AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md** | Connector lifecycle; ACL projection; freshness tracking; enterprise search gateway | Canonical |
| **AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md** | Memory layer definitions; lifecycle states; retention and deletion doctrine | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Working memory context ref: new field not in canonical docs

This analysis introduces `working_memory_context_ref` as an optional field on retrieval requests (§2.3). This field allows the orchestrator to inform the gateway about the current working memory state to avoid redundant retrieval and support document family preference.

**No canonical doc defines this field.** It is a synthesis of two requirements:
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §9.3: "If a chunk is repeatedly useful, it should become evidence_pin instead of being rediscovered and reinjected every turn."
- `WP-W1-AI-02` §1.2: The gateway accepts retrieval requests but has no mechanism to know what the orchestrator already holds.

**Recommendation:** Ratify `working_memory_context_ref` as an optional extension to the retrieval request contract. It should carry: active document refs, active evidence pin refs, and a budget hint. The gateway uses this for optimization only — it must not change pre-filtering or ACL behavior.

### 8.2 Memory store ACL verification timestamps

Decision 10 defines ACL staleness windows for connector-backed sources. The canonical docs do not specify whether internal memory stores (user-private, organization knowledge) require analogous ACL verification timestamps.

**Analysis:** Internal memory stores have simpler ACL models (owner check for user-private; tenant + role + visibility for organization). These are checked at retrieval time against the current `ContextSnapshot`, not against a cached ACL projection. Therefore, the Decision 10 staleness windows do not directly apply to internal memory stores — their ACL is always "fresh" because it is resolved at request time.

**Recommendation:** Clarify in the canonical docs that Decision 10 ACL staleness windows apply specifically to connector-backed sources where ACL is projected from an external system. Internal memory store ACL is resolved at request time and is not subject to staleness windows.

### 8.3 Compaction output as a retrieval source

`KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §11 states that working memory is not the durable memory layer. However, it is unclear whether compacted summaries (issue summaries, handoff packs) should be retrievable by the gateway in subsequent sessions.

**Analysis:** If compacted summaries are stored in the run state ledger and a new session needs to resume a run, the orchestrator must access the previous run's compacted state. This is a read from the run state ledger, not a retrieval through the gateway.

**Recommendation:** Compacted working memory outputs are accessed through the run state ledger's resume path, not through the retrieval gateway. They are not indexed as retrievable knowledge. If specific facts from a run should become durable knowledge, they must go through the explicit promotion path (§3.2).

### 8.4 Budget negotiation between orchestrator and gateway

`KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §7 defines a context budget model with explicit slice allocations. The gateway currently has `max_results` on presets but no mechanism to negotiate with the orchestrator's budget constraints.

**Analysis:** The orchestrator knows how much context budget remains for evidence. The gateway knows how many candidates are available. Without coordination, the gateway may return more results than the orchestrator can use, or fewer than optimal.

**Recommendation:** The `budget_hint` field on the retrieval request (§2.3) should carry the orchestrator's remaining evidence budget as a result count hint. The gateway treats this as advisory — it may return fewer results if the candidate set is small, but should not exceed the hint without reason. This avoids over-retrieval without requiring the gateway to understand the full budget model.

### 8.5 No conflicts detected between canonical docs

The following cross-references were checked for conflicts:

- `KNOWLEDGE_RAG_V8_SSOT.md` §10.4 (one retrieval gateway) ↔ `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §6.1 (retrieval policy gateway as a reused component): **Consistent.** Both reference the same gateway; the working memory doc explicitly says "Reused from Knowledge RAG v8."
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md` §4 (memory layers) ↔ `KNOWLEDGE_RAG_V8_SSOT.md` §3 (source scopes): **Consistent.** The memory lifecycle layers map directly to the Knowledge RAG scope types: ephemeral → session, working → not a scope (it's a runtime state), user-private durable → user_private, organization durable → organization.
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` §5 (contracts) ↔ `KNOWLEDGE_RAG_V8_SSOT.md` §1.1 (cross-cutting parity): **Consistent.** Clear ownership split: connectors doc owns connector lifecycle; Knowledge RAG owns scope and retrieval policy.
- `WP-W1-AI-02` §1.3 (consumer registration) ↔ `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` §10 (consumer presets): **Consistent.** Both define the same consumer families (chat, execution, worker, deep research). The working memory doc adds memory bias per consumer; the retrieval baseline adds scope priority per consumer. These are complementary, not conflicting.
- Decision 23 (hybrid trust) ↔ `WP-W1-TRUST-01` §1.3 (assignment rules): **Consistent.** Decision 23 mandates hybrid; WP-W1-TRUST-01 §8.1 recommends hybrid. No conflict.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Working memory integration with governed retrieval: invariant that all knowledge enters working memory through the gateway; no ungoverned side-channels; ContextSnapshot as the shared contract between orchestrator and gateway
  - Unified retrieval contract: one API surface for interactive (chat/execution), worker, and background consumers; request and response contracts; consumer-specific behavior through presets
  - Memory lifecycle: five-layer model (ephemeral → session → user-private durable → organization durable → archived) with explicit promotion path and governed retrieval integration per layer
  - Source priority and ranking model: scope priority by task type; merge and rerank strategy across memory layers + enterprise search + external scope; active document family preference
  - Freshness, staleness and ACL compliance: Decision 10 ACL windows applied uniformly; freshness tracking extended to all memory layers; unified freshness contract feeding trust class assignment
  - Trust class assignment for retrieval-backed outputs: Decision 23 hybrid pipeline; trust propagation through working memory compaction; Decision 24 provenance scope (lightweight everywhere, full ledger for business-meaningful outputs)
  - Downstream dependency map: six downstream consumers, eight upstream dependencies
  - Open questions: four items identified, zero conflicts between canonical docs
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - The `working_memory_context_ref` field (§8.1) needs ratification as an extension to the retrieval request contract before implementation
  - Budget negotiation between orchestrator and gateway (§8.4) needs engineering validation to determine whether advisory hints are sufficient or a formal protocol is needed
- **Questions requiring escalation:**
  1. Should `working_memory_context_ref` be ratified as part of the retrieval request contract, or should the orchestrator manage deduplication locally without gateway awareness? (§8.1)
  2. Should the canonical docs explicitly clarify that Decision 10 ACL staleness windows apply only to connector-backed sources, not to internal memory stores? (§8.2)
  3. Should compacted working memory outputs ever be promotable to durable knowledge through the standard promotion path, or must all promotion originate from raw source material? (§8.3)
  4. Is an advisory `budget_hint` sufficient for orchestrator-gateway coordination, or does the system need a formal budget negotiation protocol? (§8.4)
