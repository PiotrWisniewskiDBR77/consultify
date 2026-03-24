# Consultify Table Platform — Pilot Release Notes
Version: 1.0.0-pilot
Date: March 2026

## What's New

### Table Platform (metadata-first)
A completely new backend for table data that replaces the legacy graph-based storage with a proper database schema. Tables, fields, views, and records are now first-class entities with stable IDs, server-side query processing, and a full audit trail.

### Chat-to-Schema
Describe your table in natural language and the system will propose a structured schema. Review the proposal, approve or refine it, and the table is created automatically.

**Example:** "Create a project tracker with columns for name, status, owner, deadline, and priority"

### CSV Import
Import data from CSV files into existing tables or create new tables with automatic type inference. The system detects numbers, dates, emails, URLs, and select options automatically.

### Linked Records
Connect records across tables with bidirectional links. View linked records inline, use the record picker to add new links, and see count/lookup/rollup computed fields.

### Saved Views
Create and save multiple views of the same table with different sorts, filters, grouping, and visible columns. Views are persisted on the server and shared across sessions.

### Audit Trail
Every schema change and record mutation is logged with before/after state, actor, and timestamp. View the audit trail for any table to see its complete history.

### Bulk Operations
Select multiple records and delete or update them in a single operation (up to 100 records at a time).

### Attachments
Attach files to records with metadata tracking. Attachments are linked to specific fields and records.

## How to Enable

1. **Backend:** Set `ENABLE_TABLE_PLATFORM_RECORDS_API=true` in environment
2. **Frontend:** Set `tablePlatformRecordsApi=true` and `tablePlatformMetadataFirst=true` in feature flags
3. **Database:** Run migrations 700 and 701

## Migration from Legacy

Use the migration endpoint to convert existing workspace data:

```http
POST /api/table-platform/migrate/workspace
Content-Type: application/json

Body: { "workspaceId": "...", "graph": { "nodes": [...], "edges": [...], "extensions": {...} } }
```

Validate the migration:

```http
POST /api/table-platform/migrate/validate
Content-Type: application/json

Body: { "workspaceId": "...", "baseId": "..." }
```

Rollback if needed:

```http
POST /api/table-platform/migrate/rollback
Content-Type: application/json

Body: { "baseId": "..." }
```

## Known Limitations

- Formula fields are migrated as text (formula engine planned for v2)
- No real-time collaboration yet (planned for v2)
- No automation engine (planned for v2)
- Attachment storage requires external S3-compatible configuration
- Chat-to-Schema requires OpenAI API key
- Maximum 100 records per bulk operation
- No undo for schema changes (audit trail available for manual recovery)
- Field-level and row-level permissions not yet available (base-level only)

## Feedback

Please report issues with:

- Entity IDs (table, record, field)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## What's Next (v2 Roadmap)

- Formula engine v2
- Automations v1
- Forms v1
- Comments and activity per record
- Interface/dashboard layer
- Richer sharing model
- Webhooks
- Enterprise auth and governance
