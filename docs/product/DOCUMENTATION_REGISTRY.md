# Documentation Registry (Canonical vs Legacy)

> Global read order: start with `docs/SOURCE_OF_TRUTH.md`. This registry owns
> product-target truth; it does not override runtime, operations, data or UI
> authorities outside its declared scope.

## Purpose

This document clarifies which documents are **canonical** for product behavior and governance, and which documents are **legacy snapshots** or **non-authoritative** working files.

If you are implementing product changes, treat **Canonical** documents as the source of truth.

Repository hygiene, parallel-tree classification, and cleanup policy live in `docs/cleanup/README.md`.
Treat suffixed local copies such as ` 2.md` and ` 3.md` as non-authoritative snapshot duplicates unless a registry says otherwise.

## Canonical documents (source of truth)

### Product governance & lifecycle

- `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of modern project and initiative platforms across intake, governance, planning, execution, automation, AI support and closure
  - **Authority**: Highest for benchmark and parity target-setting in the initiative and execution package

- `docs/product/PROJECT_MANAGEMENT_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical readiness audit, read order, ownership map and cleanup agenda for project management documentation (projects, initiatives, tasks, decisions, inbox/SLA)
  - **Authority**: Highest for project-management documentation navigation and downstream documentation gating

- `docs/product/INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: initiative-first doctrine for the whole change-management system; defines initiative as the primary consulting instrument and tasks/decisions/economics/risks/benefits as subordinate parts of one coherent change machine
  - **Authority**: Highest for initiative-centric product doctrine across project-management documentation

- `docs/product/PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: imported leader patterns from `Softs` for task management, workflow runtime, triage, inbox, eventing, SLA and human-agent handoff
  - **Authority**: Highest for benchmark and parity target-setting in the task/workflow package

- `docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical task runtime, task classes, lifecycle, blocker model, decision linkage, templates, recurrence, state timing, AI-assisted task execution
  - **Authority**: Highest for task semantics and task-to-decision operating contract

- `docs/product/TASK_AND_DECISION_BENCHMARK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of ClickUp, Monday and adjacent work-management patterns for task structure, decision coupling, approvals, automation, workload and AI support
  - **Authority**: Highest for benchmark and parity target-setting in the task-and-decision package

- `docs/product/TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: readiness and gap audit for task and decision runtime across MyWork, Initiatives, Execution and PMO layers
  - **Authority**: Highest for task-and-decision completeness assessment and read-order gating

- `docs/product/INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical intake, triage, inbox, workflow state families, SLA clocks, handoffs, automation, replay and audit runtime
  - **Authority**: Highest for workflow runtime and personal enforcement semantics in project management

- `docs/product/INTAKE_AND_TRIAGE_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: AI-first runtime for incoming work capture, enrichment, dedupe, triage routing, initiative candidate formation, and governed commitment into initiative/task/decision objects
  - **Authority**: Highest for intake and triage semantics in the project-management package

- `docs/product/TASK_AUTOMATION_AND_EVENTING_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: AI-first automation, eventing, agent sessions, approvals, background execution, replay, observability and integration governance for task/workflow runtime
  - **Authority**: Highest for automation and eventing semantics in the task/workflow package

- `docs/product/INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical AI support for initiative creation, planning, scheduling, execution support, task management and delivery follow-through
  - **Authority**: Highest for initiative-specific AI copilot and execution-support doctrine

- `docs/product/AI_COLLABORATION_WITH_INITIATIVES_TASKS_AND_DECISIONS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical AI collaboration model across initiatives, tasks and decisions, including writer, consultant, expert, planner and execution-copilot roles, benchmarked against ClickUp and Notion patterns
  - **Authority**: Highest for object-level AI collaboration doctrine across the execution spine

- `docs/product/INITIATIVE_ANALYSIS_QUALITY_LOGIC_AND_CAPACITY_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical Analysis tab runtime for initiative quality, feasibility, sequencing logic, timeline sanity, capacity balancing and AI-assisted remediation
  - **Authority**: Highest for initiative analysis cockpit semantics and issue-remediation doctrine

- `docs/product/INITIATIVE_ELEMENT_COVERAGE_AND_GAP_MATRIX_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: explicit audit of initiative element coverage across docs, runtime sections and project-management expectations, including missing or under-specified initiative domains
  - **Authority**: Highest for initiative object completeness and section-coverage assessment

- `docs/product/INITIATIVE_TECHNOLOGY_ADVISORY_AND_ARCHITECTURE_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical technology-advisory layer inside initiative design, covering solution direction, architecture choices, tool and infrastructure fit, implementation constraints and AI-assisted technology guidance
  - **Authority**: Highest for technology-advisory and architecture guidance inside initiative design

- `docs/product/INITIATIVE_SKILL_GAP_AND_CAPABILITY_DEVELOPMENT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical capability-requirements, skills-gap, staffing and capability-development layer for initiatives
  - **Authority**: Highest for skill-gap analysis and capability-development doctrine in initiative planning

- `docs/product/INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical planning doctrine for initiative baselines, sequencing, dependencies, capacity, workload and critical-path management
  - **Authority**: Highest for initiative timeline, capacity and critical-path doctrine

- `docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical reporting, accountability, blocker, risk and recovery model for initiative execution
  - **Authority**: Highest for delivery reporting and execution-risk doctrine

- `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of leading execution-management patterns for workload, balance, timeliness, dependencies, dashboards, recovery and delivery control
  - **Authority**: Highest for benchmark and parity target-setting in the Execution or Wdrozenie package

- `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical split of the Execution module into `Portfolio`, `Raporty` and `Manager`, including surface responsibilities, allowed actions, reporting catalog boundaries and PMO/manager cockpit semantics
  - **Authority**: Highest for Execution surface semantics, tab boundaries and UX-level ownership split inside the Wdrozenie package

- `docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime for the execution control tower, including workload, balance, timeliness, intervention queues, recovery and operator actions
  - **Authority**: Highest for execution operator-runtime doctrine

- `docs/product/EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical doctrine for on-time delivery through baseline control, variance tracking, critical path, forecast confidence and recovery-oriented schedule management
  - **Authority**: Highest for schedule-control and on-time-delivery doctrine in the Execution package

- `docs/product/EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime for capacity operations, workload balancing, resource smoothing and estimate-vs-actual control during delivery
  - **Authority**: Highest for balancing and capacity-operations doctrine in the Execution package

- `docs/product/EXECUTION_READINESS_AUDIT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for Execution or Wdrozenie across runtime, operator control, workload, timeliness, risk and PMO-style oversight
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

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

- `docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical resolution of organization roles, project roles, steering-board membership, consultant overlay and initiative-effective roles for workflow and capabilities
  - **Authority**: Highest for project and initiative role-resolution doctrine

- `docs/product/INITIATIVE_TEAM_MEMBERSHIP_AND_PERMISSION_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical team-building, initiative staffing, membership-derived permissions and permission-safe collaboration inside project and initiative runtime
  - **Authority**: Highest for initiative team membership and permission-runtime doctrine

- `docs/product/CONSULTANT_OVERLAY_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: consultant overlay fields, visibility/audit rules, invitation model
  - **Authority**: High (consultant identity model)

- `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
  - **Owner**: Engineering
  - **Scope**: backend -> frontend capabilities contract for initiative UI enablement
  - **Authority**: Highest for UI capability contract

- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: normative status x role x CTA behavior (validated by tests)
  - **Authority**: High (workflow + CTA behavior)

- `docs/product/INITIATIVE_AUTOMATION_AND_TRANSITIONS.md`
  - **Owner**: Engineering
  - **Scope**: automated transitions (e.g. SCHEDULED -> EXECUTING by date), terminal/archival policies
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

- `docs/product/KPI_FULL_SYSTEM_CANON_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical cross-module doctrine for KPI across Initiatives, Results, Reporting, Goals/Scorecards, distribution surfaces, Finance linkage, alerts, action workflow and AI support
  - **Authority**: Highest for full-system KPI architecture, documentation read-order, cross-module ownership split and the premium rollout delta that remains above the historical bounded `P04` lane, including metric foundation, scorecards and reporting-adjacent enterprise surfaces

- `docs/product/RESULTS_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical Results ownership for KPI, scorecards, deviations, ROI, executive review and intervention flows
  - **Authority**: Highest for Results-native KPI truth and Results module doctrine

- `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical optional KPI-to-Finance linkage, reconciliation ownership and runtime bridge semantics
  - **Authority**: Highest for KPI to Finance linkage and reconciliation boundaries

### My Work and Radar

- `docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md`
  - **Owner**: Product Owner + Product + Engineering + UX
  - **Scope**: canonical product boundary and complete module contract for `Zlecenia`/Case Workspace nested in My Work, including direct-module work, Teresa-orchestrated durable work, planning, V8 execution, approvals, native artifacts and value
  - **Authority**: Highest for Case Workspace product-target behavior after frozen owner decisions in `docs/product/case-workspace/11_OWNER_DECISION_REGISTER.md`; V8 and owning-module SSOTs remain authoritative for their runtime and native-domain contracts

- `docs/product/MYWORK_RADAR_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the `MyWork Radar v8` package
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/MYWORK_RADAR_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product purpose, boundaries, promises and surface semantics for `Radar` as AI executive radar inside `MyWork`
  - **Authority**: Highest for `Radar v8` target state and product definition

- `docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: source-to-signal-to-insight runtime, object model, dedupe, localization and assembly of Radar payloads
  - **Authority**: Highest for Radar runtime semantics and processing spine

- `docs/product/MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: user relevance logic, consultant-style interpretation and next-move handoff from signals into system work
  - **Authority**: Highest for Radar personalization and action semantics

- `docs/product/MYWORK_RADAR_IDEA_AND_LEARNING_ACTIVATION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: how Radar activates ideas, notes, knowledge revisits, AI conversations and lightweight transformation momentum from high-value signals
  - **Authority**: Highest for Radar activation semantics beyond passive interpretation

- `docs/product/MYWORK_RADAR_BRIEFINGS_AND_DISTRIBUTION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: daily briefing, ranked streams, digest logic, selective notifications and distribution channels for Radar
  - **Authority**: Highest for Radar briefing and push semantics

- `docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: source classes, freshness, trust, dedupe, citation honesty and recommendation-strength guardrails for Radar
  - **Authority**: Highest for Radar source trust and governance doctrine

- `docs/product/MYWORK_HOME_V1_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: frozen `My Work > Home` shell, block registry, home-level role and placement of Radar inside the My Work landing experience
  - **Authority**: Highest for Home shell structure and frozen My Work Home positioning

- `docs/product/MY_WORK_INBOX_AND_SLA.md`
  - **Owner**: Product + Engineering
  - **Scope**: Inbox/My Work definition, SLA defaults, escalation rules, governance enforcement UX
  - **Authority**: Highest for execution control layer behavior

- `docs/product/NOTATKA_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the `Notatka v8` package
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/544-v81-mywork-deep-acceptance-pack.md` and `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/NOTATKA_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for `Notebook` as the durable AI-native knowledge surface inside `My Work`
  - **Authority**: Highest for Notebook target state, domain model and completeness contract

- `docs/product/NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical integration contract for notebook knowledge across chat, radar, idea, interview, execution, outputs, organization context and synced external sources
  - **Authority**: Highest for Notebook-to-platform integration and durable-note boundary rules

- `docs/product/NOTATKA_V8_WORKFLOW_MODEL.md`
  - **Owner**: Product + Engineering
  - **Scope**: end-to-end workflow model for notebook capture, enrich, connect, retrieve and convert lifecycle
  - **Authority**: Highest for Notebook workflow semantics

- `docs/product/NOTATKA_V8_AI_GOVERNANCE.md`
  - **Owner**: Product + Engineering
  - **Scope**: AI governance baseline, propose/review/accept model and trust rules for notebook operations
  - **Authority**: Highest for Notebook AI trust and audit behavior

### Idea Workspace

- `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: shared organization of the entire Idea system, one-idea-one-workspace doctrine, navigation layers, and orchestration rules across the four native canvases
  - **Authority**: Highest for Idea-system organization before canvas-specific specialization

- `docs/product/IDEA_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the whole Idea package across shared workspace doctrine, all four native work systems, and the final integration layer with the rest of Consultify
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical integration and promotion runtime for `Idea`, including inbound context, lateral cross-canvas movement, outbound artifact promotion, and traceability into downstream modules
  - **Authority**: Highest for Idea-to-platform integration, promotion behavior, and module-level traceability expectations

- `docs/product/IDEA_WORKSPACE_UI_UX_UNIFICATION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical UI/UX unification contract for the whole Idea module, including colors, state language, shell behavior, shared controls, and cross-canvas visual consistency
  - **Authority**: Highest for cross-canvas Idea UI/UX coherence and visual interaction consistency

- `docs/product/MINDMAP_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the full Mind Map package inside `Idea Workspace`
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/MINDMAP_V1_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for the `Mind Map` system, including direct tree growth, semantic node editing, interaction grammar, and stable placement inside the shared Idea shell
  - **Authority**: Highest for Mind Map product behavior

- `docs/product/MINDMAP_CHAT_SIDEKICK_AND_COLLABORATIVE_IDEA_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical chat-sidekick behavior, proposal doctrine, node/branch context contract, and collaboration-safe AI runtime for `Mind Map`
  - **Authority**: Highest for Mind Map chat integration and collaborative AI behavior

- `docs/product/MINDMAP_NAVIGATION_NODE_OPERATIONS_AND_AI_COPILOT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical navigation model for `Mind Map`, including branch drill-down, outline jump navigation, fast node operations, quick note access, and AI copilot behavior for branches and notes
  - **Authority**: Highest for Mind Map navigation, node interaction grammar, and branch/note AI assistance

- `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the full Whiteboard package inside `Idea Workspace`
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/WHITEBOARD_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for `Whiteboard`, including workshop identity, facilitation runtime, synthesis flows, missing functions, and the exact way those functions should be added to the system
  - **Authority**: Highest for Whiteboard product behavior

- `docs/product/PROCESS_FLOW_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the full Process Flow package inside `Idea Workspace`
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/PROCESS_FLOW_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for `Process Flow`, including process semantics, enterprise runtime gaps, interoperability, and the exact way missing capabilities should be added to the system
  - **Authority**: Highest for Process Flow product behavior

- `docs/product/PROCESS_FLOW_QUANTITATIVE_ANALYSIS_AND_AUTOMATION_INTELLIGENCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: quantitative-analysis layer for `Process Flow`, including VSM metrics, bottleneck analysis, automation candidate scoring, scenario comparison, and process intelligence promotion into ROI/execution artifacts
  - **Authority**: Highest for Process Flow numeric analysis, VSM intelligence, and automation-planning behavior

- `docs/product/TABLE_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the full Table package inside `Idea Workspace`, with explicit comparison to existing Consultify reality
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/TABLE_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for `Table`, including the final relational operating model, current-vs-missing capability split, and the exact way Airtable/Coda-class additions should be added to the current system
  - **Authority**: Highest for Table product behavior

- `docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: specialization of the Table package around relational schema governance, linked-data explainability, and docs-plus-data workflow composition over the same source of truth
  - **Authority**: Highest for Table relational-schema doctrine and docs-plus-data composition behavior

- `docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: exhaustive missing-capabilities matrix for the Table package, including remaining gaps across base shell, schema, relations, records, views, interfaces, forms, AI builder, input/import/sync, governance, and decision-support layers
  - **Authority**: Highest for the final explicit ledger of what still remains to be completed in the Table package

- `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
  - **Owner**: Product + Engineering
  - **Scope**: when economics is required, minimal fields, gate enforcement, reporting/baselines
  - **Authority**: Highest for economics governance and APPROVE gate blocking rules

### System architecture brief (north star)

- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
  - **Owner**: Product
  - **Scope**: system purpose, core modules order, role vocabulary, closed artefact list
  - **Authority**: Highest for "what the system is" and "what artefacts exist"

### Reports & Presentations (v3) - canonical generator specs

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
  - **Scope**: end-to-end Report Generator SSOT (R1-R4 canonical report types, wizard/builder, templates, AI narrative, RAG/escalation mapping, export quality gates PDF/DOCX/PPTX)
  - **Authority**: Superseded for Document runtime doctrine by `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`. Preserved as historical reference per archive-first policy. Report-class semantics (RAG, escalation, traceability) remain valid and are inherited by Document Studio.

### Consultify Document Studio (v1) - canonical document runtime

- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: productized Document runtime above the V8.1 substrate; three modes (generate without template, plan template, generate from approved template); document type taxonomy; Document Template Architect; Template Registry; Document Schema; Formatting & Style Engine; AI Document Editor with five edit scopes; Document QA Engine with ten categories; governance; lifecycle; MVP roadmap
  - **Authority**: Highest for Document runtime productization, document templates, document narrative planning, formatting and style governance, AI document editing semantics and document QA contract

- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`
  - **Owner**: Product + Engineering
  - **Scope**: catalog of supported document types in Document Studio, default audience, purpose, required and optional inputs, default sections, formatting class, approval rules, confidentiality defaults
  - **Authority**: Highest for the document type catalog inside Document Studio

- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: explicit current-vs-target gap analysis between the V8.1 substrate plus the existing report and presentation runtimes and Document Studio v1
  - **Authority**: Highest for Reuse / Extend / New labeling of Document Studio capabilities

- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: wave-by-wave engineering plan (MVP-1 through MVP-5) with file-level boundaries, acceptance criteria and validation method per wave
  - **Authority**: Highest for Document Studio engineering execution and wave sequencing

### V8.1 - native artifact runtime and outputs closure

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical v8.1 functional doctrine for contextual artifact generation, outputs library as the durable home, `My Work` as personal artifact view, and shared lifecycle across documents, presentations and sheets
  - **Authority**: Highest for v8.1 product behavior and next-phase outputs operating model

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: implementation-grade plan for the shared artifact substrate, format adapters, APIs, library surfaces, route strategy and rollout order for v8.1
  - **Authority**: Highest for v8.1 engineering execution and architecture boundaries

- `docs/product/V8_1_IMPLEMENTATION_START_PACKET.md`
  - **Owner**: Product + Engineering
  - **Scope**: safe execution brief for the implementation agent building `v8.1`, including guardrails, sequencing, compatibility rules and required evidence against the stabilized `v8` baseline
  - **Authority**: Highest for v8.1 delivery guardrails and implementation-safe startup context

- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: final closure drill-down for the `V8.1` artifact runtime and outputs scope, including doc-truth reconciliation, runtime closure, surface closure and evidence closure needed to reach honest 100%
  - **Authority**: Highest for `V8.1` completion sequencing under the frozen package, subordinate to `V8_V81_FINAL_COMPLETION_PROGRAM.md`

### Final closure of frozen V8.0 + V8.1

- `docs/product/V8_V81_FINAL_COMPLETION_PROGRAM.md`
  - **Owner**: Product + Engineering
  - **Scope**: final closure doctrine for the frozen combined `V8.0 + V8.1` package, including scope freeze, completion criteria, 4-track parallel execution model, and required final evidence before sign-off
  - **Authority**: Highest for final package-completion governance across product truth, execution truth, runtime truth, and evidence truth

- `docs/product/V8_V81_MANAGER_4_AGENT_ORCHESTRATION_PROMPT.md`
  - **Owner**: Product + Engineering
  - **Scope**: ready-to-use operating brief for the manager agent supervising 4 parallel workers across canon closure, runtime closure, surface closure, and evidence closure
  - **Authority**: Highest for manager-agent startup context and orchestration rules during final package completion

- `docs/product/work-packets/IMPLEMENTATION_CONTROL_BOARD.md`
  - **Owner**: Manager Agent
  - **Scope**: operational execution ledger for the frozen `V8.0 + V8.1` package, tracking current implementation/runtime/evidence progress after the 20-wave foundation
  - **Authority**: Highest for current closure-execution status reporting below final sign-off authority

- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
  - **Owner**: Manager Agent
  - **Scope**: mandatory area-by-area closure ledger for the frozen `V8.0 + V8.1` package, tracking scope, canonical docs, implementation mapping, runtime evidence, surface evidence, test/staging evidence, owner, next packet and blocker
  - **Authority**: Highest for package-wide closure status accounting required by the final completion program

- `docs/product/work-packets/V81_ARTIFACT_RUNTIME_EVIDENCE_PACK.md`
  - **Owner**: Manager Agent
  - **Scope**: focused evidence pack for the `V8.1` artifact runtime, Outputs Library, My Work outputs bridge, and explicit local-vs-staging sign-off boundaries
  - **Authority**: High for the local `V8.1` artifact-runtime proof set used by the closure ledger and final evidence assembly

- `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`
  - **Owner**: Manager Agent
  - **Scope**: explicit fulfilled/partial/deferred/blocked matrix for the `V8.1` artifact runtime and outputs scope, including final local closure verdict and remaining formal blockers
  - **Authority**: High for final `V8.1` local closure accounting under the `V8.1` final completion plan

- `docs/product/work-packets/DECISION_LOG_PROGRAM_CONTROL.md`
  - **Owner**: Manager Agent
  - **Scope**: explicit program-control decisions, scope freezes, authority reconciliation and sequencing rules for the frozen closure package
  - **Authority**: Highest for program-level decision history and authority-chain reconciliation during final closure

### Interview (v3 as-is + v6 redesign target)

- `docs/product/INTERVIEW_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the whole Interview package across V3, V6 and V8 docs
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

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

- `docs/product/INTERVIEW_PROGRAM_OPERATING_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical program, wave, coverage and research-operations model for Interview without changing the core session mechanics
  - **Authority**: Highest for Interview program orchestration and operating model around sessions

- `docs/product/INTERVIEW_DISCOVERY_AND_HYPOTHESIS_OPERATING_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical consulting-discovery model for Interview programs, including discovery brief, hypotheses, stakeholder weighting and decision-oriented inquiry
  - **Authority**: Highest for Interview as a consulting discovery operating model

- `docs/product/INTERVIEW_DISTRIBUTION_AND_PARTICIPANT_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: participant management, invitation flow, reminder policy, representation rules and participation funnel for Interview
  - **Authority**: Highest for Interview distribution and respondent runtime operations

- `docs/product/INTERVIEW_ASSIGNMENT_REVIEW_AND_CONFIRMATION_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical assignment lifecycle, reminder memory, escalation policy, answer validation, respondent confirmation and reviewer rework loop for Interview
  - **Authority**: Highest for Interview assignment operations, confirmation semantics and review-loop behavior

- `docs/product/INTERVIEW_AGENT_AND_ORG_CONTEXT_MEMORY_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical integration contract between Interview, Teresa-style agent guidance, text and voice answer capture, answer refinement, and promotion of approved outputs into organization context and vector knowledge
  - **Authority**: Highest for Interview agent integration and interview-derived organizational memory formation

- `docs/product/INTERVIEW_TEMPLATE_QUALITY_AND_METHODOLOGY_GUARDRAILS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: template checker, publish quality gates, methodology policies and promotion readiness for Interview templates
  - **Authority**: Highest for Interview template quality governance and methodology guardrails

- `docs/product/INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: analytics layers, cross-session rollups, contradiction handling and governed handoff from Interview findings into change-management work
  - **Authority**: Highest for Interview insight analytics and closed-loop transition semantics

- `docs/product/INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical model for classifying interview evidence, assigning confidence, and triangulating interview findings with other sources
  - **Authority**: Highest for Interview evidence class, confidence and triangulation doctrine

- `docs/product/INTERVIEW_CONTRADICTION_AND_CLIENT_READBACK_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime for contradiction handling, clarification loops, targeted re-interviews and client readback of interpreted meaning
  - **Authority**: Highest for Interview contradiction handling and client interpretation readback

- `docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: consent, access policy, retention, auditability and AI policy for Interview voice, transcript, evidence and knowledge reuse
  - **Authority**: Highest for Interview admin, privacy and AI governance

- `docs/product/INTERVIEW_BRANCHING_AND_FLOW_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: branching, routing, reusable flow fragments, path simulation and runtime path audit for Interview templates
  - **Authority**: Highest for Interview flow architecture beyond base conditional visibility

- `docs/product/INTERVIEW_REPORTING_AND_DASHBOARDS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: session, wave, program and executive reporting layers plus dashboard semantics for Interview
  - **Authority**: Highest for Interview reporting and dashboard behavior

- `docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: internal handoff, knowledge ingestion, export object classes and external delivery rules for Interview outputs
  - **Authority**: Highest for Interview integration and export semantics

- `docs/product/INTERVIEW_COLLABORATION_AND_SHARING_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: collaboration levels, sharing scopes, role overlays and permission boundaries around Interview programs, sessions and insights
  - **Authority**: Highest for Interview collaboration and sharing semantics

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
  - Assessment execution -> report -> initiative draft generation
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

- `docs/product/CHAT_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the whole Chat v8 package
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: one synthetic assessment of forgotten or still-missing functionality across chat, Teresa, application-agent runtime and execution-adjacent product behavior
  - **Authority**: Highest for cross-package completeness assessment of chat plus agent functionality

- `docs/product/ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical notification, reminder and reengagement model for pending review, async completion, proposal expiry and Teresa or agent return paths
  - **Authority**: Highest for async user-visible state and reentry semantics across chat and agent flows

- `docs/product/COMMUNICATION_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for internal and external communication, collaboration, channel policy, communication routing and message-to-work conversion
  - **Authority**: Highest for communication product identity and channel-governance semantics across the platform

- `docs/product/COMMUNICATION_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: readiness audit for communication across internal collaboration, external communication, channel routing and connector-backed delivery
  - **Authority**: Highest for current-state communication coverage and package read order

- `docs/product/INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical policy for internal communication, collaboration governance, channel ownership and message-to-work conversion
  - **Authority**: Highest for internal communication governance and collaboration rules

- `docs/product/EXTERNAL_COMMUNICATION_AND_CLIENT_CHANNELS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical model for external communication, client-facing channels, delivery updates and safe outbound messaging
  - **Authority**: Highest for client-safe and external communication semantics

- `docs/product/COMMUNICATION_CHANNEL_SYNC_AND_ROUTING_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical channel-binding, routing, connector-backed delivery and communication-to-work materialization model
  - **Authority**: Highest for communication routing and channel-sync semantics

- `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of calendar interoperability and PMO-grade time orchestration based on the local `Softs/Kalendarz` corpus and current platform goals
  - **Authority**: Highest for benchmark conclusions that shape the MyWork Calendar v8 package

- `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot for the calendar capability as a PMO-grade unified time surface with external sync
  - **Authority**: Historical navigation snapshot only; current closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md` and `docs/product/work-packets/evidence/549-v8-v81-package-exception-retirement.md`

- `docs/product/MYWORK_CALENDAR_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical product truth for the My Work calendar as a unified PMO-grade time surface across internal work and external calendar systems
  - **Authority**: Highest for MyWork Calendar v8 target state and object-model ownership

- `docs/product/MYWORK_CALENDAR_V8_AS_IS.md`
  - **Owner**: Product + Engineering
  - **Scope**: current-state interpretation of the existing calendar runtime, documentation and connector reality
  - **Authority**: Highest for as-is interpretation during calendar v8 work

- `docs/product/MYWORK_CALENDAR_V8_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: explicit gap matrix between the current calendar runtime and the target PMO-grade calendar system
  - **Authority**: Highest for prioritization and sequencing of calendar gaps

- `docs/product/MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: wave-by-wave plan for turning the current calendar baseline into a PMO-grade calendar with Outlook and Google synchronization
  - **Authority**: Highest for calendar v8 delivery sequencing

- `docs/product/AGENT_INTERRUPT_AND_RESUME_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical interrupt, resume, revalidation and recovery semantics for Teresa voice, proposal-only work and async agent flows
  - **Authority**: Highest for resumability and interruption truth across chat and agent runtime

- `docs/product/EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: one shared run, proposal, approval and apply spine for chat-started work, Teresa, execution runtime and module adapters
  - **Authority**: Highest for cross-surface execution and proposal truth

- `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: visible user, tenant-admin and operator-facing controls for personalization, memory access, private mode and deletion semantics
  - **Authority**: Highest for memory controls semantics exposed in product surfaces

- `docs/product/OPERATOR_SUPPORT_AND_FAILURE_RECOVERY_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: support-grade diagnosis, reconstruction and recovery doctrine for Teresa, proposals, applies and async agent failures
  - **Authority**: Highest for operator support and governed failure recovery across chat and agent runtime

- `docs/product/TEAM_APPROVAL_AND_SHARED_AGENT_REVIEW_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: shared review, delegated approval ownership and team-safe proposal collaboration for Teresa and agent-generated work
  - **Authority**: Highest for team approval and shared review semantics in chat and agent flows

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

- `docs/product/CHAT_APPLICATION_AGENT_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime for chat as application agent, with Teresa as right-rail copilot, proposal-only app work and module adapter routing
  - **Authority**: Highest for chat-started application-agent runtime semantics below full execution-agent scope

- `docs/product/AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical proposal-only contract for AI work inside the application without hidden apply rights
  - **Authority**: Highest for proposal-only app-work semantics across Teresa and related in-app copilot flows

- `docs/product/TERESA_VOICE_CHAT_RAIL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: right-side Teresa voice rail inside chat, including dual voice modes, state machine, controls and proposal integration
  - **Authority**: Highest for Teresa-specific in-chat voice surface behavior

- `docs/product/VOICE_TRUST_AND_APPROVALS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: trust, review and approval semantics for voice-driven chat and Teresa copilot flows
  - **Authority**: Highest for keeping voice flows aligned with proposal and approval doctrine

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

- `docs/product/TERESA_ASSISTANT_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: named in-platform assistant contract for Teresa including persona, scope, memory, voice posture and tenant-safe behavior across chat and interview-adjacent work
  - **Authority**: Highest for Teresa as a productized named assistant inside Consultify

- `docs/product/INTERVIEW_AGENT_GUIDED_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: Teresa-guided runtime for asking questions, capturing answers and supporting interview flows without replacing canonical interview mechanics
  - **Authority**: Highest for Teresa-specific guided interview behavior inside the Interview package

- `docs/product/TOOLS_AND_ASSESSMENT_AGENT_ADAPTERS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical module-adapter contract for Teresa working with Tools and Assessment through typed proposals and guided steps
  - **Authority**: Highest for application-agent adapter semantics across Tools and Assessment

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

- `docs/product/AI_LLM_MODEL_MANAGEMENT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical analysis and build direction for multi-LLM management, including model profiles, task-shape routing, effort policy, context classes, lifecycle management and cost-aware execution
  - **Authority**: Highest for next-step design of cross-app model selection and execution-profile management

- `docs/product/MULTI_LLM_AND_MULTI_AGENT_READINESS_AUDIT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: one synthetic readiness verdict for combined multi-LLM management, multi-agent orchestration, chat-started application-agent runtime and virtual-worker control-plane maturity
  - **Authority**: Highest for integrated readiness assessment across the multi-LLM plus multi-agent architecture

### AI leader parity architecture package (cross-cutting canonical)

- `docs/product/AI_CORE_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical readiness audit, read order, ownership map and safe sequencing for further AI-core-dependent documentation work
  - **Authority**: Highest for AI core documentation navigation, readiness assessment and downstream documentation gating

- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: master parity package for 12 cross-cutting AI architecture areas missing between current `V8` suites and leader-grade AI operating environments
  - **Authority**: Highest for package structure, prioritization, ownership map and cross-package hardening status of the parity architecture program

- `docs/product/AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime contract across workspace, project, conversation, run and artifact contexts
  - **Authority**: Highest for cross-surface workspace/project runtime semantics

- `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical architecture for connectors, enterprise search, ACL-aware retrieval, sync, freshness and source audit
  - **Authority**: Highest for connector lifecycle, enterprise search governance and retrieval-source control shared across AI consumers

- `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of mature sync and integration platforms based on the local `Softs/synchronizacja` corpus including `Boomi`, `Workato` and `MuleSoft`
  - **Authority**: Highest for external benchmark conclusions that shape the sync package

- `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: historical readiness audit snapshot of external synchronization capability across calendars, communication, PM systems, cloud docs, knowledge sources and AI provider ecosystems
  - **Authority**: Historical navigation snapshot only; current Wave 1 closure authority lives in `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`

- `docs/product/AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: cross-vendor standards for sync, interoperability, webhooks, reconciliation, connector modes, cloud-object behavior and AI-first work with external systems
  - **Authority**: Highest for shared sync/interoperability doctrine across connectors, cloud integrations, remote tools and external-system runtime behavior

- `docs/product/CONNECTOR_EVENT_CATALOG_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical connector event taxonomy, event envelope, idempotency doctrine, runtime recovery and replay semantics for sync, reconciliation and publish flows
  - **Authority**: Highest for connector runtime event naming and persisted event semantics

- `docs/product/EXTERNAL_OBJECT_LINEAGE_AND_PROVENANCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical identity, version, mirror snapshot, freshness and transformation-lineage model for external objects consumed or published by the platform
  - **Authority**: Highest for external object lineage and provenance continuity across sync, retrieval, proposals and artifacts

- `docs/product/CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical sync modes, field authority model, direction semantics, conflict classes and conflict-resolution policy for external integrations
  - **Authority**: Highest for connector sync-mode semantics and conflict-handling behavior

- `docs/product/MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical trust model for MCP servers, remote tool providers, credential delegation, remote mutation policy and external trust boundaries
  - **Authority**: Highest for trust admission and execution policy of remote MCP servers and external tool runtimes

- `docs/product/CLOUD_FILES_AND_EXTERNAL_DOCS_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical runtime semantics for external docs and files including access, preview, extraction completeness, live/mirrored freshness and publish/share behavior
  - **Authority**: Highest for cloud-file and external-document runtime behavior across connectors, retrieval and artifact publishing

- `docs/product/CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical admin, operator, support and user-explanation surfaces for connector health, failures, incident reconstruction and degraded-state explainability
  - **Authority**: Highest for connector operator/support visibility and explanation surfaces

- `docs/product/CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical event-channel, binding, payload-schema, compatibility and schema-evolution model for event-driven connectors and publish/subscribe contracts
  - **Authority**: Highest for event-contract semantics and schema/version governance in sync architecture

- `docs/product/CONNECTOR_DESIGN_RUNTIME_AND_PROMOTION_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical design-time assets, runtime deployments, review/promote/rollback lifecycle and drift model for connector packages
  - **Authority**: Highest for design/runtime separation and deployment-governance semantics of integration assets

- `docs/product/CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical timeout, retry, circuit-breaker, ingress-limit, backpressure and edge-SLO policy for connector and webhook runtime
  - **Authority**: Highest for edge reliability and gateway protection semantics across sync surfaces

- `docs/product/CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: implementation-grade backend aggregate model for provider catalog, connector installations, mappings, runtime runs, external objects and MCP/remote-tool audit
  - **Authority**: Highest for backend domain semantics of the sync package

- `docs/product/CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: implementation-grade control-plane, webhook-ingress, operator-runtime and support-read API contract for the sync backend
  - **Authority**: Highest for API surface and control-plane contract of the sync package

- `docs/product/work-packets/V8_PO1_PUBLIC_API_KEYS_AND_USER_LEVEL_SYNC_REPLATFORM_2026-04-02.md`
  - **Owner**: Product + Engineering
  - **Scope**: delivery-grade plan for user-level integrations SSOT, admin monitoring-only sync posture, API keys productization, and Public API v1 (Tasks + Calendar)
  - **Authority**: Highest for PO1 implementation scope/DoD and the intended Admin-vs-Settings ownership split for integrations + API keys

- `docs/product/INTEGRATION_CONNECTOR_SPECS.md`
  - **Owner**: Product + Engineering
  - **Scope**: complete technical specification for all 20 integration connectors — OAuth flows, scopes, API endpoints, rate limits, Node.js SDKs, token storage, webhook patterns, and environment variables for Gmail, Outlook, Slack, Teams, Google Calendar, Outlook Calendar, Apple Calendar, Calendly, Jira, Asana, Trello, ClickUp, Monday.com, Notion, Todoist, Linear, Google Drive, OneDrive, Dropbox, Box
  - **Authority**: Highest for connector implementation details, required scopes, and authentication flows

- `docs/product/CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: implementation-grade queue, worker, job, dead-letter, retention and storage model for connector runtime
  - **Authority**: Highest for runtime execution and storage semantics of the sync package

- `docs/product/CONNECTOR_DB_SCHEMA_AND_MIGRATION_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: implementation-grade canonical table, key, index and migration contract for converging current sync schema into the V8 backend model
  - **Authority**: Highest for sync-package database schema and migration semantics

- `docs/product/CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: code-informed explanation of the current sync connection methodology in the repo and the target consolidated connection flow
  - **Authority**: Highest for interpreting current-to-target sync connection behavior across code and documentation

- `docs/product/CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: wave-by-wave refactor program for converging current sync code paths into one canonical backend, including epics, cutover order and migration safety rules
  - **Authority**: Highest for delivery sequencing and cutover strategy of the sync package

- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical draft, preview, version trace and publish lifecycle for AI-produced artifacts
  - **Authority**: Highest for cross-module AI artifact runtime semantics

- `docs/product/AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical job lifecycle for background, scheduled, batch and long-running AI work
  - **Authority**: Highest for non-interactive AI runtime semantics and long-running AI work classes

- `docs/product/AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical least-privilege model for AI tools, delegation, risk classes and approval-aware tool access
  - **Authority**: Highest for AI tool governance and delegation safety

- `docs/product/AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical AI ops and release discipline for evals, release bundles, canary, rollback, deprecation and org impact
  - **Authority**: Highest for AI release-management, rollout discipline and operator-control semantics

- `docs/product/AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical review, approval, escalation and override doctrine for AI work
  - **Authority**: Highest for cross-surface human-in-the-loop governance semantics

- `docs/product/AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical collaboration, sharing and publishing lifecycle for AI outputs and artifacts
  - **Authority**: Highest for cross-surface AI collaboration semantics

- `docs/product/AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical mapping from identity and roles into AI scope and consumer visibility
  - **Authority**: Highest for AI identity/scope resolution semantics

- `docs/product/AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical workload taxonomy and SLA mapping for latency, reliability, cost and execution mode
  - **Authority**: Highest for AI workload classes and shared SLA vocabulary

- `docs/product/AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical lifecycle for ephemeral, working and durable memory including freshness, retention and deletion cascade
  - **Authority**: Highest for memory lifecycle semantics across AI consumers

- `docs/product/AI_TENANT_MEMORY_BOOTSTRAP_AND_ASSIGNMENT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical bootstrap, ownership, policy defaults and assistant memory assignment model for new tenants and tenant-scoped AI memory layers
  - **Authority**: Highest for tenant memory bootstrap and assistant-to-tenant memory assignment semantics

- `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: public/landing assistant contract for Anna including persona, voice, knowledge boundaries, session memory limits and separation from tenant-bound assistants
  - **Authority**: Highest for Anna as a landing-page and public sales assistant

### Virtual workers control plane

- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical entry point, read order and readiness assessment for the `Superadmin -> Virtual Workers` package
  - **Authority**: Highest for package framing and readiness status of virtual workers control-plane documentation

- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_BENCHMARK_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark translation of leader agent-platform patterns into target needs for `consultify` virtual workers
  - **Authority**: Highest for completeness benchmarking of the virtual workers control-plane package

- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical target model for `Superadmin -> Virtual Workers`, including registry, profiles, knowledge, tools, memory, channels, evals, rollout and audit
  - **Authority**: Highest for target control-plane behavior of virtual workers

- `docs/product/VIRTUAL_WORKERS_CONVERSATION_INTELLIGENCE_AND_PRIVACY_ANALYTICS_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical privacy-first analytics contract for aggregated topic, duration, channel, outcome and knowledge-gap reporting across virtual worker conversations
  - **Authority**: Highest for virtual worker conversation intelligence and transcript-light analytics semantics

- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: phased implementation plan for evolving the current `Virtual Workers` module into a leader-grade superadmin control plane
  - **Authority**: Highest for implementation sequencing of the virtual workers control-plane package

- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical trust contract for citations, evidence, provenance, routing explanation and support-visible explainability
  - **Authority**: Highest for cross-surface AI output trust semantics

### Core AI hardening rule

For `Chat v8`, `Execution Agent v8`, `Knowledge RAG v8`, `Multi-Agent v8` and `AI_LLM_MODEL_MANAGEMENT_V8`:

- local package docs still own product/domain behavior,
- parity package docs own cross-cutting architecture,
- `AI_CORE_V8_READINESS_AUDIT.md` owns read order and documentation readiness gating,
- benchmark, gap matrix and implementation docs must stay synchronized with both when hardening status changes.

- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
  - **Owner**: Engineering
  - **Scope**: context builder, orchestration and runtime agent/mode pipeline
  - **Authority**: High for implementation details of AI orchestration

- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
  - **Owner**: Product + Engineering
  - **Scope**: evidence-led deep research architecture, review model and runtime expectations
  - **Authority**: Highest for deep research evidence semantics

### Agent execution domain cleanup

- `docs/product/AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: master implementation order, dependency model and build-now execution plan that unifies `Execution Agent v8` and `Knowledge RAG v8` into one delivery program
  - **Authority**: Highest for cross-package sequencing and implementation-readiness across agent + knowledge architecture

- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical component model for supervisor-led multi-agent work management, typed delegation, task graphs, branch isolation, merge semantics and observability
  - **Authority**: Highest for multi-agent orchestration semantics inside the execution architecture

- `docs/product/AGENT_EXECUTION_DOMAIN_MAP_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical separation between execution agent, audit agents, virtual workers and RAG management; defines correct foundation for future execution-agent work
  - **Authority**: Highest for agent-domain taxonomy and next-step scoping before `Execution Agent` design

- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical concept for a chat-started execution agent that plans, proposes, approves and executes work across application artifacts
  - **Authority**: Highest for `Execution Agent` target concept and product/runtime boundaries

- `docs/product/AGENT_EXECUTION_V8_AS_IS.md`
  - **Owner**: Product + Engineering
  - **Scope**: runtime truth of current execution-related patterns, reusable foundations, fragmented proposal systems and non-canonical/legacy execution-adjacent layers
  - **Authority**: Highest for current-state assessment of execution-agent foundations

- `docs/product/AGENT_EXECUTION_V8_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: prioritized gap analysis between current runtime and target execution-agent model
  - **Authority**: Highest for execution-agent gap prioritization and sequencing logic

- `docs/product/AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: build-ready workstreams, waves, acceptance criteria and sequencing for execution-agent rebuild
  - **Authority**: Highest for execution-agent implementation sequencing

- `docs/product/AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md`
  - **Owner**: Product + Engineering
  - **Scope**: unified next-phase delivery program across execution spine, adapters, tool/HITL governance, multi-LLM resolver layer, multi-agent work manager, AI ops/release, observability and Virtual Workers hardening; maps phases to existing v8 plans without replacing them
  - **Authority**: Highest for cross-package sequencing of the combined agentic stack (use together with execution implementation plan, master plan and multi-LLM readiness audit)

### Knowledge / RAG governance

- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical ownership, scope, sharing and governance model for user-private and organization-shared knowledge/RAG
  - **Authority**: Highest for knowledge/RAG target model and security boundaries

- `docs/product/KNOWLEDGE_RAG_V8_BENCHMARK.md`
  - **Owner**: Product + Engineering
  - **Scope**: benchmark of mature knowledge/RAG system concerns and missing areas still to be covered in `consultify`
  - **Authority**: Highest for completeness benchmarking of the knowledge/RAG package

- `docs/product/KNOWLEDGE_RAG_V8_AS_IS.md`
  - **Owner**: Product + Engineering
  - **Scope**: runtime truth of current memory, org knowledge, document corpus, retrieval engine and worker knowledge foundations
  - **Authority**: Highest for current-state assessment of knowledge/RAG foundations

- `docs/product/KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
  - **Owner**: Product + Engineering
  - **Scope**: prioritized gap analysis between current knowledge/RAG package and mature enterprise-grade target state
  - **Authority**: Highest for knowledge/RAG completeness gaps and hardening priorities

- `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
  - **Owner**: Product + Engineering
  - **Scope**: build-ready strategy and sequencing for user-private knowledge, organization-shared knowledge, promotion workflow and retrieval gateway unification
  - **Authority**: Highest for knowledge/RAG implementation sequencing

- `docs/product/KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
  - **Owner**: Product + Engineering
  - **Scope**: canonical architecture for short-term / working memory, active document sets, compaction, issue summaries and run-scoped context assembly across AI consumers
  - **Authority**: Highest for working-memory design and context-budget semantics inside the knowledge/RAG package

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

### Historical closure baselines (not current runtime truth)

- `docs/product/V8_POST_20_WAVE_CLOSURE_PROGRAM.md`
  - Historical execution baseline from the moment the repo still treated the V8 runtime as largely unwired. Keep for baseline comparison, not for current closure truth where later execution evidence or code contradicts it.

- `docs/product/work-packets/POST_20_WAVE_CLOSURE_AUDIT.md`
  - Historical audit snapshot from 2026-03-23. Useful for baseline gap framing, but superseded by later execution-board reports and repo/runtime evidence for current closure status.

### Generated / internal working artifacts

- `docs/functional_requirements_full.txt`
  - May be useful as a reference, but is not a governance source of truth.

## Rules

- Canonical docs must not contradict each other.
- If a canonical doc changes, update cross-links and any impacted canonical docs in the same change set.
- If a legacy/snapshot doc becomes relevant, either:
  - promote it by moving/rewriting it into the canonical set, or
  - add a clear note that it is historical and link to the canonical replacement.
