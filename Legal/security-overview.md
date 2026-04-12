# Security Overview

**Effective Date:** April 1, 2026
**Version:** 2.0

Security is foundational to the Consultify Consulting Intelligence Platform. This document describes the technical and organizational measures we implement to protect your data and ensure the integrity of our Services.

## 1. Our Commitment

DBR77 is committed to protecting the confidentiality, integrity, and availability of all data processed through the Consultify platform. Our security program is built on the principles of:

- **Defense in depth:** multiple layers of security controls at every level.
- **Least privilege:** access is granted only to the minimum extent necessary.
- **Continuous improvement:** regular assessment and enhancement of security measures.
- **Transparency:** open communication about our security practices.

## 2. Infrastructure Security

- **Cloud hosting:** the Services are hosted on SOC 2 Type II and ISO 27001 certified cloud infrastructure providers in the EU (Frankfurt) and US (Virginia) regions.
- **Network isolation:** all production systems run in private VPCs with strict security group rules, intrusion detection systems (IDS), and DDoS mitigation.
- **Redundancy:** multi-availability-zone deployment for high availability with automatic failover.
- **Backups:** automated, encrypted backups performed daily with point-in-time recovery capability. Backup restoration is tested regularly.
- **Container security:** all services run in isolated containers with minimal attack surface.

## 3. Data Encryption

- **In transit:** all data is encrypted using TLS 1.2 or higher. We enforce HTTPS for all connections and use HSTS headers.
- **At rest:** all stored data, including databases, backups, and file storage, is encrypted using AES-256.
- **Key management:** encryption keys are managed through dedicated Key Management Services (KMS) with automatic rotation.
- **Secrets management:** all credentials, API keys, and sensitive configuration are stored in encrypted vault services, never in code.

## 4. Access Control

- **Authentication:** JWT-based authentication with configurable session policies. Multi-factor authentication (MFA) available for all users. SSO via SAML 2.0 and OIDC for Enterprise customers.
- **Role-based access control (RBAC):** fine-grained permissions for users, admins, and super-admins across all features and data.
- **Multi-tenancy isolation:** strict tenant isolation through row-level security policies, ensuring no cross-tenant data access.
- **Least privilege:** all internal access follows the principle of least privilege, with regular access reviews.
- **API security:** API keys with scoped permissions, rate limiting, and IP allowlisting available for Enterprise.

## 5. Monitoring & Logging

- **Audit logging:** comprehensive audit logs of all user actions, API calls, and administrative operations, retained for 12+ months.
- **Real-time monitoring:** continuous monitoring of application health, security events, and anomalous behavior.
- **SIEM integration:** security events are aggregated and analyzed through SIEM tools for threat detection and incident correlation.
- **Uptime monitoring:** external synthetic monitoring from multiple geographic locations with 60-second intervals.

## 6. Incident Response

Our incident response process follows industry best practices:

1. **Detection:** automated monitoring and alerts detect potential security incidents.
2. **Triage:** incidents are classified by severity (P1–P4) and assigned to the appropriate response team.
3. **Containment:** immediate actions to contain the incident and prevent further impact.
4. **Notification:** for Personal Data Breaches, we notify affected customers within 72 hours in accordance with GDPR Article 33.
5. **Remediation:** root cause analysis, system recovery, and implementation of preventive measures.
6. **Post-incident review:** documented post-mortem with lessons learned and action items.

## 7. Penetration Testing & Vulnerability Management

- **Annual penetration testing:** conducted by independent third-party security firms.
- **Vulnerability scanning:** automated scanning of infrastructure and applications on a regular cadence.
- **Dependency management:** continuous monitoring of third-party dependencies for known vulnerabilities, with critical patches applied within 48 hours.
- **Secure SDLC:** security is integrated into the software development lifecycle, including code reviews, static analysis, and security testing.

## 8. Compliance & Certifications

- **GDPR:** fully compliant with the EU General Data Protection Regulation. DPO contactable at dpo@dbr77.com.
- **SOC 2 Type II:** security controls aligned with AICPA Trust Service Criteria (certification in progress).
- **ISO 27001:** information security management system aligned with ISO 27001 (certification in progress).
- **IEC 62443:** security practices aligned with industrial cybersecurity standards where applicable.

For compliance documentation or security questionnaire responses, contact security@dbr77.com.

## 9. Responsible Disclosure

If you discover a potential security vulnerability, we encourage responsible disclosure:

**Report to:** security@dbr77.com

Please include:

- Description of the vulnerability and potential impact.
- Steps to reproduce.
- Any supporting evidence (screenshots, logs).

We commit to:

- Acknowledging your report within 48 hours.
- Providing regular updates on remediation progress.
- Not pursuing legal action against good-faith security researchers.
- Coordinated disclosure timeline of 90 days.

## 10. Contact

**Security team:** security@dbr77.com
**Data Protection Officer:** dpo@dbr77.com

**DBR77 Robotics Sp. z o.o.**
ul. Żółkiewskiego 31, 87-100 Toruń, Poland
