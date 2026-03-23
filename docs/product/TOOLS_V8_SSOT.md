# Tools V8 SSOT — Bridging Contract

> **Status:** Canonical (v8 bridge)
> **Authority:** Decision W7-8 (`DECISION_LOG_WAVE_7.md`)
> **Date:** 2026-03-23
> **Scope:** Bridges V3 consulting tools product contracts with V8 platform, runtime, governance, and integration requirements. This is not a rewrite of V3 — it layers V8 obligations on top of the existing V3 canon.

---

## 1. Purpose and scope

The consulting tools module has strong V3 product contracts (workflow, catalog, standard, knowledge bank) but no explicit connection to V8 platform capabilities established in Waves 1–7. This document closes that gap.

**What this doc does:**

- Declares which V3 docs remain canonical and what they govern.
- Specifies V8 platform integration requirements that tools must satisfy.
- Codifies AI governance rules at session and action level (Decision W7-6).
- Defines tool session knowledge, context, and promotion rules under V8.
- Establishes the shared registry model (Decision W7-5).
- Summarizes gaps and hardening priorities from `WP-W7-ROOF-02`.

**What this doc does not do:**

- Replace or duplicate V3 product contracts.
- Define new tool UX flows (those remain in `CONSULTING_TOOLS_V3.md` and `CONSULTING_TOOLS_STANDARD_V1.md`).
- Specify implementation details (those belong in work packets and code).

---

## 2. V3 foundation (references)

The following V3 documents remain the canonical product contracts. V8 adds requirements on top; it does not override these contracts.

| Document | Governs |
|---|---|
| `CONSULTING_TOOLS_V3.md` | Module workflow SSOT: Library → Sessions → Outputs → Initiatives; data contracts; wizard skeleton; AI behavior contract |
| `CONSULTING_TOOLS_STANDARD_V1.md` | Reusable tool standard: experience principles, UX shell, runtime contract, AI mentor contract, output standard, adoption checklist |
| `TOOLS_CATALOG_V3.md` | Catalog surfaces, tool inventory, surface types, view modes |
| `CONSULTING_TOOLS_TOOL_SPECS_V3.md` | Per-tool specifications (one task per tool) |
| `CONSULTING_TEMPLATES_LIBRARY_V3.md` | 60 classic framework templates: method definitions + implementation contract |
| `TOOLS_KNOWLEDGE_BANK_V3.md` | Knowledge bank RAG architecture, pack types, ingestion pipeline |
| `SOURCE_TRACEABILITY_SPEC.md` | Finalization gates, source traceability fields, output eligibility |
| `UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md` | Output contract: initiative / report / presentation / idea |
| `TOOLS_HELP_CENTER_SIDEBAR_CONTRACT_V1.md` | KB article slug contract per tool |

**Rule:** Any V8 requirement that conflicts with a V3 contract must be resolved by updating the V3 doc, not by creating a parallel truth.

---

## 3. V8 platform integration requirements

These are the V8 platform capabilities that the tools module must integrate with. Each row references the Wave 1 baseline packet that defines the capability.

| # | V8 capability | Baseline packet | Integration requirement for tools |
|---|---|---|---|
| 1 | **Context identity** | `WP-W1-AI-01` | Every tool session must bind to a `ContextSnapshot` at creation. All AI operations within the session execute against that snapshot's scope. |
| 2 | **Governed retrieval** | `WP-W1-AI-02` | Knowledge bank retrieval (RAG) must flow through the governed retrieval pipeline with ACL enforcement, not bypass it via direct vector queries. |
| 3 | **Execution proposal/approval spine** | `WP-W1-AI-03` | Tool session AI actions that produce mutations (finalize session, create initiative/report/presentation) must generate proposals through the approval spine. |
| 4 | **Tool governance (HITL)** | `WP-W1-AI-04` | Each consulting tool's AI actions must be registered as `AIToolCapability` entries in the tool catalog with risk class and consumer class assignments. |
| 5 | **Trust and provenance** | `WP-W1-TRUST-01` | Tool session outputs must carry provenance metadata per Decision 24: lightweight provenance on all outputs, full ledger on saved/shared artifacts. |
| 6 | **Multiplayer** | `WP-W1-MP-01` | Tool sessions must support presence and collaborative editing when the multiplayer platform is operational. Single-user remains acceptable for Wave 7. |
| 7 | **Version/replay** | `WP-W1-MP-02` | Tool session history must integrate with the version/replay spine. Finalization snapshots are the minimum; full event replay is the target. |
| 8 | **Memory controls** | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | Tool session AI must respect user and tenant memory preferences (`UserMemoryPreference`, `TenantMemoryControlPolicy`). |
| 9 | **Prompt OS** | Prompt registry (V8 canon) | Tool AI prompts must be registered in the prompt registry and governed by prompt lifecycle rules. |

**Priority:** Items 1–4 are P0 for V8 roof integrity. Items 5–9 are P1, to be integrated as their platform foundations mature.

---

## 4. AI governance for tools (session + action level)

> **Decision W7-6:** `session sets the sandbox, action decides the gate`.

### 4.1 Session-level governance

When a tool session is created, the system must:

1. Bind the session to a `ContextSnapshot` (V8 requirement #1).
2. Resolve the effective `ConsumerToolPolicy` for the session's tool type, applying the org→project tightening hierarchy (Decision 20).
3. Set the session's AI mode and context boundaries based on the resolved policy.

The session-level sandbox constrains all AI operations within the session. No action inside the session may exceed the permissions granted by the session sandbox.

### 4.2 Action-level governance

Within the session sandbox, each AI action is individually gated:

| Tool action | Risk class | Default approval path |
|---|---|---|
| Browse catalog / Library | `read_only` | `auto_executable` |
| Start tool session | `bounded_write` | `policy_approvable` |
| AI proposes inputs/assumptions | `read_only` | `auto_executable` |
| AI drafts summaries/conclusions | `bounded_write` | `policy_approvable` (propose→accept) |
| AI generates missing items checklist | `read_only` | `auto_executable` |
| Finalize session (lock) | `workflow_mutation` | `requires_human_approval` |
| Create initiative from session | `workflow_mutation` | `requires_human_approval` |
| Create report/presentation from session | `bounded_write` | `policy_approvable` |
| Knowledge bank retrieval (RAG) | `read_only` | `auto_executable` |
| Assessment scoring (DRD/SIRI/ADMA) | `bounded_write` | `policy_approvable` |

Source: `WP-W7-ROOF-02` §5.1, ratified by Decision W7-6.

### 4.3 Compatibility with V3 AI contract

The V3 "propose → accept" AI behavior contract (`CONSULTING_TOOLS_V3.md` §5, `CONSULTING_TOOLS_STANDARD_V1.md` §7) maps directly to V8 governance:

- `propose → accept` = `bounded_write` with `policy_approvable` approval path.
- `workflow_mutation` actions (finalize, create initiative) already require explicit user action in V3.
- No V3 contract is overridden; V8 formalizes the approval semantics that V3 described informally.

### 4.4 Tool catalog registration

Per Decision 19, all consulting tool AI actions must be registered in the tool catalog as `AIToolCapability` entries. Registration workflow:

1. Tool owner proposes risk classification per tool action.
2. AI governance owner approves classification.
3. Until ratified, new tools default to `requires_approval` (Decision 19).

The 31 interactive toolTypes and 60 classic framework templates must all have catalog entries. Auto-generation from the Known Tools registry is acceptable as a seed, with governance owner review required before activation.

---

## 5. Tool session and knowledge rules

### 5.1 Session context binding

Every tool session operates within a V8 context:

- **At creation:** session binds to `ContextSnapshot` capturing org, project, user, and scope.
- **During execution:** all AI retrieval and generation operates within the snapshot's scope.
- **At finalization:** the snapshot version is frozen with the session snapshot (extends existing V3 finalization contract from `SOURCE_TRACEABILITY_SPEC.md`).

### 5.2 Knowledge retrieval rules

Tool session AI may retrieve knowledge from:

| Source | Governance | Reference |
|---|---|---|
| Tool-scoped knowledge packs | Governed retrieval with ACL | `TOOLS_KNOWLEDGE_BANK_V3.md` + `WP-W1-AI-02` |
| Organization knowledge | Governed retrieval with ACL | `WP-W1-AI-02` |
| Platform artifacts (Notebook, Interview, Reports) | Governed retrieval with ACL | `WP-W1-AI-02` |
| External web/benchmarks | External scope path (Decision 12) | `DECISION_LOG_WAVE_1.md` D12 |

All retrieval must flow through the governed pipeline. Direct vector queries bypassing ACL are prohibited.

### 5.3 Memory and personalization

- Tool session AI must check `UserMemoryPreference` before using durable memory for personalization.
- Tenant-level `TenantMemoryControlPolicy` sets the ceiling; user preferences operate within that ceiling.
- If memory is disabled, AI operates in stateless mode within the session context only.

---

## 6. Promotion and output rules

### 6.1 V3 output contract (unchanged)

The V3 output contract remains canonical: finalized sessions may produce initiatives, reports, presentations, and ideas. All outputs must carry `source_type`, `source_id`, `source_version` traceability.

Reference: `CONSULTING_TOOLS_V3.md` §4.4, `UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md`.

### 6.2 V8 additions to output rules

| Rule | V8 requirement |
|---|---|
| **Provenance** | Every output created from a tool session must carry provenance metadata per Decision 24. Saved/shared outputs require full provenance ledger entry. |
| **Approval spine** | Output creation that constitutes a `workflow_mutation` (create initiative) must go through the execution proposal/approval spine (`WP-W1-AI-03`). |
| **Trust signaling** | If the output was generated with AI assistance, trust class must be assigned by runtime contract (Decision 23), not by model self-report. |
| **Context lineage** | Output must reference the `ContextSnapshot` under which it was created, enabling audit of what scope/permissions were active during generation. |

### 6.3 Promotion to downstream modules

Tool outputs feed into:

- **Initiatives module** — initiative packages with traceability.
- **Reports module** — report generator with tool session as primary source.
- **Presentations module** — presentation generator with tool session as primary source.
- **Results module** — KPI/OKR linkage through initiative traceability chain.

Each downstream module must accept the tool session's `ContextSnapshot` lineage and provenance metadata. The tool session is the canonical source; downstream modules must not re-derive or override the source truth.

---

## 7. Shared registry model (Known Tools table)

> **Decision W7-5:** `one shared registry, typed families`.

### 7.1 Registry architecture

The Known Tools table is the single shared registry for all tool types:

| Tool class | Description | Storage |
|---|---|---|
| `consulting_tool` | 31 interactive toolTypes (SWOT, 5 Forces, etc.) | Known Tools table |
| `framework_template` | 60 classic framework templates (MECE, PESTEL, BSC, etc.) | Known Tools table (typed family) |
| `methodology_pack` | Licensed assessments (DRD, SIRI, ADMA) | Known Tools table (typed family) |

A `tool_class` or family/subtype discriminator distinguishes the three families. No disconnected parallel registry unless a later scale problem forces it.

### 7.2 Registry fields (V8 additions)

The V3 `ToolDefinition` data contract (`CONSULTING_TOOLS_V3.md` §7.1) is extended with:

| Field | Purpose | Source |
|---|---|---|
| `ai_tool_capabilities[]` | References to `AIToolCapability` entries in the governance catalog | `WP-W1-AI-04` |
| `consumer_class_policy_id` | Link to the effective `ConsumerToolPolicy` | `WP-W1-AI-04` |
| `knowledge_pack_ids[]` | References to knowledge packs for governed retrieval | `TOOLS_KNOWLEDGE_BANK_V3.md` |
| `prompt_registry_ids[]` | References to registered prompts in the Prompt OS | V8 Prompt OS canon |
| `governance_status` | `pending_review` / `classified` / `active` per Decision 19 | `DECISION_LOG_WAVE_1.md` D19 |

### 7.3 Template integration

Classic framework templates from `CONSULTING_TEMPLATES_LIBRARY_V3.md` are stored in the Known Tools table with `tool_class = framework_template`. They share the same Library surface, filters, and preview contract as consulting tools. Template-specific metadata (workspace mode, block structure, DoD checklist) is stored as tool-class-specific extensions, not as separate schema.

---

## 8. Gap summary and hardening priorities

Source: `WP-W7-ROOF-02` §6, validated against Decisions W7-5 through W7-8.

### 8.1 P0 — Must-have for V8 roof integrity

| # | Gap | Rationale |
|---|---|---|
| 1 | Bind tool sessions to `ContextSnapshot` | Foundation for all V8 AI governance |
| 2 | Register consulting tool AI actions in tool catalog (`AIToolCapability`) | Decision 19 requires all AI-callable tools to have catalog entries |
| 3 | Close SIRI 16D data model gap | Methodology correctness: current 8D model produces incomplete assessments |
| 4 | Close ADMA T1-T7 + FoF benchmark gap | Same severity as SIRI |
| 5 | Define unified org admin settings surface architecture | Decision W7-7: prevent admin surface fragmentation |
| 6 | Tool invocation trace viewer for support | Governance model is unauditable without operator surface |
| 7 | Migrate DRD knowledge from bridge code to RAG packs | Bridge code diverges from canonical knowledge bank architecture |

### 8.2 P1 — Required for standard adoption and scale

| # | Gap | Rationale |
|---|---|---|
| 8 | Adopt consulting tools standard for Wave 1 tools (4 tools) | Validates standard beyond Dynamic SWOT |
| 9 | Admin UI for tenant memory controls | `TenantMemoryControlPolicy` defined but invisible to admins |
| 10 | Admin UI for tool governance policies | `ConsumerToolPolicy` defined but not manageable |
| 11 | Preview graphics for 31 toolTypes | Library UX degraded without thumbnails |
| 12 | Knowledge packs for top-10 tools | AI mentor quality depends on tool-scoped knowledge |
| 13 | Output package mapping per tool | Generators cannot scaffold consistent deliverables without this |

### 8.3 P2 — Scale and completeness

| # | Gap | Rationale |
|---|---|---|
| 14 | 60 framework templates in Library registry | Large content surface; depends on shared registry (Decision W7-5) |
| 15 | Micro-video production pipeline | UX quality, not blocking functionality |
| 16 | External vector store adapter | Scaling concern; pgvector sufficient for MVP |
| 17 | Case knowledge capture pipeline | Closed-loop learning |
| 18 | Multiplayer for tool sessions | Depends on broader multiplayer rollout |
| 19 | Tool session version/replay | Depends on broader version/replay rollout |

---

## 9. Related documents

### V3 product contracts (canonical)

- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`
- `docs/product/TOOLS_CATALOG_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md`
- `docs/product/TOOLS_HELP_CENTER_SIDEBAR_CONTRACT_V1.md`

### V8 governance and platform baselines

- `docs/product/work-packets/WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md`
- `docs/product/work-packets/WP-W1-AI-02_GOVERNED_RETRIEVAL_BASELINE.md`
- `docs/product/work-packets/WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md`
- `docs/product/work-packets/WP-W1-AI-04_TOOL_GOVERNANCE_HITL_BASELINE.md`
- `docs/product/work-packets/WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md`
- `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`

### Wave 7 decisions and analysis

- `docs/product/work-packets/DECISION_LOG_WAVE_7.md` — Decisions W7-5, W7-6, W7-7, W7-8
- `docs/product/work-packets/DECISION_LOG_WAVE_1.md` — Decisions 19–22 (tool governance), 23–24 (trust/provenance)
- `docs/product/work-packets/WP-W7-ROOF-02_TOOLS_ORG_ADMIN.md` — Gap analysis and priority ordering

### Downstream consumers

- `docs/product/REPORT_GENERATOR_V3.md`
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
