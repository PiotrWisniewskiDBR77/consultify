# System Module - Migration Guide

## Overview

This guide describes the migration process for implementing the System Module in an existing Consultify installation.

## Pre-Migration Checklist

- [ ] Backup existing database
- [ ] Review current audit log structure
- [ ] Identify existing webhook configurations
- [ ] Document current feature flag usage
- [ ] Plan maintenance window

## Database Migration

### Step 1: Create New Tables

The migration script automatically creates all new tables when the database initializes. Tables created:

1. `audit_logs` - Extended audit logging
2. `feature_flags` - Feature flag management
3. `feature_flag_history` - Flag change history
4. `webhook_deliveries` - Webhook delivery tracking
5. `integrations` - Integration management
6. `integration_sync_logs` - Sync history
7. `system_metrics` - Metrics storage
8. `security_events` - Security event tracking
9. `compliance_records` - Compliance records
10. `system_config` - System configuration
11. `api_keys` - API key management
12. `backup_records` - Backup tracking

### Step 2: Migrate Existing Data

Existing `activity_logs` data is automatically migrated to `audit_logs` table on first run.

### Step 3: Extend Existing Tables

The `webhooks` table is extended with:
- `retry_policy` (TEXT JSON)
- `headers` (TEXT JSON)
- `payload_template` (TEXT JSON)

## Code Migration

### Backend Changes

1. New routes added to `server/routes/`
2. New services added to `server/services/`
3. Routes registered in `server/index.js`

### Frontend Changes

1. New components added to `components/SuperAdmin/`
2. API methods added to `services/api.ts`
3. SystemModule updated with new tabs

## Post-Migration Steps

1. Verify all tables created successfully
2. Test API endpoints
3. Verify frontend components load
4. Test feature flag functionality
5. Verify audit log migration
6. Test webhook delivery
7. Review system health monitoring

## Rollback Plan

If migration fails:

1. Restore database backup
2. Revert code changes
3. Remove new routes from server/index.js
4. Clear frontend build cache

## Verification

Run the following checks:

```bash
# Check database tables
sqlite3 consultify.db ".tables" | grep -E "(audit_logs|feature_flags|webhook_deliveries)"

# Test API endpoints
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/system-health

# Check frontend
npm run build
```

## Known Issues

- Migration runs automatically on database initialization
- Existing activity_logs data preserved
- No data loss during migration

## Support

For migration issues, check:
- Server logs for errors
- Database integrity
- API endpoint accessibility
- Frontend console for errors












