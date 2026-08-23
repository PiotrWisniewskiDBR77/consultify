-- Finance valuation input events are an immutable child ledger of the exact
-- canonical artifact/version/revision graph.  Keep all three identities
-- tenant-bound at the database wall so future/raw callers cannot attribute an
-- event to parents owned by another organization.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM finance_valuation_input_command_events e
      LEFT JOIN finance_artifacts a
        ON (a.artifact_id, a.organization_id) = (e.artifact_id, e.organization_id)
     WHERE a.artifact_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'finance_valuation_input_command_events contains an artifact tenant mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM finance_valuation_input_command_events e
      LEFT JOIN finance_business_versions bv
        ON (bv.business_version_id, bv.organization_id) =
           (e.business_version_id, e.organization_id)
     WHERE bv.business_version_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'finance_valuation_input_command_events contains a business-version tenant mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM finance_valuation_input_command_events e
      LEFT JOIN finance_working_revisions wr
        ON (wr.working_revision_id, wr.organization_id) =
           (e.working_revision_id, e.organization_id)
     WHERE wr.working_revision_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'finance_valuation_input_command_events contains a working-revision tenant mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'finance_valuation_input_command_events'::regclass
       AND conname IN (
         'fk_fin_val_input_events_artifact_org',
         'fk_fin_val_input_events_bv_org',
         'fk_fin_val_input_events_wr_org'
       )
  ) THEN
    RAISE EXCEPTION
      'finance_valuation_input_command_events tenant constraint identity already exists';
  END IF;
END $$;

ALTER TABLE finance_valuation_input_command_events
  ADD CONSTRAINT fk_fin_val_input_events_artifact_org
  FOREIGN KEY (artifact_id, organization_id)
  REFERENCES finance_artifacts (artifact_id, organization_id);

ALTER TABLE finance_valuation_input_command_events
  ADD CONSTRAINT fk_fin_val_input_events_bv_org
  FOREIGN KEY (business_version_id, organization_id)
  REFERENCES finance_business_versions (business_version_id, organization_id);

ALTER TABLE finance_valuation_input_command_events
  ADD CONSTRAINT fk_fin_val_input_events_wr_org
  FOREIGN KEY (working_revision_id, organization_id)
  REFERENCES finance_working_revisions (working_revision_id, organization_id);
