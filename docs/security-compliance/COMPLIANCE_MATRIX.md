# Compliance Matrix (GDPR / SOC 2 / ISO 27001)
>
> **Document:** COMPLIANCE_MATRIX.md  
> **Version:** 1.0  
> **Last Updated:** 2026-02-06  
> **Status:** ✅ Maintained (evidence-linked)

## Purpose
Single, auditable matrix that maps **enterprise compliance requirements** to:
- **Implementation status**
- **Evidence in this repo** (policies, guides, runbooks, audits)

This file exists because other documents reference a “Compliance Matrix” as SSOT.

## Scope & definitions
- **Status definitions**
  - ✅ Implemented: feature/control exists + documented + testable evidence
  - 🟡 Partial: implemented in part OR implemented but evidence incomplete
  - 🔴 Planned: documented intention, not implemented or not evidenced
- **Evidence**: links to docs in this repo. Production proofs (e.g., SOC2 audit report, signed DPA) are **out of repo** and should be attached in the customer “data room”.

---

## A) GDPR (privacy & data protection)

| Area | Requirement | Status | Evidence (docs) |
|---|---|:---:|---|
| DPIA | AI processing DPIA completed and maintained | ✅ | `docs/security-compliance/DPIA_AI_PROCESSING.md` |
| Encryption | Encryption configuration documented (at rest / in transit, key handling) | 🟡 | `docs/security-compliance/ENCRYPTION_CONFIGURATION.md` |
| Access control | RBAC coverage audited and documented | 🟡 | `docs/security-compliance/RBAC_AUDIT_REPORT.md`, `docs/security-compliance/SECURITY_MODULE_AUDIT.md` |
| Data minimization | Data collection rules documented (what, why) | 🟡 | `docs/security-compliance/GDPR_COMPLIANCE_GUIDE.md` |
| DSR (export/delete) | Right of access / portability / erasure flows defined and auditable | 🟡 | `docs/security-compliance/GDPR_COMPLIANCE_GUIDE.md`, `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| Retention | Retention periods + purge/anonymization jobs defined | 🟡 | `docs/security-compliance/GDPR_COMPLIANCE_GUIDE.md`, `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| Audit trail | Actions/events are logged for investigations & DSR evidence | 🟡 | `docs/security-compliance/SECURITY_RUNBOOKS.md`, `docs/security-compliance/SECURITY_MODULE_AUDIT.md` |
| Incident response | Breach response process defined | ✅ | `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md` |

Notes:
- Some GDPR controls require **production operational evidence** (DSR execution logs, retention job runs, key rotation records). Those should be attached in the data room.

---

## B) SOC 2 (Trust Services Criteria)

| TSC Domain | Control theme | Status | Evidence (docs) |
|---|---|:---:|---|
| CC (Common Criteria) | Access control & least privilege (RBAC) | 🟡 | `docs/security-compliance/SOC2_IMPLEMENTATION_GUIDE.md`, `docs/security-compliance/RBAC_AUDIT_REPORT.md` |
| CC | Change management (review, CI/CD, release discipline) | 🟡 | `docs/due-diligence/TECH_DD_CHECKLIST.md` (process claims), `docs/operations/DEPLOYMENT_GUIDE.md` |
| CC | Logging & monitoring | 🟡 | `docs/operations/MONITORING_DASHBOARD.md`, `docs/security-compliance/SECURITY_RUNBOOKS.md` |
| CC | Incident response | ✅ | `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md` |
| A (Availability) | DR/BCP plans, restore testing | 🟡 | `docs/operations/DISASTER_RECOVERY.md`, `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| C (Confidentiality) | Encryption & secret management | 🟡 | `docs/security-compliance/ENCRYPTION_CONFIGURATION.md`, `docs/security-compliance/SOC2_IMPLEMENTATION_GUIDE.md` |
| P (Privacy) | Privacy program mapping (GDPR alignment) | 🟡 | `docs/security-compliance/GDPR_COMPLIANCE_GUIDE.md`, `docs/security-compliance/DPIA_AI_PROCESSING.md` |

Notes:
- SOC 2 requires **evidence over time** (e.g., quarterly access reviews, incident drill records). This repo contains the **control design** docs; operational evidence should be maintained externally.

---

## C) ISO 27001 (ISMS-aligned)

| Annex / Theme | Control theme | Status | Evidence (docs) |
|---|---|:---:|---|
| Access Control | RBAC and permission governance | 🟡 | `docs/security-compliance/RBAC_AUDIT_REPORT.md`, `docs/security-compliance/SECURITY_MODULE_AUDIT.md` |
| Cryptography | Encryption & key management approach | 🟡 | `docs/security-compliance/ENCRYPTION_CONFIGURATION.md` |
| Operations Security | Secure ops procedures & runbooks | 🟡 | `docs/security-compliance/SECURITY_RUNBOOKS.md`, `docs/operations/DEPLOYMENT_GUIDE.md` |
| Incident Management | Response playbook & escalation | ✅ | `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md` |
| Business Continuity | Disaster recovery planning | 🟡 | `docs/operations/DISASTER_RECOVERY.md` |
| Supplier/Vendor | Third-party risk awareness | 🟡 | `docs/due-diligence/THIRD_PARTY_SERVICES.md` |

---

## D) Open items (documentation hygiene)
These are documentation gaps that materially impact “audit readiness”:
- [ ] Ensure `docs/operations/SLA_SLO.md` exists and matches production measurement.
- [ ] Keep tech stack SSOT consistent across DD, Audit Guide, and Architecture docs.
- [ ] Resolve any contradictory audit claims (e.g., WCAG “implemented” vs “removed” in AI audit documents).

