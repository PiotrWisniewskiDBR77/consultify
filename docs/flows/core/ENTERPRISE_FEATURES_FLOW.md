# FLOW-ENTERPRISE-001: Enterprise Features

> **ID:** FLOW-ENTERPRISE-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Zaawansowane funkcje dla klientów Enterprise - Data Residency, Custom Contracts, SLA, Dedicated Support.

## Enterprise Features Matrix

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE FEATURES                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DATA RESIDENCY                                                 ││
│  │  • EU-only data storage                                         ││
│  │  • Region selection                                             ││
│  │  • Data sovereignty compliance                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  CUSTOM CONTRACTS & SLA                                         ││
│  │  • Custom terms and conditions                                  ││
│  │  • SLA guarantees (99.9%+)                                      ││
│  │  • Dedicated account manager                                    ││
│  │  • Priority support                                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ADVANCED SECURITY                                              ││
│  │  • SSO (SAML/OIDC)                                              ││
│  │  • SCIM provisioning                                            ││
│  │  • IP whitelisting                                              ││
│  │  • Custom session policies                                      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  WHITE-LABEL OPTIONS                                            ││
│  │  • Custom logo                                                  ││
│  │  • Custom colors                                                ││
│  │  • Custom domain                                                ││
│  │  • Custom email sender                                          ││
│  │  • Branded reports                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  COMPLIANCE                                                     ││
│  │  • SOC 2 Type II                                                ││
│  │  • ISO 27001                                                    ││
│  │  • GDPR compliant                                               ││
│  │  • Custom data retention                                        ││
│  │  • Audit log exports                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Residency

### Available Regions

| Region         | Code   | Status  |
| -------------- | ------ | ------- |
| European Union | `eu`   | Active  |
| United States  | `us`   | Planned |
| Asia Pacific   | `apac` | Planned |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA RESIDENCY FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Organization Setup                                             │
│  ─────────────────                                              │
│  1. Select data residency region                                │
│  2. Confirm data location requirements                          │
│  3. System provisions resources in selected region              │
│                                                                 │
│  Runtime                                                        │
│  ───────                                                        │
│  • All data stored in selected region                           │
│  • Database in regional cluster                                 │
│  • File storage in regional bucket                              │
│  • Backups in same region                                       │
│                                                                 │
│  Exceptions                                                     │
│  ──────────                                                     │
│  • CDN for static assets (global)                               │
│  • Analytics aggregates (anonymized)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Custom Contracts

### Contract Types

| Type           | Description                     |
| -------------- | ------------------------------- |
| **Standard**   | Default terms, monthly billing  |
| **Annual**     | 12-month commitment, discount   |
| **Enterprise** | Custom terms, dedicated support |
| **Custom**     | Fully customized agreement      |

### Contract Features

```typescript
interface EnterpriseContract {
  id: string;
  organizationId: string;

  // Contract details
  contractType: 'standard' | 'annual' | 'enterprise' | 'custom';
  startDate: string;
  endDate: string;
  autoRenew: boolean;

  // SLA
  slaLevel: 'standard' | 'premium' | 'enterprise';
  uptimeGuarantee: number; // 99.9, 99.95, 99.99
  supportResponseTime: {
    critical: number; // hours
    high: number;
    medium: number;
    low: number;
  };

  // Limits
  customLimits: {
    maxUsers?: number;
    maxProjects?: number;
    maxStorage?: number; // GB
    maxTokens?: number;
  };

  // Pricing
  customPricing: {
    basePrice: number;
    perUserPrice: number;
    currency: string;
    billingCycle: 'monthly' | 'quarterly' | 'annual';
  };

  // Features
  enabledFeatures: string[];

  // Support
  dedicatedAccountManager?: string;
  dedicatedSlackChannel?: string;

  // Documents
  signedContractUrl?: string;
  addendums: { name: string; url: string }[];
}
```

## White-Label Configuration

```typescript
interface WhiteLabelConfig {
  organizationId: string;

  // Branding
  logo: {
    light: string; // URL
    dark: string;
    favicon: string;
  };

  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };

  // Domain
  customDomain?: string;
  sslCertificateId?: string;

  // Email
  emailFromName?: string;
  emailFromAddress?: string;
  emailReplyTo?: string;

  // Reports
  reportHeaderLogo?: string;
  reportFooterText?: string;
  hideConsultinityBranding: boolean;

  // Login page
  loginBackgroundImage?: string;
  loginWelcomeText?: string;
}
```

## Database Schema

```sql
-- Enterprise contracts
CREATE TABLE IF NOT EXISTS enterprise_contracts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    -- Contract info
    contract_type TEXT NOT NULL, -- 'standard', 'annual', 'enterprise', 'custom'
    contract_number TEXT UNIQUE,

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    signed_date DATE,
    auto_renew INTEGER DEFAULT 0,
    renewal_notice_days INTEGER DEFAULT 30,

    -- SLA
    sla_level TEXT DEFAULT 'standard',
    uptime_guarantee REAL DEFAULT 99.9,
    support_response_hours TEXT, -- JSON: {critical, high, medium, low}

    -- Limits
    max_users INTEGER,
    max_projects INTEGER,
    max_storage_gb INTEGER,
    max_tokens_monthly INTEGER,

    -- Pricing
    base_price REAL,
    per_user_price REAL,
    currency TEXT DEFAULT 'USD',
    billing_cycle TEXT DEFAULT 'monthly',
    custom_pricing_notes TEXT,

    -- Features
    enabled_features TEXT DEFAULT '[]', -- JSON array

    -- Support
    account_manager_id TEXT,
    account_manager_name TEXT,
    account_manager_email TEXT,
    support_slack_channel TEXT,
    support_priority TEXT DEFAULT 'standard',

    -- Documents
    signed_contract_url TEXT,
    addendums TEXT DEFAULT '[]', -- JSON

    -- Status
    status TEXT DEFAULT 'active', -- 'draft', 'pending_signature', 'active', 'expired', 'terminated'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data residency settings
CREATE TABLE IF NOT EXISTS data_residency (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,

    -- Region
    region TEXT NOT NULL DEFAULT 'eu', -- 'eu', 'us', 'apac'
    region_locked INTEGER DEFAULT 0, -- Cannot be changed after data exists

    -- Compliance
    data_sovereignty_required INTEGER DEFAULT 0,
    cross_border_transfer_allowed INTEGER DEFAULT 0,

    -- Storage locations
    database_region TEXT,
    file_storage_region TEXT,
    backup_region TEXT,

    configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    configured_by TEXT
);

-- White-label configurations
CREATE TABLE IF NOT EXISTS white_label_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,

    -- Logo
    logo_light_url TEXT,
    logo_dark_url TEXT,
    favicon_url TEXT,

    -- Colors
    color_primary TEXT,
    color_secondary TEXT,
    color_accent TEXT,
    custom_css TEXT,

    -- Domain
    custom_domain TEXT UNIQUE,
    custom_domain_verified INTEGER DEFAULT 0,
    ssl_certificate_id TEXT,
    ssl_expires_at TIMESTAMP,

    -- Email
    email_from_name TEXT,
    email_from_address TEXT,
    email_reply_to TEXT,
    email_verified INTEGER DEFAULT 0,

    -- Reports
    report_header_logo_url TEXT,
    report_footer_text TEXT,
    hide_consultinity_branding INTEGER DEFAULT 0,

    -- Login page
    login_background_url TEXT,
    login_welcome_text TEXT,
    login_custom_html TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA tracking
CREATE TABLE IF NOT EXISTS sla_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    month DATE NOT NULL, -- First day of month

    -- Uptime
    total_minutes INTEGER NOT NULL,
    downtime_minutes INTEGER DEFAULT 0,
    uptime_percentage REAL,

    -- Incidents
    incidents_count INTEGER DEFAULT 0,
    incidents_critical INTEGER DEFAULT 0,
    incidents_high INTEGER DEFAULT 0,

    -- Support response
    tickets_total INTEGER DEFAULT 0,
    tickets_within_sla INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,

    -- Credits
    sla_breach INTEGER DEFAULT 0,
    credit_amount REAL DEFAULT 0,
    credit_applied INTEGER DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, month)
);

CREATE INDEX IF NOT EXISTS idx_contracts_org ON enterprise_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON enterprise_contracts(status);
CREATE INDEX IF NOT EXISTS idx_residency_org ON data_residency(organization_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_org ON white_label_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON white_label_config(custom_domain);
CREATE INDEX IF NOT EXISTS idx_sla_org ON sla_tracking(organization_id);
```

## API Endpoints

### Enterprise Contracts

| Method | Endpoint                         | Description          |
| ------ | -------------------------------- | -------------------- |
| GET    | `/api/admin/enterprise/contract` | Get contract details |
| PUT    | `/api/admin/enterprise/contract` | Update contract      |
| GET    | `/api/admin/enterprise/sla`      | Get SLA metrics      |

### Data Residency

| Method | Endpoint                    | Description                    |
| ------ | --------------------------- | ------------------------------ |
| GET    | `/api/admin/data-residency` | Get residency config           |
| PUT    | `/api/admin/data-residency` | Update residency (before data) |

### White-Label

| Method | Endpoint                               | Description          |
| ------ | -------------------------------------- | -------------------- |
| GET    | `/api/admin/white-label`               | Get config           |
| PUT    | `/api/admin/white-label`               | Update config        |
| POST   | `/api/admin/white-label/verify-domain` | Verify custom domain |
| POST   | `/api/admin/white-label/verify-email`  | Verify email sender  |

## Related Flows

- FLOW-SECURITY-001: Enterprise security features
- FLOW-AUDIT-001: Compliance audit logs
- FLOW-BILLING-001: Enterprise billing
- FLOW-GDPR-001: Data compliance
