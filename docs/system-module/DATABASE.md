# System Module - Database Schema

## Tables

### audit_logs
Comprehensive audit logging table.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `timestamp` (DATETIME)
- `user_id` (TEXT)
- `user_email` (TEXT)
- `ip_address` (TEXT)
- `user_agent` (TEXT)
- `action_type` (TEXT)
- `resource_type` (TEXT)
- `resource_id` (TEXT)
- `before_data` (TEXT JSON)
- `after_data` (TEXT JSON)
- `risk_level` (TEXT)
- `compliance_tags` (TEXT JSON)
- `request_id` (TEXT)
- `organization_id` (TEXT)
- `metadata` (TEXT JSON)

**Indexes:**
- `idx_audit_logs_timestamp` on timestamp DESC
- `idx_audit_logs_user_id` on user_id
- `idx_audit_logs_action_type` on action_type
- `idx_audit_logs_resource` on resource_type, resource_id
- `idx_audit_logs_risk_level` on risk_level

### feature_flags
Feature flag configuration.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `flag_key` (TEXT UNIQUE)
- `name` (TEXT)
- `description` (TEXT)
- `enabled` (INTEGER)
- `flag_type` (TEXT)
- `targeting_rules` (TEXT JSON)
- `rollout_percentage` (INTEGER)
- `environment` (TEXT)
- `organization_id` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)
- `created_by` (TEXT)

### feature_flag_history
Feature flag change history.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `feature_flag_id` (TEXT)
- `change_type` (TEXT)
- `old_value` (TEXT JSON)
- `new_value` (TEXT JSON)
- `changed_by` (TEXT)
- `changed_at` (DATETIME)

### webhook_deliveries
Webhook delivery tracking.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `webhook_id` (TEXT)
- `event_type` (TEXT)
- `payload` (TEXT JSON)
- `status` (TEXT)
- `response_code` (INTEGER)
- `response_body` (TEXT)
- `attempts` (INTEGER)
- `delivered_at` (DATETIME)
- `created_at` (DATETIME)

**Indexes:**
- `idx_webhook_deliveries_webhook_id` on webhook_id
- `idx_webhook_deliveries_status` on status
- `idx_webhook_deliveries_created_at` on created_at DESC

### integrations
Third-party integrations.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `organization_id` (TEXT)
- `type` (TEXT)
- `name` (TEXT)
- `config` (TEXT JSON)
- `auth_config` (TEXT JSON)
- `enabled` (INTEGER)
- `sync_config` (TEXT JSON)
- `last_sync_at` (DATETIME)
- `last_sync_status` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### integration_sync_logs
Integration sync history.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `integration_id` (TEXT)
- `sync_type` (TEXT)
- `status` (TEXT)
- `records_processed` (INTEGER)
- `errors` (TEXT JSON)
- `started_at` (DATETIME)
- `completed_at` (DATETIME)

### system_metrics
System metrics time-series data.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `metric_name` (TEXT)
- `metric_value` (REAL)
- `metric_type` (TEXT)
- `tags` (TEXT JSON)
- `timestamp` (DATETIME)

**Indexes:**
- `idx_system_metrics_name_time` on metric_name, timestamp DESC

### security_events
Security event tracking.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `event_type` (TEXT)
- `severity` (TEXT)
- `user_id` (TEXT)
- `ip_address` (TEXT)
- `details` (TEXT JSON)
- `resolved` (INTEGER)
- `resolved_at` (DATETIME)
- `resolved_by` (TEXT)
- `created_at` (DATETIME)

### compliance_records
Compliance framework records.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `framework` (TEXT)
- `control_id` (TEXT)
- `control_name` (TEXT)
- `status` (TEXT)
- `evidence` (TEXT JSON)
- `last_verified_at` (DATETIME)
- `verified_by` (TEXT)
- `notes` (TEXT)

### system_config
System configuration settings.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `config_key` (TEXT UNIQUE)
- `config_value` (TEXT JSON)
- `config_type` (TEXT)
- `environment` (TEXT)
- `description` (TEXT)
- `updated_at` (DATETIME)
- `updated_by` (TEXT)

### api_keys
API key management.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `organization_id` (TEXT)
- `user_id` (TEXT)
- `key_hash` (TEXT UNIQUE)
- `key_prefix` (TEXT)
- `name` (TEXT)
- `permissions` (TEXT JSON)
- `rate_limit` (INTEGER)
- `expires_at` (DATETIME)
- `last_used_at` (DATETIME)
- `created_at` (DATETIME)
- `revoked_at` (DATETIME)

### backup_records
Backup management.

**Columns:**
- `id` (TEXT PRIMARY KEY)
- `backup_type` (TEXT)
- `status` (TEXT)
- `size_bytes` (INTEGER)
- `storage_location` (TEXT)
- `started_at` (DATETIME)
- `completed_at` (DATETIME)
- `verified_at` (DATETIME)
- `metadata` (TEXT JSON)

## Relationships

- `audit_logs.organization_id` → `organizations.id`
- `audit_logs.user_id` → `users.id`
- `feature_flags.organization_id` → `organizations.id`
- `feature_flags.created_by` → `users.id`
- `feature_flag_history.feature_flag_id` → `feature_flags.id`
- `webhook_deliveries.webhook_id` → `webhooks.id`
- `integrations.organization_id` → `organizations.id`
- `integration_sync_logs.integration_id` → `integrations.id`
- `security_events.user_id` → `users.id`
- `security_events.resolved_by` → `users.id`
- `compliance_records.verified_by` → `users.id`
- `system_config.updated_by` → `users.id`
- `api_keys.organization_id` → `organizations.id`
- `api_keys.user_id` → `users.id`

## Migration Notes

- Existing `activity_logs` data migrated to `audit_logs` table
- `webhooks` table extended with new columns
- All new tables created with proper indexes for performance









