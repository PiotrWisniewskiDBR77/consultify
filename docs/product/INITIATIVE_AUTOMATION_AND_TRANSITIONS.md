# Initiative automation & transitions (canonical)

This document defines the **system automation rules** for initiative lifecycle transitions.

It complements:

- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md` (business governance)
- `docs/product/GATE_DEFINITION_OF_DONE.md` (DoD per gate)
- `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` (CTA + editability matrix)

Backend remains the source of truth:

- `GET /api/initiatives/:id/gate-readiness-check`

---

## 1) Scheduled → Executing: auto-start by timeline

### Rule (v1)

When an initiative is in status:

- `SCHEDULED`

…and its effective start date is reached:

- `planned_start_date` (preferred) **or** `start_date` (fallback)

Then the system auto-transitions:

- `SCHEDULED → EXECUTING` using gate `START`

### Why

- `SCHEDULED` is “baseline committed” and should not require manual clicking to start.
- Time controls execution: it aligns module routing and reduces operational friction.

### Implementation (backend)

- Cron job: runs every **5 minutes**
- Code:
  - `server/src/jobs/initiativeAutoStartJob.ts`
  - wired in `server/src/cron/Scheduler.ts`

### Auditability

Each auto-start:

- updates `initiatives.status` and sets `execution_started_at`
- appends to `initiative_status_history` (best-effort) with:
  - `from_status = SCHEDULED`
  - `to_status = EXECUTING`
  - `gate_type = START`
  - `changed_by = NULL` (system)
  - reason: “Auto-started by timeline…”

### Manual override

Manual `START` can still exist as a control action for PMO.
If manual start remains enabled, it must be idempotent:

- if already `EXECUTING`, no-op

---

## 2) Approved backlog: why `APPROVED` must exist

`APPROVED` is a real operational state:

- approved for execution/investment
- **not yet scheduled** (capacity/roadmap slot not committed)

Baseline timeline is a **blocking requirement** only from `SCHEDULED` onwards.

---

## 3) Done → Tracking (Benefits start)

Benefits tracking is not automatic by default (v1).

Transition:

- `DONE → TRACKING` using gate `START_TRACKING`

Owner:

- `BUSINESS_OWNER`

Rationale:

- prevents entering Benefits without KPI/baseline ownership and tracking intent

### Policy (backend-enforced, v1)

Before `START_TRACKING` is allowed:

- **Benefits owner must be assigned**:
  - `initiatives.owner_business_id` is set
- **KPIs must exist**:
  - at least 1 KPI exists in `initiative_kpis`
  - at least 1 KPI has `target_value` + `unit`

Tracking window:

- stored in `initiatives.tracking_start_date` / `initiatives.tracking_end_date`
- if empty, backend auto-sets defaults when starting tracking (v1 default: **90 days**)

---

## 4) Terminal transitions: Cancelled / Archived

- `CANCELLED → ARCHIVED`: archival policy / retention decision
- `TRACKING → ARCHIVED`: once benefits tracking period ends and records are captured

Archival is typically PMO-controlled (or Admin override) and should be auditable.
