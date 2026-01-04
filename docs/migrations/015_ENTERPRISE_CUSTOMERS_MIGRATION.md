# Migration Guide: 015 Enterprise Customers Module

## Overview

This migration adds comprehensive enterprise-level customer management features to the Consultify platform, including extended organization and user management, security features, support systems, analytics, compliance, automation, and communication tools.

## Migration Script

**File:** `server/migrations/015_enterprise_customers_module.sql`

## Tables Added

### Organization Management
- `organization_metadata` - Custom fields and metadata
- `organization_tags` - Tags and labels
- `organization_relationships` - Parent-child and partner relationships
- `organization_health_scores` - Health scoring and churn risk
- `organization_segments` - Marketing/sales segments

### User Management
- `user_profiles` - Extended user profiles
- `user_activity_summary` - Activity aggregation
- `user_sessions` - Detailed session tracking
- `user_groups` - Cross-organization groups
- `user_group_members` - Group membership
- `user_onboarding_progress` - Onboarding tracking
- `user_licenses` - License management

### Security
- `organization_ip_whitelist` - IP whitelisting
- `user_devices` - Device management
- `user_mfa_methods` - MFA methods (TOTP, SMS, Email)
- `organization_password_policies` - Password policies
- `security_events` - Security event logging

### Support & Customer Success
- `support_tickets` - Support ticket system
- `support_ticket_comments` - Ticket comments
- `customer_success_notes` - CS notes
- `customer_health_checks` - Health check data
- `customer_lifecycle_events` - Lifecycle tracking

### Feedback
- `feedback_items` - Enhanced feedback system
- `feedback_votes` - Feedback voting
- `feedback_comments` - Feedback comments
- `feature_roadmap` - Public feature roadmap

### Analytics
- `organization_analytics` - Organization metrics
- `user_adoption_metrics` - User adoption tracking

### Compliance
- `data_retention_policies` - Data retention rules
- `gdpr_data_subject_requests` - GDPR DSAR requests
- `user_consents` - Consent management

### Automation & Integration
- `integration_connections` - Integration connections
- `automation_rules` - Automation rules
- `webhook_subscriptions` - Webhook subscriptions

### Communication
- `email_templates` - Email templates
- `email_campaigns` - Email campaigns
- `notification_preferences` - Notification preferences

## Running the Migration

### SQLite
The migration is automatically applied when the database is initialized via `server/database.sqlite.active.js`.

### PostgreSQL
Run the migration script manually:
```bash
psql -d consultify -f server/migrations/015_enterprise_customers_module.sql
```

## Seed Data

After migration, populate test data:
```bash
node server/seed/seed_enterprise_customers.js
```

## Rollback

To rollback this migration, drop all added tables:
```sql
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS email_campaigns;
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS webhook_subscriptions;
DROP TABLE IF EXISTS automation_rules;
DROP TABLE IF EXISTS integration_connections;
DROP TABLE IF EXISTS user_consents;
DROP TABLE IF EXISTS gdpr_data_subject_requests;
DROP TABLE IF EXISTS data_retention_policies;
DROP TABLE IF EXISTS user_adoption_metrics;
DROP TABLE IF EXISTS organization_analytics;
DROP TABLE IF EXISTS feature_roadmap;
DROP TABLE IF EXISTS feedback_comments;
DROP TABLE IF EXISTS feedback_votes;
DROP TABLE IF EXISTS feedback_items;
DROP TABLE IF EXISTS customer_lifecycle_events;
DROP TABLE IF EXISTS customer_health_checks;
DROP TABLE IF EXISTS customer_success_notes;
DROP TABLE IF EXISTS support_ticket_comments;
DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS organization_password_policies;
DROP TABLE IF EXISTS user_mfa_methods;
DROP TABLE IF EXISTS user_devices;
DROP TABLE IF EXISTS organization_ip_whitelist;
DROP TABLE IF EXISTS user_licenses;
DROP TABLE IF EXISTS user_onboarding_progress;
DROP TABLE IF EXISTS user_group_members;
DROP TABLE IF EXISTS user_groups;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_activity_summary;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS organization_segments;
DROP TABLE IF EXISTS organization_health_scores;
DROP TABLE IF EXISTS organization_relationships;
DROP TABLE IF EXISTS organization_tags;
DROP TABLE IF EXISTS organization_metadata;
```

## Notes

- All tables include proper foreign key constraints
- Indexes are created for performance optimization
- JSON fields are used for flexible data storage
- Timestamps use DATETIME for SQLite compatibility
- All tables support both SQLite and PostgreSQL

## Verification

After migration, verify tables exist:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%organization_%' OR name LIKE '%user_%' OR name LIKE '%support_%' OR name LIKE '%security_%';
```

## Dependencies

- Existing tables: `organizations`, `users`
- No breaking changes to existing schema
- Backward compatible with existing data












