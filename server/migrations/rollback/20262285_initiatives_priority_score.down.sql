-- Rollback DEC-537 priority score projection.

DROP INDEX IF EXISTS idx_initiatives_priority_score;

UPDATE ie_aggregate_state
   SET payload_json = payload_json - 'priorityScore' - 'prioritySource' - 'priorityOverrideReason'
 WHERE aggregate_type = 'initiative';

ALTER TABLE initiatives DROP COLUMN IF EXISTS priority_override_reason;
ALTER TABLE initiatives DROP COLUMN IF EXISTS priority_source;
ALTER TABLE initiatives DROP COLUMN IF EXISTS priority_score;
