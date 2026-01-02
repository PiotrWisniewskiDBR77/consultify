# Governance & Ownership Policy

**Last Updated:** 1 January 2026  
**Standard:** McKinsey-Grade Corporate Governance v1.0

This document defines the rules for data ownership, decision accountability, and organizational governance within the Consultinity platform.

---

## 1. Data Sovereignty
Organizations retain 100% ownership of their "Decision Graph".

- **Immutability**: Once an initiative is `APPROVED`, its history cannot be modified (Audit Lock).
- **Isolation**: No data from an organization can be used to "train" global AI models without explicit, multi-layer consent (Opt-in only).
- **Exportability**: Organizations can export their entire DRD graph (Axes, Initiatives, Tasks) in JSON and PDF formats at any time.

---

## 2. RBAC & Decision Rights
Permissions are mapped to organizational roles, not just technical access levels.

| Role | Right | Accountability |
| :--- | :--- | :--- |
| **Sponsor (Admin)** | Final Approval of Initiatives. | Business ROI. |
| **Architect (Editor)** | Axis & Position Mapping. | Methodology Integrity. |
| **Assignee (Member)** | Task Execution & Reporting. | Operational Output. |
| **Viewer** | Read-only access to specific axes. | Informed Alignment. |

---

## 3. The "Decision Lock" Protocol
To ensure auditability, the platform enforces the following:

1. **Status Transition Logs**: Every change from `DRAFT` to `APPROVED` must be accompanied by a "Validation Signature" (User ID + Timestamp).
2. **AI Transparency**: Any AI-generated insight MUST be clearly watermarked or tagged to distinguish it from human input.
3. **Audit History**: Retention of all `ChangeRequests` for minimum 7 years.

---

## 4. Compliance Frameworks
The system is built to satisfy:
- **PMBOK 7**: Performance and value-based measurement.
- **ISO 21500**: Project governance standards.
- **GDPR**: Data privacy and the right to erasure.
