# FLOW-NOTIFICATION-001: Notification System

> **ID:** FLOW-NOTIFICATION-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Kompleksowy system powiadomień - in-app, email, push, integracje.

## Notification Channels

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION CHANNELS                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │    IN-APP       │  │     EMAIL       │  │  PUSH (Future)  │      │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │      │
│  │  • Bell icon    │  │  • Immediate    │  │  • Mobile PWA   │      │
│  │  • Real-time    │  │  • Digest       │  │  • Desktop      │      │
│  │  • Badge count  │  │  • Summary      │  │  • Service      │      │
│  │  • History      │  │  • Marketing    │  │    Worker       │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐                           │
│  │     SLACK       │  │   MS TEAMS      │                           │
│  │  ─────────────  │  │  ─────────────  │                           │
│  │  • Channels     │  │  • Channels     │                           │
│  │  • DMs          │  │  • Chats        │                           │
│  │  • Interactive  │  │  • Cards        │                           │
│  └─────────────────┘  └─────────────────┘                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Notification Types

| Category        | Type                     | Channels             | Default |
| --------------- | ------------------------ | -------------------- | ------- |
| **Tasks**       | task_assigned            | in-app, email        | All     |
|                 | task_due_soon            | in-app, email        | in-app  |
|                 | task_overdue             | in-app, email        | All     |
|                 | task_completed           | in-app               | in-app  |
|                 | task_comment             | in-app               | in-app  |
| **Decisions**   | decision_needed          | in-app, email, slack | All     |
|                 | decision_made            | in-app, email        | in-app  |
|                 | decision_escalated       | in-app, email        | All     |
| **Initiatives** | initiative_status_change | in-app               | in-app  |
|                 | initiative_approved      | in-app, email        | All     |
|                 | initiative_blocked       | in-app, email        | All     |
| **Assessments** | assessment_completed     | in-app, email        | All     |
|                 | assessment_shared        | in-app, email        | in-app  |
| **Projects**    | project_created          | in-app               | in-app  |
|                 | project_member_added     | in-app, email        | in-app  |
|                 | project_archived         | in-app               | in-app  |
| **AI**          | ai_suggestion            | in-app               | in-app  |
|                 | ai_action_pending        | in-app               | in-app  |
|                 | ai_insight               | in-app               | in-app  |
| **System**      | system_maintenance       | in-app, email        | All     |
|                 | subscription_change      | in-app, email        | All     |
|                 | usage_alert              | in-app, email        | All     |

## Notification Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION FLOW                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  1. EVENT TRIGGER                                               ││
│  │     Task assigned, Decision needed, etc.                        ││
│  └──────────────────────────────┬──────────────────────────────────┘│
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  2. NOTIFICATION SERVICE                                        ││
│  │     • Get notification type config                              ││
│  │     • Get user preferences                                      ││
│  │     • Determine channels to use                                 ││
│  └──────────────────────────────┬──────────────────────────────────┘│
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  3. CHANNEL DISPATCH                                            ││
│  │     ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         ││
│  │     │ In-App  │  │  Email  │  │  Slack  │  │  Teams  │         ││
│  │     └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         ││
│  └──────────┼────────────┼────────────┼────────────┼───────────────┘│
│             │            │            │            │                 │
│             ▼            ▼            ▼            ▼                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  4. DELIVERY                                                    ││
│  │     • Real-time WebSocket (in-app)                              ││
│  │     • Email queue                                               ││
│  │     • Integration webhooks                                       ││
│  └──────────────────────────────┬──────────────────────────────────┘│
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  5. TRACKING                                                    ││
│  │     • Delivery status                                           ││
│  │     • Read status                                               ││
│  │     • Click tracking (email)                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## User Preferences

```typescript
interface NotificationPreferences {
  userId: string;

  // Global settings
  globalEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
  quietHoursTimezone: string;

  // Email settings
  emailEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly';
  emailDigestTime: string; // "09:00"

  // Per-type settings
  typeSettings: {
    [notificationType: string]: {
      enabled: boolean;
      channels: ('in_app' | 'email' | 'slack' | 'teams')[];
    };
  };
}
```

## In-App Notifications UI

```
┌─────────────────────────────────────────────┐
│  🔔 Notifications                    [⚙️]   │
├─────────────────────────────────────────────┤
│  TODAY                                      │
│  ─────────────────────────────────────────  │
│  🔴 Decision needed: Budget approval        │
│      Project Alpha · 5 min ago              │
│                                             │
│  ✅ Task completed by John                  │
│      "Update documentation" · 1 hour ago    │
│                                             │
│  💡 AI Suggestion                           │
│      "Consider adding KPI..." · 2 hours ago │
│                                             │
│  YESTERDAY                                  │
│  ─────────────────────────────────────────  │
│  📋 You were assigned a task                │
│      "Review Q3 results" · 1 day ago        │
│                                             │
│  [Mark all as read]     [View all →]        │
└─────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Notification types configuration
CREATE TABLE IF NOT EXISTS notification_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'tasks', 'decisions', 'initiatives', 'assessments', 'projects', 'ai', 'system'
    display_name TEXT NOT NULL,
    description TEXT,
    default_channels TEXT NOT NULL, -- JSON array
    is_user_configurable INTEGER DEFAULT 1,
    is_critical INTEGER DEFAULT 0, -- Cannot be disabled
    template_subject TEXT,
    template_body TEXT,
    icon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,

    -- Global settings
    global_enabled INTEGER DEFAULT 1,
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',

    -- Email settings
    email_enabled INTEGER DEFAULT 1,
    email_digest_enabled INTEGER DEFAULT 0,
    email_digest_frequency TEXT DEFAULT 'daily',
    email_digest_time TEXT DEFAULT '09:00',

    -- Per-type settings (JSON)
    type_settings TEXT DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Notification details
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

    -- Related entity
    entity_type TEXT,
    entity_id TEXT,
    action_url TEXT,

    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON

    -- Status
    is_read INTEGER DEFAULT 0,
    read_at TIMESTAMP,
    is_dismissed INTEGER DEFAULT 0,
    dismissed_at TIMESTAMP,

    -- Delivery tracking
    channels_sent TEXT DEFAULT '[]', -- JSON array of channels
    email_sent_at TIMESTAMP,
    email_delivered INTEGER DEFAULT 0,
    email_opened INTEGER DEFAULT 0,
    slack_sent_at TIMESTAMP,

    -- Grouping
    group_key TEXT, -- For grouping similar notifications

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Email digest queue
CREATE TABLE IF NOT EXISTS notification_digest_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    digest_type TEXT NOT NULL, -- 'daily', 'weekly'
    scheduled_for DATE NOT NULL,
    included_in_digest_at TIMESTAMP,

    UNIQUE(notification_id, digest_type),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

-- Notification delivery log
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'in_app', 'email', 'slack', 'teams', 'push'

    -- Delivery status
    status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,

    -- For email
    message_id TEXT,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_digest_queue_user ON notification_digest_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_queue_scheduled ON notification_digest_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
```

## API Endpoints

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/notifications`              | Get user notifications |
| GET    | `/api/notifications/unread-count` | Get unread count       |
| POST   | `/api/notifications/:id/read`     | Mark as read           |
| POST   | `/api/notifications/read-all`     | Mark all as read       |
| DELETE | `/api/notifications/:id`          | Dismiss notification   |
| GET    | `/api/notifications/preferences`  | Get preferences        |
| PUT    | `/api/notifications/preferences`  | Update preferences     |

## WebSocket Events

```typescript
// Server → Client
interface NotificationEvent {
  type: 'notification:new';
  payload: {
    id: string;
    type: string;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    createdAt: string;
  };
}

interface UnreadCountEvent {
  type: 'notification:unread_count';
  payload: {
    count: number;
  };
}
```

## Related Flows

- FLOW-INTEGRATION-001: Slack/Teams notifications
- FLOW-DECISION-001: Decision notifications
- FLOW-TASK-001: Task notifications
- FLOW-MYWORK-001: AI inbox notifications
