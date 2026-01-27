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

### 3.1.1 Where system roles act (scope)
| System role | Scope | What they do | What they don’t need to do |
|---|---|---|---|
| Owner | global system + organization | billing, access to all data, instance governance | does not need to work operationally inside projects |
| Admin | system configuration + project configuration | create projects, assign project roles, manage users | does not need to be a decision maker for initiative gates |
| User | projects only | act only within assigned project roles | no system-level configuration |

### 3.2 Project roles (RACI-based)
This is the canonical project role set for governance and UX.

**Consultant**
- works on tools and assessments
- edits initiatives
- never approves gates

**Initiative Owner**
- responsible for initiative content and completeness
- prepares initiatives for decisions

**Project Sponsor / Business Owner**
- decides on business sense
- approves strategic transitions

**PMO**
- manages roadmap and schedule
- ensures timeline control
- closes delivery

**Steering Committee (optional)**
- approves key initiatives (strategic/financial)

**AI System**
- supports analysis, summaries, recommendations
- never a decision maker

### 3.2.1 Where project roles act (modules)
| Project role | Where they act (modules) | Role in the process |
|---|---|---|
| Project Sponsor / Business Owner | Initiatives (decision moments), Benefits (benefits acceptance) | strategic decisions and gate approvals |
| Initiative Owner | Initiatives, Implementation | owns initiative lifecycle content and readiness |
| Consultant | Interview, Tools, Assessment, Initiatives (draft & review) | structures problems; creates outputs; never decides |
| PMO | Initiatives, Implementation | roadmap, schedule, delivery closure |
| Steering Committee (optional) | Initiatives (approval gate) | approves key initiatives (strategic/financial) |
| AI System | everywhere (support layer) | analysis, summaries, recommendations; never decides |

## 4. Core artefacts (final, closed list)
No additional artefacts are allowed without explicit design extension.

### 4.1 Artefacts by type
1) Insight (Interview artefact; context)
2) Tool Output (Tools artefact; can create initiative drafts)
3) Assessment Report (Assessment module only)
4) Initiative (central)
5) Task (operational; always linked to an initiative)
6) Decision (governance; gate-required; auditable)
7) Economic Analysis (tool; multiple templates; linked to initiative)
8) Benefits / Tracking Records (Benefits module)

### 4.2 Artefact semantics (canonical)
This section defines “what an artefact is” and where it is created/used.

1) **Insight**
- **Definition**: a structured insight derived from interview/conversation
- **Created in**: Interview (fed by Chat context)
- **Created by**: Consultant (AI can propose)
- **Used for**: context; informs Tools/Assessment/Initiatives
- **Rule**: does not create initiatives directly

2) **Tool Output**
- **Definition**: output of a specific consulting tool (e.g., SWOT, Value Pool)
- **Created in**: Tools
- **Created by**: Consultant/User (AI can structure)
- **Used for**: can create initiative draft (`DRAFT`)
- **Rule**: tools do not create insights
- **Persistence**: stored as a ToolSession snapshot (see `docs/product/RESET_ERD_CONSULTINITY.md`)

3) **Assessment Report**
- **Definition**: formal diagnostic report (e.g., SIRI, DRD)
- **Created in**: Assessment
- **Created by**: user team; AI aggregates
- **Status**: Draft → Review → Final (locked)
- **Used for**: source of initiatives; non-editable after closure

4) **Initiative (central artefact)**
- **Definition**: transformation unit = problem + plan + execution + effect
- **Lives in**: Initiatives → Implementation → Benefits
- **Created from**: Tools, Assessment
- **Always contains**: problem, goal, scope, KPI, risks, timeline, assigned team, status
- **Accumulates over time**: tasks, decisions, financial analyses

5) **Task**
- **Definition**: unit of operational work
- **Lives in**: Initiatives and Implementation
- **Rule**: always linked to an initiative
- **Created/edited by**: Initiative Owner, PMO, users (within permissions)
- **Statuses**: Open / In Progress / Blocked / Done

6) **Decision**
- **Definition**: formal management decision (governance)
 - **Lives in**: Initiatives & Implementation
 - **Created when**: approvals, changes, escalations
 - **Contains**: options, decider, date, impact (scope/budget/timeline)
 - **Statuses**: Proposed / Approved / Rejected / Escalated
 - **Rule**: required on gates; retained for audit

7) **Economic Analysis**
- **Definition**: economics tool (multiple models/templates), not one rigid form
- **Lives in**: Initiatives & Implementation
- **Result**: linked to initiative; informs decisions

8) **Benefits / Tracking Records**
- **Definition**: Benefits artefacts used to evaluate outcomes
- **Created in**: Benefits
- **Contains**: financial + operational assessment, plan vs actual, ex-post conclusions

## 5. Work process (where what happens)
Chat → Interview (Insights) → Tools (Tool outputs → Initiative) → Assessment (Report → Initiative) → Initiatives (planning + decisions) → Implementation (tasks + execution) → Benefits (evaluation + outcomes) → Reporting

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

