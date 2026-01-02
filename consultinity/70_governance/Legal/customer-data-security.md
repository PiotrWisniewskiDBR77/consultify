# Customer Data Security Policy

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

This Customer Data Security Policy describes how **DBR77 Robotics Sp. z o.o.** ("we", "us", "our") protects data entrusted to us by our customers ("Customer Data") when using Consultinity.

This policy supplements our [Security Overview](/security), [Privacy Policy](/privacy), and [Data Processing Addendum](/legal/dpa).

## 2. Scope and Definitions

### 2.1 Customer Data

"Customer Data" includes:
- **Content Data:** Documents, assessments, roadmaps, initiatives, and reports you create
- **Configuration Data:** Organization settings, user preferences, and workflows
- **Integration Data:** Data synchronized from connected third-party systems
- **AI Interaction Data:** Prompts, questions, and AI-generated outputs

### 2.2 Personal Data

Personal Data contained within Customer Data is processed in accordance with our [Privacy Policy](/privacy) and [Data Processing Addendum](/legal/dpa).

### 2.3 Excluded Data

This policy does not cover:
- Aggregated, anonymized analytics data
- System logs and performance metrics
- Data you make publicly available

## 3. Data Custody Model

### 3.1 Ownership

You retain full ownership of your Customer Data. We act as a custodian and processor of your data solely to provide the Service.

### 3.2 Our Responsibilities

As data custodian, we are responsible for:

| Responsibility | Commitment |
|----------------|------------|
| **Confidentiality** | Protect data from unauthorized access |
| **Integrity** | Prevent unauthorized modification |
| **Availability** | Ensure data is accessible when needed |
| **Recoverability** | Enable data recovery in case of incidents |

### 3.3 Your Responsibilities

You are responsible for:
- Accuracy of data you upload
- Managing user access within your organization
- Complying with laws applicable to your data
- Backing up critical data independently

## 4. Tenant Isolation

### 4.1 Data Separation

Each customer organization operates in complete isolation:

| Layer | Isolation Method |
|-------|------------------|
| **Database** | Logical separation with organization_id enforcement |
| **File Storage** | Isolated S3 prefixes per organization |
| **Application** | Middleware enforces organization context |
| **API** | All requests scoped to authenticated organization |
| **Backups** | Organization-specific backup sets |

### 4.2 Access Control

| Control | Implementation |
|---------|----------------|
| **Authentication** | All requests require valid JWT token |
| **Authorization** | Role-based access control (RBAC) |
| **Organization Binding** | Users can only access their organization's data |
| **API Keys** | Scoped to organization, rotatable |

### 4.3 Cross-Tenant Protection

We implement multiple safeguards to prevent cross-tenant data access:

- Database queries always include organization filter
- Application middleware validates organization context
- API endpoints verify organization membership
- Automated testing for tenant isolation
- Security audit logging for all data access

## 5. Encryption

### 5.1 Encryption at Rest

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| **Database** | AES-256 (AWS RDS encryption) | AWS KMS |
| **File Storage** | AES-256 (S3 SSE) | AWS KMS |
| **Backups** | AES-256 | AWS KMS |
| **Credentials** | AES-256 + field-level encryption | Application-managed keys |

### 5.2 Encryption in Transit

| Communication | Standard |
|---------------|----------|
| **Browser to Application** | TLS 1.3 |
| **Application to Database** | TLS 1.3 |
| **Application to AI Providers** | TLS 1.3 |
| **Internal Services** | mTLS (mutual TLS) |

### 5.3 Key Management

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | AWS Key Management Service (KMS) |
| **Key Rotation** | Automatic annual rotation |
| **Access to Keys** | Limited to essential services |
| **Key Auditing** | All key usage logged in CloudTrail |

### 5.4 BYOK Encryption (Enterprise)

Enterprise customers can provide their own encryption keys:
- Customer-managed AWS KMS keys
- Keys never leave customer's AWS account
- We have use-only access, not admin access
- Customer can revoke access at any time

## 6. AI Processing Security

### 6.1 Data Minimization

When processing data through AI features:

| Principle | Implementation |
|-----------|----------------|
| **Context Limitation** | Only relevant data sent to AI |
| **PII Handling** | Redaction applied where feasible |
| **Prompt Engineering** | Minimal data in system prompts |
| **Response Filtering** | Sensitive data filtered from responses |

### 6.2 AI Provider Security

| Provider | Data Handling |
|----------|---------------|
| **OpenAI** | Zero data retention (API), no training |
| **Anthropic** | Zero data retention, no training |
| **Google** | Per DPA, no training |

### 6.3 BYOK (Bring Your Own Key) Security

For customers using their own AI provider keys:

| Aspect | Security Measure |
|--------|------------------|
| **Key Storage** | Encrypted at rest (AES-256) |
| **Key Access** | Decrypted only during API call |
| **Key Isolation** | Stored in separate encrypted vault |
| **Key Logging** | Keys never logged or exposed |
| **Direct Routing** | Prompts go directly to your provider |

### 6.4 Local LLM Security (Enterprise)

For customers using self-hosted LLMs:
- Data never leaves your infrastructure
- We provide orchestration only
- Secure endpoint configuration
- Certificate validation for HTTPS

## 7. Data Breach Response

### 7.1 Detection

We employ multiple detection mechanisms:

| Method | Coverage |
|--------|----------|
| **Intrusion Detection** | AWS GuardDuty |
| **Anomaly Detection** | Unusual access patterns |
| **Log Monitoring** | 24/7 automated monitoring |
| **User Reports** | security@dbr77.com |

### 7.2 Incident Classification

| Severity | Description | Example |
|----------|-------------|---------|
| **P1 - Critical** | Confirmed data breach | Unauthorized data access |
| **P2 - High** | Potential data exposure | Vulnerability discovered |
| **P3 - Medium** | Security concern | Failed attack attempt |
| **P4 - Low** | Minor issue | Configuration weakness |

### 7.3 Response Timeline

| Action | Timeline |
|--------|----------|
| **Initial Detection** | Continuous monitoring |
| **Triage & Assessment** | Within 1 hour |
| **Containment** | Within 4 hours |
| **Customer Notification** | Within 72 hours (P1/P2) |
| **Regulatory Notification** | Within 72 hours (if required) |
| **Root Cause Analysis** | Within 5 business days |
| **Post-Incident Report** | Within 10 business days |

### 7.4 Customer Notification

For incidents affecting your data, we will notify you with:

| Information | Details |
|-------------|---------|
| **Nature** | Description of the incident |
| **Timing** | When it occurred and was detected |
| **Scope** | What data was potentially affected |
| **Impact** | Assessed consequences |
| **Actions** | Steps we've taken |
| **Recommendations** | Actions you should take |
| **Contact** | Dedicated incident contact |

### 7.5 Communication Channels

| Severity | Primary | Secondary |
|----------|---------|-----------|
| **P1 - Critical** | Phone (if provided) + Email | In-app banner |
| **P2 - High** | Email to admin(s) | In-app notification |
| **P3/P4** | Email to admin(s) | — |

## 8. Data Recovery

### 8.1 Backup Strategy

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| **Database** | Daily full, hourly incremental | 30 days | EU (separate region) |
| **Files** | Daily | 30 days | EU (separate region) |
| **Configuration** | Daily | 90 days | Version controlled |

### 8.2 Recovery Objectives

| Metric | Target |
|--------|--------|
| **RPO (Recovery Point Objective)** | 24 hours (standard), 1 hour (Enterprise) |
| **RTO (Recovery Time Objective)** | 4 hours |

### 8.3 Recovery Process

In case of data loss or corruption:

1. **Assessment:** Determine scope and cause
2. **Communication:** Notify affected customers
3. **Recovery:** Restore from most recent clean backup
4. **Validation:** Verify data integrity
5. **Documentation:** Provide incident report

### 8.4 Customer-Initiated Recovery

You can request data recovery:
- Contact support@dbr77.com
- Specify time range and data scope
- Recovery within 24 hours (business days)
- Additional fees may apply for complex recoveries

## 9. Data Export and Portability

### 9.1 Self-Service Export

You can export your data at any time:

| Data Type | Format | Location |
|-----------|--------|----------|
| **Assessments** | JSON, PDF | Settings → Export |
| **Roadmaps** | JSON, PDF | Project → Export |
| **Initiatives** | JSON, CSV | Project → Export |
| **Documents** | Original format | Documents → Download |
| **Full Export** | ZIP (JSON + files) | Settings → Data → Export All |

### 9.2 API Export

Scale and Enterprise plans can export via API:
- `GET /api/export/organization` - Full organization export
- `GET /api/export/project/:id` - Project-specific export
- Rate limits apply

### 9.3 Post-Termination Export

After subscription ends:
- 30 days to export data
- Support available for assisted export
- Enterprise: Custom retention terms available

## 10. Right to Audit

### 10.1 Information Available

Upon request, we provide:

| Document | Availability |
|----------|--------------|
| **SOC 2 Type II Report** | Under NDA (when available) |
| **Penetration Test Summary** | Under NDA |
| **Security Questionnaire** | SIG, CAIQ, custom |
| **DPA** | Publicly available |
| **Sub-processor List** | Publicly available |

### 10.2 On-Site Audits (Enterprise)

Enterprise customers may conduct on-site audits:
- Minimum 30 days notice
- During business hours
- Limited to DPA scope
- At customer's expense
- Subject to confidentiality agreement

### 10.3 Third-Party Audits

You may engage a third-party auditor:
- Subject to our approval (not unreasonably withheld)
- Bound by confidentiality agreement
- Limited to compliance verification
- Results shared with us

## 11. Compliance

### 11.1 Certifications and Standards

| Standard | Status |
|----------|--------|
| **GDPR** | ✅ Compliant |
| **ePrivacy Directive** | ✅ Compliant |
| **SOC 2 Type II** | 🔄 In progress (Q2 2025) |
| **ISO 27001** | 📋 Planned (Q4 2025) |

### 11.2 Data Residency

| Tier | Primary Location | Options |
|------|------------------|---------|
| **Growth/Scale** | EU (Germany, Netherlands) | — |
| **Enterprise** | EU (default) | Custom regions available |

### 11.3 Regulatory Cooperation

We cooperate with:
- Data protection authorities
- Law enforcement (with valid legal process)
- Your compliance audits

## 12. Security Governance

### 12.1 Security Team

| Role | Responsibility |
|------|----------------|
| **Security Lead** | Overall security program |
| **DPO** | Data protection and privacy |
| **DevSecOps** | Application security |
| **Infrastructure** | Cloud security |

### 12.2 Security Reviews

| Review | Frequency |
|--------|-----------|
| **Access Reviews** | Quarterly |
| **Vulnerability Scans** | Weekly |
| **Penetration Testing** | Annual |
| **Policy Review** | Annual |
| **Incident Drills** | Semi-annual |

### 12.3 Continuous Improvement

We continuously improve security through:
- Bug bounty program (planned)
- Security research engagement
- Industry best practices adoption
- Customer feedback integration

## 13. Customer Security Controls

### 13.1 Available Controls

| Control | Growth | Scale | Enterprise |
|---------|--------|-------|------------|
| **SSO** | Google/Microsoft | Google/Microsoft | SAML/SCIM |
| **MFA** | Available | Available | Enforced |
| **IP Allowlisting** | — | — | ✅ |
| **Session Timeout** | Configurable | Configurable | Configurable |
| **Audit Logs** | 90 days | 1 year | 7 years |
| **BYOK (AI)** | — | ✅ | ✅ |
| **BYOK (Encryption)** | — | — | ✅ |

### 13.2 Configuring Security

Access security settings:
- Settings → Security (organization admin)
- Configure MFA, session policies, and access controls
- Review audit logs

## 14. Contact

**Security Team**
- Email: security@dbr77.com
- For urgent security issues: Include "URGENT" in subject

**Privacy/DPO**
- Email: privacy@dbr77.com

**Incident Reporting**
- Email: security@dbr77.com
- Subject: Security Incident - [Organization Name]

**Enterprise Security Inquiries**
- Email: enterprise@dbr77.com

---

*This Customer Data Security Policy is maintained by DBR77 Robotics Sp. z o.o. and reflects our commitment to protecting your data.*

