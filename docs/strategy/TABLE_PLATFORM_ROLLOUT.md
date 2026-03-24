# Consultify Table Platform — Rollout Package

## 1. Overview

### What was built

The **metadata-first table platform** replaces the graph-based table storage (`extensions.table` + `nodes`) with first-class backend entities. Users can:

- Create bases and tables via API or Chat-to-Schema
- Import CSV into new or existing tables
- Manage fields, views, records, and relations
- Query with filters, sorts, grouping, and pagination
- View audit trails and linked records

### Architecture summary

- **9 services**: MetadataService, RecordsService, AuditService, RelationService, ViewQueryEngine, SchemaValidationService, ChatToSchemaService, CsvImportService, MigrationService
- **39 endpoints** under `/api/table-platform`
- **9 DB tables**: `tp_bases`, `tp_tables`, `tp_fields`, `tp_views`, `tp_records`, `tp_record_links`, `tp_attachments`, `tp_audit_events`, `tp_schema_proposals`

### Feature flag strategy

| Flag | Purpose |
|------|---------|
| `ENABLE_TABLE_PLATFORM_METADATA_FIRST` | Enables metadata-first mode for pilot users (load tables from backend) |
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | Enables all table-platform API routes |

Both flags are OFF in production by default. Enable per org or per user for pilot rollout.

---

## 2. Known Limitations (v1)

- **No real-time collaboration** — planned for v2
- **No offline support**
- **No automation engine** — planned for v2
- **Formula fields not migrated** — displayed as text when migrating from legacy
- **Relation fields not migrated** — displayed as text when migrating from legacy
- **No field-level permissions** — v1 uses base-level only
- **No row-level filtering by permissions**
- **Attachment storage** — requires external object storage (S3/compatible) configuration
- **Chat-to-Schema** — requires `OPENAI_API_KEY` and `AI_MODEL`/`AI_API_URL`
- **Maximum 100 records per bulk operation** (bulk-delete, bulk-update)
- **Maximum 10 records per batch** (records/batch endpoint)
- **No undo for schema changes** — only audit trail for history

---

## 3. Rollout Checklist

### Pre-rollout

- [ ] Run migration `700_table_platform_foundation.sql`
- [ ] Set environment variables: `OPENAI_API_KEY`, `AI_MODEL`, `AI_API_URL` (for Chat-to-Schema)
- [ ] Configure object storage for attachments (S3/compatible)
- [ ] Verify feature flags are OFF in production

### Pilot activation

- [ ] Enable `ENABLE_TABLE_PLATFORM_RECORDS_API` for pilot org
- [ ] Enable `ENABLE_TABLE_PLATFORM_METADATA_FIRST` for pilot users
- [ ] Run migration for 1–2 test workspaces via `POST /api/table-platform/migrate/workspace`
- [ ] Validate migrated data via `POST /api/table-platform/migrate/validate`

### Monitoring

- [ ] Watch `tp_audit_events` for errors
- [ ] Monitor API response times for `/api/table-platform/*`
- [ ] Check for 500 errors in table-platform routes
- [ ] Verify no impact on non-pilot users (flags off)

### Rollback plan

- [ ] Disable feature flags (instant rollback)
- [ ] Use `MigrationService.rollbackMigration` if needed to remove migrated bases
- [ ] Legacy data in `extensions.table` is untouched; rollback only affects new platform entities

---

## 4. Migration Guide

### Automatic migration

Migrate a legacy workspace graph into the new platform:

```http
POST /api/table-platform/migrate/workspace
Content-Type: application/json
Authorization: Bearer <token>

{
  "workspaceId": "<idea_id_or_workspace_id>",
  "graph": {
    "nodes": [...],
    "edges": [...],
    "extensions": {
      "table": {
        "columns": [...],
        "views": [...]
      }
    }
  }
}
```

Returns: `{ success, baseId, tableId, fieldsMigrated, recordsMigrated, viewsMigrated, warnings, fieldMapping }`

### Validation

Validate that migrated data matches the legacy graph:

```http
POST /api/table-platform/migrate/validate
Content-Type: application/json

{
  "workspaceId": "<workspace_id>",
  "baseId": "<base_id>",
  "graph": { ... }  // optional; pass for full node/column comparison
}
```

Returns: `{ valid, legacyNodeCount, newRecordCount, legacyColumnCount, newFieldCount, discrepancies }`

### Rollback

Delete a migrated base (CASCADE removes tables, fields, views, records):

```http
POST /api/table-platform/migrate/rollback
Content-Type: application/json
Authorization: Bearer <token>

{
  "baseId": "<base_id>"
}
```

Returns: `204 No Content`

---

## 5. API Reference Summary

### Bases & metadata

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bases` | Create base |
| GET | `/bases/:baseId` | Get base with tables |
| GET | `/workspaces/:workspaceId/bases` | List bases |
| POST | `/bases/:baseId/tables` | Create table |
| DELETE | `/tables/:tableId` | Delete table |
| GET | `/tables/:tableId` | Get table with fields and views |
| POST | `/tables/:tableId/fields` | Create field |
| DELETE | `/fields/:fieldId` | Delete field |
| PATCH | `/fields/:fieldId` | Update field |
| POST | `/tables/:tableId/views` | Create view |
| PATCH | `/views/:viewId` | Update view |
| DELETE | `/views/:viewId` | Delete view |

### Records

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tables/:tableId/records` | List records (filter, sort, cursor) |
| POST | `/tables/:tableId/records` | Create record |
| GET | `/records/:recordId` | Get record |
| PATCH | `/records/:recordId` | Update record |
| DELETE | `/records/:recordId` | Delete record |
| POST | `/tables/:tableId/records/query` | View query (filters, sorts, groupBy) |
| POST | `/tables/:tableId/records/batch` | Batch create/update/delete (max 10 ops) |
| POST | `/tables/:tableId/records/bulk-delete` | Bulk delete (max 100) |
| POST | `/tables/:tableId/records/bulk-update` | Bulk update (max 100) |

### Relations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/records/:recordId/links` | Link records |
| DELETE | `/records/:recordId/links` | Unlink records |
| GET | `/records/:recordId/links/:fieldId` | Get linked records |

### Import & schema

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tables/:tableId/import/csv` | Import CSV into table |
| POST | `/bases/:baseId/import/csv` | Import CSV as new table |
| POST | `/schema/propose` | Chat-to-Schema: propose schema |
| POST | `/schema/proposals/:id/execute` | Execute approved operations |
| POST | `/schema/proposals/:id/reject` | Reject proposal |
| POST | `/schema/proposals/:id/refine` | Refine proposal |
| GET | `/schema/proposals/:id` | Get proposal |
| GET | `/workspaces/:workspaceId/schema/proposals` | List proposals |

### Migration

| Method | Path | Description |
|--------|------|-------------|
| POST | `/migrate/workspace` | Migrate legacy graph to platform |
| POST | `/migrate/validate` | Validate migration result |
| POST | `/migrate/rollback` | Roll back migration |

### Audit & attachments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit/:entityType/:entityId` | Get audit events for entity |
| GET | `/tables/:tableId/audit` | Get audit events for table |
| POST | `/records/:recordId/attachments` | Create attachment |
| GET | `/records/:recordId/attachments` | List attachments |
| DELETE | `/attachments/:attachmentId` | Delete attachment |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React / IdeaTableTool)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    /api/table-platform (Express Router)                  │
│  requireTablePlatform middleware (ENABLE_TABLE_PLATFORM_RECORDS_API)     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────┐            ┌──────────────────┐           ┌─────────────────┐
│ MetadataSvc   │            │ RecordsService   │           │ RelationService │
│ Bases/Tables │            │ CRUD, list, batch │           │ Links/unlinks   │
│ Fields/Views │            │ ViewQueryEngine   │           │ linked_record   │
└──────────────┘            └──────────────────┘           └─────────────────┘
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (tp_* tables)                          │
│  tp_bases → tp_tables → tp_fields, tp_views, tp_records                   │
│  tp_record_links, tp_attachments, tp_audit_events, tp_schema_proposals     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────┐            ┌──────────────────┐           ┌─────────────────┐
│ AuditService │            │ ChatToSchemaSvc   │           │ CsvImportSvc    │
│ logEvent     │            │ LLM proposal     │           │ parse + import  │
└──────────────┘            └──────────────────┘           └─────────────────┘
```

---

## 7. Success Criteria

- [ ] Pilot user can create a table from chat (Chat-to-Schema)
- [ ] Pilot user can import CSV
- [ ] Pilot user can use grid: sort, filter, group
- [ ] Pilot user can link records across tables
- [ ] Pilot user can view audit trail
- [ ] Data persists correctly after page reload
- [ ] No regression in existing modules (finance, mindmap)
- [ ] Migration from legacy graph preserves schema and data

---

## 8. Team Contacts

| Role | Contact |
|------|---------|
| Platform Owner | [TBD] |
| Technical Lead | [TBD] |
| Pilot Users | [TBD] |
