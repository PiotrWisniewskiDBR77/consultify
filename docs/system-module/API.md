# System Module - API Documentation

## Base URL
All endpoints are prefixed with `/api`

## Authentication
All endpoints require SuperAdmin authentication via Bearer token.

## Audit Logs API

### GET /audit-logs
Get audit logs with filtering and pagination.

**Query Parameters:**
- `search` - Search term
- `riskLevel` - Filter by risk level (ALL, LOW, MEDIUM, HIGH, CRITICAL)
- `startDate` - Start date filter
- `endDate` - End date filter
- `userId` - Filter by user ID
- `actionType` - Filter by action type
- `resourceType` - Filter by resource type
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 50)

**Response:**
```json
{
  "logs": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### GET /audit-logs/:id
Get audit log by ID.

### GET /audit-logs/stats/summary
Get audit log statistics.

### GET /audit-logs/export/csv
Export audit logs to CSV.

### GET /audit-logs/compliance/:framework
Get compliance report for a framework (GDPR, SOC2, ISO27001, etc.).

## Feature Flags API

### GET /feature-flags
Get client-side flags (evaluated for current user).

### GET /feature-flags/admin
Get all feature flags (admin only).

**Query Parameters:**
- `environment` - Filter by environment
- `organizationId` - Filter by organization
- `enabled` - Filter by enabled status

### GET /feature-flags/:id
Get feature flag by ID.

### POST /feature-flags
Create a new feature flag.

**Request Body:**
```json
{
  "flag_key": "new_feature",
  "name": "New Feature",
  "description": "Description",
  "enabled": false,
  "flag_type": "boolean",
  "targeting_rules": [],
  "rollout_percentage": 0,
  "environment": "production"
}
```

### PUT /feature-flags/:id
Update a feature flag.

### DELETE /feature-flags/:id
Delete a feature flag.

### POST /feature-flags/:id/toggle
Toggle a feature flag.

### GET /feature-flags/:id/history
Get feature flag change history.

## Webhooks API

### GET /webhooks
Get all webhooks for organization.

### GET /webhooks/:id
Get webhook by ID.

### POST /webhooks
Create a new webhook.

**Request Body:**
```json
{
  "name": "My Webhook",
  "url": "https://example.com/webhook",
  "events": ["task.created", "task.updated"],
  "secret": "webhook-secret"
}
```

### PUT /webhooks/:id
Update a webhook.

### DELETE /webhooks/:id
Delete a webhook.

### POST /webhooks/:id/test
Test a webhook.

### GET /webhooks/:id/deliveries
Get webhook delivery history.

### POST /webhooks/:id/retry
Retry a failed webhook delivery.

## Integrations API

### GET /integrations
Get all integrations for organization.

### GET /integrations/:id
Get integration by ID.

### POST /integrations
Create a new integration.

### PUT /integrations/:id
Update an integration.

### DELETE /integrations/:id
Delete an integration.

### POST /integrations/:id/sync
Trigger a sync for an integration.

### GET /integrations/:id/sync-logs
Get sync logs for an integration.

### GET /integrations/:id/health
Check integration health.

### GET /integrations/available/types
Get available integration types.

## Security API

### GET /security/events
Get security events.

### POST /security/events
Create a security event.

### PUT /security/events/:id/resolve
Resolve a security event.

### GET /security/events/stats
Get security event statistics.

### GET /security/compliance
Get compliance records.

### POST /security/compliance
Create a compliance record.

### GET /security/compliance/:framework/report
Get compliance report for a framework.

## System Configuration API

### GET /system-config
Get all system configurations.

### GET /system-config/:key
Get configuration value by key.

### POST /system-config
Set configuration value.

### DELETE /system-config/:key
Delete configuration.

## System Health API

### GET /system-health
Basic health check.

### GET /system-health/detailed
Detailed health check (SuperAdmin only).

### GET /system-health/metrics
Get system metrics.

### GET /system-health/services
Get service status.

### POST /system-health/refresh
Force refresh health data.

## API Keys API

### GET /api-keys
Get all API keys.

### POST /api-keys
Create a new API key.

### DELETE /api-keys/:id
Revoke an API key.

### GET /api-keys/:id/usage
Get API key usage statistics.

## Backups API

### GET /backups
Get all backups.

### POST /backups
Create a new backup.

**Request Body:**
```json
{
  "type": "full",
  "reason": "manual"
}
```

### GET /backups/:id
Get backup details.

### DELETE /backups/:id
Delete a backup.

