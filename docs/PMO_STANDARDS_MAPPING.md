# PMO Standards Mapping

## Overview

SCMS implements a **Meta-PMO Framework** - a certifiable, methodology-neutral PMO model that maps to professional standards without hard-coding any single methodology.

> **Core Principle**: SCMS establishes common denominators across professional PMO standards with no proprietary terminology and clear traceability to known norms.

## Standards Compatibility

| Standard | Version | Description |
|----------|---------|-------------|
| **ISO 21500** | 2021 | Guidance on Project Management |
| **PMI PMBOK** | 7th Edition | Project Management Body of Knowledge |
| **PRINCE2** | 2017 | Projects IN Controlled Environments |

---

## SCMS Concept Mapping Table

The following table provides explicit terminology mapping between SCMS concepts and professional standards:

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

---

## PMO Domains (Certifiable Core)

SCMS organizes PMO functionality into **7 certifiable domains**. Each domain is:
- **Optional**: Can be enabled/disabled per project
- **Configurable**: Labels can be customized
- **Neutral**: No methodology-specific terminology

### Domain Registry

| Domain ID | Display Name | ISO 21500 | PMBOK 7 | PRINCE2 |
|-----------|--------------|-----------|---------|---------|
| `GOVERNANCE_DECISION_MAKING` | Governance & Decision Making | Integration Subject Group | Stakeholder Performance Domain | Organization Theme |
| `SCOPE_CHANGE_CONTROL` | Scope & Change Control | Scope Subject Group | Development Approach & Life Cycle | Change Theme |
| `SCHEDULE_MILESTONES` | Schedule & Milestones | Time Subject Group | Planning Performance Domain | Plans Theme |
| `RISK_ISSUE_MANAGEMENT` | Risk & Issue Management | Risk Subject Group | Uncertainty Performance Domain | Risk Theme |
| `RESOURCE_RESPONSIBILITY` | Resource & Responsibility | Resource Subject Group | Team Performance Domain | Organization Theme |
| `PERFORMANCE_MONITORING` | Performance Monitoring | Integration Subject Group | Measurement Performance Domain | Progress Theme |
| `BENEFITS_REALIZATION` | Benefits Realization | Integration Subject Group | Delivery Performance Domain | Business Case Theme |

### Domain → SCMS Objects Mapping

| Domain | SCMS Objects |
|--------|--------------|
| Governance & Decision Making | Decision, Escalation, GovernancePolicy, StageGate, ChangeRequest |
| Scope & Change Control | Initiative, Task, ScheduleBaseline, ChangeRequest |
| Schedule & Milestones | Phase, StageGate, Roadmap, RoadmapInitiative, Wave |
| Risk & Issue Management | Risk, Issue, BlockedReason, RiskAssessment |
| Resource & Responsibility | User, Team, Assignment, Capacity, Owner |
| Performance Monitoring | PMOHealth, KPI, VarianceReport, Progress, ExecutiveReport |
| Benefits Realization | ValueHypothesis, FinancialAssumption, ProjectClosure, StabilizationStatus |

---

## Phase & Gate Neutrality

SCMS phases and gates are fully configurable:

### Default Phases (Editable)

| Phase | Default Label | Purpose |
|-------|---------------|---------|
| 1 | Context | Strategic context gathering |
| 2 | Assessment | Current state analysis |
| 3 | Initiatives | Change definition |
| 4 | Roadmap | Sequencing and planning |
| 5 | Execution | Implementation |
| 6 | Stabilization | Value realization |

### Gate Types

| Gate | From Phase | To Phase | Purpose |
|------|------------|----------|---------|
| Readiness Gate | Context | Assessment | Verify strategic readiness |
| Design Gate | Assessment | Initiatives | Approve change definition |
| Planning Gate | Initiatives | Roadmap | Approve roadmap baseline |
| Execution Gate | Roadmap | Execution | Authorize implementation |
| Closure Gate | Execution | Stabilization | Confirm delivery completion |

> **Note**: Phase and gate labels can be customized per project via the `ProjectPMOConfiguration` settings without affecting certification traceability.

---

## Auditability

Every governance action in SCMS is logged with full certification traceability:

### Audit Trail Structure

| Field | Description |
|-------|-------------|
| `project_id` | Project context |
| `pmo_domain_id` | Which PMO domain |
| `pmo_phase` | Current lifecycle phase |
| `object_type` | DECISION, BASELINE, CHANGE_REQUEST, etc. |
| `object_id` | Specific object reference |
| `action` | CREATED, APPROVED, REJECTED, TRANSITIONED, etc. |
| `actor_id` | Who performed the action |
| `iso21500_mapping` | ISO 21500 term at time of action |
| `pmbok_mapping` | PMBOK term at time of action |
| `prince2_mapping` | PRINCE2 term at time of action |
| `created_at` | Timestamp |

### Example Audit Entry

```json
{
  "id": "audit-123",
  "project_id": "proj-456",
  "pmo_domain_id": "GOVERNANCE_DECISION_MAKING",
  "pmo_phase": "Roadmap",
  "object_type": "DECISION",
  "object_id": "dec-789",
  "action": "APPROVED",
  "actor_id": "user-001",
  "iso21500_mapping": "Governance Decision (Clause 4.3.4)",
  "pmbok_mapping": "Project Decision / Authorization",
  "prince2_mapping": "Project Board Decision",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pmo-domains` | GET | List all PMO domains with standards mapping |
| `/api/pmo-domains/standards-mapping` | GET | Get complete SCMS → Standards mapping table |
| `/api/pmo-domains/:domainId` | GET | Get specific domain details |
| `/api/pmo-domains/:domainId/objects` | GET | List SCMS objects in a domain |
| `/api/pmo-domains/projects/:projectId` | GET | Get enabled domains for a project |
| `/api/pmo-domains/projects/:projectId` | PUT | Configure project domains |
| `/api/pmo-domains/projects/:projectId/audit-trail` | GET | Get audit trail for certification |
| `/api/pmo-domains/concept/:concept` | GET | Get audit documentation for a concept |
| `/api/pmo-domains/seed` | POST | Seed/refresh domain reference data (admin) |

---

## Code References

### Services

| File | Purpose |
|------|---------|
| `server/services/pmoDomainRegistry.js` | Domain registry and project configuration |
| `server/services/pmoStandardsMapping.js` | Standards terminology mapping |

### Database Tables

| Table | Purpose |
|-------|---------|
| `pmo_domains` | Reference table for 7 PMO domains |
| `project_pmo_domains` | Per-project domain enablement |
| `pmo_audit_trail` | Certification-ready audit log |

### Type Definitions

| Type | Location |
|------|----------|
| `PMODomainId` | `types.ts` - Enum for domain identifiers |
| `PMODomain` | `types.ts` - Domain interface |
| `PMOStandardMapping` | `types.ts` - Standards mapping interface |
| `PMOAuditableObject` | `types.ts` - Traceability interface |
| `PMOAuditEntry` | `types.ts` - Audit log entry interface |
| `ProjectPMOConfiguration` | `types.ts` - Project configuration interface |

---

## UI/UX Rules

To maintain methodology neutrality:

1. **No methodology-specific branding** in UI
2. **Neutral terminology only** - avoid vendor language
3. **No buzzwords** - use professional PMO terms
4. **Configurable labels** - projects can customize names
5. **Standards reference** - always cite ISO/PMBOK/PRINCE2 equivalents

---

## Definition of Done

A compliant SCMS implementation must:

- [ ] PMO model can be mapped to ISO 21500, PMI PMBOK, and PRINCE2
- [ ] No part of system assumes one methodology
- [ ] Auditor can trace: decisions, baselines, changes, governance
- [ ] Documentation states "standards-compatible"
- [ ] UI uses neutral terminology

---

## Certification Audit Checklist

For certification auditors:

### 1. Domain Coverage
- [ ] All 7 domains are defined
- [ ] Each domain maps to ISO/PMBOK/PRINCE2
- [ ] Domains are configurable per project

### 2. Terminology Neutrality
- [ ] No Agile-specific terms (Sprint, Epic, Story)
- [ ] No vendor-specific terms
- [ ] All concepts have standards equivalents

### 3. Audit Trail Completeness
- [ ] Every decision is logged
- [ ] Every baseline is logged
- [ ] Every change request is logged
- [ ] All entries include standards mapping

### 4. Traceability
- [ ] Objects reference their PMO domain
- [ ] Objects reference current phase
- [ ] Standards terminology preserved in logs

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Maintained by: SCMS PMO Framework Team*
