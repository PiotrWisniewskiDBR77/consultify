# PMO STANDARDS COMPLIANCE

## Official Compliance Statement

> **Consultify implements a Meta-PMO Framework that is:**
> - **ALIGNED** with ISO 21500:2021 (International PM Standard)
> - **COMPATIBLE** with PMI PMBOK® Guide 7th Edition
> - **TRACEABLE** to PRINCE2® Governance Themes
> - **AUDITABLE** according to professional PMO standards

---

## 1. Global Standards Overview

### 1.1 Primary Standards (Implemented)

| Standard | Organization | Version | Role in Consultify |
|----------|--------------|---------|-------------------|
| **ISO 21500** | ISO | 2021 | Foundation layer - methodology-neutral guidance |
| **PMBOK® Guide** | PMI (USA) | 7th Edition | Implementation details - 8 Performance Domains |
| **PRINCE2®** | AXELOS (UK) | 2017/2023 | Governance framework - 7 Themes |

### 1.2 Secondary Standards (Compatible)

| Standard | Organization | Compatibility |
|----------|--------------|---------------|
| **ISO 21502** | ISO | Project Governance guidance |
| **IPMA ICB4** | IPMA | Competency baseline for PMO roles |
| **OPM3®** | PMI | Organizational maturity model |
| **P3M3®** | AXELOS | Portfolio/Programme/Project maturity |
| **GPMOi Framework™** | Global PMO Institute | Modern PMO pillars |

---

## 2. Standards Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONSULTIFY PMO COMPLIANCE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LAYER 1: FOUNDATION                               │    │
│  │                       ISO 21500:2021                                 │    │
│  │         (International standard - methodology neutrality)            │    │
│  │                                                                      │    │
│  │  7 Subject Groups:                                                   │    │
│  │  Integration | Stakeholder | Scope | Schedule | Cost | Risk | Quality│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                 │                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LAYER 2: IMPLEMENTATION                           │    │
│  │                    PMI PMBOK 7th Edition                             │    │
│  │         (Detailed practices and performance domains)                 │    │
│  │                                                                      │    │
│  │  8 Performance Domains:                                              │    │
│  │  Stakeholders | Team | Development | Planning |                      │    │
│  │  Project Work | Delivery | Measurement | Uncertainty                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                 │                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LAYER 3: GOVERNANCE                              │    │
│  │                    PRINCE2® Themes                                   │    │
│  │         (Business Case, Organization, Quality, Plans,               │    │
│  │          Risk, Change, Progress)                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Consultify PMO Domains

Consultify organizes PMO functionality into **7 certifiable domains**. Each domain:
- Is **optional** and can be enabled/disabled per project
- Is **configurable** with customizable labels
- Uses **neutral** terminology (no methodology-specific language)
- Is **traceable** to ISO/PMBOK/PRINCE2

### 3.1 Domain Registry

| Domain ID | Display Name | ISO 21500 | PMBOK 7 | PRINCE2 |
|-----------|--------------|-----------|---------|---------|
| `GOVERNANCE_DECISION_MAKING` | Governance & Decision Making | Integration Subject Group (Clause 4.3) | Stakeholder Performance Domain | Organization Theme |
| `SCOPE_CHANGE_CONTROL` | Scope & Change Control | Scope Subject Group (Clause 4.4) | Development Approach & Life Cycle | Change Theme |
| `SCHEDULE_MILESTONES` | Schedule & Milestones | Time Subject Group (Clause 4.5) | Planning Performance Domain | Plans Theme |
| `RISK_ISSUE_MANAGEMENT` | Risk & Issue Management | Risk Subject Group (Clause 4.8) | Uncertainty Performance Domain | Risk Theme |
| `RESOURCE_RESPONSIBILITY` | Resource & Responsibility | Resource Subject Group (Clause 4.6) | Team Performance Domain | Organization Theme |
| `PERFORMANCE_MONITORING` | Performance Monitoring | Integration Subject Group (Clause 4.4.22) | Measurement Performance Domain | Progress Theme |
| `BENEFITS_REALIZATION` | Benefits Realization | Integration Subject Group (Clause 4.4.1) | Delivery Performance Domain | Business Case Theme |

### 3.2 Domain → SCMS Objects Mapping

| Domain | SCMS Objects |
|--------|--------------|
| Governance & Decision Making | Decision, Escalation, GovernancePolicy, StageGate, ChangeRequest, ProjectMember |
| Scope & Change Control | Initiative, Task, ScheduleBaseline, ChangeRequest |
| Schedule & Milestones | Phase, StageGate, Roadmap, RoadmapInitiative, Wave |
| Risk & Issue Management | Risk, Issue, BlockedReason, RiskAssessment, RAIDItem |
| Resource & Responsibility | User, Team, ProjectMember, Assignment, Capacity, Workstream |
| Performance Monitoring | PMOHealthSnapshot, KPI, VarianceReport, Progress, ExecutiveReport |
| Benefits Realization | ValueHypothesis, FinancialAssumption, ProjectClosure, StabilizationStatus |

---

## 4. SCMS Concept Mapping Table

Every concept in Consultify maps explicitly to professional standards:

| SCMS Concept | SCMS Object | ISO 21500 | PMI PMBOK 7th | PRINCE2 | Domain |
|--------------|-------------|-----------|---------------|---------|--------|
| **Phase** | `SCMSPhase` | Project Phase (Clause 4.2) | Project Life Cycle Phase | Stage (Management Stage) | Schedule & Milestones |
| **Stage Gate** | `StageGate` | Phase Gate (Clause 4.3) | Management Gate / Phase Gate | Stage Gate / End Stage Assessment | Governance & Decision Making |
| **Initiative** | `Initiative` | Work Package (Clause 4.4.4) | Deliverable Group / Work Package | Work Package | Scope & Change Control |
| **Task** | `Task` | Activity (Clause 4.4.5) | Activity | Activity | Scope & Change Control |
| **Decision** | `Decision` | Governance Decision (Clause 4.3.4) | Project Decision / Authorization | Project Board Decision | Governance & Decision Making |
| **Baseline** | `ScheduleBaseline` | Baseline (Clause 4.4.10) | Performance Measurement Baseline | Stage Plan (baselined) | Scope & Change Control |
| **Change Request** | `ChangeRequest` | Change Request (Clause 4.4.23) | Change Request | Request for Change (RFC) | Scope & Change Control |
| **Roadmap** | `Roadmap` | Project Schedule (Clause 4.4.10) | Project Schedule | Project Plan / Stage Plan | Schedule & Milestones |
| **Governance Settings** | `GovernancePolicy` | Project Governance Framework (Clause 4.3) | Governance Framework | Project Board Terms of Reference | Governance & Decision Making |
| **PMO Health** | `PMOHealthSnapshot` | Project Performance Measurement (Clause 4.4.22) | Project Performance Information | Highlight Report | Performance Monitoring |
| **Value Hypothesis** | `ValueHypothesis` | Benefits Identification (Clause 4.4.1) | Benefits Documentation | Expected Benefits (Business Case) | Benefits Realization |
| **Escalation** | `Escalation` | Escalation (Clause 4.3.4) | Escalation Path | Exception Report | Governance & Decision Making |
| **Project Member** | `ProjectMember` | Project Team (Clause 4.6.2) | Team Performance Domain | Organization Theme (Roles) | Resource & Responsibility |
| **Workstream** | `Workstream` | Work Breakdown Structure (Clause 4.4.3) | Work Package Grouping | Work Package Cluster | Resource & Responsibility |

---

## 5. Project Roles

### 5.1 Role Hierarchy

Consultify implements a three-level role hierarchy aligned with PMO standards:

```
PLATFORM LEVEL              ORGANIZATION LEVEL           PROJECT LEVEL
══════════════════          ══════════════════════       ══════════════════════

SUPERADMIN ──────────────── ADMIN ─────────────────────── SPONSOR
    │                         │                               │
    │                         ├── PROJECT_MANAGER ──────────── PMO_LEAD
    │                         │       │                           │
    │                         │       ├── TEAM_LEAD ──────────── WORKSTREAM_OWNER
    │                         │       │       │                       │
    │                         │       │       └── TEAM_MEMBER ─────── INITIATIVE_OWNER
    │                         │       │                               │
    │                         │       └── SME (Subject Expert)       TASK_ASSIGNEE
    │                         │
    │                         ├── VIEWER (Auditor)
    │                         │
    │                         └── CONSULTANT (External)
```

### 5.2 Project Role Definitions

| Role | ISO 21500 | PMBOK 7 | PRINCE2 | Description |
|------|-----------|---------|---------|-------------|
| **SPONSOR** | Project Sponsor (4.3.2) | Sponsor | Executive | Strategic decisions, budget authority |
| **DECISION_OWNER** | Decision Maker (4.3.4) | Project Decision Authority | Project Board | Final decision authority |
| **PMO_LEAD** | Project Manager (4.3.3) | Project Manager | Project Manager | Overall project coordination |
| **WORKSTREAM_OWNER** | Work Package Manager (4.4.4) | Work Package Lead | Team Manager | Workstream delivery |
| **INITIATIVE_OWNER** | Activity Owner (4.4.5) | Activity Owner | Work Package Owner | Initiative delivery |
| **TASK_ASSIGNEE** | Resource (4.6.2) | Team Member | Team Member | Task execution |
| **SME** | Subject Matter Expert (4.6.3) | Specialist | Technical Consultant | Domain expertise |
| **REVIEWER** | Quality Reviewer (4.7.2) | Quality Assessor | Quality Reviewer | Assessment and review |
| **OBSERVER** | Stakeholder (4.2.2) | Stakeholder | Stakeholder | Read-only visibility |
| **CONSULTANT** | External Advisor (4.6.4) | External Resource | External Advisor | Limited scope advisory |
| **STAKEHOLDER** | Stakeholder (4.2.2) | Stakeholder | Stakeholder | Notifications and updates |

### 5.3 RACI Matrix

| Object | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|--------|-----------------|-----------------|---------------|--------------|
| **Project** | PMO_LEAD | SPONSOR | CONSULTANT | STAKEHOLDER |
| **Initiative** | INITIATIVE_OWNER | PMO_LEAD | SME | TEAM_MEMBER |
| **Task** | TASK_ASSIGNEE | INITIATIVE_OWNER | SME | PMO_LEAD |
| **Decision** | DECISION_OWNER | SPONSOR | PMO_LEAD | ALL |
| **Assessment** | ASSESSOR | PMO_LEAD | REVIEWER | SPONSOR |
| **Change Request** | REQUESTER | PMO_LEAD | DECISION_OWNER | SPONSOR |
| **Roadmap** | PMO_LEAD | SPONSOR | INITIATIVE_OWNER | STAKEHOLDER |
| **Stage Gate** | PMO_LEAD | SPONSOR | DECISION_OWNER | ALL |

---

## 6. Phase & Gate Framework

### 6.1 Default SCMS Phases

| Phase | Default Label | ISO 21500 | PMBOK 7 | PRINCE2 | Purpose |
|-------|---------------|-----------|---------|---------|---------|
| 1 | Context | Initiating (4.2) | Project Work Domain | Starting Up | Strategic context gathering |
| 2 | Assessment | Planning (4.3) | Planning Domain | Initiating | Current state analysis |
| 3 | Initiatives | Planning (4.3) | Development Domain | Initiating | Change definition |
| 4 | Roadmap | Planning (4.3) | Planning Domain | Stage Planning | Sequencing and planning |
| 5 | Execution | Executing (4.4) | Delivery Domain | Controlling | Implementation |
| 6 | Stabilization | Closing (4.5) | Delivery Domain | Closing | Value realization |

### 6.2 Stage Gates

| Gate | From → To | ISO 21500 | PMBOK 7 | PRINCE2 | Purpose |
|------|-----------|-----------|---------|---------|---------|
| **Readiness Gate** | Context → Assessment | Phase Gate (4.3.1) | Phase Gate | Authorization to Proceed | Verify strategic readiness |
| **Design Gate** | Assessment → Initiatives | Phase Gate (4.3.2) | Phase Gate | End Stage Assessment | Approve change definition |
| **Planning Gate** | Initiatives → Roadmap | Phase Gate (4.3.3) | Phase Gate | End Stage Assessment | Approve roadmap baseline |
| **Execution Gate** | Roadmap → Execution | Phase Gate (4.3.4) | Phase Gate | Authorization to Proceed | Authorize implementation |
| **Closure Gate** | Execution → Stabilization | Phase Gate (4.3.5) | Phase Gate | End Project | Confirm delivery completion |

---

## 7. Task Workflow

### 7.1 Task Status Lifecycle

```
                          ┌──────────────────┐
                          │     CREATED      │
                          └────────┬─────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ASSIGNMENT                               │
│     PMO_LEAD / INITIATIVE_OWNER assigns to TASK_ASSIGNEE        │
│     (Validates: capacity, permissions, workstream membership)    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │       TODO       │◄──────────────┐
                    │   (SLA starts)   │               │
                    └────────┬─────────┘               │
                             │                         │
                    ┌────────┴────────┐                │
                    │  SLA EXCEEDED?  │                │
                    └────────┬────────┘                │
                             │ YES                     │
                             ▼                         │
                    ┌──────────────────┐               │
                    │    ESCALATE      │               │
                    │  Level 0→1→2→3   │───────────────┘
                    │  Notify managers │     (Reassignment)
                    └──────────────────┘
                             │ NO
                             ▼
                    ┌──────────────────┐
                    │   IN_PROGRESS    │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    │   BLOCKED?      │
                    └────────┬────────┘
               YES ◄─────────┴─────────► NO
                │                        │
                ▼                        ▼
       ┌──────────────┐         ┌──────────────┐
       │   BLOCKED    │         │     DONE     │
       │  Log reason  │         │   Notify     │
       │  Auto-escalate│────────►│  Update KPIs │
       └──────────────┘         └──────────────┘
```

### 7.2 Escalation Matrix

| Level | Escalate To | Notify | SLA Hours | ISO 21500 | PMBOK 7 | PRINCE2 |
|-------|-------------|--------|-----------|-----------|---------|---------|
| 0 → 1 | INITIATIVE_OWNER | PMO_LEAD | 24 | Escalation (4.3.4) | Escalation Path | Exception |
| 1 → 2 | PMO_LEAD | SPONSOR, DECISION_OWNER | 24 | Escalation (4.3.4) | Escalation Path | Exception Report |
| 2 → 3 | SPONSOR | ADMIN | 24 | Escalation (4.3.4) | Senior Escalation | Highlight Report |

---

## 8. Auditability

### 8.1 Audit Trail Structure

Every governance action is logged with full certification traceability:

| Field | Description | Required |
|-------|-------------|----------|
| `id` | Unique audit entry ID | Yes |
| `project_id` | Project context | Yes |
| `organization_id` | Organization context | Yes |
| `pmo_domain_id` | Which PMO domain (7 domains) | Yes |
| `pmo_phase` | Current lifecycle phase (1-6) | Yes |
| `object_type` | DECISION, TASK, INITIATIVE, etc. | Yes |
| `object_id` | Specific object reference | Yes |
| `action` | CREATED, APPROVED, REJECTED, ASSIGNED, etc. | Yes |
| `actor_id` | Who performed the action | Yes |
| `iso21500_mapping` | ISO 21500 term at time of action | Yes |
| `pmbok_mapping` | PMBOK term at time of action | Yes |
| `prince2_mapping` | PRINCE2 term at time of action | Yes |
| `metadata` | Additional context (JSON) | No |
| `created_at` | Timestamp | Yes |

### 8.2 Example Audit Entry

```json
{
  "id": "audit-20241226-001",
  "project_id": "proj-transformation-2024",
  "organization_id": "org-acme",
  "pmo_domain_id": "GOVERNANCE_DECISION_MAKING",
  "pmo_phase": "Roadmap",
  "object_type": "DECISION",
  "object_id": "dec-budget-approval-001",
  "action": "APPROVED",
  "actor_id": "user-ceo-001",
  "iso21500_mapping": "Governance Decision (Clause 4.3.4)",
  "pmbok_mapping": "Project Decision / Authorization",
  "prince2_mapping": "Project Board Decision",
  "metadata": {
    "decision_type": "BUDGET_APPROVAL",
    "amount": 150000,
    "currency": "EUR"
  },
  "created_at": "2024-12-26T10:30:00Z"
}
```

---

## 9. Certification Audit Checklist

For certification auditors verifying Consultify compliance:

### 9.1 Domain Coverage
- [x] All 7 PMO domains are defined
- [x] Each domain maps to ISO 21500 Subject Groups
- [x] Each domain maps to PMBOK 7 Performance Domains
- [x] Each domain maps to PRINCE2 Themes
- [x] Domains are configurable per project

### 9.2 Role Coverage
- [x] Project roles defined with clear responsibilities
- [x] RACI matrix implemented
- [x] Role hierarchy aligned with ISO 21500, PMBOK, PRINCE2
- [x] Escalation paths defined

### 9.3 Terminology Neutrality
- [x] No Agile-specific terms (Sprint, Epic, Story) in core PMO
- [x] No vendor-specific terms
- [x] All concepts have standards equivalents
- [x] Labels are configurable per project

### 9.4 Audit Trail Completeness
- [x] Every decision is logged
- [x] Every baseline is logged
- [x] Every change request is logged
- [x] Every task assignment is logged
- [x] Every escalation is logged
- [x] All entries include standards mapping (ISO/PMBOK/PRINCE2)

### 9.5 Traceability
- [x] Objects reference their PMO domain
- [x] Objects reference current phase
- [x] Standards terminology preserved in logs
- [x] Audit trail is immutable and exportable

---

## 10. UI/UX Rules

To maintain methodology neutrality in the user interface:

1. **No methodology-specific branding** - avoid PMI, AXELOS, ISO logos
2. **Neutral terminology only** - use professional PMO terms
3. **No buzzwords** - avoid "Agile", "Waterfall", "Scrum" in core PMO
4. **Configurable labels** - projects can customize phase/gate names
5. **Standards reference** - optionally show ISO/PMBOK/PRINCE2 equivalents in tooltips
6. **Role clarity** - always show user's project role and permissions

---

## 11. API Reference

### PMO Domains API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pmo-domains` | GET | List all PMO domains with standards mapping |
| `/api/pmo-domains/standards-mapping` | GET | Get complete SCMS → Standards mapping table |
| `/api/pmo-domains/:domainId` | GET | Get specific domain details |
| `/api/pmo-domains/:domainId/objects` | GET | List SCMS objects in a domain |
| `/api/pmo-domains/projects/:projectId` | GET | Get enabled domains for a project |
| `/api/pmo-domains/projects/:projectId` | PUT | Configure project domains |
| `/api/pmo-domains/projects/:projectId/audit-trail` | GET | Get audit trail for certification |

### Project Members API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/:projectId/members` | GET | List project team members |
| `/api/projects/:projectId/members` | POST | Add member to project |
| `/api/projects/:projectId/members/:userId` | PATCH | Update member role/permissions |
| `/api/projects/:projectId/members/:userId` | DELETE | Remove member from project |
| `/api/projects/:projectId/raci-matrix` | GET | Get RACI matrix for project |

### Workstreams API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/:projectId/workstreams` | GET | List project workstreams |
| `/api/projects/:projectId/workstreams` | POST | Create workstream |
| `/api/workstreams/:id` | PATCH | Update workstream |
| `/api/workstreams/:id` | DELETE | Delete workstream |

### Task Assignment API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks/:id/assign` | POST | Assign task to user |
| `/api/tasks/:id/escalate` | POST | Escalate task |
| `/api/tasks/overdue` | GET | Get overdue tasks for escalation |

---

## 12. TypeScript Types Reference

Key types for PMO compliance are defined in `types.ts`:

- `PMODomainId` - Enum for 7 PMO domains
- `PMODomain` - Domain definition with standards mapping
- `PMOStandardMapping` - ISO/PMBOK/PRINCE2 terminology mapping
- `PMOAuditableObject` - Base interface for traceability
- `PMOAuditEntry` - Audit log entry with standards mapping
- `ProjectPMOConfiguration` - Per-project domain settings
- `ProjectRole` - Project-level role enum
- `ProjectMember` - Project member with role and permissions
- `Workstream` - Workstream definition

---

## 13. Code References

### Services

| File | Purpose |
|------|---------|
| `server/services/pmoDomainRegistry.js` | Domain registry and project configuration |
| `server/services/pmoStandardsMapping.js` | Standards terminology mapping |
| `server/services/projectMemberService.js` | Project member management |
| `server/services/workstreamService.js` | Workstream management |
| `server/services/taskAssignmentService.js` | Task assignment with SLA/escalation |

### Database Tables

| Table | Purpose |
|-------|---------|
| `pmo_domains` | Reference table for 7 PMO domains |
| `project_pmo_domains` | Per-project domain enablement |
| `pmo_audit_trail` | Certification-ready audit log |
| `project_members` | Project team members with roles |
| `workstreams` | Project workstreams |
| `task_escalations` | Escalation history |

---

## 14. Definition of Done

A compliant Consultify implementation must satisfy:

- [x] PMO model maps to ISO 21500, PMI PMBOK, and PRINCE2
- [x] No part of system assumes one methodology
- [x] Auditor can trace: decisions, baselines, changes, governance
- [x] Documentation states "standards-compatible"
- [x] UI uses neutral terminology
- [x] Roles implemented with RACI matrix
- [x] Audit trail includes standards mapping for every action
- [x] Escalation paths defined and automated

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-24 | SCMS Team | Initial version from legacy |
| 2.0 | 2024-12-26 | AI + ANTYGRACITY | Full compliance documentation with roles, RACI, workflow |

---

*This document is the canonical source of truth for PMO standards compliance in Consultify.*
*All development must align with this specification.*
*Deviations require explicit approval and documentation update.*



