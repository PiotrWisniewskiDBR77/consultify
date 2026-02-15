# Initiative status × role × CTA matrix (v1)

This is the **canonical behavior matrix** for:

- which **CTA actions** are available on the initiative
- what is editable in the **properties strip (“6 fields”)**
- whether **AI** is enabled

Backend is the source of truth via `GET /api/initiatives/:id/gate-readiness-check` (see `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`).

Role vocabulary and effective-role resolution is defined in `docs/product/ROLES_MODEL.md`.

## Status set (canonical)

`DRAFT`, `PENDING_REVIEW`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`, `TRACKING`, `CANCELLED`, `ARCHIVED`

## Effective roles (initiative context)

`userRoles[]` returned by backend is the effective role set for the current user, derived from:

- system role (Admin override)
- project membership (canonical project roles)
- initiative gate role assignments + derived roles (owner/sponsor)
- steering board membership (if enabled)

## Steering Board delegation rule (important)

If Steering Board is **disabled** for a project:

- any gate that would require `STEERING_COMMITTEE` can be executed by `PROJECT_SPONSOR` **or** `PORTFOLIO_OWNER`.

Backend reflects this by rewriting `requiredRoles` in `availableTransitions`.

## Properties strip (“6 fields”) editability

Always read-only (system controlled):

- `Status`
- `Phase`
- `Next Gate`

Conditionally editable:

| Field       | Editable when                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Priority    | user has any of: `PMO`, `PROJECT_MANAGER`, `PROJECT_LEAD`, `INITIATIVE_OWNER`, `PROJECT_SPONSOR` AND status is not `CANCELLED`/`ARCHIVED` |
| Owner       | same rule as Priority                                                                                                                     |
| Target date | same rule as Priority                                                                                                                     |

These rules are returned via `capabilities.topBar.*`.

## Timeline baseline policy (important)

- **Gate `APPROVE` / status `APPROVED` does not require a baseline timeline.**
- Baseline timeline (at least `planned_start_date`) becomes **blocking** from:
  - `SCHEDULED` (and later statuses: `EXECUTING`, `BLOCKED`, `DONE`, `TRACKING`)

This allows `APPROVED` to function as an **approved backlog** state (approved but not yet scheduled).

## Benefits start policy (DONE → TRACKING)

`DONE → TRACKING` is a **workflow gate** (`START_TRACKING`) owned by `BUSINESS_OWNER`.

Backend enforces (v1):

- **Business Owner assigned**: `initiatives.owner_business_id` must be set
- **KPIs exist**:
  - at least 1 KPI exists in `initiative_kpis`
  - at least 1 KPI has `target_value` + `unit`
- **Tracking window**:
  - stored in `initiatives.tracking_start_date` / `initiatives.tracking_end_date`
  - if missing, backend auto-sets defaults on transition (v1 default: **90 days**)

## CTA bar – workflow actions

Workflow actions are driven by backend:

- UI renders only actions where `availableTransitions[].canCurrentUserExecute = true`
- UI must not show disabled workflow actions

## CTA bar – create actions (contextCreateActions)

`capabilities.ctaBar.contextCreateActions` is backend-owned.

v1 rules:

| Status band                                                 | contextCreateActions       |
| ----------------------------------------------------------- | -------------------------- |
| `PLANNING`, `APPROVED`, `SCHEDULED`, `EXECUTING`, `BLOCKED` | `task`, `decision`, `raid` |
| `DRAFT`, `PENDING_REVIEW`, `REVIEW`, `PROMOTED`             | `decision`, `raid`         |
| `CANCELLED`, `ARCHIVED`                                     | (none)                     |

If the user has no edit role in the current status, the list is empty.

## AI CTA (right side)

`capabilities.ctaBar.canUseAi = true` iff:

- `capabilities.cards.canEditCards = true`, and
- status is not `CANCELLED`/`ARCHIVED`

When false, the AI CTA is disabled and UI must show an explanatory message.

## Test verification workflow

When behavior changes:

- update this document first (matrix change)
- update backend rules (capabilities + enforcement)
- add/adjust tests validating the matrix
