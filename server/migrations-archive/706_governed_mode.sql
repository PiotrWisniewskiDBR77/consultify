-- 706: Add governance_mode to tp_tables
-- 'operational' = default, flexible schema changes
-- 'governed'    = locked schema, requires approval via Chat-to-Schema

ALTER TABLE tp_tables
  ADD COLUMN IF NOT EXISTS governance_mode TEXT NOT NULL DEFAULT 'operational';

-- Add ordinal to tp_views for reorder support (tp_fields already has field_order)
ALTER TABLE tp_views
  ADD COLUMN IF NOT EXISTS ordinal INTEGER DEFAULT 0;
