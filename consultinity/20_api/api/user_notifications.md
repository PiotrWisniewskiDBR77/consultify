# User-Level Notifications & Integrations System

## Overview

This document describes the user-level notifications and integrations system implemented in Consultify. The key architectural change is that integrations and notifications are managed at the **individual user level**, not at the organization level.

Each user:
- Connects their own accounts (Slack, Teams, Jira, ClickUp)
- Configures their own notification preferences
- Manages which channels receive which types of notifications

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  components/settings/                                        │
│  ├── NotificationSettingsV2/     # Notification preferences  │
│  │   ├── index.tsx               # Main component            │
│  │   ├── OverviewTab.tsx         # Quick overview            │
│  │   ├── ChannelsTab.tsx         # Email preferences         │
│  │   ├── CategoriesTab.tsx       # Push notifications        │
│  │   ├── ScheduleTab.tsx         # Quiet hours               │
│  │   ├── WatchingTab.tsx         # Watched objects           │
│  │   └── DigestsTab.tsx          # Daily/weekly digests      │
│  └── UserIntegrations/           # Integration management    │
│      ├── index.tsx               # Main component            │
│      └── IntegrationCard.tsx     # Single integration card   │
├─────────────────────────────────────────────────────────────┤
│  hooks/                                                      │
│  ├── useUserIntegrations.ts      # Integration management    │
│  └── useUserNotificationPreferences.ts # Preferences mgmt    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                         │
├─────────────────────────────────────────────────────────────┤
│  server/routes/                                              │
│  ├── userIntegrations.js         # OAuth endpoints           │
│  ├── settings.js                 # Notification prefs        │
│  └── mcp.js                      # MCP protocol endpoints    │
├─────────────────────────────────────────────────────────────┤
│  server/services/                                            │
│  ├── userIntegrationService.js   # Integration management    │
│  ├── userNotificationPreferencesService.js                   │
│  ├── notificationService.js      # Extended delivery         │
│  └── integrations/                                           │
│      ├── slackUserIntegration.js                            │
│      ├── teamsUserIntegration.js                            │
│      ├── jiraUserIntegration.js                             │
│      └── clickupUserIntegration.js                          │
├─────────────────────────────────────────────────────────────┤
│  server/mcp/                                                 │
│  └── mcpServer.js                # MCP server implementation │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  • user_integrations             # OAuth tokens per user     │
│  • user_notification_preferences_v2                          │
│  • user_watchers                 # Watched objects           │
│  • user_integration_sync_logs    # Sync audit trail          │
│  • due_date_reminders_sent       # Reminder tracking         │
│  • mcp_audit_logs                # MCP audit trail           │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### user_integrations
Stores OAuth tokens for each user's connected apps.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | User reference |
| provider | TEXT | 'slack', 'teams', 'jira', 'clickup' |
| access_token_encrypted | TEXT | Encrypted OAuth access token |
| refresh_token_encrypted | TEXT | Encrypted refresh token |
| token_expires_at | DATETIME | Token expiration |
| external_user_id | TEXT | User's ID in external system |
| external_workspace_id | TEXT | Workspace/site ID |
| external_workspace_name | TEXT | Display name |
| config_json | TEXT | Provider-specific settings |
| status | TEXT | 'active', 'expired', 'revoked', 'error' |

### user_notification_preferences_v2
Extended notification preferences per user.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | User reference (unique) |
| global_enabled | INTEGER | Master toggle |
| schedule_json | TEXT | Quiet hours settings |
| urgency_json | TEXT | Critical override settings |
| categories_json | TEXT | Category/channel matrix |
| digests_json | TEXT | Digest settings |

### user_watchers
Tracks which objects users are watching.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| user_id | TEXT | User reference |
| object_type | TEXT | 'task', 'initiative', 'project' |
| object_id | TEXT | Object reference |
| notify_on | TEXT | 'all', 'mentions', 'status_changes' |

## API Endpoints

### User Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/integrations` | List user's integrations |
| GET | `/api/settings/integrations/providers` | List available providers |
| GET | `/api/settings/integrations/:provider/status` | Get connection status |
| POST | `/api/settings/integrations/:provider/connect` | Start OAuth flow |
| GET | `/api/settings/integrations/:provider/callback` | OAuth callback |
| DELETE | `/api/settings/integrations/:provider` | Disconnect |
| POST | `/api/settings/integrations/:provider/test` | Test connection |
| POST | `/api/settings/integrations/:provider/refresh` | Refresh token |
| PUT | `/api/settings/integrations/:provider/config` | Update config |

### Notification Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/notifications/preferences` | Get preferences |
| PUT | `/api/settings/notifications/preferences` | Update preferences |
| GET | `/api/settings/notifications/categories` | List categories |
| PUT | `/api/settings/notifications/schedule` | Update schedule |
| PUT | `/api/settings/notifications/digests` | Update digests |
| GET | `/api/settings/notifications/quiet-hours/status` | Check quiet hours |

### Watchers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/watchers` | List watched objects |
| POST | `/api/settings/watchers` | Add watcher |
| DELETE | `/api/settings/watchers/:type/:id` | Remove watcher |
| GET | `/api/settings/watchers/check/:type/:id` | Check if watching |

### MCP (Model Context Protocol)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mcp/initialize` | Initialize MCP session |
| GET | `/api/mcp/tools/list` | List available tools |
| POST | `/api/mcp/tools/call` | Execute a tool |
| GET | `/api/mcp/resources/list` | List resources |
| POST | `/api/mcp/resources/read` | Read a resource |
| GET | `/api/mcp/prompts/list` | List prompts |
| POST | `/api/mcp/prompts/get` | Get filled prompt |

## Supported Integrations

### Slack
- OAuth with user scopes: `chat:write`, `channels:read`, `users:read`, `im:write`
- Features: Real-time notifications, interactive buttons, channel selection
- Notification blocks with actions (mark complete, snooze)

### Microsoft Teams
- OAuth with scopes: `User.Read`, `Chat.ReadWrite`, `ChannelMessage.Send`
- Features: Adaptive cards, direct messages, team notifications
- Supports webhook-based delivery

### Jira
- OAuth with scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`
- Features: Bi-directional task sync, status mapping, issue creation
- Multiple Jira sites supported

### ClickUp
- OAuth-based authentication
- Features: Task sync, status sync, workspace selection
- Priority mapping between systems

## Notification Categories

The system organizes notifications into categories:

1. **Tasks** - Task assignments, updates, due dates, blocks
2. **Governance** - Decisions, change requests, gate approvals
3. **Collaboration** - Mentions, comments, document sharing
4. **AI** - Risk detection, recommendations, workload warnings
5. **System** - Maintenance, announcements, permission changes

Each category can be independently:
- Enabled/disabled
- Configured per channel (in-app, email, push, Slack, Teams)

## Due Date Reminders

Smart reminder system with configurable timing:
- 1 week before due
- 3 days before due
- 1 day before due
- 1 hour before due
- At due time

Reminders are tracked to prevent duplicates.

## Quiet Hours

Users can configure:
- Quiet hours window (e.g., 22:00 - 08:00)
- Quiet days (e.g., Saturday, Sunday)
- Critical override (urgent notifications still delivered)
- Timezone-aware scheduling

## MCP Server

The MCP (Model Context Protocol) server enables AI integrations:

### Tools
- `consultify.tasks.list` - List user's tasks
- `consultify.tasks.create` - Create new task
- `consultify.tasks.update` - Update task
- `consultify.tasks.get` - Get task details
- `consultify.initiatives.list` - List initiatives
- `consultify.notifications.send` - Send notification
- `consultify.projects.list` - List projects
- `consultify.search` - Search across entities

### Resources
- `consultify://user/profile` - User profile
- `consultify://user/tasks/today` - Today's tasks
- `consultify://user/tasks/overdue` - Overdue tasks
- `consultify://user/notifications/unread` - Unread notifications
- `consultify://organization/initiatives` - Organization initiatives

### Prompts
- `consultify.daily_standup` - Generate standup summary
- `consultify.task_breakdown` - Break task into subtasks
- `consultify.initiative_summary` - Executive summary

## Environment Variables

Required for integrations:

```env
# Slack
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret

# Microsoft Teams
TEAMS_CLIENT_ID=your_teams_client_id
TEAMS_CLIENT_SECRET=your_teams_client_secret
TEAMS_TENANT_ID=common

# Jira
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret

# ClickUp
CLICKUP_CLIENT_ID=your_clickup_client_id
CLICKUP_CLIENT_SECRET=your_clickup_client_secret

# Encryption
INTEGRATION_ENCRYPTION_KEY=32-character-secret-key
```

## Security

- OAuth tokens are encrypted at rest using AES-256-CBC
- User-scoped access - users can only manage their own integrations
- Audit logging for all MCP operations
- Token refresh handled automatically on expiration

## Usage Examples

### Frontend - Connect Slack

```typescript
import { useUserIntegrations } from '../hooks/useUserIntegrations';

const { connect, isConnected } = useUserIntegrations();

// Check if connected
if (!isConnected('slack')) {
  // Initiate OAuth
  await connect('slack');
}
```

### Frontend - Update Notification Preferences

```typescript
import { useUserNotificationPreferences } from '../hooks/useUserNotificationPreferences';

const { toggleChannel, updateSchedule } = useUserNotificationPreferences();

// Enable Slack for task notifications
await toggleChannel('tasks', 'slack', true);

// Set quiet hours
await updateSchedule({
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00'
});
```

### Backend - Deliver Notification

```javascript
const NotificationService = require('./services/notificationService');

await NotificationService.deliverNotification(userId, {
  type: 'TASK_ASSIGNED',
  severity: 'INFO',
  title: 'New Task Assigned',
  message: 'You have been assigned: Complete Q1 Report',
  relatedObjectType: 'TASK',
  relatedObjectId: taskId,
  isActionable: true,
  actionUrl: `/tasks/${taskId}`
});
```

### Backend - MCP Tool Execution

```javascript
const MCPServer = require('./mcp/mcpServer');

const result = await MCPServer.executeTool(
  'consultify.tasks.list',
  { status: 'pending', limit: 10 },
  { userId, organizationId }
);
```

## Migration

Run the migration to create required tables:

```bash
sqlite3 database.sqlite < server/migrations/105_user_integrations.sql
```

## Files Created/Modified

### New Files
- `server/migrations/105_user_integrations.sql`
- `server/services/userIntegrationService.js`
- `server/services/userNotificationPreferencesService.js`
- `server/services/integrations/slackUserIntegration.js`
- `server/services/integrations/teamsUserIntegration.js`
- `server/services/integrations/jiraUserIntegration.js`
- `server/services/integrations/clickupUserIntegration.js`
- `server/routes/userIntegrations.js`
- `server/routes/mcp.js`
- `server/mcp/mcpServer.js`
- `components/settings/NotificationSettingsV2/*`
- `components/settings/UserIntegrations/*`
- `hooks/useUserIntegrations.ts`
- `hooks/useUserNotificationPreferences.ts`

### Modified Files
- `server/index.js` - Added routes
- `server/routes/settings.js` - Extended with V2 preferences
- `server/services/notificationService.js` - Added deliverNotification

## Standards Compliance

This implementation follows market standards inspired by:
- **HubSpot** - Granular notification preferences
- **ClickUp** - Watcher system
- **Monday** - Category-based notifications
- **Slack** - Interactive notification cards
- **Anthropic MCP** - AI integration protocol

