# Customer Data Security

**Effective Date:** April 1, 2026
**Version:** 2.0

This document describes how DBR77 Robotics Sp. z o.o. protects Customer Data within the Consultify Consulting Intelligence Platform. It supplements our [Security Overview](/legal/security) and [Privacy Policy](/legal/privacy).

## 1. Data Classification

We classify data processed through Consultify into the following categories:

| Category | Description | Protection Level |
|----------|-------------|-----------------|
| **Customer Data** | Organization profiles, assessments, initiatives, documents, and content created by customers | Highest — encrypted, isolated, access-controlled |
| **Account Data** | User profiles, authentication credentials, billing information | High — encrypted, access-controlled |
| **Usage Data** | Feature usage, session data, interaction patterns | Medium — anonymized where possible |
| **System Data** | Logs, metrics, configuration | Standard — retention-limited |

## 2. Data Isolation

- **Tenant isolation:** each customer's data is logically isolated through row-level security policies. No customer can access another customer's data through the application.
- **Database isolation:** customer data is stored with tenant-scoped access controls at the database level.
- **AI processing isolation:** when Customer Data is sent to AI models for processing, each request is scoped to the individual customer's context. No cross-tenant data mixing occurs.
- **Environment separation:** production, staging, and development environments are fully separated. Customer Data is never used in non-production environments.

## 3. Encryption

### Data in Transit

- All connections use TLS 1.2 or higher with strong cipher suites.
- Internal service-to-service communication is encrypted.
- API connections enforce HTTPS with HSTS.

### Data at Rest

- All databases: AES-256 encryption.
- File storage: server-side encryption with managed keys.
- Backups: encrypted with separate key management.
- Encryption keys are managed through dedicated KMS with automatic rotation.

## 4. Access Control

### Customer-Side Controls

- **Role-based access:** customers can define roles and permissions for their team members.
- **SSO integration:** SAML 2.0 and OIDC for Enterprise customers.
- **MFA:** available for all users, enforceable by organization admins.
- **Session management:** configurable session duration, IP restrictions, and concurrent session limits.
- **Audit trail:** customers can view audit logs of actions within their workspace.

### DBR77 Internal Controls

- Production data access requires explicit justification and approval.
- All access is logged and regularly audited.
- Engineers do not have default access to Customer Data.
- Support access to customer workspaces requires customer authorization and is logged.

## 5. Data Retention and Deletion

- **Active accounts:** Customer Data is retained for the duration of the subscription.
- **After cancellation:** customers have 30 days to export data. After 30 days, data is queued for deletion.
- **Deletion process:** data is permanently deleted from primary storage and backups within 90 days of the deletion request.
- **Legal holds:** data may be retained beyond standard periods if required by law or ongoing legal proceedings.

## 6. Backup and Recovery

- **Backup frequency:** automated daily backups with point-in-time recovery.
- **Backup encryption:** all backups are encrypted with AES-256.
- **Backup location:** backups are stored in a geographically separate region from primary data, within the same regulatory jurisdiction.
- **Recovery testing:** backup restoration procedures are tested quarterly.
- **RTO/RPO:** Recovery Time Objective of 4 hours and Recovery Point Objective of 1 hour for critical services.

## 7. Incident Response for Customer Data

In the event of a security incident affecting Customer Data:

1. **Detection and assessment:** we identify the scope and impact of the incident.
2. **Customer notification:** affected customers are notified within 48 hours of confirmed incidents involving their data (within 72 hours for GDPR-reportable Personal Data Breaches).
3. **Containment:** immediate measures to stop the incident and prevent further data exposure.
4. **Investigation:** thorough root cause analysis with timeline and impact assessment.
5. **Remediation:** implementation of corrective measures and verification.
6. **Post-incident report:** detailed report provided to affected customers, including timeline, root cause, impact, and preventive measures.

## 8. Compliance

Our Customer Data security practices are aligned with:

- **GDPR** — EU General Data Protection Regulation
- **SOC 2 Type II** — AICPA Trust Service Criteria
- **ISO 27001** — Information Security Management
- **IEC 62443** — Industrial Cybersecurity (where applicable)

## 9. Contact

**Security team:** security@dbr77.com
**Data Protection Officer:** dpo@dbr77.com

**DBR77 Robotics Sp. z o.o.**
ul. Żółkiewskiego 31, 87-100 Toruń, Poland
