# Legal Documentation - Consultinity

This folder contains all legal documents for the Consultinity platform, operated by DBR77 Robotics Sp. z o.o.

## Document Index

| Document | File | URL | Description |
|----------|------|-----|-------------|
| Terms of Service | `terms-of-service.md` | `/terms` | Main agreement governing platform use |
| Privacy Policy | `privacy-policy.md` | `/privacy` | GDPR-compliant privacy practices |
| Cookie Policy | `cookie-policy.md` | `/cookies` | Cookie usage and categories |
| Acceptable Use Policy | `acceptable-use-policy.md` | `/legal/acceptable-use` | Platform rules and restrictions |
| AI Usage Policy | `ai-usage-policy.md` | `/legal/ai-policy` | AI features, BYOK, data handling |
| Subscription Agreement | `subscription-agreement.md` | `/legal/subscription` | Pricing, billing, AI credits |
| Data Processing Addendum | `data-processing-addendum.md` | `/legal/dpa` | GDPR Article 28 DPA |
| Service Level Agreement | `service-level-agreement.md` | `/legal/sla` | Uptime and support SLAs |
| Refund & Cancellation | `refund-cancellation-policy.md` | `/legal/refunds` | Cancellation and refund terms |
| Security Overview | `security-overview.md` | `/security` | Security practices overview |
| Customer Data Security | `customer-data-security.md` | `/legal/customer-security` | Data protection, encryption, incident response |
| Sub-processor List | `subprocessor-list.md` | `/legal/subprocessors` | Third-party data processors |

## Legal Center

All documents are accessible via the **Legal Center** at `/legal`.

## URL → Page Mapping

### Footer Links

| URL | Document |
|-----|----------|
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/cookies` | Cookie Policy |
| `/security` | Security Overview |
| `/legal` | Legal Center (all documents) |

### Settings Page Links

| Settings Section | Documents |
|-----------------|-----------|
| **Billing Settings** | Subscription Agreement, SLA, Refund Policy |
| **Privacy Settings** | Privacy Policy, Cookie Policy, DPA, Sub-processors |
| **Security Settings** | Security Overview, Customer Data Security, Sub-processors |
| **AI Settings** | AI Usage Policy, Customer Data Security |
| **Legal Settings** | All documents (via Legal Center) |

### Registration/Login

| Checkpoint | Required Documents |
|-----------|-------------------|
| Registration | Terms of Service, Privacy Policy |
| Organization Admin (Enterprise) | DPA |

## Metadata & Configuration

All document metadata is stored in `config/legal-metadata.json`:

- Document versions and effective dates
- Subscription pricing (Growth, Scale, Enterprise)
- Trial configuration
- Company information
- Compliance settings

## Company Information

**DBR77 Robotics Sp. z o.o.**
- Address: ul. Żółkiewskiego 31, 87-100 Toruń, Poland
- NIP: 8792725331
- KRS: 0000860440
- REGON: 387073039

### Subsidiaries

- **DBR77 USA Inc.** - 9319 Robert D. Snyder Road, Charlotte, NC 28262, USA
- **DBR77 GmbH** - Kurfürstendamm 194, 10707 Berlin, Germany (VAT: DE368505344)

## Technical Integration

### Seed Scripts

- **Legal Documents**: `server/seeds/legalDocumentsFromFiles.js`
- **Pricing Plans**: `server/seeds/pricingFromMetadata.js`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/legal/document/:type` | GET | Get document by type |
| `/api/legal/active` | GET | List all active documents |
| `/api/legal/my-acceptances` | GET | Get user's acceptances |
| `/api/pricing/plans` | GET | Get subscription plans |
| `/api/pricing/page` | GET | Get pricing page data |

### Frontend Views

- `views/LegalIndexView.tsx` - Legal Center index
- `views/LegalDocumentView.tsx` - Individual document view
- `views/legal/*.tsx` - Standalone pages (Terms, Privacy, etc.)

### User Acceptance Flow

1. User registers or logs in
2. System checks for unaccepted required documents (TOS, PRIVACY)
3. User must accept before accessing protected features
4. Acceptance recorded with timestamp and document version
5. Re-acceptance required on major version updates

## Updating Documents

1. Edit the relevant `.md` file
2. Update version in `config/legal-metadata.json`
3. Run seed script: `node server/seeds/legalDocumentsFromFiles.js`
4. For pricing changes: `node server/seeds/pricingFromMetadata.js`
5. Users will be prompted to re-accept if version changed

## Compliance Summary

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | ✅ Compliant | EU data residency, DPA available |
| ePrivacy Directive | ✅ Compliant | Cookie consent management |
| SOC 2 Type II | 🔄 In progress | Q2 2025 target |
| ISO 27001 | 📋 Planned | Q4 2025 target |

## Contact

| Purpose | Email |
|---------|-------|
| Legal inquiries | legal@dbr77.com |
| Privacy/DPO | privacy@dbr77.com |
| Security | security@dbr77.com |
| Billing | billing@dbr77.com |
| Support | support@dbr77.com |
| General | contact@dbr77.com |

---

*Last updated: January 1, 2025*  
*Version: 1.0*
