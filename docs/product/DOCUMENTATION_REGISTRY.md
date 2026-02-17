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
