# CONSULTINITY – System Architecture Brief (Canonical)

## 1. Purpose of the system

Consultinity is an AI-supported transformation execution system, combining:

- consulting workflow
- PMO discipline
- decision governance
- initiative execution
- benefits realization tracking

The system does **not** replace management. It structures decisions, execution and accountability.

**Core principle:** one initiative = one object = one lifecycle.

## 1.1 System axis (non-negotiable)

The **Initiative** is the central system object. Everything else:

- tools
- assessments
- tasks
- decisions
- budgets / economics
- benefits tracking
  either creates an initiative, enriches it, or closes it out.

## 1.2 Initiative sources (fixed)

There are **two equal sources of initiatives**:

- **Tools**: strategic/operational tools can generate initiatives directly
- **Assessments**: assessments end with an **Assessment Report** which creates initiatives

Rules:

- No “insights from tools”
- Insights originate only from **Interview** (fed by Chat conversation) and are used as context (not as a direct initiative source)

## 2. Core modules (system flow order)

The system consists of the following modules, executed sequentially but connected by shared artefacts:

1. Chat
2. Interview
3. Tools
4. Assessment
5. Initiatives
6. Implementation
7. Benefits
8. Reporting

> Note: Some UI modules can exist as cross-cutting “support” areas (e.g., personal inbox, economics analysis), but they must not break the core flow above.

## 3. System roles

### 3.1 System roles (access & permissions)

**Owner**

- Billing owner
- Full access
- Cannot delete own account

**Admin**

- User & permission management
- System configuration
- Project setup

**User**

- Access based on project role
- No system-level configuration

> Canonical, precise role semantics are defined in:
>
> - `docs/product/ROLES_MODEL.md` (system + project + initiative effective roles)
> - `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md` (project roles + steering board)
> - `docs/product/CONSULTANT_OVERLAY_MODEL.md` (consultant overlay)

### 3.1.1 Where system roles act (scope)

| System role | Scope                                        | What they do                                        | What they don’t need to do                                |
| ----------- | -------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Owner       | global system + organization                 | billing, access to all data, instance governance    | does not need to work operationally inside projects       |
| Admin       | system configuration + project configuration | create projects, assign project roles, manage users | does not need to be a decision maker for initiative gates |
| User        | projects only                                | act only within assigned project roles              | no system-level configuration                             |

### 3.2 Project roles (RACI-based)

This document uses a simplified business vocabulary.

The **canonical project role set (8)** used for permissions/capabilities and governance is defined in:

- `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`

Important clarifications:

- **Consultant is an overlay**, not a separate project role universe (see `docs/product/CONSULTANT_OVERLAY_MODEL.md`).
- Initiative gates and UI permissions are driven by backend **effective roles** + **capabilities** contract
  (see `docs/product/ROLES_MODEL.md` and `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`).

### 3.2.1 Where project roles act (modules)

| Project role                  | Where they act (modules)                  | Role in the process                                                     |
| ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Sponsor                       | Initiatives (decision moments)            | strategic decisions and gate approvals                                  |
| Project Leader                | Initiatives, Implementation               | operational delivery ownership; coordination and escalation             |
| Initiative Owner              | Initiatives, Implementation               | owns initiative content, readiness, progress reporting                  |
| Team Member                   | Implementation                            | executes assigned work; updates progress                                |
| PMO _(invoked)_               | Initiatives, Implementation, Reporting    | standards control; schedule/baselines; closure checks                   |
| Portfolio Owner _(invoked)_   | Initiatives (escalations), Reporting      | investment-level decisions across projects                              |
| Business Owner (Benefits)     | Benefits                                  | benefits acceptance and KPI outcome ownership                           |
| Steering Committee (optional) | Initiatives (approval gates)              | board approvals/escalations when enabled                                |
| Consultant overlay            | Interview, Tools, Assessment, Initiatives | advisory/structuring work; visible & auditable; not authority by itself |
| AI System                     | everywhere (support layer)                | analysis, summaries, recommendations; never decides                     |

## 4. Artefacts (canonical lists)

This section defines two closed lists:

- **(A) Core governance artefacts** — drive the system axis and governance rules
- **(B) Supporting / document artefacts** — enable work (notes, decks, workspaces, finance runs) without breaking the axis

No additional artefacts are allowed without explicit design extension.

### 4.1 (A) Core governance artefacts (final, closed list)

1. Insight (Interview artefact; context)
2. ToolSession (Tools artefact; the canonical source snapshot)
3. Assessment Report (Assessment module only; canonical source snapshot)
4. Initiative (central)
5. Task (operational; always linked to an initiative)
6. Decision (governance; gate-required; auditable)
7. Economic Analysis (tool; linked to initiative)
8. Benefits / Tracking Records (Benefits module)

### 4.2 (B) Supporting / document artefacts (v3, closed list)

These artefacts are “work surfaces” and outputs, but they must remain traceable and must not create initiatives directly
(see `docs/product/SOURCE_TRACEABILITY_SPEC.md`).

1. NotebookPage (Living Notebook)
2. Workspace (visual canvas)
3. Report (final report artefact)
4. Presentation / Deck (final deck artefact)
5. FinancialModel (import + mapping + snapshots)
6. FinancialAnalysisRun (saved analysis)
7. FinancialScenario (saved scenario / assumptions)
8. Valuation (valuation run)
9. InvestmentCase (per-initiative investment analysis)

### 4.3 Artefact semantics (canonical)

This section defines “what an artefact is” and where it is created/used.

1. **Insight**

- **Definition**: a structured insight derived from interview/conversation
- **Created in**: Interview (fed by Chat context)
- **Created by**: Consultant (AI can propose)
- **Used for**: context; informs Tools/Assessment/Initiatives
- **Rule**: does not create initiatives directly

2. **ToolSession (Tools output snapshot)**

- **Definition**: a source snapshot of one execution of a specific consulting tool (e.g., SWOT, Value Pool)
- **Created in**: Tools (and also via “MyWork seed → ToolSession(MYWORK)” when needed for traceability)
- **Created by**: Consultant/User (AI can structure; never modifies a finalized source)
- **Used for**: canonical source of initiative creation (after finalization), plus traceability for report/presentation outputs
- **Rule**: tools do not create insights
- **Persistence**: stored as a ToolSession snapshot (see `docs/product/RESET_ERD_CONSULTINITY.md`)

3. **Assessment Report**

- **Definition**: formal diagnostic report (e.g., SIRI, DRD)
- **Created in**: Assessment
- **Created by**: user team; AI aggregates
- **Status**: Draft → Review → Final (locked)
- **Used for**: source of initiatives; non-editable after closure

4. **Initiative (central artefact)**

- **Definition**: transformation unit = problem + plan + execution + effect
- **Lives in**: Initiatives → Implementation → Benefits
- **Created from**: Tools, Assessment
- **Always contains**: problem, goal, scope, KPI, risks, timeline, assigned team, status
- **Accumulates over time**: tasks, decisions, financial analyses

5. **Task**

- **Definition**: unit of operational work
- **Lives in**: Initiatives and Implementation
- **Rule**: always linked to an initiative
- **Created/edited by**: Initiative Owner, PMO, users (within permissions)
- **Statuses**: Open / In Progress / Blocked / Done

6. **Decision**

- **Definition**: formal management decision (governance)
- **Lives in**: Initiatives & Implementation
- **Created when**: approvals, changes, escalations
- **Contains**: options, decider, date, impact (scope/budget/timeline)
- **Statuses**: Proposed / Approved / Rejected / Escalated
- **Rule**: required on gates; retained for audit

7. **Economic Analysis**

- **Definition**: economics tool (multiple models/templates), not one rigid form
- **Lives in**: Initiatives & Implementation
- **Result**: linked to initiative; informs decisions

8. **Benefits / Tracking Records**

- **Definition**: Benefits artefacts used to evaluate outcomes
- **Created in**: Benefits
- **Contains**: financial + operational assessment, plan vs actual, ex-post conclusions

## 5. Work process (where what happens)

Chat → Interview (Insights) → Tools (ToolSession → Initiative) → Assessment (Assessment Report → Initiative) → Initiatives (planning + decisions) → Implementation (tasks + execution) → Benefits (evaluation + outcomes) → Reporting

## 6. System rules (non-negotiable)

- One initiative is central and stable in format across modules
- Artefacts do not duplicate each other
- Decisions are explicit and auditable
- Implementation is flexible but controlled
- Benefits closes the cycle

## Related (canonical) documents

- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `docs/flows/core/INITIATIVE_MANAGEMENT_FLOW.md`
- `docs/flows/core/DECISION_SYSTEM_FLOW.md`
- `docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/flows/discovery/DISCOVERY_CONSULTANT_FLOW.md`
