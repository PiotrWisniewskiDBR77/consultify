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
           WHEN 'PENDING_APPROVAL' THEN 'ANALYZING'
           WHEN 'APPROVED' THEN 'APPROVED_BACKLOG'
           WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
           WHEN 'CLOSED' THEN 'DELIVERED'
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
    NEW.lifecycle_stage_source := COALESCE(NEW.lifecycle_stage_source, 'writer');
    IF NEW.lifecycle_stage = 'ARCHIVED' THEN NEW.archived := TRUE; END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF UPPER(COALESCE(NEW.status, 'DRAFT')) <> 'REJECTED' THEN
      NEW.lifecycle_stage := CASE UPPER(COALESCE(NEW.status, 'DRAFT'))
        WHEN 'PROPOSED' THEN 'REGISTERED_DRAFT'
        WHEN 'DRAFT' THEN 'REGISTERED_DRAFT'
        WHEN 'PENDING_APPROVAL' THEN 'ANALYZING'
        WHEN 'APPROVED' THEN 'APPROVED_BACKLOG'
        WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
        WHEN 'CLOSED' THEN 'DELIVERED'
      END;
      NEW.lifecycle_stage_source := 'mapped';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS initiatives_lifecycle_stage_sync ON initiatives;
CREATE TRIGGER initiatives_lifecycle_stage_sync
BEFORE INSERT OR UPDATE OF status, lifecycle_stage ON initiatives
FOR EACH ROW EXECUTE FUNCTION sync_initiative_lifecycle_stage();

COMMIT;

-- Additive rollback (run manually if required; do not drop either column):
-- UPDATE initiatives SET lifecycle_stage = NULL, lifecycle_stage_source = NULL;
