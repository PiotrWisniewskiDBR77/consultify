# SCMS Lifecycle Guide (AI-Driven Strategic Change Management System)

## Overview

This document describes the 6-phase canonical lifecycle that all transformation projects must follow in the SCMS platform. Each phase has defined inputs, outputs, and governance controls.

---

## Phase 1: CONTEXT (Why Change?)

**Purpose**: Establish the strategic rationale for transformation.

**Key Activities**:
- Define business model and core processes
- Capture strategic goals and success criteria
- Document challenges and constraints
- Set transformation horizon

**API Endpoints**:
- `GET /api/context/:projectId` - Retrieve context
- `PUT /api/context/:projectId` - Save context
- `POST /api/context/:projectId/analyze` - AI readiness analysis

**Gate Criteria**:
- Context Readiness Score ≥ 80%
- All required fields populated

---

## Phase 2: ASSESSMENT (Where are we now?)

**Purpose**: Establish current state (As-Is) and target state (To-Be).

**Key Activities**:
- Score maturity across all 7 axes
- Identify gaps requiring attention
- Generate AI gap analysis summary

**API Endpoints**:
- `GET /api/assessment/:projectId` - Retrieve assessment
- `PUT /api/assessment/:projectId` - Save assessment
- `POST /api/assessment/:projectId/gap-analysis` - AI gap analysis

**Gate Criteria**:
- All 7 axes assessed
- Gap analysis reviewed

---

## Phase 3: INITIATIVES (What must change?)

**Purpose**: Define discrete transformation initiatives to close gaps.

**Key Activities**:
- Create initiative cards with business cases
- Prioritize based on value vs effort
- Validate decision readiness

**API Endpoints**:
- `GET /api/initiatives?projectId=xxx`
- `POST /api/initiatives`
- `PATCH /api/initiatives/:id`

**Gate Criteria**:
- Each initiative has owner assigned
- Business case documented

---

## Phase 4: ROADMAP (When & in what sequence?)

**Purpose**: Sequence initiatives into waves with dependencies.

**Key Activities**:
- Create roadmap waves
- Assign initiatives to waves
- Baseline the roadmap

**API Endpoints**:
- `GET /api/roadmap/:projectId/waves`
- `POST /api/roadmap/:projectId/waves`
- `PATCH /api/roadmap/initiatives/:id/assign`
- `POST /api/roadmap/:projectId/baseline`

**Gate Criteria**:
- All initiatives assigned to waves
- Roadmap baselined (changes require CR)

---

## Phase 5: EXECUTION (Are initiatives being delivered?)

**Purpose**: Track delivery of initiatives and tasks.

**Key Activities**:
- Execute tasks within initiative scope
- Monitor progress and blockers
- Conduct phase gate reviews

**API Endpoints**:
- `GET /api/execution/:projectId/summary`
- `GET /api/execution/:projectId/blockers`
- `POST /api/execution/:projectId/gate-check`

**Gate Criteria**:
- All tasks in current phase complete
- No critical blockers

---

## Phase 6: STABILIZATION (Is the change sustained?)

**Purpose**: Confirm value realization and embed changes.

**Key Activities**:
- Record KPI measurements
- Compare actual vs expected outcomes
- Generate lessons learned

**API Endpoints**:
- `GET /api/stabilization/:projectId/kpis`
- `POST /api/stabilization/:projectId/kpis`
- `GET /api/stabilization/:projectId/value-realization`
- `GET /api/stabilization/:projectId/lessons-learned`

**Gate Criteria**:
- Value realization ≥ 80% of expected
- Lessons learned documented

---

## Governance & Change Control

All baselined artifacts (Roadmap, Initiatives) require a **Change Request (CR)** to modify.

**API Endpoints**:
- `GET /api/governance/change-requests`
- `POST /api/governance/change-requests`
- `PATCH /api/governance/change-requests/:id/decide`

---

## RBAC Summary

| Role | Context | Assessment | Initiatives | Roadmap | Execution | Stabilization |
|------|---------|------------|-------------|---------|-----------|---------------|
| SuperAdmin | Full | Full | Full | Full | Full | Full |
| Admin | Full | Full | Full | Full | Full | Full |
| Project Manager | Edit | Edit | Edit | Edit | Edit | Edit |
| Team Member | View | View | View | View | Update Tasks | View |
| Viewer | View | View | View | View | View | View |

---

## AI Behavior Across Phases

The AI adapts its behavior based on the current phase:

| Phase | AI Mode | Examples |
|-------|---------|----------|
| Context | Advisory | Suggests missing context, validates completeness |
| Assessment | Analytical | Summarizes gaps, prioritizes focus areas |
| Initiatives | Strict | Validates decision readiness, rejects vague proposals |
| Roadmap | Advisory | Suggests optimal sequencing, detects conflicts |
| Execution | Advisory | Flags blockers, suggests interventions |
| Stabilization | Analytical | Analyzes value realization, generates lessons |
