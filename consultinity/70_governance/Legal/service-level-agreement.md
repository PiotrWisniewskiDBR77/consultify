# Service Level Agreement (SLA)

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

This Service Level Agreement ("SLA") defines the service commitments for Consultinity, operated by DBR77 Robotics Sp. z o.o. This SLA is part of your subscription agreement and specifies uptime guarantees, support response times, and remedies.

## 2. Service Availability

### 2.1 Uptime Commitment

We commit to the following availability targets:

| Plan | Monthly Uptime | Permitted Downtime |
|------|----------------|-------------------|
| Growth | 99.5% | ~3.6 hours/month |
| Scale | 99.9% | ~43 minutes/month |
| Enterprise | 99.95% | ~22 minutes/month |

### 2.2 Uptime Calculation

Uptime is calculated as:

```
Uptime % = ((Total Minutes - Downtime Minutes) / Total Minutes) × 100
```

Measured on a calendar month basis.

### 2.3 Exclusions

The following are NOT counted as downtime:

- **Scheduled Maintenance:** Pre-announced maintenance windows
- **Emergency Maintenance:** Critical security patches (with notification)
- **Customer-Caused Issues:** Actions by you that cause service disruption
- **Force Majeure:** Events beyond our reasonable control
- **Third-Party Services:** Outages of external providers (e.g., AWS, AI providers)
- **Beta Features:** Features explicitly marked as beta or experimental

### 2.4 Maintenance Windows

| Type | Notice | Typical Duration | Timing |
|------|--------|------------------|--------|
| Scheduled | 72+ hours | 1-4 hours | Sundays 02:00-06:00 CET |
| Emergency | Best effort | Variable | As required |
| Updates | None (zero-downtime) | N/A | Continuous |

We strive to perform most updates with zero downtime using rolling deployments.

## 3. Support Response Times

### 3.1 Support Tiers

| Priority | Description | Growth SLA | Scale SLA | Enterprise SLA |
|----------|-------------|------------|-----------|----------------|
| **P1 - Critical** | Service unavailable, business stopped | 24h | 8h | 4h |
| **P2 - High** | Major feature broken, workaround possible | 48h | 24h | 8h |
| **P3 - Medium** | Non-critical issue, degraded experience | 72h | 48h | 24h |
| **P4 - Low** | Question, minor issue, feature request | 5 days | 3 days | 48h |

### 3.2 Priority Definitions

**P1 - Critical:**
- Platform completely inaccessible
- Data loss or corruption
- Security breach or vulnerability
- Complete failure of core functionality

**P2 - High:**
- Major feature unavailable
- Significant performance degradation
- API failures affecting integrations
- Issues affecting multiple users

**P3 - Medium:**
- Non-critical feature issues
- Single user issues
- Minor performance issues
- Documentation gaps

**P4 - Low:**
- General questions
- Feature requests
- Minor cosmetic issues
- Non-urgent inquiries

### 3.3 Response vs. Resolution

- **Response Time:** Time to initial acknowledgment
- **Resolution Time:** Not guaranteed (varies by complexity)

We aim to provide updates every:
- P1: Every 2 hours until resolved
- P2: Every 8 hours until resolved
- P3/P4: As progress is made

### 3.4 Support Hours

| Channel | Growth | Scale | Enterprise |
|---------|--------|-------|------------|
| Email | Business hours | Business hours | Business hours |
| Chat | — | Business hours | Extended hours |
| Phone | — | — | 24/7 for P1 |

**Business Hours:** Monday-Friday, 09:00-18:00 CET (excluding Polish holidays)
**Extended Hours:** Monday-Friday, 08:00-22:00 CET

### 3.5 Support Channels

| Channel | Contact |
|---------|---------|
| Email | support@dbr77.com |
| In-App | Help → Contact Support |
| Phone (Enterprise) | Provided to Enterprise customers |
| Slack (Enterprise) | Dedicated channel available |

## 4. Service Credits

### 4.1 Eligibility

You may be eligible for service credits if:
- Uptime falls below your plan's commitment
- You report the issue within 30 days
- Downtime exceeds the permitted threshold

### 4.2 Credit Calculation

| Monthly Uptime | Service Credit |
|----------------|----------------|
| 99.0% - 99.5% (Scale) | 10% of monthly fee |
| 99.0% - 99.9% (Enterprise) | 10% of monthly fee |
| 98.0% - 99.0% | 25% of monthly fee |
| 95.0% - 98.0% | 50% of monthly fee |
| Below 95.0% | 100% of monthly fee |

### 4.3 Credit Limits

- Maximum credit: 100% of one month's subscription fee
- Credits applied to future invoices
- Credits are not redeemable for cash
- Credits do not compound

### 4.4 Requesting Credits

To request a service credit:

1. Email sla@dbr77.com within 30 days of the incident
2. Include:
   - Account name and email
   - Date(s) and time(s) of downtime
   - Description of impact
   - Any relevant screenshots or logs

We will respond within 10 business days with credit determination.

## 5. Performance Targets

### 5.1 Response Time Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Page Load | < 3 seconds | P95 |
| API Response | < 500ms | P95 |
| AI Operations | < 30 seconds | P95 |
| Search | < 2 seconds | P95 |
| Export (small) | < 10 seconds | P95 |

### 5.2 Performance Monitoring

We monitor performance continuously and publish status at:
- **Status Page:** status.consultinity.com
- **Subscribe:** Email alerts for incidents

### 5.3 Performance Exclusions

Performance targets exclude:
- Operations on unusually large datasets
- Custom integrations and API usage beyond rate limits
- BYOK operations (depend on your AI provider)
- Beta features

## 6. Data Protection

### 6.1 Data Backup

| Aspect | Commitment |
|--------|------------|
| Backup Frequency | Daily |
| Backup Retention | 30 days |
| Geographic Redundancy | Multiple EU data centers |
| Recovery Point Objective (RPO) | 24 hours |
| Recovery Time Objective (RTO) | 4 hours |

### 6.2 Disaster Recovery

We maintain disaster recovery procedures including:
- Daily automated backups
- Cross-region replication
- Documented recovery procedures
- Annual DR testing (Enterprise: upon request, participate in tests)

### 6.3 Data Durability

- 99.999999999% (11 nines) storage durability
- Provided by underlying cloud infrastructure (AWS S3)

## 7. Security Commitments

### 7.1 Security Measures

We implement:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Regular security audits
- Penetration testing (annual)
- 24/7 security monitoring
- Vulnerability management

### 7.2 Security Incident Response

| Severity | Response | Notification |
|----------|----------|--------------|
| Critical | Immediate | Within 4 hours |
| High | Within 4 hours | Within 24 hours |
| Medium | Within 24 hours | Within 72 hours |
| Low | Within 72 hours | Monthly report |

### 7.3 Compliance

- GDPR compliant
- SOC 2 Type II (in progress)
- ISO 27001 (planned)

For security questions: security@dbr77.com

## 8. Enterprise SLA Enhancements

Enterprise customers may negotiate:

### 8.1 Custom Uptime

- Up to 99.99% uptime commitment
- Custom downtime windows
- Priority incident handling

### 8.2 Dedicated Resources

- Dedicated infrastructure options
- Named support engineer
- Quarterly business reviews
- Custom SLA reporting

### 8.3 Enhanced Support

- 24/7 P1/P2 support
- Private Slack channel
- Direct phone line
- On-site support (upon request)

### 8.4 Custom Terms

Contact sales@dbr77.com for custom enterprise SLA terms.

## 9. Remedies and Limitations

### 9.1 Sole Remedy

Service credits are your sole and exclusive remedy for SLA failures, except as required by applicable law.

### 9.2 Limitations

This SLA does not apply to:
- Free trial accounts
- Accounts with past due payments
- Terminated or suspended accounts
- Issues caused by customer actions

### 9.3 Changes to SLA

We may update this SLA with 30 days notice. Changes do not apply retroactively to active annual subscriptions.

## 10. Escalation Process

### 10.1 Escalation Path

If you're not satisfied with support response:

1. **Level 1:** Request supervisor review (via support ticket)
2. **Level 2:** Email escalations@dbr77.com
3. **Level 3:** Email ceo@dbr77.com

### 10.2 Escalation Timeline

- Level 1 → Level 2: After 48 hours without resolution
- Level 2 → Level 3: After additional 72 hours

## 11. Contact Information

**Support:**
- Email: support@dbr77.com
- In-App: Help → Contact Support

**SLA Issues:**
- Email: sla@dbr77.com

**Security:**
- Email: security@dbr77.com

**Status:**
- Page: status.consultinity.com

---

*This SLA is effective for all paid Consultinity subscriptions.*
