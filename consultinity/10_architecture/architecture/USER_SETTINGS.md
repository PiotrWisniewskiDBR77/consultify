# User Settings Architecture

## Overview

The User Settings panel provides personalization and account management features. Following the SuperAdmin pattern, it uses a **6-module structure** with tab-based navigation within each module.

## Module Structure

```
User Settings (6 Modules)
├── Profile Module
│   ├── Personal Info
│   ├── Avatar
│   ├── Password
│   ├── Billing
│   └── Account
├── AI Preferences Module
│   ├── Instructions
│   ├── Memory
│   ├── Response Style
│   ├── Chat History
│   └── Voice
├── Notifications Module
│   ├── All
│   ├── Email
│   ├── Push
│   └── Schedule
├── Security & Privacy Module (Enterprise)
│   ├── Dashboard (Security Score)
│   ├── MFA (Two-Factor Auth)
│   ├── Trusted Devices
│   ├── Sessions
│   ├── Security Events (Audit Log)
│   ├── Data Controls (GDPR)
│   └── Privacy
├── Integrations Module
│   ├── Apps
│   ├── API Keys
│   ├── Webhooks
│   └── Calendar
└── Appearance Module
    ├── Theme
    ├── Language
    ├── Regional
    ├── Accessibility
    ├── Work
    └── Dashboard
```

## Component Architecture

### Sidebar Navigation

**File:** `components/SettingsSidebar.tsx`

The SettingsSidebar component follows the SuperAdmin pattern with:
- Collapsible/expandable states
- Pin/unpin functionality
- Section-based navigation
- User info display
- Back to app button

### Module Components

| Module | File | Tabs |
|--------|------|------|
| Profile | `views/settings/ProfileModule.tsx` | Personal, Avatar, Password, Billing, Account |
| AI Preferences | `views/settings/AIPreferencesModule.tsx` | Instructions, Memory, Style, History, Voice |
| Notifications | `views/settings/NotificationsModule.tsx` | All, Email, Push, Schedule |
| Security | `views/settings/SecurityPrivacyModule.tsx` | MFA, Sessions, History, Data, Privacy |
| Integrations | `views/settings/IntegrationsModule.tsx` | Apps, API, Webhooks, Calendar |
| Appearance | `views/settings/AppearanceModule.tsx` | Theme, Language, Regional, Accessibility, Work, Dashboard |

### AppView Mappings

```typescript
// Settings Module Views (6-module structure)
SETTINGS_PROFILE_MODULE = 'SETTINGS_PROFILE_MODULE'
SETTINGS_AI_MODULE = 'SETTINGS_AI_MODULE'
SETTINGS_NOTIFICATIONS_MODULE = 'SETTINGS_NOTIFICATIONS_MODULE'
SETTINGS_SECURITY_MODULE = 'SETTINGS_SECURITY_MODULE'
SETTINGS_INTEGRATIONS_MODULE = 'SETTINGS_INTEGRATIONS_MODULE'
SETTINGS_APPEARANCE_MODULE = 'SETTINGS_APPEARANCE_MODULE'
```

## Features by Module

### Profile Module
- **Personal Info:** Name, email, company, role
- **Avatar:** Profile picture management
- **Password:** Password change
- **Billing:** Subscription overview, payment methods
- **Account:** Account status, export data, delete account

### AI Preferences Module
- **Instructions:** Custom AI instructions
- **Memory:** Enable/disable AI memory, clear memory
- **Response Style:** Length, tone, format preferences
- **Chat History:** Enable/disable, clear history
- **Voice:** Voice settings for audio features

### Notifications Module
- **All:** Master notification settings
- **Email:** Email notification preferences
- **Push:** Push notification settings
- **Schedule:** Quiet hours, weekend settings

### Security & Privacy Module (Enterprise)

**See detailed documentation:** [SECURITY_MODULE.md](./SECURITY_MODULE.md)

- **Dashboard:** Security score (0-100), compliance badges, quick actions
- **MFA:** Two-factor authentication with enhanced UX, backup codes
- **Trusted Devices:** Manage devices that skip 2FA verification
- **Sessions:** Active sessions management
- **Security Events:** Personal audit log with filtering and export
- **Data Controls:** GDPR-compliant consent management, data export/deletion
- **Privacy:** Visibility and communication preferences

### Integrations Module
- **Apps:** Connected applications
- **API Keys:** Personal API key management
- **Webhooks:** Webhook configurations
- **Calendar:** Google/Outlook calendar sync

### Appearance Module
- **Theme:** Light/dark/system theme
- **Language:** Language selection
- **Regional:** Timezone, date format
- **Accessibility:** A11y options
- **Work:** Work preferences
- **Dashboard:** Dashboard customization

## Backend API Routes

### New Routes

| Route | Purpose |
|-------|---------|
| `GET /api/auth/login-history` | Get user's login history |
| `GET/DELETE /api/ai/memory` | Manage AI memory |
| `PUT /api/ai/memory/settings` | Update AI memory settings |
| `GET/DELETE /api/sessions` | Manage active sessions |
| `POST /api/user/data-export` | Request GDPR data export |
| `PUT /api/user/data-retention` | Update data retention settings |

### Database Tables

```sql
-- AI Memory
CREATE TABLE user_ai_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_key TEXT,
    memory_value TEXT,
    created_at DATETIME
);

-- Login History
CREATE TABLE login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    status TEXT,
    created_at DATETIME
);

-- Active Sessions
CREATE TABLE active_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device TEXT,
    ip_address TEXT,
    last_active DATETIME,
    created_at DATETIME
);
```

## Data Flow

```
SettingsView.tsx
    │
    ├── SettingsSidebar (Navigation)
    │   └── Section selection → setCurrentView()
    │
    └── Module Components
        └── Tab selection → local state
            └── Settings changes → API → onUpdateUser()
```

## Translation Keys

All UI text uses i18n keys under the `settings` namespace:

```json
{
  "settings": {
    "modules": {
      "profile": "Profile",
      "aiPreferences": "AI Preferences",
      "notifications": "Notifications",
      "security": "Security & Privacy",
      "integrations": "Integrations",
      "appearance": "Appearance & Regional"
    },
    "tabs": {
      "personal": "Personal Info",
      "avatar": "Avatar",
      // ... etc
    }
  }
}
```

## GDPR Compliance

The Settings panel includes GDPR-compliant features:

1. **Data Export (Article 20):** Users can request full data export
2. **Data Deletion (Article 17):** Users can request account deletion
3. **Training Opt-out:** Users can exclude data from AI training
4. **Data Retention:** Configurable retention periods

## Migration from Legacy Structure

The new modular structure consolidates the previous flat menu:

| Old View | New Module > Tab |
|----------|------------------|
| SETTINGS_PROFILE | Profile > Personal |
| SETTINGS_BILLING | Profile > Billing |
| SETTINGS_AI | AI Preferences > Instructions |
| SETTINGS_NOTIFICATIONS | Notifications > All |
| SETTINGS_SECURITY | Security > MFA |
| SETTINGS_PRIVACY | Security > Privacy |
| SETTINGS_INTEGRATIONS | Integrations > Apps |
| SETTINGS_REGIONALIZATION | Appearance > Regional |
| SETTINGS_ACCESSIBILITY | Appearance > Accessibility |
| SETTINGS_WORK_PREFERENCES | Appearance > Work |
| SETTINGS_DASHBOARD_PREFERENCES | Appearance > Dashboard |

Legacy AppView values continue to work via the `appViewToSettingsSection` mapping in SettingsSidebar.

## Best Practices

1. **State Persistence:** Save settings immediately on change
2. **Optimistic Updates:** Show changes immediately, revert on error
3. **Validation:** Validate inputs before saving
4. **Feedback:** Show success/error toasts after actions
5. **Confirmation:** Require confirmation for destructive actions

## Related Documentation

- [Security Module](./SECURITY_MODULE.md) - Enterprise Security & Privacy detailed docs
- [Admin Panel Architecture](./ADMIN_PANEL.md)
- [SuperAdmin Architecture](./SUPERADMIN_PANEL.md)
- [Help System](./HELP_SYSTEM.md)
- [Authentication System](./AUTHENTICATION.md)

