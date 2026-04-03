# Partner Portal Module

> **Status**: Enterprise Ready ✅  
> **Last Updated**: 2026-01-09  
> **Version**: 1.0.0

## Overview

The Partner Portal is a comprehensive module for managing partner relationships in the Consultinity platform. It enables partners to manage their client organizations, track certifications, view commissions, and access marketing resources.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Partner Portal                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │  Overview   │ │   Clients   │ │Certification│ │  Resources ││
│  │  Dashboard  │ │Organizations│ │   Learning  │ │  Marketing ││
│  │  Metrics    │ │  Projects   │ │    Exams    │ │ Templates  ││
│  │ Performance │ │   Users     │ │Certificates │ │Case Studies││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│  ┌─────────────┐ ┌─────────────┐                                │
│  │   Billing   │ │   Profile   │                                │
│  │  Licenses   │ │Company Info │                                │
│  │  Invoices   │ │Specializations                               │
│  │ Commissions │ │   Regions   │                                │
│  │  Discounts  │ │Public Listing                                │
│  └─────────────┘ └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

## Modules

### 1. Overview

- **Dashboard**: Partnership summary, KPIs, recent activity
- **Metrics**: Revenue, client retention, project analytics
- **Performance**: Performance score breakdown, rankings

### 2. Clients

- **Organizations**: Manage client organizations under partnership
- **Projects**: Track transformation projects across clients
- **Users**: User management for client organizations

### 3. Certification

- **Learning Path**: Structured courses for partner certification
- **Exams**: Assessment exams for certification
- **Certificates**: Earned certificates and credentials

### 4. Resources

- **Documentation**: Partner guides and API docs
- **Marketing Materials**: Logos, presentations, templates
- **Case Studies**: Success stories and references
- **Templates**: PMO templates and frameworks

### 5. Billing

- **Licenses**: License allocation and management
- **Invoices**: Invoice history and downloads
- **Commissions**: Commission tracking and payouts
- **Discounts**: Partner tier discounts and benefits

### 6. Profile

- **Company Info**: Partner organization details
- **Specializations**: Framework certifications (DRD, SIRI, etc.)
- **Regions**: Operating regions
- **Public Listing**: Partner directory visibility

## Database Schema

### Core Tables

```sql
-- Partner organizations
partner_organizations (
    id, name, legal_name, tax_id, contact_email, contact_phone,
    tier, status, partner_since, license_discount_percent,
    commission_rate_percent, performance_score, public_listing_enabled
)

-- Partner users relationship
partner_users (
    id, partner_org_id, user_id, role, status, joined_at
)

-- Partner specializations
partner_specializations (
    id, partner_org_id, framework, certified, certified_at
)

-- Partner certifications
partner_certifications (
    id, partner_org_id, user_id, certification_name,
    certification_type, status, progress_percent
)

-- Partner client organizations
partner_client_organizations (
    id, partner_org_id, organization_id, relationship_type,
    status, onboarded_at, contract_value_annual
)

-- Partner commissions
partner_commissions (
    id, partner_org_id, client_org_id, commission_type,
    amount, currency, status, paid_at
)
```

See migration `215_partner_portal.sql` for complete schema.

## API Endpoints

### Partner Organization

```
GET    /api/partners/organization         - Get current partner org
PUT    /api/partners/organization         - Update partner details
PUT    /api/partners/organization/specializations
PUT    /api/partners/organization/regions
PUT    /api/partners/organization/listing
```

### Dashboard & Metrics

```
GET    /api/partners/dashboard            - Dashboard summary
GET    /api/partners/metrics              - Performance metrics
```

### Clients

```
GET    /api/partners/clients              - List clients
POST   /api/partners/clients              - Add client
GET    /api/partners/clients/:id          - Client details
GET    /api/partners/projects             - List projects
```

### Certifications

```
GET    /api/partners/certifications       - Certification status
GET    /api/partners/certifications/:id/modules
POST   /api/partners/certifications/:id/modules/:moduleId/progress
```

### Billing

```
GET    /api/partners/licenses             - License allocations
POST   /api/partners/licenses/order       - Order licenses
GET    /api/partners/commissions          - Commission history
GET    /api/partners/invoices             - Invoice list
GET    /api/partners/invoices/:id/download
```

### Resources

```
GET    /api/partners/resources            - List resources
GET    /api/partners/resources/:id/download
GET    /api/partners/tiers                - Partner tier info
```

## Partner Tiers

| Tier       | Discount | Requirements                               |
| ---------- | -------- | ------------------------------------------ |
| Registered | 10%      | Basic registration                         |
| Certified  | 12%      | €50K revenue, 3+ projects, Foundation cert |
| Premier    | 14%      | €150K revenue, 10+ projects, All certs     |
| Elite      | 20%      | €500K revenue, 25+ projects, VIP status    |

## Certification Path

1. **Consultinity Foundations** (2h, 5 modules)
   - Platform basics, navigation, project setup

2. **PMO Standards** (4h, 8 modules)
   - ISO 21500, PMBOK 7, PRINCE2

3. **AI Intelligence Modules** (3h, 6 modules)
   - AI chat, recommendations, analytics

4. **Assessment Specialist** (6h, 12 modules)
   - DRD, SIRI, ADMA, CMMI, Lean 4.0

## UI Components

### PartnerSidebar

- Non-collapsible navigation groups (matches AdminSidebar pattern)
- Violet accent colors (consistent design system)
- Search with Cmd+K shortcut
- Badge support for pending items
- Quick actions

### PartnerLayout

- Two-column layout with fixed sidebar (280px)
- Responsive design (sidebar collapses on mobile)
- Breadcrumb navigation
- Floating panel design (ClickUp-style)

## Access Control

```typescript
// Partner roles
type PartnerRole = 'owner' | 'admin' | 'member' | 'viewer';

// Permissions by role
owner:  Full access, can transfer ownership
admin:  Manage team, clients, settings
member: View and edit own work, clients
viewer: Read-only access
```

## Integration Points

1. **Organizations Module**: Client organizations link to main org system
2. **Projects Module**: Partner projects integrate with project management
3. **Assessment Module**: Partner certifications use assessment framework
4. **Billing Module**: License and commission tracking

## Testing

```bash
# Run partner module tests
npm test -- --grep "partner"

# Test files
tests/unit/backend/routes/partners.routes.test.ts
tests/components/Partner/*.test.tsx
```

## Help Content

Partner-specific help is available in `src/config/moduleHelpContent.ts`:

- `partner.dashboard`: Dashboard overview and tips
- `partner.clients`: Client management guide
- `partner.certification`: Certification path information
- `partner.billing`: License and commission help

## Changelog

### v1.0.0 (2026-01-09)

- Initial Partner Portal implementation
- Non-collapsible sidebar navigation (AdminSidebar pattern)
- Full CRUD for partner organizations
- Client and project management
- Certification and learning system
- License and commission tracking
- Resource library

## Related Documentation

- [Partner Portal Specification](./PARTNER_PORTAL_SPECIFICATION.md)
- [API Documentation](./api/PARTNERS_API.md)
- [Database Schema](../server/migrations/215_partner_portal.sql)
