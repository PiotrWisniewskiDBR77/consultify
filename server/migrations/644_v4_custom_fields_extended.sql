-- V4-TASK-02: Extend custom field schemas with options, validation, defaults, and ordering
ALTER TABLE task_custom_field_schemas ADD COLUMN IF NOT EXISTS options_json TEXT;
ALTER TABLE task_custom_field_schemas ADD COLUMN IF NOT EXISTS default_value_json TEXT;
ALTER TABLE task_custom_field_schemas ADD COLUMN IF NOT EXISTS validation_json TEXT;
ALTER TABLE task_custom_field_schemas ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE task_custom_field_schemas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- V4-EXEC-06: Ensure tasks have source tracking columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_type, source_id);
