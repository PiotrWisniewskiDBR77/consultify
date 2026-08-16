-- FIN-BVP-001 / FIN-MVP-CUTOVER-001
-- Canonical Finance artifact identities are TEXT (see finance_artifacts and
-- finance_business_versions).  The cutover telemetry table originally used
-- UUID, which made the real alias bridge fail even for UUID-shaped TEXT IDs.
-- Preserve all existing values while aligning the durable observation schema
-- with its canonical source of truth.

ALTER TABLE finance_legacy_usage_events
  ALTER COLUMN canonical_artifact_id TYPE TEXT
    USING canonical_artifact_id::text,
  ALTER COLUMN canonical_business_version_id TYPE TEXT
    USING canonical_business_version_id::text;
