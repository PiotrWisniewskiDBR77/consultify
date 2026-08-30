import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface ChunkOrgCoverage {
  total: number;
  docId: number;
  documentId: number;
  projectId: number;
  metadata: number;
  uniquelyRecoverable: number;
}

export interface ChunkOrgBackfillResult {
  backfilled: number;
  quarantined: number;
}

export interface EligibleChunk {
  id: string;
  content: string | null;
  organization_id: string;
}

const scopeClause = (idPattern?: string): { sql: string; params: unknown[] } =>
  idPattern ? { sql: 'AND k.id LIKE ?', params: [idPattern] } : { sql: '', params: [] };

const candidateCte = (scopeSql: string): string => `
  WITH candidate_rows AS (
    SELECT
      k.id,
      k.organization_id,
      old_doc.organization_id AS doc_id_org,
      new_doc.organization_id AS document_id_org,
      CASE
        WHEN pg_input_is_valid(NULLIF(k.metadata, ''), 'jsonb')
        THEN k.metadata::jsonb ->> 'organization_id'
      END AS metadata_org
    FROM knowledge_chunks k
    LEFT JOIN knowledge_docs old_doc ON old_doc.id = k.doc_id
    LEFT JOIN knowledge_docs new_doc ON new_doc.id = k.document_id
    WHERE 1 = 1 ${scopeSql}
  ), resolved AS (
    SELECT
      c.*,
      (SELECT COUNT(DISTINCT value) FROM (VALUES (c.doc_id_org), (c.document_id_org), (c.metadata_org)) AS candidates(value) WHERE value IS NOT NULL AND value <> '') AS candidate_count,
      (SELECT MIN(value) FROM (VALUES (c.doc_id_org), (c.document_id_org), (c.metadata_org)) AS candidates(value) WHERE value IS NOT NULL AND value <> '') AS resolved_org
    FROM candidate_rows c
  )`;

export async function measureChunkOrgCoverage(idPattern?: string): Promise<ChunkOrgCoverage> {
  const scope = scopeClause(idPattern);
  return (await dbGet(
    `${candidateCte(scope.sql)}
     SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE doc_id_org IS NOT NULL AND doc_id_org <> '')::int AS "docId",
       COUNT(*) FILTER (WHERE document_id_org IS NOT NULL AND document_id_org <> '')::int AS "documentId",
       0::int AS "projectId",
       COUNT(*) FILTER (WHERE metadata_org IS NOT NULL AND metadata_org <> '')::int AS metadata,
       COUNT(*) FILTER (WHERE organization_id IS NULL AND candidate_count = 1)::int AS "uniquelyRecoverable"
     FROM resolved`,
    scope.params
  )) as ChunkOrgCoverage;
}

export async function runChunkOrgBackfill(idPattern?: string): Promise<ChunkOrgBackfillResult> {
  const scope = scopeClause(idPattern);
  const backfill = await dbRun(
    `${candidateCte(scope.sql)}
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
     WHERE k.id = r.id AND k.organization_id IS NULL AND r.candidate_count = 1`,
    scope.params
  );

  const quarantineScope = scopeClause(idPattern);
  const quarantine = await dbRun(
    `${candidateCte(quarantineScope.sql)}
     UPDATE knowledge_chunks k
     SET org_quarantined = TRUE,
         org_quarantine_reason = CASE WHEN r.candidate_count = 0 THEN 'no_organization_candidate' ELSE 'conflicting_organization_candidates' END
     FROM resolved r
     WHERE k.id = r.id AND k.organization_id IS NULL`,
    quarantineScope.params
  );

  const result = {
    backfilled: backfill.changes || 0,
    quarantined: quarantine.changes || 0,
  };
  logger.info('[ChunkOrgBackfill] completed', result);
  return result;
}

export async function rollbackChunkOrgBackfill(
  idPattern?: string
): Promise<{ rolledBack: number }> {
  const scope = scopeClause(idPattern);
  const result = await dbRun(
    `UPDATE knowledge_chunks k
     SET organization_id = NULL,
         org_backfill_source = NULL,
         org_backfilled_at = NULL
     WHERE k.org_backfilled_at IS NOT NULL
       AND k.org_backfill_source IS NOT NULL
       ${scope.sql}`,
    scope.params
  );
  const rolledBack = result.changes || 0;
  logger.info('[ChunkOrgBackfill] rolled back', { rolledBack });
  return { rolledBack };
}

export async function listEligibleChunks(
  organizationId: string,
  idPattern?: string
): Promise<EligibleChunk[]> {
  const scope = scopeClause(idPattern);
  return dbAll<EligibleChunk>(
    `SELECT k.id, k.content, k.organization_id
     FROM knowledge_chunks k
     WHERE k.organization_id = ?
       AND k.org_quarantined = FALSE
       ${scope.sql}
     ORDER BY k.id`,
    [organizationId, ...scope.params]
  );
}
