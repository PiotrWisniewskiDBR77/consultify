# Documentation Registry (Canonical vs Legacy)

## Purpose

This document clarifies which documents are **canonical** for product behavior and governance, and which documents are **legacy snapshots** or **non-authoritative** working files.

If you are implementing product changes, treat **Canonical** documents as the source of truth.

## Canonical documents (source of truth)

### Product governance & lifecycle

- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
  - **Owner**: Product
  - **Scope**: Initiative lifecycle, decision gates, RACI, UX permissions, role vocabulary
  - **Authority**: Highest for governance and UI locks/buttons

- `docs/product/ROLES_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical role layers (system/project/initiative), steering board, consultant overlay, effective roles mapping
  - **Authority**: Highest for role vocabulary and role resolution semantics

- `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`
  - **Owner**: Product
  - **Scope**: canonical project roles + optional steering board model
  - **Authority**: High (project governance vocabulary)

- `docs/product/CONSULTANT_OVERLAY_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: consultant overlay fields, visibility/audit rules, invitation model
  - **Authority**: High (consultant identity model)

- `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
  - **Owner**: Engineering
  - **Scope**: backend → frontend capabilities contract for initiative UI enablement
  - **Authority**: Highest for UI capability contract

- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: normative status×role×CTA behavior (validated by tests)
  - **Authority**: High (workflow + CTA behavior)

- `docs/product/INITIATIVE_AUTOMATION_AND_TRANSITIONS.md`
  - **Owner**: Engineering
  - **Scope**: automated transitions (e.g. SCHEDULED → EXECUTING by date), terminal/archival policies
  - **Authority**: High (automation behavior)

- `docs/product/GATE_DEFINITION_OF_DONE.md`
  - **Owner**: Product + Engineering
  - **Scope**: normative DoD for decision gates; UI completeness checks
  - **Authority**: Highest for gate readiness rules (what blocks transitions)

- `docs/product/CHANGE_AND_UNBLOCK_POLICY.md`
  - **Owner**: Product + Engineering
  - **Scope**: mandatory policy for CHANGE, BLOCKED, UNBLOCK; thresholds and approvals
  - **Authority**: Highest for change governance and unblock rules

- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical source artefacts and SourceLink mapping (ToolSession, AssessmentReport)
  - **Authority**: Highest for source traceability rules (no initiative without source)

- `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical report types, RAG logic, escalation rules, reporting UX
  - **Authority**: Highest for reporting behavior and management layer outputs

- `docs/product/MY_WORK_INBOX_AND_SLA.md`
  - **Owner**: Product + Engineering
  - **Scope**: Inbox/My Work definition, SLA defaults, escalation rules, governance enforcement UX
  - **Authority**: Highest for execution control layer behavior

- `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
  - **Owner**: Product + Engineering
  - **Scope**: when economics is required, minimal fields, gate enforcement, reporting/baselines
  - **Authority**: Highest for economics governance and APPROVE gate blocking rules

### System architecture brief (north star)

- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
  - **Owner**: Product
  - **Scope**: system purpose, core modules order, role vocabulary, closed artefact list
  - **Authority**: Highest for “what the system is” and “what artefacts exist”

### Reports & Presentations (v3) — canonical generator specs

- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
  - **Owner**: Product
  - **Scope**: libraries + generators (Gamma-like UX), template system, export requirements (high level)
  - **Authority**: High (product behavior for Reports/Presentations)

- `docs/product/PRESENTATION_GENERATOR_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: end-to-end Presentation Generator SSOT (modes: SHOW/DOCUMENT/BRIEFING/WORKSHOP, wizard flow, deck builder, AI agent, themes/brand kits, curated palettes, image presets, refresh rules, animations, export policy, undo/no realtime)
  - **Authority**: Highest for presentation generator behavior

- `docs/product/REPORT_GENERATOR_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: end-to-end Report Generator SSOT (R1–R4 canonical report types, wizard/builder, templates, AI narrative, RAG/escalation mapping, export quality gates PDF/DOCX/PPTX)
  - **Authority**: Highest for report generator behavior

### Interview (v3 as-is + v6 redesign target)

- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: as-is / v3 canonical contract for template engine, runtime, assignment workflow and supporting materials
  - **Authority**: Highest for current shipped Interview behavior until V6 rollout

- `docs/product/INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md`
  - **Owner**: Product + Engineering
  - **Scope**: to-be V6 redesign of Interview as Templates Studio + Interview Runtime + Insight Report + knowledge collection system
  - **Authority**: Highest for V6 redesign target state and implementation planning

- `docs/product/INTERVIEW_TEMPLATES_LIBRARY_V6.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical system / organization / private template library and seed packs for V6
  - **Authority**: High for template taxonomy, seed library scope and AI-first authoring rules

### Authoritative backend data model (ERD)

- `docs/product/RESET_ERD_CONSULTINITY.md`
  - **Owner**: Product + Engineering
  - **Scope**: authoritative entity model for backend implementation
  - **Authority**: Highest for database schema and service boundaries

### Module routing & information architecture

- `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
  - **Owner**: Product + Engineering
  - **Scope**: Sidebar modules, routes, module responsibilities, lifecycle-to-module mapping
  - **Authority**: Highest for navigation and module boundaries

### Core process flows

- `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md`
  - Assessment execution → report → initiative draft generation
- `docs/flows/core/INITIATIVE_MANAGEMENT_FLOW.md`
  - End-to-end initiative lifecycle and governance gates
- `docs/flows/core/DECISION_SYSTEM_FLOW.md`
  - Decision objects, escalation, committee approvals, gate decisions
- `docs/flows/core/PMO_STANDARDS_FLOW.md`
  - PMO standards selection and how it affects roles/permissions terminology

### Standards compliance (terminology + traceability)

- `docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md`
  - **Owner**: Product + Compliance
  - **Scope**: ISO/PMBOK/PRINCE2 traceability, role hierarchy, auditability
  - **Authority**: Highest for standards alignment and audit language

### Chat v8 (canonical chat product suite)

- `docs/product/CHAT_V8_SSOT.md`
  - **Owner**: Product
  - **Scope**: canonical chat product purpose, principles, taxonomy index, package map and completeness criteria
  - **Authority**: Highest for `Chat v8` target state and document ownership map

- `docs/product/CHAT_V8_BENCHMARK.md`
  - **Owner**: Product
  - **Scope**: benchmark and parity/non-goal matrix vs ChatGPT, Claude and Perplexity
  - **Authority**: Highest for leader-grade comparison targets

- `docs/product/CHAT_V8_WORKFLOW_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical end-to-end user workflow, variants and trust flow
  - **Authority**: High for user journey and workflow semantics

- `docs/product/CHAT_V8_AS_IS.md`
  - **Owner**: Product + Engineering
  - **Scope**: current-state audit of chat product/runtime
  - **Authority**: Highest for as-is interpretation during `v8` work

- `docs/product/CHAT_V8_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: explicit gaps between current chat and target `v8`
  - **Authority**: High for prioritization and sequencing

- `docs/product/CHAT_V8_RUNTIME_TRUTH_MAP.md`
  - **Owner**: Engineering
  - **Scope**: canonical runtime owners, live vs legacy surfaces, support-ready interpretation
  - **Authority**: Highest for execution-time truth and capability classification

- `docs/product/CHAT_V8_AI_GOVERNANCE.md`
  - **Owner**: Product + Engineering
  - **Scope**: answer/proposal/action rules, source honesty, privacy and governance principles
  - **Authority**: Highest for AI behavior and governance semantics in chat

- `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: epics, waves, execution order, acceptance matrix and rollout strategy for `Chat v8`
  - **Authority**: Highest for `Chat v8` delivery sequencing

- `docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
  - **Owner**: Product + Engineering
  - **Scope**: chat controls, visibility rules, canonical/partial/legacy classification
  - **Authority**: Highest for chat button and control semantics

- `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: conversation lifecycle, folders, revisit and history/library model
  - **Authority**: Highest for chat history semantics

- `docs/product/CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
  - **Owner**: Product + Engineering
  - **Scope**: file/URL/cloud semantics, retrieval scope and source transparency
  - **Authority**: Highest for chat retrieval/source rules

- `docs/product/CHAT_V8_MODES_AND_SCOPE_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: modes, source scope, model selection, privacy and personalization toggles
  - **Authority**: Highest for chat mode/scope semantics

- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
  - **Owner**: Product + Engineering
  - **Scope**: proposals, approvals, execution semantics and artifact handoff actions
  - **Authority**: Highest for chat action lifecycle semantics

- `docs/product/CHAT_V8_VOICE_AND_MULTIMODAL.md`
  - **Owner**: Product + Engineering
  - **Scope**: dictation, voice conversation, TTS and multimodal boundaries
  - **Authority**: Highest for chat voice contract

- `docs/product/CHAT_V8_RESPONSE_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: response classes, metadata and trust expectations
  - **Authority**: Highest for response semantics in chat

- `docs/product/CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
  - **Owner**: Product + Engineering
  - **Scope**: prompt composition order, precedence, base persona ownership, fallback and traceability rules for chat
  - **Authority**: Highest for chat prompt-system contract at product/runtime boundary

- `docs/product/CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md`
  - **Owner**: Product + Engineering
  - **Scope**: quality standards for prompt text, anti-duplication rules, content evaluation checklist and prompt-layer quality targets
  - **Authority**: Highest for chat prompt content quality rules

- `docs/product/CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: prioritized mastery gaps for prompt architecture, trust semantics, eval discipline, release hardening and prompt operations
  - **Authority**: Highest for prompt mastery gap prioritization and target-state hardening path

- `docs/product/CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
  - **Owner**: Product + Engineering
  - **Scope**: conversation/user/org memory, personalization, private mode and trust boundaries
  - **Authority**: Highest for memory semantics in chat

- `docs/product/CHAT_V8_MESSAGE_AND_THREAD_OPERATIONS.md`
  - **Owner**: Product + Engineering
  - **Scope**: edit, regenerate, fork/branch, variant and thread continuity semantics
  - **Authority**: Highest for message and thread operation semantics

- `docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
  - **Owner**: Product + Engineering
  - **Scope**: sharing, visibility layers, folder scope and permission boundaries
  - **Authority**: Highest for chat visibility and sharing semantics

- `docs/product/CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
  - **Owner**: Product + Engineering
  - **Scope**: rich response rendering, in-thread vs artifact boundary, copy/export semantics
  - **Authority**: Highest for chat rich output behavior

- `docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
  - **Owner**: Product + Engineering
  - **Scope**: retention, audit, export, admin visibility, tenant isolation and compliance boundaries
  - **Authority**: Highest for chat enterprise/compliance promises

### AI prompt and runtime governance companions (implementation-authoritative)

- `docs/product/modules/ai/AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`
  - **Owner**: Engineering
  - **Scope**: canonical prompt CRUD/runtime assembly/governed publish stack and gaps
  - **Authority**: Highest for current prompt governance as-is and release-control architecture

- `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: target-state operating system for routing, purposes, privacy, context and runtime AI controls
  - **Authority**: Highest for platform-level AI operating model beyond chat-specific UX

- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
  - **Owner**: Engineering
  - **Scope**: context builder, orchestration and runtime agent/mode pipeline
  - **Authority**: High for implementation details of AI orchestration

- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: evidence-led deep research architecture, review model and runtime expectations
  - **Authority**: Highest for deep research evidence semantics

### Supporting (canonical, but secondary)

- `docs/architecture/WORK_DIMENSIONS`
  - Work mode scoping (SIMPLE/PROJECT/LOCATION/FULL) and capability model
- `docs/modules/ECONOMICS_MODULE.md`
  - Economics workflow and how analyses can create initiatives + gate decisions

## Legacy / snapshot documents (not authoritative)

### Number-suffixed documents

Files with a trailing number in the filename (examples: `... 3.md`, `... 10.md`) are treated as **snapshots** created during iterative drafting.

They are **not canonical** unless explicitly linked from a canonical document.

Common examples:

- `docs/*_SPECIFICATION *.md`
- `docs/*_AUDIT *.md`
- `docs/NAVIGATION_STRUCTURE *.md`
- `docs/TRANSLATION_* *.md`
- `docs/IMPLEMENTATION_PLAN *.md`
- `docs/DEMO_MODE *.md`

### Recent implementation reports

- `docs/product/INITIATIVE_AI_IMPLEMENTATION_REPORT_2026-02-15.md`
  - Snapshot report of shipped Initiative Artifact AI improvements (Scope/Tasks/Decisions/Team/Resources).

### Generated / internal working artifacts

- `docs/functional_requirements_full.txt`
  - May be useful as a reference, but is not a governance source of truth.

## Rules

- Canonical docs must not contradict each other.
- If a canonical doc changes, update cross-links and any impacted canonical docs in the same change set.
- If a legacy/snapshot doc becomes relevant, either:
  - promote it by moving/rewriting it into the canonical set, or
  - add a clear note that it is historical and link to the canonical replacement.
