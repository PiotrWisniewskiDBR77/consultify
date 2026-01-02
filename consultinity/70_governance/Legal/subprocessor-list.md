# Sub-processor List

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

This document lists the sub-processors engaged by **DBR77 Robotics Sp. z o.o.** to process personal data on behalf of our customers as part of Consultinity services.

This list is maintained as required by our [Data Processing Addendum](/legal/dpa) and GDPR Article 28.

## 2. About This List

### 2.1 Purpose

We engage sub-processors to help deliver our Service. All sub-processors are bound by data processing agreements that require them to protect your data consistent with our obligations.

### 2.2 Updates

We update this list when sub-processors are added, removed, or materially changed.

- **Update Notification:** 30 days advance notice for new sub-processors
- **How to Subscribe:** Email privacy@dbr77.com to receive notifications

### 2.3 Objection Process

If you have concerns about a new sub-processor:
1. Notify us within 14 days of receiving notice
2. Email: privacy@dbr77.com
3. We will work with you to address concerns

Per our DPA, if we cannot resolve your objection, you may terminate affected services.

## 3. Infrastructure Sub-processors

These sub-processors provide the core infrastructure for hosting and running our Service.

| Sub-processor | Location | Purpose | Data Processed |
|---------------|----------|---------|----------------|
| **Amazon Web Services (AWS)** | EU (Frankfurt, Dublin) | Cloud hosting, compute, storage, database | All customer data |
| **Google Cloud Platform** | EU / US | AI services integration | Data processed by AI features |

### AWS Services Used

- EC2 (Compute)
- RDS (Database)
- S3 (Storage)
- CloudFront (CDN)
- KMS (Key Management)
- CloudWatch (Monitoring)

**AWS DPA:** [aws.amazon.com/compliance/data-processing-addendum](https://aws.amazon.com/compliance/data-processing-addendum/)

**AWS Compliance:** SOC 2 Type II, ISO 27001, PCI DSS

## 4. AI Service Sub-processors

These sub-processors power our AI features.

| Sub-processor | Location | Purpose | Data Processed |
|---------------|----------|---------|----------------|
| **OpenAI, LLC** | USA | AI model inference (GPT-4, GPT-4o) | User prompts, context data |
| **Anthropic, PBC** | USA | AI model inference (Claude 3.5) | User prompts, context data |
| **Google LLC (Gemini)** | USA | AI model inference (Gemini Pro) | User prompts, context data |

### AI Data Commitments

- ✅ **No Training:** Your data is NOT used to train AI models
- ✅ **No Retention:** AI providers do not retain your data beyond processing
- ✅ **Minimization:** Only necessary data is sent for processing
- ✅ **DPAs in Place:** All providers have signed data processing agreements

**OpenAI DPA:** [openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum/)

**Anthropic Privacy:** [anthropic.com/privacy](https://www.anthropic.com/privacy)

**Google Cloud DPA:** [cloud.google.com/terms/data-processing-addendum](https://cloud.google.com/terms/data-processing-addendum)

### BYOK (Bring Your Own Key)

For customers using BYOK:
- Data is sent directly to YOUR provider account
- We do not process your API keys
- You maintain the provider relationship
- Standard sub-processor list does not apply to your direct provider relationship

## 5. Payment Sub-processors

| Sub-processor | Location | Purpose | Data Processed |
|---------------|----------|---------|----------------|
| **Stripe, Inc.** | EU / USA | Payment processing, billing | Billing contact info, payment method, transactions |

**Note:** We do not store complete credit card numbers. Stripe handles all payment card data directly.

**Stripe DPA:** [stripe.com/legal/dpa](https://stripe.com/legal/dpa)

**Stripe Compliance:** PCI DSS Level 1, SOC 2 Type II

## 6. Communication Sub-processors

| Sub-processor | Location | Purpose | Data Processed |
|---------------|----------|---------|----------------|
| **Mailgun (Sinch)** | EU | Transactional email delivery | Email addresses, email content |

**Mailgun DPA:** [mailgun.com/legal/dpa](https://www.mailgun.com/legal/dpa/)

## 7. Analytics & Monitoring Sub-processors

| Sub-processor | Location | Purpose | Data Processed |
|---------------|----------|---------|----------------|
| **Functional Software, Inc. (Sentry)** | USA | Error monitoring, debugging | Error reports, stack traces, user context |

**Sentry DPA:** [sentry.io/legal/dpa](https://sentry.io/legal/dpa/)

### Analytics Note

We do NOT use third-party analytics cookies or tracking pixels. All product analytics are performed using privacy-respecting, first-party methods.

## 8. Summary by Data Type

| Data Type | Sub-processors |
|-----------|----------------|
| **Account Data** | AWS, Mailgun |
| **Content Data** | AWS, AI providers (OpenAI, Anthropic, Google) |
| **Payment Data** | Stripe |
| **Error/Debug Data** | Sentry |

## 9. Geographic Summary

| Region | Sub-processors |
|--------|----------------|
| **European Union** | AWS (Frankfurt, Dublin), Stripe (EU), Mailgun (EU) |
| **United States** | OpenAI, Anthropic, Google, Stripe (backup), Sentry |

### Data Residency

- **Primary Storage:** European Union (Germany, Netherlands)
- **AI Processing:** USA (with SCCs and supplementary measures)
- **Backups:** European Union

For customers requiring strict EU-only processing:
- Use BYOK with EU-based AI providers
- Enterprise plans offer custom data residency options

## 10. Security Certifications

| Sub-processor | SOC 2 | ISO 27001 | PCI DSS |
|---------------|-------|-----------|---------|
| AWS | ✅ Type II | ✅ | ✅ |
| OpenAI | ✅ Type II | — | — |
| Anthropic | ✅ Type II | — | — |
| Google Cloud | ✅ Type II | ✅ | — |
| Stripe | ✅ Type II | — | ✅ Level 1 |
| Mailgun | ✅ | — | — |
| Sentry | ✅ | — | — |

## 11. Change Log

| Date | Change | Sub-processor | Details |
|------|--------|---------------|---------|
| 2025-01-01 | Initial | All | Initial sub-processor list published |

## 12. Notifications

### Subscribe to Updates

To receive notifications of sub-processor changes:

**Email:** privacy@dbr77.com  
**Subject:** Subscribe to Sub-processor Updates

Include:
- Your name
- Your organization
- Account email

### Change Notification Process

1. We publish updates to this page
2. We notify subscribed customers via email
3. 30-day notice period before new sub-processor engagement
4. 14-day objection window

## 13. Contact

**Privacy Questions**
- Email: privacy@dbr77.com

**Objections to New Sub-processors**
- Email: privacy@dbr77.com
- Deadline: Within 14 days of notification

**Data Protection Officer**
- Email: privacy@dbr77.com

**Legal Inquiries**
- Email: legal@dbr77.com

---

*This Sub-processor List is maintained by DBR77 Robotics Sp. z o.o. and updated as required by GDPR Article 28.*
