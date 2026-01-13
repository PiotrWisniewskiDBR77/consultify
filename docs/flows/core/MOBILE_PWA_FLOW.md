# FLOW-MOBILE-001: Mobile & PWA

> **ID:** FLOW-MOBILE-001 | **Status:** ✅ Complete | **Priority:** P2

## Overview

| Metric                    | Value               |
| ------------------------- | ------------------- |
| **Completeness**          | 100%                |
| **Implementation Status** | Design + Foundation |

## Purpose

Responsywna aplikacja webowa zoptymalizowana pod urządzenia mobilne. Przygotowanie pod przyszłe PWA.

## Mobile Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MOBILE STRATEGY                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: Responsive Web (Current)                                   │
│  ─────────────────────────────────────────────────────────────────  │
│  • Mobile-first CSS                                                  │
│  • Touch-optimized UI                                                │
│  • Optimized for mobile browsers                                     │
│                                                                      │
│  Phase 2: PWA (Future)                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  • Service Worker                                                    │
│  • Offline support                                                   │
│  • Push notifications                                                │
│  • Install prompt                                                    │
│                                                                      │
│  Phase 3: Native Apps (Future)                                       │
│  ─────────────────────────────────────────────────────────────────  │
│  • React Native wrapper                                              │
│  • Native notifications                                              │
│  • Biometric auth                                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Mobile-Optimized Views

### Priority Views (Must Work Well)

| View                      | Mobile Importance | Notes                 |
| ------------------------- | ----------------- | --------------------- |
| **MyWork Dashboard**      | 🔴 Critical       | Daily task management |
| **Assessment (Lean 4.0)** | 🔴 Critical       | Field audits          |
| **Task List**             | 🔴 Critical       | Quick updates         |
| **Decision Queue**        | 🟡 High           | Approve on the go     |
| **Notifications**         | 🟡 High           | Stay informed         |
| **AI Chat**               | 🟡 High           | Quick questions       |
| **Reports View**          | 🟢 Medium         | Review only           |
| **Project Dashboard**     | 🟢 Medium         | Overview              |
| **Settings**              | ⚪ Low            | Rarely used           |

### MyWork Mobile Layout

```
┌─────────────────────────────┐
│  ☰  MyWork        🔔 👤    │
├─────────────────────────────┤
│                             │
│  Good morning, Jan!         │
│  You have 5 tasks today     │
│                             │
│  ┌───────────────────────┐  │
│  │ 📊 Quick Stats        │  │
│  │ Tasks: 5 | Decisions: 2│  │
│  └───────────────────────┘  │
│                             │
│  Today's Focus              │
│  ───────────────────────    │
│  ┌───────────────────────┐  │
│  │ ☐ Review Q1 Report    │  │
│  │   Due: Today 5pm      │  │
│  │   [Start] [Snooze]    │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ☐ Team standup        │  │
│  │   Due: Today 10am     │  │
│  └───────────────────────┘  │
│                             │
│  Decisions Needed           │
│  ───────────────────────    │
│  ┌───────────────────────┐  │
│  │ ⚡ Budget Approval    │  │
│  │   Deadline: 2h        │  │
│  │   [Approve] [Reject]  │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  🏠   📋   💬   👤   ⚙️    │
└─────────────────────────────┘
     Bottom Navigation
```

### Assessment Mobile (Lean 4.0)

```
┌─────────────────────────────┐
│  ← Lean 4.0 Assessment      │
├─────────────────────────────┤
│                             │
│  Section 3 of 8             │
│  ████████░░░░ 40%           │
│                             │
│  ─────────────────────────  │
│  Question 12/30             │
│                             │
│  How would you rate the     │
│  current state of visual    │
│  management in this area?   │
│                             │
│  ┌───────────────────────┐  │
│  │  📷 Add Photo         │  │
│  └───────────────────────┘  │
│                             │
│  ┌─────────────────────┐    │
│  │ ○ 1 - Not present   │    │
│  │ ○ 2 - Basic         │    │
│  │ ● 3 - Developing    │    │
│  │ ○ 4 - Advanced      │    │
│  │ ○ 5 - World-class   │    │
│  └─────────────────────┘    │
│                             │
│  Notes (optional)           │
│  ┌───────────────────────┐  │
│  │ Some boards visible   │  │
│  │ but not updated...    │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  [← Previous]    [Next →]   │
└─────────────────────────────┘
```

## PWA Configuration (Future)

```json
// manifest.json
{
  "name": "Consultinity",
  "short_name": "Consultinity",
  "description": "AI-powered transformation management",
  "start_url": "/app/mywork",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#3B82F6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "categories": ["business", "productivity"],
  "screenshots": [{ "src": "/screenshots/mobile-1.png", "sizes": "390x844", "type": "image/png" }]
}
```

## Database Schema

```sql
-- Mobile device registrations
CREATE TABLE IF NOT EXISTS mobile_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Device info
    device_type TEXT NOT NULL, -- 'ios', 'android', 'web'
    device_name TEXT,
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,

    -- Push notifications
    push_token TEXT,
    push_provider TEXT, -- 'fcm', 'apns', 'web_push'
    push_enabled INTEGER DEFAULT 1,

    -- Status
    is_active INTEGER DEFAULT 1,
    last_active_at TIMESTAMP,

    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Mobile-specific preferences
CREATE TABLE IF NOT EXISTS mobile_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,

    -- UI preferences
    compact_mode INTEGER DEFAULT 0,
    bottom_nav_items TEXT DEFAULT '["home","tasks","chat","profile"]',
    quick_actions TEXT DEFAULT '["new_task","scan_qr"]',

    -- Notifications
    push_task_reminders INTEGER DEFAULT 1,
    push_decisions INTEGER DEFAULT 1,
    push_mentions INTEGER DEFAULT 1,
    push_ai_suggestions INTEGER DEFAULT 0,
    quiet_hours_start TEXT, -- "22:00"
    quiet_hours_end TEXT, -- "07:00"

    -- Offline
    offline_sync_enabled INTEGER DEFAULT 0,
    offline_data_limit_mb INTEGER DEFAULT 100,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_token ON mobile_devices(push_token);
```

## API Endpoints

| Method | Endpoint                      | Description           |
| ------ | ----------------------------- | --------------------- |
| POST   | `/api/mobile/register-device` | Register device       |
| PUT    | `/api/mobile/preferences`     | Update preferences    |
| POST   | `/api/mobile/push-token`      | Update push token     |
| GET    | `/api/mobile/sync-data`       | Get offline sync data |

## Touch Interactions

```typescript
// Touch-optimized gestures
const mobileGestures = {
  task: {
    swipeRight: 'complete',
    swipeLeft: 'snooze',
    longPress: 'options',
    tap: 'open',
  },
  notification: {
    swipeRight: 'dismiss',
    swipeLeft: 'archive',
    tap: 'open',
  },
  decision: {
    swipeRight: 'approve',
    swipeLeft: 'reject',
    tap: 'details',
  },
};
```

## Related Flows

- FLOW-MYWORK-001: Dashboard priorities
- FLOW-ASSESSMENT-001: Field assessments
- FLOW-NOTIFICATION-001: Push notifications
