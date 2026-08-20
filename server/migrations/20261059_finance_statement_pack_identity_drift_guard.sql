-- Repair effective-schema drift after restores/bootstrap paths that can
-- resurrect the legacy type-only Statement pack index after 20261057.

DROP INDEX IF EXISTS idx_fs_pack_active_type;

DROP INDEX IF EXISTS idx_fs_pack_active_type_period;

CREATE UNIQUE INDEX idx_fs_pack_active_type_period
  ON financial_statements(
    statement_pack_id,
    statement_type,
    COALESCE(period_start, DATE '0001-01-01'),
    COALESCE(period_end, DATE '0001-01-01')
  )
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';
