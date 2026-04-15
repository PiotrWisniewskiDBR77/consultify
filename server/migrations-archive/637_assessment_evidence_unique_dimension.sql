-- Ensure assessment_evidence upserts have a valid unique conflict target.
-- Keeps the newest row per assessment/framework/dimension and enforces uniqueness.

WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY assessment_id, framework_id, dimension_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM assessment_evidence
  WHERE framework_id IS NOT NULL
    AND dimension_id IS NOT NULL
)
DELETE FROM assessment_evidence ae
USING ranked r
WHERE ae.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_evidence_unique_dimension
  ON assessment_evidence(assessment_id, framework_id, dimension_id)
  WHERE framework_id IS NOT NULL
    AND dimension_id IS NOT NULL;
