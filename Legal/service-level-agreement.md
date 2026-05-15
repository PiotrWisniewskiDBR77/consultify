# Service Level Agreement

**Effective Date:** April 1, 2026
**Version:** 2.0

This Service Level Agreement ("SLA") defines the service availability commitments, incident response standards, and remedies for the Consultify Consulting Intelligence Platform ("Services"). This SLA applies to all customers with active, paid subscription plans (Scale and Enterprise tiers) and forms part of the Agreement between you and DBR77 Robotics Sp. z o.o.

## 1. Service Availability

DBR77 commits to maintaining **99.9% monthly uptime** for the Consultify production Services ("Uptime Commitment"). Uptime is calculated as follows:

`Uptime % = ((Total Minutes in Month − Downtime Minutes) / Total Minutes in Month) × 100`

**"Downtime"** means any period during which the Consultify core platform services (authentication, AI chat, assessment tools, dashboard, API) are materially unavailable to all users, as measured by our external monitoring systems. A period of Downtime begins when DBR77 confirms the outage (or when our monitoring detects it, whichever is earlier) and ends when the service is restored.

The 99.9% Uptime Commitment allows for a maximum of approximately 43 minutes of unplanned Downtime per month.

## 2. Scheduled Maintenance

Scheduled maintenance is necessary to keep the Services secure, up to date, and performing optimally:

- **Standard maintenance window:** Sundays, 02:00–06:00 UTC. Most maintenance is performed during this window with zero or minimal downtime.
- **Advance notice:** we provide at least 72 hours' notice for scheduled maintenance that may cause service interruption, via email and in-app notification.
- **Emergency maintenance:** critical security patches or urgent fixes may require maintenance outside the standard window. We will provide as much advance notice as reasonably possible (minimum 4 hours for non-critical emergencies).
- **Exclusion:** scheduled maintenance periods with proper advance notice are excluded from Downtime calculations.

## 3. Incident Classification

Incidents are classified by severity to ensure appropriate prioritization and response:

| Severity | Definition | Examples |
|----------|------------|----------|
| P1 — Critical | Complete outage or critical functionality unavailable; business severely impacted; no workaround | Platform down; AI services halted; authentication failure |
| P2 — High | Major feature degraded or unavailable; business impact; workaround exists | Assessment tools failing; API latency >10× normal; reports broken |
| P3 — Medium | Minor or intermittent issue; limited impact; workaround available | Intermittent UI issues; non-critical delays; minor display problems |
| P4 — Low | Inquiry, documentation, or enhancement request; no immediate business impact | Feature requests; how-to questions; cosmetic issues |

## 4. Response and Resolution Times

### Scale Tier

| Severity | Initial Response | Status Updates | Target Resolution |
|----------|------------------|----------------|-------------------|
| P1 | 2 hours | Every 2 hours | 8 hours |
| P2 | 8 hours | Every 8 hours | 24 hours |
| P3 | 24 hours | Every 24 hours | 5 business days |
| P4 | 48 hours | As needed | Best effort |

### Enterprise Tier

| Severity | Initial Response | Status Updates | Target Resolution |
|----------|------------------|----------------|-------------------|
| P1 | 30 minutes | Every 1 hour | 4 hours |
| P2 | 4 hours | Every 4 hours | 12 hours |
| P3 | 8 hours | Every 12 hours | 3 business days |
| P4 | 24 hours | As needed | Best effort |

Response times are measured during business hours (Monday–Friday, 08:00–18:00 CET) for P3 and P4 incidents. P1 and P2 incidents are covered 24/7 for Enterprise tier customers.

## 5. Escalation

If you are not satisfied with the progress on an incident, you may escalate through the following channels:

- **Level 1 — Support Engineer:** initial point of contact for all incidents via the support portal and support@dbr77.com.
- **Level 2 — Engineering Lead:** escalation for P1/P2 incidents not resolved within target times, or when technical complexity requires senior involvement.
- **Level 3 — VP of Engineering:** escalation for persistent P1 incidents or systemic issues affecting multiple customers.
- **Executive escalation:** Enterprise customers may contact their designated Customer Success Manager or Account Executive for executive-level escalation.

## 6. Service Credits

If we fail to meet the Uptime Commitment in any calendar month, you may be eligible for service credits:

| Monthly Uptime | Service Credit (% of monthly fee) |
|----------------|-----------------------------------|
| 99.0% – 99.9% | 10% |
| 95.0% – 99.0% | 25% |
| Below 95.0% | 50% |

**How to claim:** submit a written request to support@dbr77.com within thirty (30) days after the end of the month in which the Downtime occurred. Include the dates, times, and description of impact.

- Service credits are applied to future invoices and are not redeemable for cash.
- Maximum aggregate service credit for any month shall not exceed 50% of the monthly fee.
- Service credits are your sole and exclusive remedy for failure to meet the Uptime Commitment.

## 7. Exclusions

The Uptime Commitment and service credits do not apply to unavailability caused by:

- Scheduled maintenance performed in accordance with Section 2.
- Force majeure events, including natural disasters, war, terrorism, pandemics, government actions, or widespread internet or utility failures.
- Actions or inactions of the Customer or its Authorized Users, including misconfiguration, unauthorized modifications, or excessive load beyond agreed capacity.
- Failures of third-party services, networks, or equipment not under DBR77's control.
- Free, trial, beta, or preview features and services.
- Customer-initiated downtime (e.g., requested data migrations, environment resets).
- DNS issues outside DBR77's managed infrastructure.

## 8. Monitoring

We use the following monitoring practices to ensure service reliability:

- **External synthetic monitoring:** automated health checks from multiple geographic locations every 60 seconds.
- **Internal application monitoring:** real-time metrics on latency, error rates, throughput, and resource utilization.
- **Status page:** real-time service status is published at status.consultify.ai. Customers can subscribe to email or webhook notifications for status updates.
- **Alerting:** automated alerts trigger on-call response for any degradation detected by monitoring systems.

## 9. Reporting

- **Monthly uptime reports:** available to all paid customers through the Consultify admin dashboard, showing monthly uptime percentage, incident history, and resolution details.
- **Incident post-mortems:** for P1 and P2 incidents, we publish a root cause analysis (RCA) within five (5) business days of resolution.
- **Quarterly business reviews:** Enterprise customers receive quarterly service reviews with their Customer Success Manager.

## 10. Contact

For support requests, incident reports, or SLA-related inquiries:

**Support:** support@dbr77.com
**DBR77 Robotics Sp. z o.o.** — ul. Żółkiewskiego 31, 87-100 Toruń, Poland
