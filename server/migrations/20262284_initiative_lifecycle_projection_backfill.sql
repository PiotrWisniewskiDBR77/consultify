-- D-20: make initiatives.lifecycle_stage the persisted twelve-stage source of truth.
-- `initiatives.status` remains the seven-code compatibility projection, and
-- `ie_aggregate_state.payload_json.lifecycleState` is brought back to the same
-- persisted stage for existing rows. Idempotent: a second run updates 0 rows.
BEGIN;

DO $$
DECLARE
  status_updates integer := 0;
  aggregate_updates integer := 0;
BEGIN
  WITH stage_projection(stage, status, archived) AS (
    VALUES
      ('REGISTERED_DRAFT','DRAFT',false),
      ('DEFINED','DRAFT',false),
      ('ANALYZING','PENDING_APPROVAL',false),
      ('READY_FOR_DECISION','PENDING_APPROVAL',false),
      ('APPROVED_BACKLOG','APPROVED',false),
      ('SCHEDULED','APPROVED',false),
      ('IN_EXECUTION','IN_EXECUTION',false),
      ('DELIVERED','CLOSED',false),
      ('BENEFITS_TRACKING','CLOSED',false),
      ('EFFECTIVENESS_REVIEWED','CLOSED',false),
      ('CLOSED','CLOSED',false),
      ('ARCHIVED','CLOSED',true)
  ), updated_status AS (
    UPDATE initiatives AS i
       SET status = p.status,
           archived = CASE WHEN p.archived THEN true ELSE i.archived END
      FROM stage_projection AS p
     WHERE i.lifecycle_stage = p.stage
       AND UPPER(COALESCE(i.status, 'DRAFT')) NOT IN ('REJECTED', 'PROPOSED')
       AND UPPER(COALESCE(i.status, 'DRAFT')) IS DISTINCT FROM p.status
     RETURNING i.id
  )
  SELECT count(*)::integer INTO status_updates FROM updated_status;

  WITH valid_stage(stage) AS (
    VALUES
      ('REGISTERED_DRAFT'),
      ('DEFINED'),
      ('ANALYZING'),
      ('READY_FOR_DECISION'),
      ('APPROVED_BACKLOG'),
      ('SCHEDULED'),
      ('IN_EXECUTION'),
      ('DELIVERED'),
      ('BENEFITS_TRACKING'),
      ('EFFECTIVENESS_REVIEWED'),
      ('CLOSED'),
      ('ARCHIVED')
  ), updated_aggregate AS (
    UPDATE ie_aggregate_state AS a
       SET version = a.version + 1,
           payload_json = COALESCE(a.payload_json, '{}'::jsonb) || jsonb_build_object('lifecycleState', i.lifecycle_stage),
           updated_at = NOW()
      FROM initiatives AS i
      JOIN valid_stage AS v ON v.stage = i.lifecycle_stage
     WHERE a.organization_id = i.organization_id
       AND a.aggregate_type = 'initiative'
       AND a.aggregate_id = i.id
       AND (a.payload_json->>'lifecycleState') IS DISTINCT FROM i.lifecycle_stage
     RETURNING a.aggregate_id
  )
  SELECT count(*)::integer INTO aggregate_updates FROM updated_aggregate;

  RAISE NOTICE 'D-20 lifecycle projection backfill: status_updates=% aggregate_updates=%', status_updates, aggregate_updates;
END $$;

COMMIT;
