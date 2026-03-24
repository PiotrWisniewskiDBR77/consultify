# WP-W7-ROOF-02 — Tools v8 and Organization/Admin Hardening Analysis

> Status: Completed
> Packet: WP-W7-ROOF-02
> Wave: 7 — Roof hardening for weaker branches
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `CONSULTING_TOOLS_V3.md` — module workflow SSOT
> - `CONSULTING_TOOLS_STANDARD_V1.md` — reusable tool standard (Dynamic SWOT reference)
> - `TOOLS_CATALOG_V3.md` — catalog surfaces and tool inventory
> - `TOOLS_KNOWLEDGE_BANK_V3.md` — knowledge bank RAG architecture
> - `V3_TOOLS_COMPLETENESS_MATRIX.md` — content and system completeness audit
> - `TOOLS_GAP_ANALYSIS_V3.md` — DRD/SIRI/ADMA/KPI code-vs-SSOT gaps
> - `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md` — interview governance
> - `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` — memory control surfaces
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.8 Wave 7
> - `WP-W1-AI-04_TOOL_GOVERNANCE_HITL_BASELINE.md` — tool governance baseline
> - `DECISION_LOG_WAVE_1.md` — Decisions 19-22

---

## 1. Tools catalog and knowledge bank readiness

### 1.1 Catalog completeness

The tools module operates under a unified mental model: **Library → Sessions → Outputs → Initiatives** (`CONSULTING_TOOLS_V3.md` §2.2).

Current catalog state per `V3_TOOLS_COMPLETENESS_MATRIX.md`:

| Dimension | Status | Detail |
|---|---|---|
| 31 interactive toolTypes in Library | Complete (31/31 seeded) | Migrations 559, 562, 604 cover all toolTypes with `whenToUse/inputs/steps/outputs/commonMistakes/example/nextSteps` (EN+PL) |
| KB article slugs per toolType | Complete (31/31) | `tools-<toolType>-how-to` with EN+PL content |
| Preview graphics | Gap | `thumbnail_url` often NULL; graphic asset production pipeline not operational |
| Micro-videos | Gap | Scripts exist partially; `video_url` not wired for most tools |
| Runtime surface contracts | Partial | Many tool specs in `CONSULTING_TOOLS_TOOL_SPECS_V3.md` have minimal table-columns / workspace-mode / validation-gate definitions |
| 60 classic framework templates | Spec exists | `CONSULTING_TEMPLATES_LIBRARY_V3.md` defines the contract, but templates are not yet stored in the Known Tools `tools` table |
| Output package mapping per tool | Gap | No canonical report-section or deck-slide mapping per toolType exists |

### 1.2 Knowledge bank readiness

Per `TOOLS_KNOWLEDGE_BANK_V3.md`:

| Component | Status | Detail |
|---|---|---|
| Repo pack structure (`knowledge/tool-kb/`) | Operational | Folder structure, README, templates exist |
| RAG ingestion endpoint | Operational | `POST /api/ai-operations/knowledge/tool-packs/index` with tool-scoped retrieval |
| DRD packs (qbank, methodology) | Exist (bridge) | UI still reads from `src/services/assessmentKnowledge/*` rather than RAG packs |
| SIRI/ADMA packs | Partial | Methodology packs exist but QBank completeness varies |
| Consulting tool packs (non-licensed) | Gap | No knowledge packs authored for the 31 interactive toolTypes |
| External vector store adapter | Gap | §9 of TOOLS_KNOWLEDGE_BANK_V3 specifies external provider API; not implemented |
| Case knowledge capture pipeline | Gap | §10 propose→review→publish pipeline not implemented |
| Help packs per tool | Gap | Help pack type defined but not authored for most tools |
| Benchmarks packs | Gap | Pack type defined but no benchmark datasets ingested |

### 1.3 Summary assessment

The catalog has strong structural foundations (31/31 tools seeded, KB slugs wired, ingestion endpoint operational). The primary gaps are **content production** (graphics, videos, knowledge packs) and **system integration** (templates in Library, output mappings, external RAG provider).

---

## 2. Tools V8 upgrade path

### 2.1 V3 → V8 gap analysis

The tools module documentation is anchored at V3. The V8 implementation program (`V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.8) identifies Tools v8 as a Wave 7 roof-hardening target. The upgrade path requires bridging V3 contracts with V8 platform capabilities established in Waves 1-6.

| V8 capability | Tools integration status | Required work |
|---|---|---|
| **AI tool governance** (WP-W1-AI-04) | Not integrated | Tool catalog model (`AIToolCapability`) must be applied to consulting tools; each tool session's AI actions must be classified by risk class and governed by consumer class policy |
| **Execution proposal spine** (WP-W1-AI-03) | Not integrated | Tool session AI actions that produce mutations (create initiative, finalize session) must generate proposals through the approval spine |
| **Context identity** (WP-W1-AI-01) | Not integrated | Tool sessions must bind to `ContextSnapshot` for retrieval and AI operations |
| **Governed retrieval** (WP-W1-AI-02) | Partially integrated | Knowledge bank RAG exists but does not use governed retrieval pipeline with ACL enforcement |
| **Multiplayer** (WP-W1-MP-01) | Not integrated | Tool sessions are single-user; no presence, locking, or concurrent editing support |
| **Version/replay** (WP-W1-MP-02) | Not integrated | Session snapshots exist at finalization but no version history or replay capability |
| **Trust and provenance** (WP-W1-TRUST-01) | Partial | Source traceability exists (`SOURCE_TRACEABILITY_SPEC.md`) but does not connect to V8 trust/provenance ledger |
| **Memory controls** (USER_AND_ADMIN_MEMORY_CONTROLS_V8) | Not integrated | Tool session AI does not respect user/admin memory preferences |
| **Prompt OS** | Not integrated | Tool AI prompts are not registered in the prompt registry or governed by prompt lifecycle |

### 2.2 Consulting Tools Standard adoption

Per `CONSULTING_TOOLS_STANDARD_V1.md`, Dynamic SWOT is the reference implementation. The standard defines a 3-wave rollout:

- **Wave 1 (closest to SWOT):** `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` — 4 tools
- **Wave 2 (remaining strategic):** `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine` — 5 tools
- **Wave 3 (operational + automation):** 22 tools including `process-automation`, `vsm-builder`, `rpa-scanner`, etc.

Adoption checklist per tool (§10 of the standard) requires: product spec, KB article, preview content, standard session shell, conversation→analysis→conclusions→outputs flow, AI mentor behavior, four standard outputs, review/finalization, traceability, and validated smoke path.

**Current adoption status:** Dynamic SWOT is the only tool with a complete reference implementation. No other tool has been formally validated against the adoption checklist.

### 2.3 Licensed assessment gaps

Per `TOOLS_GAP_ANALYSIS_V3.md`:

| Assessment | Critical gap |
|---|---|
| **DRD** | QBank/Help packs exist but UI still uses bridge code (`assessmentKnowledge/*`); no explicit deck export contract |
| **SIRI** | Code implements 8D model; SSOT requires 16D data layer with 16D→8D render mapping; report/deck missing 16D view |
| **ADMA** | Code lacks T1-T7 aggregation (with weights) and FoF benchmark overlay; report template is pillar/dimension only |

### 2.4 Recommended V8 upgrade sequence

1. **Bind tool sessions to V8 governance spine** — ContextSnapshot, tool governance risk classification, approval spine for mutations
2. **Migrate tool AI to Prompt OS** — register tool prompts, apply governed retrieval for knowledge bank
3. **Close licensed assessment data gaps** — SIRI 16D, ADMA T1-T7/FoF, DRD deck export
4. **Adopt standard for Wave 1 tools** — 4 tools closest to SWOT
5. **Content production pipeline** — graphics, micro-videos, knowledge packs for all 31 toolTypes
6. **Templates integration** — 60 classic frameworks into Library registry
7. **Multiplayer and version/replay** — tool session collaborative editing

---

## 3. Organization/Admin surface readiness

### 3.1 Current admin surface inventory

Based on the canonical docs, the following admin surfaces are documented or implied:

| Surface | Doc source | Status |
|---|---|---|
| **Interview privacy/AI governance admin** | `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md` | Documented (draft); no implementation contract |
| **User memory controls** | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` §4 | Documented; control objects defined (`UserMemoryPreference`) |
| **Tenant admin memory controls** | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` §6 | Documented; control objects defined (`TenantMemoryControlPolicy`) |
| **Operator visibility controls** | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` §7 | Documented; `MemoryAccessExplanation` schema defined |
| **Tool governance admin** | `WP-W1-AI-04` §2 | Consumer class policy model defined; no admin UI contract |
| **Knowledge bank admin** | `TOOLS_KNOWLEDGE_BANK_V3.md` §8 | Indexing endpoint exists; no admin surface for pack management |
| **Org settings (general)** | Implied across multiple docs | No unified org settings SSOT |

### 3.2 Gap assessment

The Organization/Admin surfaces have a consistent pattern: **architectural contracts exist but product surfaces are undefined**.

| Gap | Severity | Detail |
|---|---|---|
| No unified org settings surface spec | High | Multiple docs reference "org admin controls" but no single SSOT defines the settings surface, navigation, and permission model |
| No admin UI for tool governance policies | High | `ConsumerToolPolicy` schema exists (WP-W1-AI-04 §2.2) but no admin surface to manage policies per tool/consumer class |
| No admin UI for memory controls | High | `TenantMemoryControlPolicy` exists as a schema but no product surface spec for where admins configure these controls |
| No admin UI for interview governance | Medium | `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md` defines governance areas but no admin surface contract |
| No admin UI for knowledge bank operations | Medium | Indexing endpoint exists but no admin surface for triggering reindex, viewing pack status, or managing ingestion |
| No admin UI for AI policy overrides | Medium | Decision 20 establishes org→project tightening hierarchy but no surface for admins to configure overrides |
| No admin audit/explanation surface | Medium | `ToolInvocationTrace` and `MemoryAccessExplanation` schemas exist but no operator/admin surface to view them |

### 3.3 Org settings consolidation requirement

The V8 canon introduces at least 6 distinct admin control domains that need surfaces:

1. **AI governance** — tool permissions, consumer class policies, risk class overrides
2. **Memory** — personalization policy, org memory, retention, assistant access
3. **Privacy** — interview consent, transcript handling, evidence reuse
4. **Knowledge** — pack management, ingestion, case knowledge review queue
5. **Sync/Connectors** — connector health, sync policies (covered by PM sync docs, out of this packet's direct scope but relevant for admin surface consolidation)
6. **General org** — branding, roles, permissions, billing (implied but not V8-documented)

Without a unified admin surface architecture, each domain will build its own settings page, creating fragmentation.

---

## 4. AI governance admin integration

### 4.1 What Wave 1 established

WP-W1-AI-04 delivered:

- `AIToolCapability` schema with risk class taxonomy (5 levels)
- `ConsumerToolPolicy` schema with 4 consumer classes
- `DelegationGuard` schema for subagent governance
- Unified approval states (5 states)
- `ToolInvocationTrace` for audit
- Permission explanation path (7 steps)

Decisions 19-22 from `DECISION_LOG_WAVE_1.md` further specified:

- D19: Tool catalog population requires governance owner approval; new tools default to stricter handling
- D20: Policy override hierarchy is org→project (tighten only, never loosen)
- D21: Subagent credentials are scoped temporary tokens only
- D22: Background job mutations use deferred approval queue

### 4.2 What is missing for admin operability

The Wave 1 baseline is a **schema and policy model**. To make it operational, the following admin surfaces are required:

| Admin capability | Requirement | Priority |
|---|---|---|
| **Tool catalog browser** | Admin can view all registered tools, their risk classes, mutation types, and current policies | P0 |
| **Tool risk class management** | Governance owner can review and approve/change risk classifications per D19 | P0 |
| **Consumer class policy editor** | Admin can view and tighten consumer class policies per tool per D20 | P1 |
| **Delegation guard viewer** | Admin can inspect active delegations and their scope/tool restrictions | P1 |
| **Tool invocation trace viewer** | Support/admin can search and inspect `ToolInvocationTrace` records per §6.3 explanation path | P0 |
| **Approval queue for tool mutations** | Admin/reviewer can see pending tool approvals and act on them | P0 |
| **MCP allowlist management** | Admin can manage MCP tool allowlists and trust class assignments per §5.5 | P1 |
| **Policy override dashboard** | Admin can see effective policy at org and project levels with override chain | P2 |

### 4.3 Integration with consulting tools

The consulting tools module must integrate with the AI governance model:

- Each consulting tool's AI actions (propose inputs, draft summaries, generate outputs) must be registered in the tool catalog as `AIToolCapability` entries
- The "propose → accept" contract from `CONSULTING_TOOLS_STANDARD_V1.md` §7 maps naturally to the `bounded_write` risk class with `policy_approvable` approval path
- Output generation (create initiative/report/presentation from finalized session) maps to `workflow_mutation` requiring human approval
- Knowledge bank retrieval maps to `read_only` risk class

---

## 5. Wave 1 tool governance integration

### 5.1 Mapping consulting tools to the governance model

| Consulting tool action | Risk class | Consumer class | Approval path |
|---|---|---|---|
| Browse tool catalog / Library | `read_only` | `chat` | `auto_executable` |
| Start tool session | `bounded_write` | `chat` | `policy_approvable` |
| AI proposes inputs/assumptions | `read_only` | `chat` | `auto_executable` |
| AI drafts summaries/conclusions | `bounded_write` | `chat` | `policy_approvable` (propose→accept) |
| AI generates missing items checklist | `read_only` | `chat` | `auto_executable` |
| Finalize session (lock) | `workflow_mutation` | `chat` | `requires_human_approval` |
| Create initiative from session | `workflow_mutation` | `chat` | `requires_human_approval` |
| Create report/presentation from session | `bounded_write` | `chat` | `policy_approvable` |
| Knowledge bank retrieval (RAG) | `read_only` | `chat` / `background_job` | `auto_executable` |
| Knowledge bank indexing | `bounded_write` | `background_job` | `policy_approvable` |
| Assessment scoring (DRD/SIRI/ADMA) | `bounded_write` | `chat` | `policy_approvable` |

### 5.2 Open integration questions

1. **Tool catalog registration:** The 31 consulting toolTypes and 60 templates need `AIToolCapability` entries. Should these be auto-generated from the Known Tools registry, or manually curated per D19?
2. **Session-level vs action-level governance:** Should the governance model apply per tool session (one approval for the session) or per AI action within a session (granular but noisy)?
3. **Licensed assessment governance:** DRD/SIRI/ADMA have methodology-specific AI behavior (scoring guidance, evidence discipline). Should these have dedicated consumer class policies or use the standard consulting tool policy?

---

## 6. Priority ordering

### 6.1 P0 — Must-have for V8 roof integrity

| # | Item | Rationale |
|---|---|---|
| 1 | Bind tool sessions to `ContextSnapshot` | Foundation for all V8 AI governance; without this, tool AI operates outside the governed pipeline |
| 2 | Register consulting tool AI actions in tool catalog | D19 requires all AI-callable tools to have catalog entries; consulting tools are the largest unregistered surface |
| 3 | Close SIRI 16D data model gap | Critical methodology correctness issue; current 8D model produces incomplete assessments |
| 4 | Close ADMA T1-T7 + FoF gap | Same severity as SIRI; methodology output is incomplete without aggregation and benchmark |
| 5 | Define unified org admin settings surface architecture | Without this, every V8 governance domain builds its own disconnected admin page |
| 6 | Tool invocation trace viewer for support | D19-D22 governance model is unauditable without a support surface |
| 7 | Migrate DRD knowledge from bridge code to RAG packs | Bridge code (`assessmentKnowledge/*`) is a scaling bottleneck and diverges from the canonical knowledge bank architecture |

### 6.2 P1 — Required for standard adoption and scale

| # | Item | Rationale |
|---|---|---|
| 8 | Adopt consulting tools standard for Wave 1 tools (4 tools) | Validates the standard beyond Dynamic SWOT; unblocks Wave 2/3 rollout |
| 9 | Admin UI for tenant memory controls | `TenantMemoryControlPolicy` is defined but invisible to admins |
| 10 | Admin UI for tool governance policies | `ConsumerToolPolicy` is defined but not manageable |
| 11 | Content production: preview graphics for 31 toolTypes | Library UX is degraded without thumbnails |
| 12 | Content production: knowledge packs for top-10 tools | AI mentor quality depends on tool-scoped knowledge |
| 13 | Output package mapping per tool | Report/presentation generators cannot scaffold consistent deliverables without this |
| 14 | Interview governance admin surface | Privacy controls are documented but not operationally accessible |

### 6.3 P2 — Scale and completeness

| # | Item | Rationale |
|---|---|---|
| 15 | Templates (60 frameworks) in Library registry | Large content surface; depends on decision whether templates share the Known Tools table |
| 16 | Micro-video production pipeline | Important for UX but not blocking functionality |
| 17 | External vector store adapter for knowledge bank | Scaling concern; pgvector is sufficient for MVP/staging |
| 18 | Case knowledge capture pipeline | Closed-loop learning; valuable but not blocking core tool functionality |
| 19 | Multiplayer for tool sessions | Depends on broader multiplayer rollout |
| 20 | MCP allowlist admin surface | Depends on MCP integration expansion |
| 21 | Tool session version/replay | Depends on broader version/replay rollout |

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream target | What this analysis provides | Consequence if not addressed |
|---|---|---|
| **Wave 7 ROOF-01 (MyWork)** | Tool session materialization in MyWork depends on tool governance integration (items 1-2) | MyWork cannot show governed tool session status |
| **Wave 7 ROOF-03 (Landing/Superadmin)** | Unified admin surface architecture (item 5) is shared with Superadmin hardening | Admin surfaces fragment across ROOF-02 and ROOF-03 |
| **AI Core closure (Waves 3-4)** | Tool catalog registration (item 2) is a prerequisite for Phase C governance operationalization | Phase C cannot govern consulting tool AI without catalog entries |
| **Reports & Presentations v8** | Output package mapping (item 13) is required for generators to scaffold from tool sessions | Generators produce generic outputs instead of tool-specific structured deliverables |
| **Results v8** | KPI deviation management gap (from `TOOLS_GAP_ANALYSIS_V3.md` §4) affects tool→results traceability | Tool-generated initiatives cannot feed governed KPI tracking |
| **Help/Knowledge Base v8** | Knowledge pack authoring (item 12) feeds Help Center contextual content | Help Center shows placeholder content for tool guidance |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | Identity and scope model for tool session binding | Completed |
| **WP-W1-AI-03 — Execution proposal/approval spine** | Approval model for tool mutations | Completed |
| **WP-W1-AI-04 — Tool governance HITL baseline** | Catalog model, consumer class policy, delegation contract | Completed |
| **DECISION_LOG_WAVE_1 — D19-D22** | Tool registration workflow, policy hierarchy, credential delegation, background mutation path | Ratified |
| **CONSULTING_TOOLS_STANDARD_V1** | Reusable tool standard and adoption checklist | Canonical |
| **CONSULTING_TOOLS_V3** | Module workflow SSOT | Canonical |
| **TOOLS_KNOWLEDGE_BANK_V3** | Knowledge bank architecture | Canonical |

---

## 8. Open questions and conflicts

### 8.1 V3 vs V8 versioning ambiguity

The tools module documentation is versioned as V3 (`CONSULTING_TOOLS_V3.md`, `TOOLS_CATALOG_V3.md`, etc.) while the implementation program targets V8. No explicit "Tools V8" SSOT exists. The V3 docs define the product contracts; V8 adds governance, multiplayer, and platform integration layers.

**Observation (not a conflict):** The V3 docs remain valid as product contracts. V8 hardening adds platform integration requirements on top. No V3 contract contradicts V8 governance principles. However, a "Tools V8 SSOT" document may be needed to explicitly bridge V3 product contracts with V8 platform requirements.

### 8.2 Template storage decision pending

`V3_TOOLS_COMPLETENESS_MATRIX.md` §3 notes: "Decision needed: whether templates live in the same Library (as `framework_template`) or a separate Templates library tab." This decision affects:

- Library UI (one tab vs two)
- Known Tools table schema (tool_class field)
- Knowledge pack structure
- Admin governance surface

**Requires escalation:** Product decision on template storage model.

### 8.3 Tool governance granularity for consulting tools

WP-W1-AI-04 defines governance at the tool-invocation level. Consulting tools have a rich internal lifecycle (mission → input → build → synthesis → outputs) with many AI interactions per session. Applying per-invocation governance to every AI suggestion within a tool session may create excessive approval friction.

**Requires escalation:** Product/engineering decision on whether consulting tool AI actions are governed per-session or per-action, and whether the "propose → accept" UX pattern in the tool standard satisfies the HITL requirement without additional approval spine integration.

### 8.4 Admin surface ownership

Multiple V8 docs define admin control objects (`TenantMemoryControlPolicy`, `ConsumerToolPolicy`, interview governance controls) but none assigns ownership of the admin surface itself. The admin surface could live in:

- Organization Settings (tenant admin)
- Superadmin panel (platform operator)
- Module-specific settings (per-module admin)

**Requires escalation:** Architecture decision on unified admin surface ownership and navigation model.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked:

- `CONSULTING_TOOLS_STANDARD_V1.md` "propose → accept" AI contract ↔ `WP-W1-AI-04` approval semantics: Compatible. The standard's propose→accept maps to `bounded_write` with `policy_approvable`. No contradiction.
- `TOOLS_KNOWLEDGE_BANK_V3.md` RAG architecture ↔ `WP-W1-AI-02` governed retrieval: Compatible. Knowledge bank retrieval can be wrapped in governed retrieval pipeline. No contradiction.
- `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md` ↔ `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`: Complementary. Interview governance focuses on consent/visibility/retention for interview content; memory controls focus on personalization/durable memory. No overlap or contradiction.
- `CONSULTING_TOOLS_V3.md` finalization gate ↔ `WP-W1-AI-04` workflow_mutation approval: Compatible. Finalization is a governance transition that naturally maps to `workflow_mutation` requiring human approval.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Tools catalog completeness audit: 31/31 toolTypes seeded with content; gaps in graphics, videos, runtime surface contracts, output mappings, and template integration
  - Knowledge bank readiness audit: RAG infrastructure operational; gaps in tool-specific packs, external provider, case knowledge pipeline
  - V8 upgrade path: 9 V8 platform capabilities identified for integration; recommended 7-step upgrade sequence
  - Organization/Admin surface readiness: 7 admin surface gaps identified across AI governance, memory, privacy, and knowledge domains
  - AI governance admin integration: 8 admin capabilities required to operationalize WP-W1-AI-04 schemas
  - Wave 1 tool governance mapping: 11 consulting tool actions mapped to risk classes and approval paths
  - Priority ordering: 21 items across P0 (7), P1 (7), P2 (7)
  - Downstream dependency map: 6 downstream targets, 7 upstream dependencies
  - Licensed assessment gaps: SIRI 16D, ADMA T1-T7/FoF, DRD deck export identified as P0
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Template storage model decision pending (§8.2)
  - Tool governance granularity for consulting tools needs product decision (§8.3)
  - Admin surface ownership and navigation model undefined (§8.4)
- **Questions requiring escalation:**
  1. Should the 60 classic framework templates live in the same Library table as interactive toolTypes, or in a separate registry? (§8.2)
  2. Should consulting tool AI actions be governed per-session or per-action? Does the standard's propose→accept pattern satisfy HITL without additional approval spine integration? (§8.3)
  3. Who owns the unified admin surface — Organization Settings, Superadmin, or module-specific settings? What is the navigation model? (§8.4)
  4. Should a "Tools V8 SSOT" bridging document be authored to explicitly connect V3 product contracts with V8 platform integration requirements? (§8.1)
