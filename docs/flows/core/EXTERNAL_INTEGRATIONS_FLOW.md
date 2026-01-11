# FLOW-INTEGRATION-001: External Integrations

> **ID:** FLOW-INTEGRATION-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Integracje z zewnętrznymi systemami - komunikacja, zarządzanie projektami, storage, SSO.

## Integration Priorities

| Priority | Category           | Integrations                  |
| -------- | ------------------ | ----------------------------- |
| **P0**   | Communication      | Slack, Microsoft Teams        |
| **P0**   | Project Management | Jira, Asana, Monday.com       |
| **P1**   | Google Workspace   | Drive, Calendar, Docs         |
| **P1**   | Microsoft 365      | OneDrive, Outlook, SharePoint |
| **P1**   | Cloud Storage      | AWS S3, Azure Blob, GCS       |
| **P2**   | CRM                | Salesforce, HubSpot           |
| **P2**   | ERP                | SAP, Oracle                   |
| **P2**   | BI                 | Power BI, Tableau, Looker     |
| **P2**   | Automation         | Zapier, Make (Integromat)     |

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INTEGRATION ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐     ┌────────────────────────────────────────┐ │
│  │  CONSULTINITY   │     │         INTEGRATION HUB                │ │
│  │     CORE        │◄───►│                                        │ │
│  │                 │     │  ┌────────────────────────────────────┐│ │
│  │  • Tasks        │     │  │  Connection Manager                ││ │
│  │  • Decisions    │     │  │  • OAuth tokens                    ││ │
│  │  • Projects     │     │  │  • API keys                        ││ │
│  │  • Assessments  │     │  │  • Webhook secrets                 ││ │
│  │  • Reports      │     │  └────────────────────────────────────┘│ │
│  │                 │     │                                        │ │
│  └─────────────────┘     │  ┌────────────────────────────────────┐│ │
│                          │  │  Sync Engine                       ││ │
│                          │  │  • Real-time webhooks              ││ │
│                          │  │  • Scheduled polling               ││ │
│                          │  │  • Bi-directional sync             ││ │
│                          │  └────────────────────────────────────┘│ │
│                          │                                        │ │
│                          │  ┌────────────────────────────────────┐│ │
│                          │  │  Transformation Layer              ││ │
│                          │  │  • Field mapping                   ││ │
│                          │  │  • Data normalization              ││ │
│                          │  │  • Conflict resolution             ││ │
│                          │  └────────────────────────────────────┘│ │
│                          └────────────────────────────────────────┘ │
│                                          │                          │
│                                          ▼                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Slack   │ │  Teams   │ │  Jira    │ │  Asana   │ │  Monday  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Drive   │ │ OneDrive │ │ Zapier   │ │Salesforce│ │ Power BI │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Slack Integration

### Features

| Feature            | Direction            | Description                    |
| ------------------ | -------------------- | ------------------------------ |
| Task notifications | Consultinity → Slack | New tasks, updates, deadlines  |
| Decision requests  | Consultinity → Slack | Request decisions with buttons |
| Decision responses | Slack → Consultinity | Vote/decide directly in Slack  |
| Status updates     | Bi-directional       | Sync task status               |
| AI Chat            | Slack → Consultinity | Chat with AI from Slack        |

### Configuration

```typescript
interface SlackIntegration {
  id: string;
  organizationId: string;

  // OAuth
  accessToken: string;
  teamId: string;
  teamName: string;

  // Settings
  defaultChannel: string;
  notificationSettings: {
    taskCreated: boolean;
    taskCompleted: boolean;
    decisionNeeded: boolean;
    deadlineReminder: boolean;
  };

  // Mapping
  channelMappings: {
    projectId: string;
    channelId: string;
  }[];
}
```

## Jira Integration

### Features

| Feature                | Direction           | Description                 |
| ---------------------- | ------------------- | --------------------------- |
| Issue sync             | Bi-directional      | Sync tasks ↔ issues         |
| Status sync            | Bi-directional      | Sync status changes         |
| Comments               | Bi-directional      | Sync comments               |
| Attachments            | Bi-directional      | Sync files                  |
| Create from initiative | Consultinity → Jira | Create epic from initiative |

### Field Mapping

```typescript
interface JiraFieldMapping {
  consultinityField: string;
  jiraField: string;
  direction: 'to_jira' | 'from_jira' | 'bidirectional';
  transformation?: string; // JS function
}

// Default mappings
const defaultMappings: JiraFieldMapping[] = [
  { consultinityField: 'title', jiraField: 'summary', direction: 'bidirectional' },
  { consultinityField: 'description', jiraField: 'description', direction: 'bidirectional' },
  { consultinityField: 'status', jiraField: 'status', direction: 'bidirectional' },
  { consultinityField: 'priority', jiraField: 'priority', direction: 'bidirectional' },
  { consultinityField: 'assigneeId', jiraField: 'assignee', direction: 'bidirectional' },
  { consultinityField: 'dueDate', jiraField: 'duedate', direction: 'bidirectional' },
];
```

## Zapier/Make Integration

### Triggers (from Consultinity)

| Trigger                | Description              |
| ---------------------- | ------------------------ |
| `task.created`         | New task created         |
| `task.completed`       | Task marked as done      |
| `decision.needed`      | Decision request created |
| `decision.made`        | Decision was made        |
| `assessment.completed` | Assessment finished      |
| `initiative.approved`  | Initiative approved      |
| `report.generated`     | Report created           |

### Actions (to Consultinity)

| Action            | Description             |
| ----------------- | ----------------------- |
| `create_task`     | Create new task         |
| `update_task`     | Update task             |
| `create_decision` | Create decision request |
| `make_decision`   | Submit decision         |
| `add_comment`     | Add comment to item     |
| `send_ai_message` | Send message to AI      |

## Database Schema

```sql
-- Integration providers
CREATE TABLE IF NOT EXISTS integration_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'communication', 'project_management', 'storage', 'crm', 'automation'
    icon_url TEXT,
    auth_type TEXT NOT NULL, -- 'oauth2', 'api_key', 'webhook'
    oauth_config TEXT, -- JSON: {authUrl, tokenUrl, scopes}
    is_active INTEGER DEFAULT 1,
    is_beta INTEGER DEFAULT 0,
    documentation_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization integrations
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,

    -- Authentication
    auth_type TEXT NOT NULL,
    access_token TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    api_key TEXT, -- Encrypted
    token_expires_at TIMESTAMP,

    -- Provider-specific data
    external_account_id TEXT,
    external_account_name TEXT,

    -- Settings
    settings TEXT DEFAULT '{}', -- JSON
    field_mappings TEXT DEFAULT '[]', -- JSON
    sync_settings TEXT DEFAULT '{}', -- JSON: {direction, frequency, filters}

    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'error', 'disconnected'
    last_sync_at TIMESTAMP,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,

    -- Audit
    connected_by TEXT NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (provider_id) REFERENCES integration_providers(id)
);

-- Integration webhooks
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,

    -- Webhook config
    webhook_url TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array of event types

    -- Status
    is_active INTEGER DEFAULT 1,
    last_triggered_at TIMESTAMP,
    failure_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

-- Sync mappings (which items are synced)
CREATE TABLE IF NOT EXISTS integration_sync_mappings (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,

    -- Local entity
    local_type TEXT NOT NULL, -- 'task', 'initiative', 'project'
    local_id TEXT NOT NULL,

    -- External entity
    external_type TEXT NOT NULL,
    external_id TEXT NOT NULL,

    -- Sync state
    last_local_update TIMESTAMP,
    last_external_update TIMESTAMP,
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending', 'conflict', 'error'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(integration_id, local_type, local_id),
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

-- Sync history/log
CREATE TABLE IF NOT EXISTS integration_sync_log (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,

    -- Sync details
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'single_item'
    direction TEXT NOT NULL, -- 'push', 'pull', 'bidirectional'

    -- Results
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    items_synced INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_details TEXT,

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_integration ON integration_sync_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_local ON integration_sync_mappings(local_type, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_integration ON integration_sync_log(integration_id);
```

## API Endpoints

| Method | Endpoint                              | Description              |
| ------ | ------------------------------------- | ------------------------ |
| GET    | `/api/integrations/providers`         | List available providers |
| GET    | `/api/integrations`                   | List org integrations    |
| POST   | `/api/integrations/connect/:provider` | Start OAuth flow         |
| POST   | `/api/integrations/:id/disconnect`    | Disconnect integration   |
| PUT    | `/api/integrations/:id/settings`      | Update settings          |
| POST   | `/api/integrations/:id/sync`          | Trigger manual sync      |
| GET    | `/api/integrations/:id/logs`          | Get sync history         |
| POST   | `/api/integrations/webhook/:provider` | Receive webhooks         |

## Zapier API (Public)

| Method | Endpoint                        | Description      |
| ------ | ------------------------------- | ---------------- |
| POST   | `/api/zapier/auth`              | Validate API key |
| GET    | `/api/zapier/triggers/:trigger` | Get trigger data |
| POST   | `/api/zapier/actions/:action`   | Execute action   |
| GET    | `/api/zapier/samples/:type`     | Get sample data  |

## Related Flows

- FLOW-NOTIFICATION-001: Integration notifications
- FLOW-TASK-001: Task sync
- FLOW-DECISION-001: Decision requests via Slack/Teams
- FLOW-AUTH-001: OAuth for integrations
