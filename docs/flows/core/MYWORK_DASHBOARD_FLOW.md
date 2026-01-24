# FLOW-MYWORK-001: MyWork Dashboard

> **ID:** FLOW-MYWORK-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Spersonalizowany dashboard dla każdego użytkownika. Centrum pracy - wszystko co potrzebne w jednym miejscu.

## MyWork Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MY WORK DASHBOARD                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐│
│  │    QUICK STATS      │  │           TODAY'S FOCUS                ││
│  │  ─────────────────  │  │  ────────────────────────────────────  ││
│  │  Tasks: 12 pending  │  │  □ Complete DRD Assessment (60%)       ││
│  │  Decisions: 3       │  │  □ Review Initiative Draft             ││
│  │  Overdue: 2         │  │  □ Make decision: Budget approval      ││
│  └─────────────────────┘  └────────────────────────────────────────┘│
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                        MY TASKS                                  ││
│  │  ──────────────────────────────────────────────────────────────  ││
│  │  ⚡ Due Today                                                     ││
│  │  ├── [HIGH] Finalize project proposal     Project Alpha  →       ││
│  │  └── [MED]  Review team feedback          Project Beta   →       ││
│  │                                                                  ││
│  │  📅 This Week                                                    ││
│  │  ├── [HIGH] Create roadmap presentation   Project Alpha  →       ││
│  │  ├── [MED]  Update KPIs                   Project Beta   →       ││
│  │  └── [LOW]  Documentation update          Project Gamma  →       ││
│  │                                                                  ││
│  │  ⚠️ Overdue                                                      ││
│  │  └── [HIGH] Submit compliance report      Project Delta  → !     ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                    DECISIONS NEEDED                              ││
│  │  ──────────────────────────────────────────────────────────────  ││
│  │  🔴 Awaiting My Decision                                         ││
│  │  ├── Budget approval for Initiative X     Due: Tomorrow  [Make]  ││
│  │  └── Go/No-Go: Phase 2 start             Due: 3 days    [Make]  ││
│  │                                                                  ││
│  │  🟡 My Requests Pending                                          ││
│  │  └── Resource allocation request          Waiting: John  [View]  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────┐  ┌────────────────────────────────┐│
│  │     AI INBOX                │  │      RECENT ACTIVITY           ││
│  │  ─────────────────────────  │  │  ────────────────────────────  ││
│  │  💡 AI Suggestions          │  │  • Task completed (2h ago)     ││
│  │  ├── "Consider adding KPI"  │  │  • Comment on Initiative (4h)  ││
│  │  └── "Risk detected in..."  │  │  • Decision made (yesterday)   ││
│  │                             │  │  • Assessment started (2d)     ││
│  │  📊 AI Insights             │  │                                ││
│  │  └── "3 tasks may miss..."  │  │                                ││
│  └─────────────────────────────┘  └────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Sections

### 1. Quick Stats

| Stat             | Description                    |
| ---------------- | ------------------------------ |
| Pending Tasks    | Total tasks assigned to me     |
| Decisions Needed | Decisions waiting for me       |
| Overdue          | Tasks past due date            |
| In Progress      | Tasks I'm currently working on |

### 2. Today's Focus

AI-curated list of most important items for today:

- Based on due dates, priority, and dependencies
- Maximum 3-5 items
- Updates throughout the day

### 3. My Tasks

Tasks organized by urgency:

- **Due Today**: Tasks with today's deadline
- **This Week**: Tasks due in next 7 days
- **Overdue**: Past due tasks (highlighted red)
- **Upcoming**: Tasks due later

Each task shows:

- Title
- Priority indicator
- Project name
- Progress %
- Quick action buttons

### 4. Decisions Needed

Two categories:

- **Awaiting My Decision**: I am the decision maker
- **My Requests Pending**: Decisions I requested, waiting on others

Each decision shows:

- Title
- Due date / time remaining
- Decision maker (for pending)
- Quick action: [Make Decision] or [View]

### 5. AI Inbox

AI-generated insights and suggestions:

- **Suggestions**: Proactive recommendations
- **Insights**: Analysis of patterns, risks
- **Alerts**: Important notifications

### 6. Recent Activity

Timeline of my recent actions:

- Tasks completed
- Decisions made
- Comments added
- Assessments worked on

## Mobile Optimization

MyWork is critical for mobile experience (Lean 4.0 assessment in factory):

```
┌─────────────────────────────┐
│        MY WORK              │
├─────────────────────────────┤
│  📊 3 tasks · 2 decisions   │
├─────────────────────────────┤
│  TODAY'S FOCUS              │
│  ─────────────────────────  │
│  □ Complete assessment      │
│  □ Review initiative        │
│  □ Make decision            │
├─────────────────────────────┤
│  ⚠️ OVERDUE (1)             │
│  ─────────────────────────  │
│  Submit report    [View →]  │
├─────────────────────────────┤
│  🔴 DECISIONS (2)           │
│  ─────────────────────────  │
│  Budget approval  [Make →]  │
│  Phase 2 start    [Make →]  │
└─────────────────────────────┘
```

## Database Schema

```sql
-- MyWork preferences per user
CREATE TABLE IF NOT EXISTS mywork_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,

    -- Display preferences
    default_view TEXT DEFAULT 'all', -- 'all', 'tasks', 'decisions', 'focus'
    show_completed_tasks INTEGER DEFAULT 0,
    task_grouping TEXT DEFAULT 'due_date', -- 'due_date', 'project', 'priority'

    -- Focus settings
    focus_max_items INTEGER DEFAULT 5,
    focus_include_decisions INTEGER DEFAULT 1,

    -- Notifications
    daily_summary_enabled INTEGER DEFAULT 1,
    daily_summary_time TEXT DEFAULT '08:00',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Inbox items
CREATE TABLE IF NOT EXISTS ai_inbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Item details
    type TEXT NOT NULL, -- 'suggestion', 'insight', 'alert', 'action'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'

    -- Context
    related_type TEXT, -- 'task', 'initiative', 'project', 'decision'
    related_id TEXT,

    -- Status
    status TEXT DEFAULT 'unread', -- 'unread', 'read', 'dismissed', 'actioned'
    read_at TIMESTAMP,
    actioned_at TIMESTAMP,

    -- AI metadata
    confidence_score REAL,
    generated_by TEXT DEFAULT 'ai',

    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recent activity log (for activity feed)
CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Activity details
    activity_type TEXT NOT NULL, -- 'task_completed', 'decision_made', 'comment_added', etc.
    activity_data TEXT, -- JSON with details

    -- Related entity
    entity_type TEXT,
    entity_id TEXT,
    entity_name TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_inbox_user ON ai_inbox(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_status ON ai_inbox(status);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at);
```

## API Endpoints

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/api/mywork`                   | Get full MyWork dashboard data |
| GET    | `/api/mywork/tasks`             | Get my tasks (with filters)    |
| GET    | `/api/mywork/decisions`         | Get my decisions               |
| GET    | `/api/mywork/focus`             | Get AI-curated focus items     |
| GET    | `/api/mywork/inbox`             | Get AI inbox                   |
| POST   | `/api/mywork/inbox/:id/read`    | Mark inbox item as read        |
| POST   | `/api/mywork/inbox/:id/dismiss` | Dismiss inbox item             |
| GET    | `/api/mywork/activity`          | Get recent activity            |
| GET    | `/api/mywork/preferences`       | Get preferences                |
| PUT    | `/api/mywork/preferences`       | Update preferences             |
| GET    | `/api/mywork/stats`             | Get quick stats                |

## AI Integration

### Focus Curation Algorithm

```typescript
interface FocusItem {
  type: 'task' | 'decision' | 'assessment';
  id: string;
  title: string;
  reason: string; // Why this is in focus
  urgency: number; // 0-100
}

function curateFocus(userId: string): FocusItem[] {
  // 1. Get overdue items (highest priority)
  // 2. Get items due today
  // 3. Get blocked items needing my action
  // 4. Get high-priority items due this week
  // 5. Score by urgency, impact, dependencies
  // 6. Return top 5
}
```

### Inbox Generation

AI generates inbox items based on:

- Pattern analysis (tasks at risk)
- Deadlines approaching
- Blockers detected
- Recommendations from assessments
- Process optimization suggestions

## Related Flows

- FLOW-TASK-001: Tasks shown in MyWork
- FLOW-DECISION-001: Decisions shown in MyWork
- FLOW-AI-001: AI inbox integration
- FLOW-NOTIFICATION-001: Activity notifications
