-- STAGE-1 / DEC-539: persist the twelve-stage initiative lifecycle in the
-- classic initiatives table. The seven-code status remains a compatibility
-- projection until its consumers are retired.
BEGIN;

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_stage_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.initiatives'::regclass
       AND conname = 'initiatives_lifecycle_stage_check'
  ) THEN
    ALTER TABLE initiatives
      ADD CONSTRAINT initiatives_lifecycle_stage_check CHECK (
        lifecycle_stage IS NULL OR lifecycle_stage IN (
          'REGISTERED_DRAFT', 'DEFINED', 'ANALYZING', 'READY_FOR_DECISION',
          'APPROVED_BACKLOG', 'SCHEDULED', 'IN_EXECUTION', 'DELIVERED',
          'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED', 'CLOSED', 'ARCHIVED'
        )
      );
  END IF;
END $$;

-- A rerun can see the compatibility trigger created by an earlier run. Disable
-- it before backfill so populating the new column can never rewrite the legacy
-- status column as a side effect. The trigger is recreated (enabled) below.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.initiatives'::regclass
       AND tgname = 'initiatives_lifecycle_stage_sync'
       AND NOT tgisinternal
  ) THEN
    ALTER TABLE initiatives DISABLE TRIGGER initiatives_lifecycle_stage_sync;
  END IF;
END $$;

CREATE TEMP TABLE stage1_status_counts_before ON COMMIT DROP AS
SELECT UPPER(COALESCE(status, '<NULL>')) AS status, COUNT(*)::bigint AS row_count
  FROM initiatives
 GROUP BY UPPER(COALESCE(status, '<NULL>'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.initiatives'::regclass
       AND conname = 'initiatives_lifecycle_stage_source_check'
  ) THEN
    ALTER TABLE initiatives
      ADD CONSTRAINT initiatives_lifecycle_stage_source_check CHECK (
        lifecycle_stage_source IS NULL OR lifecycle_stage_source IN ('aggregate', 'mapped', 'writer')
      );
  END IF;
END $$;

-- The aggregate is the most precise source for pre-migration rows. Only the
-- twelve accepted values may cross into the constrained column.
UPDATE initiatives AS i
   SET lifecycle_stage = a.payload_json->>'lifecycleState',
       lifecycle_stage_source = 'aggregate'
  FROM ie_aggregate_state AS a
 WHERE a.organization_id = i.organization_id
   AND a.aggregate_type = 'initiative'
   AND a.aggregate_id = i.id
   AND a.payload_json->>'lifecycleState' IN (
     'REGISTERED_DRAFT', 'DEFINED', 'ANALYZING', 'READY_FOR_DECISION',
     'APPROVED_BACKLOG', 'SCHEDULED', 'IN_EXECUTION', 'DELIVERED',
     'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED', 'CLOSED', 'ARCHIVED'
   )
   AND (i.lifecycle_stage, i.lifecycle_stage_source)
       IS DISTINCT FROM (a.payload_json->>'lifecycleState', 'aggregate');

-- Rows without a precise aggregate use the first stage in the approved 7->12
-- mapping. PROPOSED is pre-registration but may exist in the legacy table;
-- REJECTED is a disposition, so its last meaningful lifecycle stage is CLOSED.
WITH mapped AS (
  SELECT id,
         CASE UPPER(COALESCE(status, 'DRAFT'))
           WHEN 'PROPOSED' THEN 'REGISTERED_DRAFT'
           WHEN 'DRAFT' THEN 'REGISTERED_DRAFT'
           WHEN 'PENDING_APPROVAL' THEN 'READY_FOR_DECISION'
           WHEN 'APPROVED' THEN 'APPROVED_BACKLOG'
           WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
           WHEN 'CLOSED' THEN 'CLOSED'
           WHEN 'REJECTED' THEN 'CLOSED'
         END AS lifecycle_stage
    FROM initiatives
   WHERE lifecycle_stage IS NULL
)
UPDATE initiatives AS i
   SET lifecycle_stage = mapped.lifecycle_stage,
       lifecycle_stage_source = 'mapped'
  FROM mapped
 WHERE i.id = mapped.id
   AND mapped.lifecycle_stage IS NOT NULL
   AND (i.lifecycle_stage, i.lifecycle_stage_source)
       IS DISTINCT FROM (mapped.lifecycle_stage, 'mapped');

-- Backfill is forbidden from changing the compatibility status column. Emit
-- the complete before/after denominator and abort the migration on drift.
DO $$
DECLARE
  changed_groups integer;
  status_counts text;
BEGIN
  SELECT COUNT(*)::integer,
         STRING_AGG(
           COALESCE(b.status, a.status) || ':' || COALESCE(b.row_count, 0)::text || '→' ||
           COALESCE(a.row_count, 0)::text,
           ', ' ORDER BY COALESCE(b.status, a.status)
         )
    INTO changed_groups, status_counts
    FROM stage1_status_counts_before b
    FULL OUTER JOIN (
      SELECT UPPER(COALESCE(status, '<NULL>')) AS status, COUNT(*)::bigint AS row_count
        FROM initiatives
       GROUP BY UPPER(COALESCE(status, '<NULL>'))
    ) a USING (status)
   WHERE COALESCE(b.row_count, 0) IS DISTINCT FROM COALESCE(a.row_count, 0);

  RAISE NOTICE 'STAGE-1 status counts before/after: %', COALESCE(status_counts, 'unchanged');
  IF changed_groups > 0 THEN
    RAISE EXCEPTION 'STAGE-1 backfill changed initiatives.status (% groups)', changed_groups;
  END IF;
END $$;

-- Compatibility guard for every remaining raw writer. An explicit stage wins
-- and derives the seven-code status. A status-only write chooses the first
-- mapped stage. REJECTED is a disposition and therefore preserves the stage at
-- which the initiative was rejected.
CREATE OR REPLACE FUNCTION sync_initiative_lifecycle_stage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle_stage IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage) THEN
    NEW.status := CASE NEW.lifecycle_stage
      WHEN 'REGISTERED_DRAFT' THEN 'DRAFT'
      WHEN 'DEFINED' THEN 'DRAFT'
      WHEN 'ANALYZING' THEN 'PENDING_APPROVAL'
      WHEN 'READY_FOR_DECISION' THEN 'PENDING_APPROVAL'
      WHEN 'APPROVED_BACKLOG' THEN 'APPROVED'
      WHEN 'SCHEDULED' THEN 'APPROVED'
      WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
      WHEN 'DELIVERED' THEN 'CLOSED'
      WHEN 'BENEFITS_TRACKING' THEN 'CLOSED'
      WHEN 'EFFECTIVENESS_REVIEWED' THEN 'CLOSED'
      WHEN 'CLOSED' THEN 'CLOSED'
      WHEN 'ARCHIVED' THEN 'CLOSED'
    END;
    NEW.lifecycle_stage_source := 'writer';
    IF NEW.lifecycle_stage = 'ARCHIVED' THEN NEW.archived := TRUE; END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF UPPER(COALESCE(NEW.status, 'DRAFT')) <> 'REJECTED' THEN
      -- A raw compatibility writer may repeat/re-case the seven-code status.
      -- Preserve a more precise existing stage whenever it belongs to the
      -- same seven-code group; never degrade SCHEDULED to APPROVED_BACKLOG,
      -- READY_FOR_DECISION to ANALYZING, or CLOSED to DELIVERED.
      IF TG_OP = 'UPDATE'
         AND OLD.lifecycle_stage IS NOT NULL
         AND UPPER(COALESCE(NEW.status, 'DRAFT')) = (CASE OLD.lifecycle_stage
           WHEN 'REGISTERED_DRAFT' THEN 'DRAFT'
           WHEN 'DEFINED' THEN 'DRAFT'
           WHEN 'ANALYZING' THEN 'PENDING_APPROVAL'
           WHEN 'READY_FOR_DECISION' THEN 'PENDING_APPROVAL'
           WHEN 'APPROVED_BACKLOG' THEN 'APPROVED'
           WHEN 'SCHEDULED' THEN 'APPROVED'
           WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
           WHEN 'DELIVERED' THEN 'CLOSED'
           WHEN 'BENEFITS_TRACKING' THEN 'CLOSED'
           WHEN 'EFFECTIVENESS_REVIEWED' THEN 'CLOSED'
           WHEN 'CLOSED' THEN 'CLOSED'
           WHEN 'ARCHIVED' THEN 'CLOSED'
         END) THEN
        NEW.lifecycle_stage := OLD.lifecycle_stage;
        NEW.lifecycle_stage_source := OLD.lifecycle_stage_source;
      ELSE
        NEW.lifecycle_stage := CASE UPPER(COALESCE(NEW.status, 'DRAFT'))
        WHEN 'PROPOSED' THEN 'REGISTERED_DRAFT'
        WHEN 'DRAFT' THEN 'REGISTERED_DRAFT'
        WHEN 'PENDING_APPROVAL' THEN 'READY_FOR_DECISION'
        WHEN 'APPROVED' THEN 'APPROVED_BACKLOG'
        WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
        WHEN 'CLOSED' THEN 'CLOSED'
        END;
        NEW.lifecycle_stage_source := 'mapped';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS initiatives_lifecycle_stage_sync ON initiatives;
CREATE TRIGGER initiatives_lifecycle_stage_sync
BEFORE INSERT OR UPDATE OF status, lifecycle_stage ON initiatives
FOR EACH ROW EXECUTE FUNCTION sync_initiative_lifecycle_stage();

-- The canonical execution aggregate can carry a stage that the seven-code
-- compatibility status cannot express (for example APPROVED + SCHEDULED).
-- Keep the persisted column in step when that aggregate is written. The first
-- UPDATE deliberately passes through the initiatives compatibility trigger;
-- the second, source-only UPDATE records where the precise value came from.
CREATE OR REPLACE FUNCTION sync_initiative_stage_from_aggregate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  aggregate_stage text;
BEGIN
  IF NEW.aggregate_type <> 'initiative' THEN
    RETURN NEW;
  END IF;

  aggregate_stage := NEW.payload_json->>'lifecycleState';
  IF aggregate_stage NOT IN (
    'REGISTERED_DRAFT', 'DEFINED', 'ANALYZING', 'READY_FOR_DECISION',
    'APPROVED_BACKLOG', 'SCHEDULED', 'IN_EXECUTION', 'DELIVERED',
    'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED', 'CLOSED', 'ARCHIVED'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE initiatives
     SET lifecycle_stage = aggregate_stage
   WHERE id = NEW.aggregate_id
     AND organization_id = NEW.organization_id
     AND lifecycle_stage IS DISTINCT FROM aggregate_stage;

  UPDATE initiatives
     SET lifecycle_stage_source = 'aggregate'
   WHERE id = NEW.aggregate_id
     AND organization_id = NEW.organization_id
     AND lifecycle_stage = aggregate_stage
     AND lifecycle_stage_source IS DISTINCT FROM 'aggregate';

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ie_aggregate_initiative_stage_sync ON ie_aggregate_state;
CREATE TRIGGER ie_aggregate_initiative_stage_sync
AFTER INSERT OR UPDATE OF payload_json ON ie_aggregate_state
FOR EACH ROW EXECUTE FUNCTION sync_initiative_stage_from_aggregate();

COMMIT;

-- Additive rollback (run manually if required; do not drop either column):
-- UPDATE initiatives SET lifecycle_stage = NULL, lifecycle_stage_source = NULL;
