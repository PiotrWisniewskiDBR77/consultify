-- DEC-537: canonical numeric priority for the Initiative stage list.
-- Existing staging data carried mixed-case initiatives.priority and optional
-- priority_order only. This migration adds an explicit score/source projection
-- and backfills the event-sourced runtime-v1 payload that powers the list.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS priority_score INTEGER;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS priority_source TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS priority_override_reason TEXT;

UPDATE initiatives
   SET priority = UPPER(TRIM(priority))
 WHERE priority IS NOT NULL
   AND TRIM(priority) <> ''
   AND UPPER(TRIM(priority)) IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
   AND priority <> UPPER(TRIM(priority));

UPDATE initiatives
   SET priority_score = COALESCE(
         priority_score,
         CASE
           WHEN priority_order = 1 THEN 100
           WHEN priority_order = 2 THEN 75
           WHEN priority_order = 3 THEN 50
           WHEN priority_order > 3 THEN GREATEST(0, LEAST(100, 100 - ((priority_order - 1) * 25)))
           WHEN UPPER(COALESCE(priority, '')) = 'CRITICAL' THEN 100
           WHEN UPPER(COALESCE(priority, '')) = 'HIGH' THEN 75
           WHEN UPPER(COALESCE(priority, '')) = 'LOW' THEN 25
           ELSE 50
         END
       ),
       priority_source = COALESCE(
         NULLIF(priority_source, ''),
         CASE
           WHEN priority_order IS NOT NULL AND priority_order > 0 THEN 'PRIORITY_ORDER'
           ELSE 'LEGACY_PRIORITY'
         END
       )
 WHERE priority_score IS NULL
    OR priority_source IS NULL
    OR TRIM(priority_source) = '';

WITH scored AS (
  SELECT
    s.organization_id,
    s.aggregate_id,
    s.payload_json,
    COALESCE(
      NULLIF(s.payload_json->>'priorityScore', '')::numeric,
      i.priority_score,
      CASE
        WHEN i.priority_order = 1 THEN 100
        WHEN i.priority_order = 2 THEN 75
        WHEN i.priority_order = 3 THEN 50
        WHEN i.priority_order > 3 THEN GREATEST(0, LEAST(100, 100 - ((i.priority_order - 1) * 25)))
        WHEN UPPER(COALESCE(s.payload_json->>'priority', i.priority, '')) = 'CRITICAL' THEN 100
        WHEN UPPER(COALESCE(s.payload_json->>'priority', i.priority, '')) = 'HIGH' THEN 75
        WHEN UPPER(COALESCE(s.payload_json->>'priority', i.priority, '')) = 'LOW' THEN 25
        ELSE 50
      END
    )::integer AS priority_score,
    COALESCE(
      NULLIF(s.payload_json->>'prioritySource', ''),
      NULLIF(i.priority_source, ''),
      CASE
        WHEN i.priority_order IS NOT NULL AND i.priority_order > 0 THEN 'PRIORITY_ORDER'
        ELSE 'LEGACY_PRIORITY'
      END
    ) AS priority_source,
    NULLIF(COALESCE(s.payload_json->>'priorityOverrideReason', i.priority_override_reason, ''), '') AS priority_override_reason,
    CASE
      WHEN UPPER(COALESCE(s.payload_json->>'priority', i.priority, '')) IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
        THEN UPPER(COALESCE(s.payload_json->>'priority', i.priority, ''))
      ELSE COALESCE(s.payload_json->>'priority', i.priority, 'MEDIUM')
    END AS normalized_priority
  FROM ie_aggregate_state s
  LEFT JOIN initiatives i
    ON i.organization_id = s.organization_id
   AND i.id = s.aggregate_id
  WHERE s.aggregate_type = 'initiative'
)
UPDATE ie_aggregate_state s
   SET payload_json = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(scored.payload_json, '{priority}', to_jsonb(scored.normalized_priority), true),
             '{priorityScore}', to_jsonb(scored.priority_score), true
           ),
           '{prioritySource}', to_jsonb(scored.priority_source), true
         ),
         '{priorityOverrideReason}', COALESCE(to_jsonb(scored.priority_override_reason), 'null'::jsonb), true
       )
  FROM scored
 WHERE s.organization_id = scored.organization_id
   AND s.aggregate_type = 'initiative'
   AND s.aggregate_id = scored.aggregate_id;

CREATE INDEX IF NOT EXISTS idx_initiatives_priority_score
  ON initiatives(organization_id, priority_score DESC, updated_at DESC, id DESC);
