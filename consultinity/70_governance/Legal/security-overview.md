# Security Overview

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

At Consultinity, operated by **DBR77 Robotics Sp. z o.o.**, security is foundational to everything we build. This document provides an overview of our security practices, certifications, and commitments.

**Company Information:**
- DBR77 Robotics Sp. z o.o.
- ul. Żółkiewskiego 31, 87-100 Toruń, Poland
- NIP: 8792725331 | KRS: 0000860440

## 2. Our Security Commitment

We are committed to protecting your data through:

- **Defense in Depth:** Multiple layers of security controls
- **Least Privilege:** Access limited to what's necessary
- **Transparency:** Clear communication about our practices
- **Continuous Improvement:** Regular audits and updates
- **Compliance:** Adherence to industry standards and regulations

## 3. Infrastructure Security

### 3.1 Cloud Infrastructure

| Component | Implementation |
|-----------|----------------|
| **Cloud Provider** | Amazon Web Services (AWS) |
| **Provider Certifications** | SOC 2 Type II, ISO 27001, PCI DSS |
| **Primary Region** | EU (Frankfurt, Germany) |
| **Secondary Region** | EU (Dublin, Ireland) |
| **Architecture** | Multi-AZ deployment for high availability |

### 3.2 Network Security

| Control | Implementation |
|---------|----------------|
| **VPC Isolation** | Dedicated Virtual Private Cloud |
| **Web Application Firewall (WAF)** | AWS WAF with OWASP rule sets |
| **DDoS Protection** | AWS Shield Standard + monitoring |
| **Load Balancing** | Application Load Balancer with health checks |
| **Network Segmentation** | Separate tiers for web, app, and database |
| **Bastion Hosts** | Restricted access for administration |

### 3.3 Physical Security

AWS data centers feature:
- 24/7 security staff and monitoring
- Multi-factor access controls
- Biometric scanners
- Video surveillance
- Environmental controls (fire, flood, climate)
- Redundant power and connectivity

## 4. Data Protection

### 4.1 Encryption

| State | Standard | Details |
|-------|----------|---------|
| **In Transit** | TLS 1.3 | All connections encrypted; HSTS enabled |
| **At Rest** | AES-256 | Database, file storage, backups |
| **Key Management** | AWS KMS | Automatic rotation, hardware security modules |

### 4.2 Data Classification

| Classification | Examples | Protections |
|----------------|----------|-------------|
| **Public** | Marketing content, documentation | Standard |
| **Internal** | Aggregated analytics | Access controls |
| **Confidential** | Customer data, credentials | Encryption + access controls |
| **Restricted** | Payment data, PII | Enhanced encryption + audit + limited access |

### 4.3 Data Handling

| Practice | Implementation |
|----------|----------------|
| **Minimization** | Collect only what's necessary |
| **Purpose Limitation** | Use data only for stated purposes |
| **Retention** | Delete when no longer needed |
| **Secure Deletion** | Cryptographic erasure or secure wipe |

### 4.4 Data Custody (Customer Data)

We act as a custodian of your data. Our responsibilities include:

| Responsibility | Our Commitment |
|----------------|----------------|
| **Confidentiality** | Protect data from unauthorized access |
| **Integrity** | Prevent unauthorized modification |
| **Availability** | Ensure data is accessible per SLA |
| **Tenant Isolation** | Complete separation between customer organizations |
| **Recoverability** | Enable data recovery from backups |

**Customer Data Security Details:** For comprehensive information about how we protect your data, including encryption, tenant isolation, and incident response, see our [Customer Data Security Policy](/legal/customer-security).

## 5. Access Control

### 5.1 Authentication

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcrypt with salt |
| **Password Requirements** | Minimum 8 characters, complexity encouraged |
| **Multi-Factor Authentication (MFA)** | TOTP (Google Authenticator, Authy, etc.) |
| **Single Sign-On (SSO)** | SAML 2.0, Google OIDC, Microsoft Entra ID |
| **Session Management** | JWT tokens, 8-hour expiration, secure cookies |
| **Account Lockout** | After 5 failed attempts |

### 5.2 Authorization

| Feature | Implementation |
|---------|----------------|
| **Model** | Role-Based Access Control (RBAC) |
| **Principle** | Least privilege |
| **Roles** | Owner, Admin, Member, Viewer (customizable) |
| **Organization Isolation** | Complete data separation between organizations |
| **Audit** | All access logged |

### 5.3 Employee Access

| Control | Implementation |
|---------|----------------|
| **Background Checks** | Pre-employment verification (where permitted) |
| **Access Reviews** | Quarterly access audits |
| **Need-to-Know** | Production access limited to essential personnel |
| **Privileged Access Management** | Elevated access requires approval and logging |
| **Offboarding** | Immediate access revocation |

## 6. Application Security

### 6.1 Secure Development

| Practice | Implementation |
|----------|----------------|
| **OWASP Top 10** | All common vulnerabilities addressed |
| **Code Review** | Mandatory peer review for all changes |
| **Static Analysis** | Automated security scanning (SAST) |
| **Dependency Scanning** | Automated vulnerability detection (npm audit, Snyk) |
| **Security Testing** | Included in CI/CD pipeline |

### 6.2 Vulnerability Management

| Activity | Frequency |
|----------|-----------|
| **Dependency Updates** | Weekly review, immediate for critical |
| **Infrastructure Patching** | Monthly or immediate for critical |
| **Vulnerability Scanning** | Weekly automated scans |
| **Penetration Testing** | Annual third-party assessment |

### 6.3 Security Headers

| Header | Value |
|--------|-------|
| **Strict-Transport-Security** | max-age=31536000; includeSubDomains |
| **X-Content-Type-Options** | nosniff |
| **X-Frame-Options** | DENY |
| **X-XSS-Protection** | 1; mode=block |
| **Referrer-Policy** | strict-origin-when-cross-origin |
| **Content-Security-Policy** | Restrictive policy |

## 7. AI Security

### 7.1 AI Data Protection

| Measure | Implementation |
|---------|----------------|
| **Data Minimization** | Only necessary data sent to AI providers |
| **No Training Use** | Customer data NOT used for AI model training |
| **Provider Agreements** | DPAs with all AI providers prohibiting data retention |
| **PII Redaction** | Applied where technically feasible |
| **Audit Logging** | All AI interactions logged |

### 7.2 AI Provider Security

| Provider | Security Measures |
|----------|-------------------|
| **OpenAI** | SOC 2 Type II, data not used for training (API) |
| **Anthropic** | SOC 2 Type II, data not retained |
| **Google AI** | ISO 27001, SOC 2, data per DPA |

### 7.3 AI Safety

| Measure | Implementation |
|---------|----------------|
| **Content Filtering** | Input/output safety measures |
| **Rate Limiting** | Prevent abuse |
| **Human Oversight** | All AI outputs are recommendations |
| **Audit Trail** | Full logging for accountability |

### 7.4 BYOK Security (Bring Your Own Key)

For customers using their own AI provider API keys:

| Measure | Implementation |
|---------|----------------|
| **Key Encryption** | API keys encrypted at rest (AES-256) |
| **Key Isolation** | Keys stored in separate encrypted vault |
| **Direct Routing** | Prompts sent directly to customer's provider |
| **No Key Logging** | API keys never logged or exposed |
| **Key Rotation** | Customers can rotate keys at any time |

## 8. Operational Security

### 8.1 Monitoring

| Type | Tools/Methods |
|------|---------------|
| **Infrastructure Monitoring** | AWS CloudWatch, custom dashboards |
| **Application Monitoring** | Sentry, custom metrics |
| **Security Monitoring** | AWS GuardDuty, CloudTrail |
| **Log Aggregation** | Centralized logging with retention |
| **Alerting** | 24/7 on-call rotation |

### 8.2 Logging

| Log Type | Retention | Purpose |
|----------|-----------|---------|
| **Access Logs** | 1 year | Security, audit |
| **Application Logs** | 90 days | Debugging, support |
| **Security Logs** | 1 year | Incident investigation |
| **Audit Logs** | 7 years | Compliance |

### 8.3 Incident Response

| Phase | Activities |
|-------|------------|
| **Detection** | Automated monitoring, user reports |
| **Triage** | Severity assessment, team notification |
| **Containment** | Isolate affected systems |
| **Eradication** | Remove threat |
| **Recovery** | Restore normal operations |
| **Post-Incident** | Root cause analysis, improvements |

**Incident Response Time:**
- P1 (Critical): Response within 1 hour
- P2 (High): Response within 4 hours
- P3 (Medium): Response within 1 business day

## 9. Business Continuity

### 9.1 Backup

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| **Database** | Daily full, hourly incremental | 30 days | Separate AWS region (EU) |
| **Files** | Daily | 30 days | Separate AWS region (EU) |
| **Configuration** | Daily | 90 days | Version controlled |

### 9.2 Disaster Recovery

| Metric | Target |
|--------|--------|
| **RPO (Recovery Point Objective)** | 24 hours |
| **RTO (Recovery Time Objective)** | 4 hours |

**DR Testing:** Annual disaster recovery drill

### 9.3 Geographic Redundancy

| Region | Role |
|--------|------|
| **EU-Central (Frankfurt)** | Primary |
| **EU-West (Ireland)** | Failover |
| **Additional Regions** | Available for Enterprise customers |

## 10. Compliance

### 10.1 Current Compliance

| Standard/Regulation | Status |
|---------------------|--------|
| **GDPR** | ✅ Compliant |
| **ePrivacy Directive** | ✅ Compliant |
| **SOC 2 Type II** | 🔄 In progress (Q2 2025) |
| **ISO 27001** | 📋 Planned (Q4 2025) |

### 10.2 Data Processing Agreements

We offer Data Processing Addendums (DPAs) for customers requiring GDPR compliance. DPA available at [/legal/dpa](/legal/dpa).

### 10.3 Sub-processor List

Current list of sub-processors available at [/legal/subprocessors](/legal/subprocessors).

## 11. Vendor Security

### 11.1 Vendor Assessment

All vendors undergo security assessment including:
- Security questionnaire (SIG or equivalent)
- Review of certifications (SOC 2, ISO 27001)
- Data processing agreement
- Ongoing monitoring

### 11.2 Critical Vendors

| Vendor | Purpose | Certifications |
|--------|---------|----------------|
| **AWS** | Infrastructure | SOC 2, ISO 27001 |
| **Stripe** | Payments | PCI DSS Level 1, SOC 2 |
| **OpenAI** | AI Services | SOC 2 |
| **Anthropic** | AI Services | SOC 2 |
| **Mailgun** | Email | SOC 2 |

## 12. Security Training

### 12.1 Employee Training

| Training | Frequency | Topics |
|----------|-----------|--------|
| **Security Awareness** | Annual | Phishing, social engineering, data handling |
| **Secure Development** | Onboarding + annual | OWASP, secure coding |
| **Incident Response** | Annual | IR procedures, roles |
| **Role-Specific** | As needed | Based on job function |

### 12.2 Phishing Simulation

Regular phishing simulations to test employee awareness.

## 13. Reporting Security Issues

### 13.1 Responsible Disclosure

We welcome security researchers to report vulnerabilities responsibly.

**Contact:** security@dbr77.com

**PGP Key:** Available upon request

### 13.2 What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any proof of concept (non-destructive)

### 13.3 Our Commitment

- Acknowledge receipt within 48 hours
- Keep you informed of progress
- Not pursue legal action for good-faith reports
- Credit researchers (if desired) after fix

### 13.4 Scope

**In scope:**
- consultinity.com and subdomains
- Consultinity application
- APIs

**Out of scope:**
- Social engineering of employees
- Physical attacks
- DoS/DDoS attacks
- Third-party services

## 14. Contact

**Security Team**
- Email: security@dbr77.com

**Data Protection/Privacy**
- Email: privacy@dbr77.com

**Compliance Requests**
- Email: legal@dbr77.com

**Security Documentation Requests**

For SOC 2 reports, security questionnaires, or penetration test summaries:
- Enterprise customers: Contact your account manager
- Others: Email security@dbr77.com with NDA

## 15. Additional Resources

- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Data Processing Addendum](/legal/dpa)
- [Sub-processor List](/legal/subprocessors)
- [Customer Data Security](/legal/customer-security)
- Status Page: status.consultinity.com

---

*By using Consultinity, you acknowledge that you have reviewed this Security Overview.*
