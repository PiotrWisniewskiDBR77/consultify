# Workspace Management Analysis - Best Practices Implementation

## 📊 Executive Summary

Analiza porównawcza funkcjonalności zarządzania workspace'em w Consultify względem standardów branżowych (ClickUp, HubSpot, Replit, Notion).

---

## 🎯 Obecny Stan vs Best Practices

### ✅ Zaimplementowane

| Obszar | Funkcjonalność | Status |
|--------|----------------|--------|
| **Team** | Zarządzanie użytkownikami | ✅ Podstawowe |
| **Team** | Zaproszenia | ✅ Pełne |
| **Team** | Tryb pracy | ✅ Zaimplementowane |
| **Team** | Konsultanci | ✅ Zaimplementowane |
| **Workspace** | Projekty | ✅ Pełne |
| **Workspace** | Baza wiedzy | ✅ Zaimplementowane |
| **Workspace** | Playbooki | ✅ Zaimplementowane |
| **Workspace** | Bulk Operations | ✅ Zaimplementowane |
| **AI** | LLM Management | ✅ Pełne |
| **AI** | AI Health | ✅ Zaimplementowane |
| **AI** | Token Management | ✅ Zaimplementowane |
| **Security** | MFA Requirement | ✅ Podstawowe |
| **Security** | SSO | ✅ Podstawowe |
| **Security** | Session Timeout | ✅ Zaimplementowane |
| **Security** | IP Whitelist | ✅ Zaimplementowane |
| **Billing** | Plan Info | ✅ Podstawowe |
| **Billing** | Usage Meters | ✅ Podstawowe |

### ❌ Brakujące (Krytyczne)

| Obszar | Funkcjonalność | Priorytet | Wzorzec |
|--------|----------------|-----------|---------|
| **Organization** | Profil organizacji (nazwa, logo, opis) | 🔴 HIGH | ClickUp, HubSpot |
| **Organization** | Billing Admin / Owner Role | 🔴 HIGH | Wszystkie |
| **Organization** | Custom Domain | 🟡 MEDIUM | HubSpot |
| **Users** | User Groups / Teams | 🔴 HIGH | ClickUp, Notion |
| **Users** | User Activity Log | 🟡 MEDIUM | HubSpot |
| **Users** | Deactivate vs Delete | 🔴 HIGH | Wszystkie |
| **Users** | User Export | 🟡 MEDIUM | GDPR |
| **Roles** | Custom Roles | 🔴 HIGH | ClickUp |
| **Roles** | Permission Matrix | 🔴 HIGH | HubSpot |
| **Billing** | Payment Methods Management | 🔴 HIGH | Stripe |
| **Billing** | Invoices Download | 🔴 HIGH | Wszystkie |
| **Billing** | Tax Information | 🟡 MEDIUM | HubSpot |
| **Billing** | Spending Alerts | 🟡 MEDIUM | Replit |
| **Security** | Domain Verification | 🟡 MEDIUM | HubSpot |
| **Security** | Password Policies | 🔴 HIGH | Wszystkie |
| **Security** | SCIM Provisioning | 🟠 LOW | Enterprise |
| **Data** | API Keys Management | 🔴 HIGH | Replit |
| **Data** | Data Export / GDPR | 🔴 HIGH | Wszystkie |
| **Data** | Data Retention Policies | 🟡 MEDIUM | HubSpot |
| **Communication** | Notification Templates | 🟡 MEDIUM | HubSpot |
| **Communication** | Announcement Center | 🟡 MEDIUM | ClickUp |
| **Communication** | Guest Access Settings | 🟡 MEDIUM | Notion |

---

## 🏗️ Proponowana Architektura Menu

### Admin Panel - 6 Modułów

```
📊 Admin Dashboard
├── 🏢 Organization (NEW - EXPANDED)
│   ├── Profile & Branding
│   │   ├── Organization Name
│   │   ├── Logo & Favicon
│   │   ├── Brand Colors
│   │   ├── Description
│   │   └── Custom Domain
│   ├── Ownership
│   │   ├── Billing Owner (cannot be deleted!)
│   │   ├── Transfer Ownership
│   │   └── Organization Admins
│   └── Regional Settings
│       ├── Default Timezone
│       ├── Default Language
│       ├── Date Format
│       └── Currency
│
├── 👥 Team (EXPANDED)
│   ├── Members
│   │   ├── Active Users
│   │   ├── Deactivated Users
│   │   ├── User Activity
│   │   └── Export Users
│   ├── Groups / Teams
│   │   ├── Create Group
│   │   ├── Group Permissions
│   │   └── Group Members
│   ├── Invitations
│   │   ├── Pending
│   │   ├── Expired
│   │   └── Invitation Settings
│   ├── Roles & Permissions
│   │   ├── Default Roles
│   │   ├── Custom Roles
│   │   └── Permission Matrix
│   └── Consultants
│       ├── External Advisors
│       └── Guest Access Settings
│
├── 📁 Workspace (AS-IS)
│   ├── Projects
│   ├── Knowledge Base
│   ├── Playbooks
│   └── Bulk Operations
│
├── 🤖 AI & Intelligence (AS-IS)
│   ├── LLM Management
│   ├── AI Health
│   ├── Help Analytics
│   └── Token Management
│
├── 💳 Billing & Subscription (EXPANDED)
│   ├── Plan & Usage
│   │   ├── Current Plan
│   │   ├── Usage Meters
│   │   ├── Seat Allocation
│   │   └── Upgrade/Downgrade
│   ├── Payment Methods
│   │   ├── Cards
│   │   ├── Bank Transfer
│   │   └── Default Method
│   ├── Invoices & History
│   │   ├── Invoice List
│   │   ├── Download PDFs
│   │   └── Payment History
│   ├── Billing Info
│   │   ├── Billing Address
│   │   ├── Tax ID / VAT
│   │   └── Billing Email
│   └── Spending Controls
│       ├── Monthly Limit
│       ├── Alert Threshold
│       └── Auto-pause Settings
│
├── 🔒 Security & Compliance (EXPANDED)
│   ├── Authentication
│   │   ├── MFA Policy
│   │   ├── SSO Configuration
│   │   ├── Password Policy
│   │   └── Session Settings
│   ├── Access Control
│   │   ├── IP Whitelist
│   │   ├── Domain Verification
│   │   └── API Keys
│   ├── Audit & Compliance
│   │   ├── Audit Log
│   │   ├── Login History
│   │   └── Data Export (GDPR)
│   └── Data Management
│       ├── Retention Policy
│       ├── Backup Settings
│       └── Delete Organization
│
└── 📢 Communication (NEW)
    ├── Notification Settings
    │   ├── Email Preferences
    │   ├── In-App Preferences
    │   └── Digest Settings
    ├── Email Templates
    │   ├── Invitation Email
    │   ├── Notification Emails
    │   └── Custom Templates
    └── Announcements
        ├── Create Announcement
        ├── Scheduled
        └── History
```

---

## 🔐 Model Własności Organizacji (OWNER)

### Koncepcja

```typescript
enum OrganizationRole {
  OWNER = 'OWNER',           // Billing Admin - cannot be deleted
  ADMIN = 'ADMIN',           // Full admin rights
  MANAGER = 'MANAGER',       // Team/Project management
  MEMBER = 'MEMBER',         // Standard user
  VIEWER = 'VIEWER',         // Read-only
  GUEST = 'GUEST'            // Limited access
}
```

### Zasady OWNER:

1. **Jeden OWNER per organizacja** - zawsze musi istnieć
2. **Cannot be deleted** - tylko transfer do innego użytkownika
3. **Billing responsibility** - karta kredytowa podpięta do tego konta
4. **Organization deletion** - tylko OWNER może usunąć org (z 30-dniowym grace period)
5. **Transfer ownership** - wymaga potwierdzenia email obu stron

### Tabela: `organization_ownership`

```sql
CREATE TABLE organization_ownership (
  id UUID PRIMARY KEY,
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  billing_email TEXT NOT NULL,
  billing_name TEXT,
  tax_id TEXT,
  billing_address JSONB,
  transferred_from_user_id UUID REFERENCES users(id),
  transferred_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 Permission Matrix

### Przykład (jak w ClickUp/HubSpot):

| Permission | Owner | Admin | Manager | Member | Guest |
|------------|-------|-------|---------|--------|-------|
| Delete Organization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transfer Ownership | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Admins | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Projects | ✅ | ✅ | ✅ | ✅ | ❌ |
| View All Projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| Invite Users | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage AI Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export Data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Custom Roles | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🎨 UI Patterns

### Organization Profile (HubSpot Style)

```
┌─────────────────────────────────────────────────────────────┐
│  🏢 Organization Profile                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────┐   Company Name                                    │
│  │ LOGO │   Acme Corporation                    [Change]    │
│  └──────┘                                                   │
│                                                             │
│  Description                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Leading provider of digital transformation...        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Industry          |  Technology                            │
│  Company Size      |  51-200 employees                      │
│  Website           |  https://acme.com                      │
│  Custom Domain     |  pmo.acme.com [Verify]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Ownership Card (Critical)

```
┌─────────────────────────────────────────────────────────────┐
│  👑 Organization Owner                         [Transfer]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────┐  John Smith                                         │
│  │ JS │  john@acme.com                                      │
│  └────┘  Billing Admin since: Jan 15, 2025                  │
│                                                             │
│  ⚠️ This account manages billing and cannot be deleted.     │
│     To remove, transfer ownership first.                    │
│                                                             │
│  💳 Payment Method: •••• 4242 (Visa)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Priority

### Phase 1: Core (Week 1)
1. ✅ Add OWNER role to `types.ts`
2. ✅ Create `organization_ownership` table
3. ✅ Implement Organization Profile view
4. ✅ Implement Ownership management with transfer

### Phase 2: Team Enhancement (Week 2)
1. User Groups system
2. User Activity tracking
3. Deactivate vs Delete
4. Permission Matrix UI

### Phase 3: Billing & Security (Week 3)
1. Payment Methods management
2. Invoice downloads
3. API Keys management
4. Password policies
5. Domain verification

### Phase 4: Communication (Week 4)
1. Notification templates
2. Announcement center
3. Guest access settings

---

## 📄 Appendix: Wzorce z konkurencji

### ClickUp
- Custom roles z granularnym permission matrix
- Spaces → Folders → Lists hierarchy
- Guest access per space
- Time tracking per user

### HubSpot
- Portal settings vs Account settings separation
- Brand Kit (colors, fonts)
- Domain management
- Email templates
- Audit log export

### Replit
- Usage-based billing visualization
- API tokens management
- Spending limits & alerts
- Team collaboration real-time

### Notion
- Workspace icon & cover
- Member groups
- Content export (Markdown, PDF)
- Guest access with link sharing

