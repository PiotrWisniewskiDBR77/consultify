-- Seed placeholder legal documents for Subscription Terms, DPA, SLA, and Security Overview.
-- These make the /legal/:slug routes return content instead of "Document Not Found".
-- Content should be replaced with final legal copy by the legal team.

INSERT INTO legal_documents (
  id, type, doc_type, name, title, version, content, content_md,
  status, is_active, effective_date, effective_from,
  scope_type, created_by, published_by,
  created_at, updated_at, published_at, requires_acceptance
)
SELECT
  gen_random_uuid(), v.doc_type, v.doc_type, v.title, v.title, '1.0.0', v.content_md, v.content_md,
  'active', TRUE, NOW(), NOW(),
  'global', 'system', 'system',
  NOW(), NOW(), NOW(), CASE WHEN v.req_accept THEN 1 ELSE 0 END
FROM (VALUES
  (
    'SUBSCRIPTION',
    'Subscription Terms',
    '# Subscription Terms

## 1. Plans and billing

Consultify offers the following subscription tiers: Trial (free, 7 days), User, Admin, and Enterprise. Pricing is listed on the public pricing page and is subject to change with 30 days notice.

## 2. Seats and usage

Each plan includes a defined number of user seats and a shared AI credit budget pooled at the organization level. Unused credits roll forward within the billing cycle.

## 3. Renewal and cancellation

Subscriptions renew automatically at the end of each billing period. You may cancel at any time; access continues until the end of the current paid period.

## 4. Payment terms

All payments are processed in EUR via the payment provider configured at checkout. Invoices are issued automatically.

## 5. Changes to terms

We may update these terms with at least 30 days written notice. Continued use after the effective date constitutes acceptance.

*Effective: April 2026. Version 1.0.0.*',
    TRUE
  ),
  (
    'DPA',
    'Data Processing Addendum',
    '# Data Processing Addendum (DPA)

## 1. Scope

This DPA applies to all processing of personal data by Consultify (Processor) on behalf of the Customer (Controller) under the Subscription Terms.

## 2. Processing purposes

Personal data is processed solely to provide the Consultify platform services as described in the service documentation.

## 3. Sub-processors

A current list of sub-processors is maintained and available upon request. We notify customers at least 30 days before engaging a new sub-processor.

## 4. Data location

All customer data is stored and processed within the European Union (EU) unless an alternative data residency arrangement is agreed in writing.

## 5. Security measures

We implement technical and organizational measures including AES-256 encryption at rest, TLS 1.3 in transit, role-based access controls, and regular security assessments.

## 6. Data subject rights

We assist the Controller in fulfilling data subject requests (access, rectification, erasure, portability) within the timeframes required by GDPR.

## 7. Breach notification

In the event of a personal data breach, we notify the Controller without undue delay and no later than 72 hours after becoming aware of the breach.

*Effective: April 2026. Version 1.0.0.*',
    FALSE
  ),
  (
    'SLA',
    'Service Level Agreement',
    '# Service Level Agreement (SLA)

## 1. Service availability

Consultify targets 99.9% monthly uptime for the core platform, excluding scheduled maintenance windows.

## 2. Scheduled maintenance

Planned maintenance is performed during low-traffic windows (typically weekends, 02:00–06:00 CET) with at least 48 hours advance notice.

## 3. Incident response

| Severity | Response time | Resolution target |
|----------|--------------|-------------------|
| Critical (service down) | 1 hour | 4 hours |
| High (major feature impaired) | 4 hours | 24 hours |
| Medium (minor feature impaired) | 8 hours | 72 hours |
| Low (cosmetic / question) | 24 hours | 5 business days |

## 4. Support channels

- **Email**: support@dbr77.com (all tiers)
- **Priority support**: Available for Admin and Enterprise plans
- **Dedicated support manager**: Enterprise plans only

## 5. Credits

If monthly uptime falls below 99.9%, affected customers may request service credits proportional to the downtime, up to 30% of the monthly fee.

## 6. Exclusions

This SLA does not cover downtime caused by force majeure events, customer network issues, or third-party service outages beyond our control.

*Effective: April 2026. Version 1.0.0.*',
    FALSE
  ),
  (
    'SECURITY',
    'Security Overview',
    '# Security Overview

## Infrastructure

- Hosted on EU-based cloud infrastructure with SOC 2 Type II certification
- AES-256 encryption at rest, TLS 1.3 in transit
- Multi-tenant data isolation with strict access controls

## Access control

- Role-based access control (RBAC) with least-privilege principles
- SSO/SAML integration available for Enterprise plans
- Multi-factor authentication (MFA) supported

## Data protection

- GDPR-compliant data processing
- Data residency within the European Union
- Regular penetration testing and vulnerability assessments

## Compliance

- SOC 2 Type II controls
- GDPR data processing addendum available
- Regular third-party security audits

## Incident management

- 24/7 monitoring and alerting
- Documented incident response procedures
- Breach notification within 72 hours as per GDPR

For security inquiries, contact security@dbr77.com.

*Last updated: April 2026.*',
    FALSE
  )
) AS v(doc_type, title, content_md, req_accept)
WHERE NOT EXISTS (
  SELECT 1 FROM legal_documents ld
  WHERE COALESCE(ld.doc_type, UPPER(ld.type)) = v.doc_type
    AND (ld.is_active = TRUE OR ld.status = 'active')
);
