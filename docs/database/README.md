# Database Documentation

## Overview

The Consultify platform uses SQLite for local development and PostgreSQL for production. This directory contains comprehensive documentation of the database schema, migration history, and operational procedures.

## Quick Stats

- **Total Tables**: 122
- **Database Size**: ~1.2 MB (development)
- **Migration Files**: 141
- **Database Type**: SQLite (dev), PostgreSQL (prod)

## Architecture

### Multi-Tenant Foundation

- `organizations` - Tenant isolation
- `users` - User accounts with org association
- `projects` - Project-level data segregation

### Core Modules

- **AI & Intelligence** (15+ tables) - AI audit, memory, learning
- **Assessment & Diagnostics** (10+ tables) - Multi-framework assessments
- **Billing & Commerce** (12+ tables) - Invoices, subscriptions, usage
- **Security & Compliance** (15+ tables) - API keys, MFA, audit logs
- **Integration & Webhooks** (8+ tables) - External integrations
- **Governance & PMO** (10+ tables) - Initiatives, reports, workstreams

## Migration System

### Running Migrations

```bash
# Apply pending migrations
npm run db:migrate

# Backfill existing migrations (one-time setup)
npm run db:migrate:backfill

# Check migration status
sqlite3 server/consultify.db "SELECT version, filename, status FROM schema_migrations ORDER BY version;"
```

### Migration Files

Located in `server/migrations/`, numbered sequentially:

- `001-050` - Core platform features
- `051-100` - AI, security, billing
- `101-150` - Settings, integrations
- `151-210` - Security MVP, Stripe, metrics

See [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md) for detailed changelog.

## Backup & Restore

### Creating Backups

```bash
# Manual backup
npm run db:backup

# Backups are stored in server/backups/ with timestamp
# Format: consultify_YYYYMMDD_HHMMSS.db.gz
```

### Restoring from Backup

```bash
# Interactive restore
npm run db:restore

# Select backup from list
# Safety backup is created automatically
```

### Backup Strategy

- **Frequency**: Daily automated backups (recommended)
- **Retention**: 7 days
- **Location**: `server/backups/`
- **Format**: Compressed with gzip (~70% compression)

## Database Health

### Health Checks

```bash
# Run comprehensive health check
npm run db:health

# Manual integrity check
sqlite3 server/consultify.db "PRAGMA integrity_check;"

# Check foreign keys
sqlite3 server/consultify.db "PRAGMA foreign_key_check;"
```

### Performance

Key indexes for optimal performance:

- User queries: `idx_users_organization_id`, `idx_users_email`
- Notifications: `idx_notifications_user_id_created_at`
- Tasks: `idx_tasks_project_id_status`
- AI Audit: `idx_ai_audit_logs_organization_id_created_at`

## Schema Documentation

Detailed table documentation available in `tables/`:

- [organizations.md](./tables/organizations.md)
- [users.md](./tables/users.md)
- [projects.md](./tables/projects.md)
- [ai_audit_logs.md](./tables/ai_audit_logs.md)
- ... (more tables)

## ER Diagram

See [schema.mermaid](./schema.mermaid) for visual representation of:

- Entity relationships
- Foreign key constraints
- Multi-tenant architecture

## Troubleshooting

### Common Issues

**Missing tables after startup**

- DatabaseInitializer auto-creates missing tables
- Check logs for initialization errors
- Run `npm run db:migrate` to ensure all migrations applied

**Foreign key violations**

- Run `PRAGMA foreign_key_check;`
- Check for orphaned records
- Verify migration order

**Performance issues**

- Check slow query logs
- Verify indexes exist
- Consider VACUUM for SQLite

### Getting Help

1. Check [MIGRATION_HISTORY.md](./MIGRATION_HISTORY.md) for recent changes
2. Review DatabaseInitializer logs
3. Run health check: `npm run db:health`
4. Check integrity: `PRAGMA integrity_check;`

## Development Guidelines

### Adding New Tables

1. Create migration file: `server/migrations/XXX_feature_name.sql`
2. Include rollback procedure in comments
3. Update this documentation
4. Add to CRITICAL_TABLES in DatabaseInitializer if essential
5. Run migration: `npm run db:migrate`

### Modifying Existing Tables

1. Create new migration (never modify existing ones)
2. Use `ALTER TABLE` for schema changes
3. Include data migration if needed
4. Test on development database first
5. Document breaking changes

### Best Practices

- ✅ Always use migrations for schema changes
- ✅ Test migrations on development database first
- ✅ Include rollback procedures
- ✅ Document breaking changes
- ✅ Backup before major changes
- ❌ Never modify applied migrations
- ❌ Never delete migration files
- ❌ Never commit database files to git

## References

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [DatabaseInitializer.ts](../../server/src/database/DatabaseInitializer.ts)
- [Migration Runner](../../server/scripts/migrate.ts)
