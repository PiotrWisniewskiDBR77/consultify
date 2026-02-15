# Initiative Governance Model (Lifecycle, Gates, Roles)

## Purpose

This document defines the **canonical governance model** for initiatives in Consultify:

- lifecycle states and which module “owns” each state
- decision gates (what blocks transitions)
- role responsibility (RACI)
- UX permissions (who can do what in the UI)

This is written in **business vocabulary** (roles and gates). Engineering should treat this as the **source of truth for UI locks/buttons and workflow rules**.

## Role vocabulary (canonical)

This document uses the **canonical project roles & governance** vocabulary from:

- `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`
- `docs/product/CONSULTANT_OVERLAY_MODEL.md` (overlay visibility; not authority)

- **Sponsor (`SPONSOR`)**: accountable for strategic decisions; final go/no-go and investment approval.
- **Project Leader (`PROJECT_LEADER`)**: operational delivery commander; plans, coordinates, escalates.
- **Initiative Owner (`INITIATIVE_OWNER`)**: owns initiative readiness/content and progress reporting.
- **Team Member (`TEAM_MEMBER`)**: executes assigned work and updates progress.
- **PMO (`PMO`)** _(invoked)_: standards/completeness control; scheduling/baselines; closure checks.
- **Portfolio Owner (`PORTFOLIO_OWNER`)** _(invoked)_: investment-level escalations across projects.
- **Business Owner (Benefits) (`BUSINESS_OWNER`)**: owns benefits/KPI outcomes and benefits acceptance gate.
- **Steering Committee (`STEERING_COMMITTEE`)**: optional board approvals/escalations when Steering Board is enabled.
- **Consultant overlay**: advisory identity/visibility overlay (see `docs/product/CONSULTANT_OVERLAY_MODEL.md`); does not grant authority by itself.
- **AI System**: supports analysis/summarization/recommendations; never decides.

> Note: legacy terms like “Transformation Lead” / “Execution Lead” map to the canonical set above
> (typically `PROJECT_LEADER`/`PMO` vs `TEAM_MEMBER` execution). Canonical definitions live in `docs/product/ROLES_MODEL.md`.

> Note: “Approver” below refers to the governance role that owns the gate decision.

## 1) Lifecycle table (module, status, approver, intent)

|   # | Module             | Status            | Approver                      | What happens in this status (≤10 words)            |
| --: | ------------------ | ----------------- | ----------------------------- | -------------------------------------------------- |
|   1 | Tools / Assessment | DRAFT             | System                        | Initiative draft auto-created from sources         |
|   2 | Initiatives        | EDITING           | No approval                   | Single initiative form enriched and completed      |
|   3 | Initiatives        | REVIEW            | No approval                   | Prepared for PROMOTE decision gate                 |
|   4 | Initiatives        | PROMOTED (Gate 1) | Project Sponsor               | Promote: “should this be an initiative?”           |
|   5 | Initiatives        | PLANNING          | No approval                   | Scope/KPI/dependencies/timeline prepared           |
|   6 | Initiatives        | APPROVED (Gate 2) | Sponsor or Steering Committee | Approve investment and resource commitment         |
|   7 | Initiatives        | SCHEDULED         | PMO                           | Scheduled on roadmap and timeline baseline         |
|   8 | Implementation     | EXECUTING         | No approval                   | Tasks, decisions, budget updates executed          |
|   9 | Implementation     | BLOCKED           | No approval                   | Execution blocked; escalations and decisions apply |
|  10 | Implementation     | DONE              | PMO                           | Close execution: delivery completion confirmed     |
|  11 | Benefits           | TRACKING (Gate 4) | Business Owner                | Benefits acceptance: start measuring effects       |
|  12 | Any                | CANCELLED         | Project Sponsor               | Initiative formally stopped with rationale         |

### Important clarification: “gate phases” vs “core state”

The initiative status list is **final and simplified**:
`DRAFT`, `EDITING`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`, `TRACKING`, `CANCELLED`.

Gates are enforced via **Decision** objects + audit trail. The UX must show/hide gate actions accordingly.

> Implementation note (v1): the running system may include additional operational statuses
> (e.g. `PENDING_REVIEW`, `ARCHIVED`). The definitive UI permission/CTA behavior is described in:
> `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` and
> `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`.

## 2) Decision gates (what blocks transitions)

Normative DoD for each gate is defined in: `docs/product/GATE_DEFINITION_OF_DONE.md`.
Canonical source traceability rules are defined in: `docs/product/SOURCE_TRACEABILITY_SPEC.md`.

### Gate catalog (canonical)

| Gate                        | Transition it controls | Gate owner                    | Outcome                                       |
| --------------------------- | ---------------------- | ----------------------------- | --------------------------------------------- |
| Gate 1: PROMOTE             | REVIEW → PROMOTED      | Project Sponsor               | Decide “should this be an initiative?”        |
| Gate 2: APPROVE             | PLANNING → APPROVED    | Sponsor or Steering Committee | Decide “do we invest resources?”              |
| Gate 3: CHANGE (optional)   | EXECUTING → EXECUTING  | Project Sponsor               | Approve scope/budget/timeline change decision |
| Gate 4: BENEFITS ACCEPTANCE | DONE → TRACKING        | Business Owner                | Confirm tracking/measurement starts           |

## 3) RACI matrix (by lifecycle/gate)

Legend: **R** – Responsible, **A** – Accountable, **C** – Consulted, **I** – Informed

In this table, **User** means the execution participant (typically `TEAM_MEMBER` / delivery team).

| Status / Gate     | Business Owner | Project Sponsor | Initiative Owner | PMO | Consultant | User | AI System |
| ----------------- | -------------- | --------------- | ---------------- | --- | ---------- | ---- | --------- |
| DRAFT             | I              | I               | A                | C   | R          | I    | I         |
| EDITING           | I              | I               | A                | C   | R          | R    | I         |
| REVIEW            | C              | A               | R                | C   | C          | I    | I         |
| PROMOTED (Gate 1) | I              | A               | C                | I   | C          | I    | I         |
| PLANNING          | C              | A               | R                | C   | C          | I    | I         |
| APPROVED (Gate 2) | C              | A               | I                | C   | I          | I    | I         |
| SCHEDULED         | I              | C               | C                | A   | I          | I    | I         |
| EXECUTING         | I              | C               | C                | A   | C          | R    | I         |
| BLOCKED           | I              | A               | C                | C   | I          | I    | I         |
| DONE              | I              | C               | C                | A   | I          | I    | I         |
| TRACKING (Gate 4) | A              | I               | C                | C   | I          | I    | I         |
| CANCELLED         | I              | A               | C                | I   | I          | I    | I         |

## 4) UX permissions (buttons, locks, visibility)

| Status / Gate     | Create / Edit                 | Comment | Submit for Gate  | Approve Gate                 | Schedule | Execute Tasks |
| ----------------- | ----------------------------- | ------- | ---------------- | ---------------------------- | -------- | ------------- |
| DRAFT             | Consultant / Initiative Owner | All     | –                | –                            | –        | –             |
| EDITING           | Consultant / Initiative Owner | All     | –                | –                            | –        | –             |
| REVIEW            | Initiative Owner              | All     | Initiative Owner | –                            | –        | –             |
| PROMOTED (Gate 1) | –                             | All     | Initiative Owner | Project Sponsor              | –        | –             |
| PLANNING          | Initiative Owner              | All     | Initiative Owner | –                            | –        | –             |
| APPROVED (Gate 2) | –                             | All     | Initiative Owner | Sponsor / Steering Committee | –        | –             |
| SCHEDULED         | –                             | All     | –                | –                            | PMO      | –             |
| EXECUTING         | –                             | All     | –                | –                            | –        | User          |
| BLOCKED           | –                             | All     | Initiative Owner | Project Sponsor              | –        | –             |
| DONE              | –                             | All     | Initiative Owner | PMO                          | –        | –             |
| TRACKING (Gate 4) | Business Owner                | All     | –                | Business Owner               | –        | –             |
| CANCELLED         | –                             | All     | Initiative Owner | Project Sponsor              | –        | –             |

## 5) Module ownership by lifecycle state (canonical)

- **Tools**: generate DRAFT initiatives from tool outputs (no “insights from tools”)
- **Assessment**: generate DRAFT initiatives from assessment reports
- **Initiatives**: `EDITING`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`
- **Implementation**: `EXECUTING`, `BLOCKED`, `DONE` (flexible updates: tasks/decisions/budgets)
- **Benefits**: `TRACKING` (benefits/tracking records)
- **My Work**: personal inbox view of tasks + decisions + notifications across modules
- **Reporting**: governance reporting and rollups (no new artefacts)

### Updated module ownership (per simplified status model)

- **Tools**: tool sessions produce initiative drafts (`DRAFT`)
- **Assessment**: assessment reports produce initiative drafts (`DRAFT`)
- **Initiatives**: `EDITING`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`
- **Implementation**: `EXECUTING`, `BLOCKED`, `DONE` (plus flexible updates)
- **Benefits**: `TRACKING` (and benefits records)

## Artefacts (closed list)

This governance model must not introduce additional artefacts beyond the canonical list in `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`.

In particular:

- governance “gates” are implemented using the **Decision** artefact (possibly with templates/types)
- “stage gate” is a decision pattern, not a separate user-facing artefact

### Relationship to discovery artefacts

- “Insights” are created only from Interview / conversation (Chat) and serve as context.
- Tools do not generate “insights”; tools generate tool outputs which can create initiatives.

## 6) Implementation delta (current code vs this model)

This section enumerates expected deltas between code and the canonical governance model, so we can implement next.

### Lifecycle representation

- The current implementation may not have explicit core status values for `EDITING`, `PROMOTED`, `SCHEDULED`, `TRACKING`.
  - **Required**: implement them as gate decisions and/or dedicated fields, while preserving UX behavior described above.

### Transition order

- The current implementation may have a different ordering of `PLANNING`, `REVIEW`, `APPROVED`.
  - **Required**: align product behavior to this document and update transition validation accordingly.

### UI permissions

- Ensure buttons are role-gated exactly per the UX table (especially gates and scheduling).

### Auditability

- Every gate must produce an auditable record: who decided, when, rationale, and impact.

## Related (canonical) documents

- `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `docs/flows/core/INITIATIVE_MANAGEMENT_FLOW.md`
- `docs/flows/core/DECISION_SYSTEM_FLOW.md`
- `docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`
- `docs/product/CONSULTANT_OVERLAY_MODEL.md`
- `docs/product/ROLES_MODEL.md`
- `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `docs/product/INITIATIVE_AUTOMATION_AND_TRANSITIONS.md`
