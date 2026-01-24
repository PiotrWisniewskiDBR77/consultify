# FLOW-WHITELABEL-001: White-label Customization

> **ID:** FLOW-WHITELABEL-001 | **Status:** ✅ Complete | **Priority:** P2

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Pełna personalizacja wyglądu aplikacji dla klientów Enterprise - logo, kolory, domena, email branding.

## White-label Features

```
┌──────────────────────────────────────────────────────────────────────┐
│                     WHITE-LABEL FEATURES                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  🎨 BRANDING                                                    ││
│  │  • Custom logo (light/dark mode)                                ││
│  │  • Custom favicon                                               ││
│  │  • Color scheme customization                                   ││
│  │  • Custom fonts (optional)                                      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  🌐 CUSTOM DOMAIN                                               ││
│  │  • app.clientname.com                                           ││
│  │  • SSL certificate (auto-provisioned)                           ││
│  │  • DNS verification                                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📧 EMAIL BRANDING                                              ││
│  │  • Custom sender name                                           ││
│  │  • Custom from address                                          ││
│  │  • Email templates with branding                                ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📄 REPORT BRANDING                                             ││
│  │  • Custom header/footer                                         ││
│  │  • Client logo on reports                                       ││
│  │  • Hide "Powered by Consultinity"                               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  🔗 LOGIN PAGE                                                  ││
│  │  • Custom background                                            ││
│  │  • Custom welcome message                                       ││
│  │  • Custom terms/privacy links                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Configuration UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  White-label Settings                              [Preview] [Save] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Branding                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Logo (Light Mode)          Logo (Dark Mode)                        │
│  ┌─────────────────┐        ┌─────────────────┐                     │
│  │   [Upload]      │        │   [Upload]      │                     │
│  │   📷 Drop here  │        │   📷 Drop here  │                     │
│  └─────────────────┘        └─────────────────┘                     │
│                                                                     │
│  Primary Color              Secondary Color                         │
│  [#3B82F6    ] 🎨           [#10B981    ] 🎨                        │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Custom Domain                                         [Enterprise] │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Domain: [app.acme-corp.com                              ]          │
│  Status: 🟢 Verified | SSL: ✅ Active (expires 2027-01-15)          │
│                                                                     │
│  DNS Records Required:                                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CNAME  app.acme-corp.com  →  custom.consultinity.app        │ │
│  │  TXT    _verify.app        →  consultinity-verify=abc123     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Email Branding                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  From Name:    [ACME Corporation                         ]          │
│  From Email:   [no-reply@acme-corp.com                   ]          │
│  Reply To:     [support@acme-corp.com                    ]          │
│  Status: 🟡 Verification pending                                    │
│                                                                     │
│  ☐ Hide "Powered by Consultinity" in emails                         │
│  ☑ Use custom email templates                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Domain Verification Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DOMAIN VERIFICATION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User enters custom domain                                       │
│         │                                                           │
│         ▼                                                           │
│  2. System generates verification token                             │
│         │                                                           │
│         ▼                                                           │
│  3. User adds DNS records:                                          │
│     • CNAME for subdomain                                           │
│     • TXT for verification                                          │
│         │                                                           │
│         ▼                                                           │
│  4. System checks DNS (polling)                                     │
│         │                                                           │
│         ├──── Not found → Retry (max 48h)                           │
│         │                                                           │
│         ▼                                                           │
│  5. DNS verified → Provision SSL                                    │
│         │                                                           │
│         ▼                                                           │
│  6. SSL ready → Domain active                                       │
│         │                                                           │
│         ▼                                                           │
│  7. Traffic routed to custom domain                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Already in 260_enterprise_features.sql: white_label_config

-- Additional: White-label assets
CREATE TABLE IF NOT EXISTS white_label_assets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    asset_type TEXT NOT NULL, -- 'logo_light', 'logo_dark', 'favicon', 'login_bg', 'report_header', 'email_header'

    -- File info
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,

    -- Storage
    storage_path TEXT NOT NULL,
    cdn_url TEXT,

    -- Dimensions (for images)
    width INTEGER,
    height INTEGER,

    -- Status
    is_active INTEGER DEFAULT 1,

    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Domain verification attempts
CREATE TABLE IF NOT EXISTS domain_verifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    domain TEXT NOT NULL,
    verification_token TEXT NOT NULL,

    -- DNS records required
    cname_host TEXT,
    cname_target TEXT,
    txt_host TEXT,
    txt_value TEXT,

    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'verifying', 'verified', 'failed'
    verification_attempts INTEGER DEFAULT 0,
    last_check_at TIMESTAMP,
    verified_at TIMESTAMP,

    -- SSL
    ssl_status TEXT, -- 'pending', 'provisioning', 'active', 'expired'
    ssl_provisioned_at TIMESTAMP,
    ssl_expires_at TIMESTAMP,

    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Verification must complete within 48h
);

CREATE INDEX IF NOT EXISTS idx_wl_assets_org ON white_label_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_verif_org ON domain_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_verif_domain ON domain_verifications(domain);
```

## API Endpoints

| Method | Endpoint                               | Description         |
| ------ | -------------------------------------- | ------------------- |
| GET    | `/api/admin/white-label`               | Get config          |
| PUT    | `/api/admin/white-label`               | Update config       |
| POST   | `/api/admin/white-label/assets`        | Upload asset        |
| DELETE | `/api/admin/white-label/assets/:id`    | Remove asset        |
| POST   | `/api/admin/white-label/domain/verify` | Start verification  |
| GET    | `/api/admin/white-label/domain/status` | Check domain status |
| POST   | `/api/admin/white-label/email/verify`  | Verify email sender |
| GET    | `/api/admin/white-label/preview`       | Preview branding    |

## Theme Application

```typescript
// Frontend: Apply white-label theme
interface WhiteLabelTheme {
  logo: { light: string; dark: string };
  favicon: string;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
  };
  appName: string;
  loginBackground?: string;
  loginWelcome?: string;
}

// Applied via CSS variables
:root {
  --wl-primary: var(--org-primary, #3B82F6);
  --wl-secondary: var(--org-secondary, #10B981);
  --wl-logo: var(--org-logo-url);
}
```

## Related Flows

- FLOW-ENTERPRISE-001: Enterprise features
- FLOW-REPORT-001: Branded reports
- FLOW-NOTIFICATION-001: Branded emails
