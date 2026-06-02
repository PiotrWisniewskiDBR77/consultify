-- ============================================
-- Table Platform Performance Indexes
-- Migration: 701_table_platform_performance.sql
-- Description: Additional indexes for query performance targets
-- ============================================

-- Composite index for record listing with sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_tp_records_table_updated 
  ON tp_records(table_id, updated_at DESC);

-- Partial index for non-null data fields commonly used in filters
CREATE INDEX IF NOT EXISTS idx_tp_records_data_text 
  ON tp_records USING GIN (data jsonb_ops);

-- Index for schema proposals by workspace + status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_tp_proposals_ws_status 
  ON tp_schema_proposals(workspace_id, status);

-- Index for audit events by entity + time (common query in audit trail)
CREATE INDEX IF NOT EXISTS idx_tp_audit_entity_time 
  ON tp_audit_events(entity_type, entity_id, created_at DESC);

-- Index for attachments by record + field (common query)
CREATE INDEX IF NOT EXISTS idx_tp_attachments_record_field 
  ON tp_attachments(record_id, field_id);

-- Index for record links reverse lookup (used by RelationService.getReverseLinks)
CREATE INDEX IF NOT EXISTS idx_tp_record_links_to_field 
  ON tp_record_links(to_record_id, from_field_id);

-- Index for bases by workspace + org (common lookup)
CREATE INDEX IF NOT EXISTS idx_tp_bases_ws_org 
  ON tp_bases(workspace_id, organization_id);

-- Partial index for pending schema proposals (most common status query)
CREATE INDEX IF NOT EXISTS idx_tp_proposals_pending 
  ON tp_schema_proposals(workspace_id) WHERE status = 'pending';

-- ANALYZE to update statistics after index creation
ANALYZE tp_records;
ANALYZE tp_fields;
ANALYZE tp_views;
ANALYZE tp_audit_events;
ANALYZE tp_record_links;
ANALYZE tp_attachments;
ANALYZE tp_schema_proposals;
