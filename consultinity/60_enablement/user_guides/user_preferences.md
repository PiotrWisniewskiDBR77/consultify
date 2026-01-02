# User Preferences Guide

This document describes all user preference settings available in Consultify, their purpose, and how they integrate with the system.

## Overview

Consultify provides comprehensive user settings inspired by industry-leading PMO tools like HubSpot, ClickUp, Monday.com, and Asana. Settings are organized into logical categories for easy navigation.

## Settings Categories

### 1. Profile Settings (`/settings/profile`)

Basic user information and account settings.

| Setting | Type | Description |
|---------|------|-------------|
| First Name | Text | User's first name |
| Last Name | Text | User's last name |
| Email | Email | Primary email address |
| Phone | Text | Contact phone number |
| Company Name | Text | Organization name |
| Job Title | Text | Role/position title |
| Avatar | Image | Profile picture |

**API Endpoint:** `PUT /api/users/:id`

---

### 2. Regional Settings (`/settings/regional`)

Locale and format preferences for dates, numbers, and currency.

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Timezone | Select | All IANA timezones | Browser timezone |
| Measurement Units | Radio | `metric`, `imperial` | `metric` |
| Currency | Select | USD, EUR, GBP, PLN, CHF, JPY, CAD, AUD, CNY, INR | `USD` |
| Number Format | Select | `en-US`, `de-DE`, `pl-PL`, `fr-FR` | `en-US` |
| Date Format | Radio | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY` | `DD/MM/YYYY` |
| Time Format | Radio | `12h`, `24h` | `24h` |
| First Day of Week | Button | `monday`, `sunday` | `monday` |

**API Endpoint:** `GET/PUT /api/settings/preferences/regional`

**Example Request:**
```json
{
  "preferences": {
    "timezone": "Europe/Warsaw",
    "units": "metric",
    "currency": "PLN",
    "numberFormat": "pl-PL",
    "dateFormat": "DD.MM.YYYY",
    "timeFormat": "24h",
    "firstDayOfWeek": "monday"
  }
}
```

---

### 3. Work Preferences (`/settings/work`)

Task and project management preferences.

#### View & Display Settings

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Default Project View | Card Select | `kanban`, `list`, `timeline`, `calendar` | `kanban` |
| Default Task Sort | Select | `priority`, `dueDate`, `created`, `alphabetical` | `priority` |
| Week Start Day | Button | `monday`, `sunday` | `monday` |
| Show Completed Tasks | Toggle | Boolean | `false` |
| Show Subtasks | Toggle | Boolean | `true` |

#### Task Defaults (NEW)

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Default Task Priority | Button Group | `none`, `low`, `medium`, `high`, `urgent` | `medium` |
| Default Reminder | Select | `none`, `15min`, `30min`, `1hour`, `3hours`, `1day`, `3days` | `1day` |

#### Snooze & Focus (NEW)

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Default Snooze Duration | Select | `15min`, `30min`, `1hour`, `3hours`, `tomorrow`, `nextWeek` | `1hour` |
| Auto-Snooze Overdue | Toggle | Boolean | `false` |
| Enable Focus Mode | Toggle | Boolean | `true` |
| Focus Blocks Notifications | Toggle | Boolean | `true` |
| Default Focus Duration | Select | `15`, `25`, `45`, `60`, `90` minutes | `25` |

#### Automation

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Auto-Archive Days | Select | `0` (never), `7`, `14`, `30`, `60`, `90` days | `30` |
| Default Task Due Days | Select | `0` (none), `1`, `3`, `7`, `14` days | `7` |
| Time Tracking Mode | Select | `none`, `manual`, `automatic` | `none` |

**API Endpoint:** `GET/PUT /api/settings/preferences/work`

---

### 4. Dashboard Preferences (`/settings/dashboard`)

Home dashboard customization.

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Default Landing Page | Select | `dashboard`, `projects`, `tasks`, `calendar`, `ai-assistant` | `dashboard` |
| Show Greeting | Toggle | Boolean | `true` |
| Compact Mode | Toggle | Boolean | `false` |
| Auto-Refresh Interval | Select | `0` (disabled), `30`, `60`, `120`, `300` seconds | `0` |

#### Widgets Visibility

| Widget | Default |
|--------|---------|
| Tasks | `true` |
| Initiatives | `true` |
| Calendar | `true` |
| AI Insights | `true` |
| Recent Activity | `true` |
| Quick Actions | `true` |
| Metrics | `true` |

**API Endpoint:** `GET/PUT /api/settings/preferences/dashboard`

---

### 5. Notification Settings (`/settings/notifications`)

Control how and when you receive notifications.

#### Channel Preferences

| Channel | Type | Description |
|---------|------|-------------|
| Email | Toggle | Receive email notifications |
| In-App | Toggle | Show in-app notification badges |
| Slack | Toggle | Send to connected Slack workspace |
| Microsoft Teams | Toggle | Send to connected Teams channel |
| Browser Push | Toggle | Desktop browser notifications |

#### Event Categories

| Category | Events |
|----------|--------|
| Task Notifications | Assignment, updates, completion, comments |
| Milestone Notifications | Upcoming, reached, overdue |
| Mention Notifications | Direct mentions in comments/chat |
| Approval Notifications | Pending approvals, approved, rejected |
| System Notifications | Security alerts, updates, maintenance |

#### Quiet Hours

| Setting | Type | Default |
|---------|------|---------|
| Enable Quiet Hours | Toggle | `false` |
| Start Time | Time | `22:00` |
| End Time | Time | `08:00` |
| Include Weekends | Toggle | `true` |

**API Endpoint:** `GET/PUT /api/settings/notifications/preferences`

---

### 6. Sound Notifications (`/settings/sound`)

Audio alert preferences. (NEW)

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Sound Enabled | Toggle | Boolean | `true` |
| Volume | Slider | `0-100` | `70` |
| Sound Theme | Card Select | `default`, `minimal`, `playful`, `professional` | `default` |

#### Individual Sound Toggles

| Sound | Default |
|-------|---------|
| Task Assigned | `true` |
| Task Completed | `true` |
| Mentions | `true` |
| Messages | `true` |
| Reminders | `true` |

**API Endpoint:** `GET/PUT /api/settings/preferences/sound`

---

### 7. Privacy & Data Settings (`/settings/privacy`)

Privacy controls and GDPR compliance. (NEW)

#### Visibility Settings

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Profile Visibility | Radio | `public`, `organization`, `private` | `organization` |
| Show Online Status | Toggle | Boolean | `true` |
| Show Activity Status | Toggle | Boolean | `true` |
| Show Last Seen | Toggle | Boolean | `true` |

#### Data Sharing

| Setting | Type | Default |
|---------|------|---------|
| Share Analytics | Toggle | `true` |
| Share Usage Data | Toggle | `false` |
| Help Improve AI | Toggle | `true` |
| Allow Third-Party Integrations | Toggle | `true` |

#### Marketing Preferences

| Setting | Type | Default |
|---------|------|---------|
| Product Updates | Toggle | `true` |
| Marketing Emails | Toggle | `false` |
| Newsletter | Toggle | `false` |

#### Data Management (GDPR)

| Action | Description |
|--------|-------------|
| Export Data | Download all personal data in JSON format |
| Delete Account | Request permanent account deletion |

**API Endpoints:**
- Preferences: `GET/PUT /api/settings/preferences/privacy`
- Export: `POST /api/settings/export-data`
- Deletion: `POST /api/settings/request-deletion`

---

### 8. Accessibility Settings (`/settings/accessibility`)

Accessibility and usability options.

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Font Size | Select | `small`, `medium`, `large`, `extra-large` | `medium` |
| High Contrast Mode | Toggle | Boolean | `false` |
| Reduce Motion | Toggle | Boolean | `false` |
| Screen Reader Optimized | Toggle | Boolean | `false` |
| Show Keyboard Shortcuts | Toggle | Boolean | `true` |
| Focus Highlight | Toggle | Boolean | `true` |
| Cursor Size | Select | `default`, `large` | `default` |
| Text Spacing | Select | `default`, `relaxed`, `spacious` | `default` |
| Underline Links | Toggle | Boolean | `false` |

**API Endpoint:** `GET/PUT /api/settings/preferences/accessibility`

---

### 9. Advanced Settings (`/settings/advanced`)

Developer tools and advanced options. (NEW)

#### Personal API Keys

Manage API keys for programmatic access.

| Action | Description |
|--------|-------------|
| Create Key | Generate new API key with specified permissions |
| View Keys | List all active API keys (masked) |
| Delete Key | Revoke an API key |

**Permissions:** `read`, `write`, `delete`

#### Export Preferences

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Default Format | Select | `pdf`, `csv`, `xlsx`, `json` | `pdf` |
| Include Attachments | Toggle | Boolean | `true` |
| Date Range | Select | `all`, `30days`, `90days`, `1year` | `all` |

#### Keyboard Shortcuts

| Setting | Type | Default |
|---------|------|---------|
| Enable Shortcuts | Toggle | `true` |

**Common Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New Task |
| `Ctrl/Cmd + K` | Search |
| `Ctrl/Cmd + P` | Quick Switch Project |
| `Ctrl/Cmd + B` | Toggle Sidebar |
| `Ctrl/Cmd + ,` | Open Settings |
| `Ctrl/Cmd + D` | Toggle Dark Mode |
| `Ctrl/Cmd + Enter` | Mark Task Complete |
| `Ctrl/Cmd + J` | Open AI Assistant |
| `Ctrl/Cmd + Shift + F` | Focus Mode |

#### Connected Accounts (SSO)

| Provider | Status |
|----------|--------|
| Google | Connect/Disconnect |
| Microsoft | Connect/Disconnect |
| GitHub | Connect/Disconnect |

#### Developer Options

| Setting | Type | Default |
|---------|------|---------|
| Developer Mode | Toggle | `false` |
| Show Debug Info | Toggle | `false` |
| Log API Requests | Toggle | `false` |
| Beta Features | Toggle | `false` |

**API Endpoints:**
- Preferences: `GET/PUT /api/settings/preferences/advanced`
- API Keys: `GET/POST/DELETE /api/settings/api-keys`
- Connected Accounts: `GET/DELETE /api/settings/connected-accounts`

---

### 10. Security Settings (`/settings/security`)

Account security management.

| Feature | Description |
|---------|-------------|
| Change Password | Update account password |
| Active Sessions | View and revoke active login sessions |
| Two-Factor Authentication | Enable/disable 2FA (TOTP) |

**API Endpoints:**
- Password: `PUT /api/users/:id/password`
- Sessions: `GET/DELETE /api/sessions`
- MFA: `POST/DELETE /api/mfa`

---

### 11. Integration Settings (`/settings/integrations`)

External tool connections and webhooks.

#### Supported Integrations

| Provider | Type | Features |
|----------|------|----------|
| Slack | Communication | Notifications, updates |
| Microsoft Teams | Communication | Notifications, updates |
| WhatsApp | Communication | Notifications |
| Trello | Project Management | Sync boards/cards |
| Jira | Project Management | Sync issues |
| ClickUp | Project Management | Sync tasks |
| Asana | Project Management | Sync tasks |
| Monday.com | Project Management | Sync items |
| Notion | Documentation | Sync pages |
| Basecamp | Project Management | Sync projects |

#### Webhooks

Create webhooks to receive real-time notifications about events.

**Event Types:**
- `task.created`, `task.updated`, `task.completed`, `task.deleted`
- `initiative.created`, `initiative.updated`, `initiative.completed`
- `comment.created`
- `user.invited`, `user.joined`
- `approval.requested`, `approval.completed`

**API Endpoints:**
- Integrations: `GET/POST/DELETE /api/settings/integrations`
- Webhooks: `GET/POST/DELETE /api/webhooks`

---

## Database Schema

All user preferences are stored in the `users` table in two JSON columns:

```sql
-- Basic notification preferences (legacy)
notification_preferences TEXT DEFAULT '{}'

-- Extended preferences (all categories)
extended_preferences TEXT DEFAULT '{}'
```

### Extended Preferences Structure

```json
{
  "work": { ... },
  "dashboard": { ... },
  "accessibility": { ... },
  "privacy": { ... },
  "ai": { ... },
  "regional": { ... },
  "sound": { ... },
  "advanced": { ... }
}
```

### Related Tables

- `user_api_keys` - Personal API keys
- `user_connected_accounts` - SSO connections
- `data_export_requests` - GDPR data export requests
- `account_deletion_requests` - Account deletion requests
- `integrations` - External tool integrations
- `user_notification_preferences` - Granular notification settings

---

## Frontend Components

| Component | Path | Description |
|-----------|------|-------------|
| SettingsView | `views/SettingsView.tsx` | Main settings container |
| ProfileSettings | `components/settings/ProfileSettings.tsx` | Profile management |
| RegionalSettings | `components/settings/RegionalSettings.tsx` | Locale preferences |
| WorkPreferencesSettings | `components/settings/WorkPreferencesSettings.tsx` | Work preferences |
| DashboardPreferencesSettings | `components/settings/DashboardPreferencesSettings.tsx` | Dashboard customization |
| NotificationSettings | `components/settings/NotificationSettings.tsx` | Notification channels |
| SoundNotificationsSettings | `components/settings/SoundNotificationsSettings.tsx` | Audio alerts |
| PrivacyDataSettings | `components/settings/PrivacyDataSettings.tsx` | Privacy & GDPR |
| AccessibilitySettings | `components/settings/AccessibilitySettings.tsx` | Accessibility options |
| AdvancedSettings | `components/settings/AdvancedSettings.tsx` | Developer tools |
| SecuritySettings | `components/settings/SecuritySettings.tsx` | Security management |
| IntegrationSettings | `components/settings/IntegrationSettings.tsx` | Integrations & webhooks |

---

## Best Practices

1. **Respect User Preferences**: Always check user settings before displaying content or sending notifications.

2. **Apply Accessibility Settings**: Use the accessibility preferences to modify UI rendering.

3. **Honor Quiet Hours**: Check `isInQuietHours` before sending non-urgent notifications.

4. **Format Data Correctly**: Use regional settings for displaying dates, times, numbers, and currency.

5. **Privacy by Default**: Default to more private settings and let users opt-in to sharing.

---

## Migration Notes

When migrating from older versions:

1. Run migration `120_settings_enhancement_tables.sql` to create new tables
2. Existing preferences in `notification_preferences` remain compatible
3. New preferences are stored in `extended_preferences`
4. Both columns are read during preference loading for backwards compatibility

---

*Last Updated: January 2026*
*Version: 2.0.0*

