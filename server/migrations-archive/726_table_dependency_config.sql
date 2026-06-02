-- 726: Add dependency_config to tp_tables for date dependency configuration
-- Stores: startDateFieldId, endDateFieldId, durationFieldId, predecessorFieldId,
-- defaultDependencyType, defaultLagDays, skipWeekends, etc.

ALTER TABLE tp_tables ADD COLUMN IF NOT EXISTS dependency_config JSONB DEFAULT NULL;
