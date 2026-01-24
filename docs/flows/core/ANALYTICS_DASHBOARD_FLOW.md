# FLOW-ANALYTICS-001: Analytics & Dashboards

> **ID:** FLOW-ANALYTICS-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Dashboardy i analityka dla różnych poziomów użytkowników - od SuperAdmin przez Admin/Owner do PM i User.

## Dashboard Hierarchy

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD HIERARCHY                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  SUPERADMIN DASHBOARD                                           ││
│  │  • Platform-wide metrics                                        ││
│  │  • All organizations overview                                   ││
│  │  • Revenue & billing analytics                                  ││
│  │  • System health & performance                                  ││
│  │  • AI usage across platform                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  OWNER/ADMIN DASHBOARD                                          ││
│  │  • Organization overview                                        ││
│  │  • All projects status                                          ││
│  │  • Team performance                                             ││
│  │  • Usage & billing                                              ││
│  │  • AI token consumption                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PM DASHBOARD                                                   ││
│  │  • Project portfolio view                                       ││
│  │  • Initiative progress                                          ││
│  │  • Team workload                                                ││
│  │  • Decision queue                                               ││
│  │  • Risks & blockers                                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  USER DASHBOARD (MyWork)                                        ││
│  │  • Personal tasks                                               ││
│  │  • Pending decisions                                            ││
│  │  • AI suggestions                                               ││
│  │  • Activity feed                                                ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Owner/Admin Analytics

### Organization Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Organization Analytics                            [Export] [📅]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Projects    │ │ Initiatives │ │ Tasks Done  │ │ AI Tokens   │   │
│  │    12       │ │    45       │ │   234/mo    │ │  125K/200K  │   │
│  │ +2 this mo  │ │ +8 this mo  │ │ ↑15% vs LM  │ │ 62% used    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌────────────────────────────────┐ ┌────────────────────────────┐ │
│  │  Project Status Distribution   │ │  Initiative Progress       │ │
│  │  ════════════════════════════  │ │  ════════════════════════  │ │
│  │  ███████████░░░░ Active: 8    │ │  Draft:     ██░░░░ 15%     │ │
│  │  ████░░░░░░░░░░░ Planning: 3  │ │  Planning:  ████░░ 25%     │ │
│  │  █░░░░░░░░░░░░░░ Completed: 1 │ │  Executing: ██████ 40%     │ │
│  │                               │ │  Done:      ███░░░ 20%     │ │
│  └────────────────────────────────┘ └────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Team Activity (Last 30 days)                                │  │
│  │  ════════════════════════════════════════════════════════════│  │
│  │                                                              │  │
│  │  Jan 1    Jan 8    Jan 15   Jan 22   Jan 29                 │  │
│  │   ██       ███      ████     █████    ████                   │  │
│  │  ████     █████    ██████   ███████  ██████                  │  │
│  │                                                              │  │
│  │  ── Tasks   ── Decisions   ── Assessments                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Metrics Tracked

| Category        | Metrics                                     |
| --------------- | ------------------------------------------- |
| **Projects**    | Total, Active, Completed, On-time %         |
| **Initiatives** | By status, Completion rate, Avg duration    |
| **Tasks**       | Created, Completed, Overdue, Velocity       |
| **Decisions**   | Pending, Made, Avg time to decision         |
| **Team**        | Active users, Login frequency, Contribution |
| **AI**          | Tokens used, Suggestions accepted, Cost     |
| **Assessments** | Completed, Avg score, Trend                 |

## PM Analytics

### Project Portfolio View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Project Portfolio                                   [+ New Project]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Health Overview                                                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│  │ 🟢 On Track│ │ 🟡 At Risk│ │ 🔴 Critical│ │ Total     │           │
│  │     5     │ │     2     │ │     1     │ │     8     │           │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │
│                                                                     │
│  Projects                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  │ Project              │ Health │ Progress │ Initiatives│ Blockers│ │
│  ├──────────────────────┼────────┼──────────┼────────────┼─────────┤ │
│  │ Digital Transform.   │ 🟢     │ ████░ 75%│    12/15  │    0    │ │
│  │ Process Optimization │ 🟡     │ ██░░░ 45%│     8/20  │    2    │ │
│  │ AI Implementation    │ 🔴     │ █░░░░ 20%│     3/10  │    4    │ │
│  │ Lean 4.0 Rollout     │ 🟢     │ ███░░ 60%│     6/10  │    0    │ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Analytics snapshots (daily)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,

    -- Projects
    projects_total INTEGER DEFAULT 0,
    projects_active INTEGER DEFAULT 0,
    projects_completed INTEGER DEFAULT 0,
    projects_on_track INTEGER DEFAULT 0,
    projects_at_risk INTEGER DEFAULT 0,
    projects_critical INTEGER DEFAULT 0,

    -- Initiatives
    initiatives_total INTEGER DEFAULT 0,
    initiatives_draft INTEGER DEFAULT 0,
    initiatives_planning INTEGER DEFAULT 0,
    initiatives_review INTEGER DEFAULT 0,
    initiatives_approved INTEGER DEFAULT 0,
    initiatives_executing INTEGER DEFAULT 0,
    initiatives_done INTEGER DEFAULT 0,
    initiatives_blocked INTEGER DEFAULT 0,

    -- Tasks
    tasks_total INTEGER DEFAULT 0,
    tasks_open INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    tasks_completed_today INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,

    -- Decisions
    decisions_pending INTEGER DEFAULT 0,
    decisions_made_today INTEGER DEFAULT 0,
    decisions_escalated INTEGER DEFAULT 0,
    avg_decision_time_hours REAL,

    -- Users
    users_total INTEGER DEFAULT 0,
    users_active_today INTEGER DEFAULT 0,
    users_active_week INTEGER DEFAULT 0,

    -- AI
    ai_tokens_used INTEGER DEFAULT 0,
    ai_suggestions_count INTEGER DEFAULT 0,
    ai_suggestions_accepted INTEGER DEFAULT 0,

    -- Assessments
    assessments_completed INTEGER DEFAULT 0,
    avg_assessment_score REAL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, snapshot_date)
);

-- Custom dashboards
CREATE TABLE IF NOT EXISTS custom_dashboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT, -- NULL = org-wide

    name TEXT NOT NULL,
    description TEXT,

    -- Dashboard config
    layout TEXT NOT NULL, -- JSON: widget positions and sizes
    widgets TEXT NOT NULL, -- JSON: widget configurations

    -- Sharing
    is_shared INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]', -- JSON: user/role IDs

    is_default INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widgets library
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'projects', 'initiatives', 'tasks', 'decisions', 'team', 'ai'

    -- Widget config
    widget_type TEXT NOT NULL, -- 'number', 'chart', 'list', 'progress', 'table'
    default_config TEXT, -- JSON: default configuration
    data_source TEXT NOT NULL, -- API endpoint or query

    -- Permissions
    min_role TEXT DEFAULT 'user', -- Minimum role to view

    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL, -- 'project_status', 'team_performance', 'initiative_progress', 'custom'

    -- Config
    filters TEXT, -- JSON: applied filters
    columns TEXT, -- JSON: selected columns
    grouping TEXT, -- JSON: grouping config
    sorting TEXT, -- JSON: sorting config

    -- Schedule
    is_scheduled INTEGER DEFAULT 0,
    schedule_cron TEXT,
    recipients TEXT DEFAULT '[]', -- JSON: email addresses
    last_sent_at TIMESTAMP,

    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_org ON analytics_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_dashboards_org ON custom_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON saved_reports(organization_id);
```

## API Endpoints

| Method | Endpoint                     | Description              |
| ------ | ---------------------------- | ------------------------ |
| GET    | `/api/analytics/overview`    | Get org overview stats   |
| GET    | `/api/analytics/projects`    | Get project analytics    |
| GET    | `/api/analytics/initiatives` | Get initiative analytics |
| GET    | `/api/analytics/tasks`       | Get task analytics       |
| GET    | `/api/analytics/team`        | Get team analytics       |
| GET    | `/api/analytics/ai`          | Get AI usage analytics   |
| GET    | `/api/analytics/trends`      | Get trend data           |
| GET    | `/api/dashboards`            | Get dashboards           |
| POST   | `/api/dashboards`            | Create dashboard         |
| PUT    | `/api/dashboards/:id`        | Update dashboard         |
| GET    | `/api/reports`               | Get saved reports        |
| POST   | `/api/reports`               | Create report            |
| POST   | `/api/reports/:id/run`       | Run report               |

## Related Flows

- FLOW-MYWORK-001: User dashboard
- FLOW-PROJECT-001: Project data
- FLOW-REPORT-001: Report generation
- FLOW-AI-001: AI analytics
