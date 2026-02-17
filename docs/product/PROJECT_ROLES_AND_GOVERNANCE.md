# Project roles & governance (canonical)

This document defines the **canonical project-level roles** and the **optional Steering Board** model used across Consultify.

## Role layers (important)

- **System role (organization / account)**: tenant administration (Owner/Admin/User…). Not covered here.
- **Project role (delivery / governance)**: who can do what _inside a project_ (this document).
- **Consultant overlay**: a visibility/audit overlay on a user + project membership. It does **not** grant authority by itself (see `docs/product/CONSULTANT_OVERLAY_MODEL.md`).

For the precise, canonical definitions and initiative-level role resolution rules, see:

- `docs/product/ROLES_MODEL.md`

## Canonical project roles (8)

These are the roles we use for permissions/capabilities and governance:

1. **Sponsor (Business Owner)**
   - **Owns**: business goal, ROI, budget approval, go/no-go.
   - **Does not**: manage tasks daily, run schedule, lead team execution.
2. **Project Leader**
   - **Owns**: operational delivery; plan, schedule, day-to-day coordination; escalations.
   - **Does not**: change strategic goal or increase budget without Sponsor.
3. **Initiative Owner**
   - **Owns**: delivery of a specific initiative area; initiative plan; progress reporting.
4. **Team Member**
   - **Owns**: execution of assigned work; progress updates; raising risks.
5. **Project Office (PMO)** _(invoked)_
   - **Purpose**: standards, quality, compliance, completeness of reporting.
   - **Policy**: typically **invoked on triggers** (e.g. lack of reporting, tolerance breach, audit).
6. **Portfolio Owner** _(invoked)_
   - **Purpose**: investment-level decisions across projects (budget allocation, start/stop).
7. **Business Owner (Benefits)**
   - **Purpose**: ownership of benefits tracking and KPI outcomes (especially at benefits gates).
8. **Steering Committee** _(via optional Steering Board)_
   - **Purpose**: strategic approvals/escalations when Steering Board is enabled for a project.

## Steering Board (optional per project)

Some projects have a Steering Board, many do not.

- **Enabled per project**: when enabled, Steering Board membership is authoritative for specific approvals.
- **Board-only members**: can exist **without any other project role**; they are **information-first** by default.

Member types (v1):

- `CHAIR`, `BOARD_MEMBER`: can act as `STEERING_COMMITTEE` when the board is enabled
- `OBSERVER`: read/inform-only (no committee authority)

### Default delegation when Steering Board is disabled

If Steering Board is disabled, strategic approvals default to:

- **Sponsor**, or
- **Portfolio Owner** (if invoked / configured)

This delegation is formalized in backend capability rules and must be consistent with:

- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `docs/product/ROLES_MODEL.md`

## Source of truth

Backend is the **single source of truth** for role resolution and for all UI capabilities:

- initiatives: `GET /api/initiatives/:id/gate-readiness-check` returns `capabilities`.
