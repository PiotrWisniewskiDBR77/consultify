# Consultify Table Platform — Support Playbook

## 1. Architecture Quick Reference

### Services
| Service | Purpose | Key file |
|---|---|---|
| MetadataService | Base/table/field/view CRUD | server/src/services/tablePlatform/MetadataService.ts |
| RecordsService | Record CRUD, batch, pagination | server/src/services/tablePlatform/RecordsService.ts |
| ViewQueryEngine | Server-side filter/sort/group/search | server/src/services/tablePlatform/ViewQueryEngine.ts |
| ChatToSchemaService | NL → schema proposal → execution | server/src/services/tablePlatform/ChatToSchemaService.ts |
| CsvImportService | CSV parsing, type inference, import | server/src/services/tablePlatform/CsvImportService.ts |
| RelationService | Linked records, count/lookup/rollup | server/src/services/tablePlatform/RelationService.ts |
| AttachmentService | File attachment metadata | server/src/services/tablePlatform/AttachmentService.ts |
| PermissionsService | v1 base-level access control | server/src/services/tablePlatform/PermissionsService.ts |
| MigrationService | Legacy graph → new platform | server/src/services/tablePlatform/MigrationService.ts |
| AuditService | Immutable event logging | server/src/services/tablePlatform/AuditService.ts |
| SchemaValidationService | Schema operation validation | server/src/services/tablePlatform/SchemaValidationService.ts |

### Database tables
| Table | Purpose |
|---|---|
| tp_bases | Workspace-level base containers |
| tp_tables | Structured data tables |
| tp_fields | Column definitions |
| tp_views | Saved view configurations |
| tp_records | Data rows (JSONB) |
| tp_record_links | Bidirectional record relations |
| tp_attachments | File attachment metadata |
| tp_audit_events | Immutable audit log |
| tp_schema_proposals | Chat-to-Schema proposals |

### Feature flags
| Flag | Purpose | Default |
|---|---|---|
| ENABLE_TABLE_PLATFORM_RECORDS_API | Enables all /api/table-platform routes | false |
| ENABLE_TABLE_PLATFORM_METADATA_FIRST | Switches frontend to new backend | false |

## 2. Common Issues & Troubleshooting

### Issue: "Table platform is not enabled" (404)
**Cause:** Feature flag ENABLE_TABLE_PLATFORM_RECORDS_API is OFF
**Fix:** Enable the flag in server config or environment variables

### Issue: "Organization context required" (403)
**Cause:** User's auth token doesn't include organizationId
**Fix:** Verify auth middleware is extracting org from JWT/session

### Issue: Chat-to-Schema returns empty proposal
**Cause:** OPENAI_API_KEY not set or AI service unavailable
**Fix:** Check env vars: OPENAI_API_KEY, AI_API_URL, AI_MODEL

### Issue: CSV import fails with "No column mapping"
**Cause:** CSV headers don't match any existing field names
**Fix:** Either rename CSV headers to match field names, or provide explicit mapping in the request body

### Issue: Linked records not showing
**Cause:** Field type must be 'linkedRecord' with linkedTableId in options
**Fix:** Verify field options: `{ linkedTableId: "<target-table-uuid>" }`

### Issue: Slow record listing (>500ms)
**Cause:** Missing indexes or large table without cursor pagination
**Fix:**
1. Run migration 701_table_platform_performance.sql
2. Use cursor-based pagination (pageSize=50)
3. Check `EXPLAIN ANALYZE` on slow queries

### Issue: Migration fails midway
**Cause:** Legacy graph has invalid data or missing columns
**Fix:**
1. Check MigrationService warnings in response
2. Use rollback endpoint: `POST /api/table-platform/migrate/rollback`
3. Fix legacy data and retry

### Issue: Audit trail returns no events
**Cause:** Entity type/ID mismatch or events not yet created
**Fix:** Use `GET /api/table-platform/tables/:tableId/audit` for table-wide audit

## 3. Monitoring Checklist

### Daily checks
- [ ] Check tp_audit_events for error events:

```sql
SELECT * FROM tp_audit_events
WHERE event_type LIKE '%error%'
ORDER BY created_at DESC
LIMIT 20;
```

- [ ] Check schema proposal success rate:

```sql
SELECT status, COUNT(*) FROM tp_schema_proposals GROUP BY status;
```

- [ ] Check record counts per table:

```sql
SELECT table_id, COUNT(*) FROM tp_records GROUP BY table_id ORDER BY count DESC;
```

### Weekly checks
- [ ] Review slow queries in database logs
- [ ] Check attachment storage usage
- [ ] Review migration attempts and failures
- [ ] Check feature flag status across environments

## 4. Emergency Procedures

### Instant rollback (no data loss)
1. Set `ENABLE_TABLE_PLATFORM_METADATA_FIRST = false`
2. Set `ENABLE_TABLE_PLATFORM_RECORDS_API = false`
3. Users automatically fall back to legacy graph persistence
4. Legacy data in extensions.table is untouched

### Data recovery
1. Check tp_audit_events for the mutation history
2. Use before_data/after_data fields to reconstruct state
3. For full table recovery, use base-level rollback

### Performance emergency
1. Check active queries:

```sql
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

2. Kill long-running queries if needed
3. Run `ANALYZE` on affected tables
4. Check index usage:

```sql
SELECT * FROM pg_stat_user_indexes WHERE relname LIKE 'tp_%';
```

## 5. API Quick Reference

### Most common operations
| Operation | Method | Endpoint |
|---|---|---|
| List bases | GET | /api/table-platform/workspaces/:wid/bases |
| Get table with fields | GET | /api/table-platform/tables/:tid |
| List records | GET | /api/table-platform/tables/:tid/records |
| Query records | POST | /api/table-platform/tables/:tid/records/query |
| Create record | POST | /api/table-platform/tables/:tid/records |
| Update record | PATCH | /api/table-platform/records/:rid |
| Delete record | DELETE | /api/table-platform/records/:rid |
| Generate schema | POST | /api/table-platform/schema/propose |
| Execute proposal | POST | /api/table-platform/schema/proposals/:pid/execute |
| Import CSV | POST | /api/table-platform/tables/:tid/import/csv |
| Migrate workspace | POST | /api/table-platform/migrate/workspace |

## 6. Escalation Path
1. Check this playbook
2. Check audit trail for the affected entity
3. Check server logs for `[TablePlatform]` entries
4. If data issue: check tp_audit_events for before/after state
5. If performance issue: check pg_stat_statements
6. Escalate to platform team with: entity IDs, error messages, audit trail excerpt
