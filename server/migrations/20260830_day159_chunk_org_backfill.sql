-- Day 159: additive organization provenance and quarantine for knowledge chunks.
-- The live retrieval filter is deliberately not changed by this migration.

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS org_backfill_source TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS org_backfilled_at TIMESTAMP;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS org_quarantined BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS org_quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_organization_id
  ON knowledge_chunks (organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org_quarantine
  ON knowledge_chunks (org_quarantined);

WITH candidate_rows AS (
  SELECT
    k.id,
    old_doc.organization_id AS doc_id_org,
    new_doc.organization_id AS document_id_org,
    CASE
      WHEN pg_input_is_valid(NULLIF(k.metadata, ''), 'jsonb')
      THEN k.metadata::jsonb ->> 'organization_id'
    END AS metadata_org
  FROM knowledge_chunks k
  LEFT JOIN knowledge_docs old_doc ON old_doc.id = k.doc_id
  LEFT JOIN knowledge_docs new_doc ON new_doc.id = k.document_id
  WHERE k.organization_id IS NULL
), resolved AS (
  SELECT
    c.*,
    (SELECT COUNT(DISTINCT value) FROM (VALUES (c.doc_id_org), (c.document_id_org), (c.metadata_org)) AS candidates(value) WHERE value IS NOT NULL AND value <> '') AS candidate_count,
    (SELECT MIN(value) FROM (VALUES (c.doc_id_org), (c.document_id_org), (c.metadata_org)) AS candidates(value) WHERE value IS NOT NULL AND value <> '') AS resolved_org
  FROM candidate_rows c
)
UPDATE knowledge_chunks k
SET organization_id = r.resolved_org,
    org_backfill_source = concat_ws('+',
      CASE WHEN r.doc_id_org = r.resolved_org THEN 'doc_id' END,
      CASE WHEN r.document_id_org = r.resolved_org THEN 'document_id' END,
      CASE WHEN r.metadata_org = r.resolved_org THEN 'metadata.organization_id' END
    ),
    org_backfilled_at = CURRENT_TIMESTAMP,
    org_quarantined = FALSE,
    org_quarantine_reason = NULL
FROM resolved r
WHERE k.id = r.id AND r.candidate_count = 1;

WITH candidate_rows AS (
  SELECT
    k.id,
    old_doc.organization_id AS doc_id_org,
    new_doc.organization_id AS document_id_org,
    CASE
      WHEN pg_input_is_valid(NULLIF(k.metadata, ''), 'jsonb')
      THEN k.metadata::jsonb ->> 'organization_id'
    END AS metadata_org
  FROM knowledge_chunks k
  LEFT JOIN knowledge_docs old_doc ON old_doc.id = k.doc_id
  LEFT JOIN knowledge_docs new_doc ON new_doc.id = k.document_id
  WHERE k.organization_id IS NULL
), unresolved AS (
  SELECT
    c.id,
    (SELECT COUNT(DISTINCT value) FROM (VALUES (c.doc_id_org), (c.document_id_org), (c.metadata_org)) AS candidates(value) WHERE value IS NOT NULL AND value <> '') AS candidate_count
  FROM candidate_rows c
)
UPDATE knowledge_chunks k
SET org_quarantined = TRUE,
    org_quarantine_reason = CASE WHEN u.candidate_count = 0 THEN 'no_organization_candidate' ELSE 'conflicting_organization_candidates' END
FROM unresolved u
WHERE k.id = u.id;
