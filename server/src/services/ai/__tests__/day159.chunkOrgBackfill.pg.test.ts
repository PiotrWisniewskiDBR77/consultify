import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_TYPE = process.env.DAY159_EFFECTIVE_DB_TYPE || process.env.DB_TYPE;

let dbAll: typeof import('../../../utils/DbPromise.js').all;
let dbGet: typeof import('../../../utils/DbPromise.js').get;
let dbRun: typeof import('../../../utils/DbPromise.js').run;

const ids = {
  orgA: 'day159-org-a',
  orgB: 'day159-org-b',
  docs: [
    'day159-doc-old',
    'day159-doc-new',
    'day159-doc-both',
    'day159-doc-null',
    'day159-doc-conflict-a',
    'day159-doc-conflict-b',
  ],
  chunks: [
    'day159-c-old-1',
    'day159-c-old-2',
    'day159-c-new-1',
    'day159-c-new-2',
    'day159-c-both',
    'day159-c-meta',
    'day159-c-conflict',
    'day159-c-orphan',
    'day159-c-null-doc',
    'day159-c-pretagged',
  ],
};

describe('Day 159 R1-R3 — chunk organization backfill on real PostgreSQL', { retry: 0 }, () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    ({ all: dbAll, get: dbGet, run: dbRun } = await import('../../../utils/DbPromise.js'));
    const identity = (await dbGet(
      'SELECT current_database() AS database, inet_server_port() AS port'
    )) as { database: string; port: number };
    expect(process.env.DATABASE_URL).toMatch(
      /^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/
    );
    expect(identity.database.length).toBeGreaterThan(0);
    expect(identity.port).toBeGreaterThan(0);

    await dbRun(
      `INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?) ON CONFLICT (id) DO NOTHING`,
      [ids.orgA, 'Day 159 A', ids.orgB, 'Day 159 B']
    );
    const docs = [
      [ids.docs[0], ids.orgA],
      [ids.docs[1], ids.orgA],
      [ids.docs[2], ids.orgA],
      [ids.docs[3], null],
      [ids.docs[4], ids.orgA],
      [ids.docs[5], ids.orgB],
    ];
    for (const [id, organizationId] of docs) {
      await dbRun(
        `INSERT INTO knowledge_docs (id, filename, organization_id, scope, status, source_type) VALUES (?, ?, ?, 'organization', 'ready', ?) ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, source_type = EXCLUDED.source_type`,
        [id, `${id}.txt`, organizationId, organizationId === null ? 'methodology' : 'upload'],
        { fallback: false }
      );
    }
    const chunks = [
      [ids.chunks[0], ids.docs[0], null, '{}', null],
      [ids.chunks[1], ids.docs[0], null, '{}', null],
      [ids.chunks[2], null, ids.docs[1], '{}', null],
      [ids.chunks[3], null, ids.docs[1], '{}', null],
      [ids.chunks[4], ids.docs[2], ids.docs[2], '{}', null],
      [ids.chunks[5], null, null, JSON.stringify({ organization_id: ids.orgA }), null],
      [ids.chunks[6], ids.docs[4], ids.docs[5], '{}', null],
      [ids.chunks[7], null, null, '{}', null],
      [ids.chunks[8], ids.docs[3], null, '{}', null],
      [ids.chunks[9], null, null, '{}', ids.orgB],
    ];
    for (const [id, docId, documentId, metadata, organizationId] of chunks) {
      const inserted = await dbRun(
        `INSERT INTO knowledge_chunks (id, doc_id, document_id, content, chunk_index, metadata, organization_id) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT (id) DO UPDATE SET doc_id=EXCLUDED.doc_id, document_id=EXCLUDED.document_id, metadata=EXCLUDED.metadata, organization_id=EXCLUDED.organization_id, org_backfill_source=NULL, org_backfilled_at=NULL, org_quarantined=FALSE, org_quarantine_reason=NULL`,
        [id, docId, documentId, `content-${id}`, metadata, organizationId],
        { fallback: false }
      );
      expect(inserted.success, `seed ${id}`).toBe(true);
    }
    const seeded = (await dbGet(
      `SELECT COUNT(*)::int AS count FROM knowledge_chunks WHERE id LIKE 'day159-c-%'`
    )) as { count: number };
    expect(seeded.count).toBe(10);
  });

  afterAll(async () => {
    await dbRun(`DELETE FROM knowledge_chunks WHERE id LIKE 'day159-%'`);
    await dbRun(`DELETE FROM knowledge_docs WHERE id LIKE 'day159-%'`);
    await dbRun(`DELETE FROM organizations WHERE id IN (?, ?)`, [ids.orgA, ids.orgB]);
  });

  it('measures doc_id and document_id separately, including the absent project_id path', async () => {
    const { measureChunkOrgCoverage } = await import('../chunkOrgBackfillService.js');
    const coverage = await measureChunkOrgCoverage('day159-c-%');
    expect(coverage).toEqual({
      total: 10,
      docId: 4,
      documentId: 4,
      projectId: 0,
      metadata: 1,
      uniquelyRecoverable: 6,
    });
  });

  it('backfills only unique answers, quarantines unresolved rows, and deletes nothing', async () => {
    const { runChunkOrgBackfill, listEligibleChunks } =
      await import('../chunkOrgBackfillService.js');
    const before = (await dbGet(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE organization_id IS NULL)::int AS missing, COUNT(*) FILTER (WHERE org_quarantined)::int AS quarantined FROM knowledge_chunks WHERE id LIKE 'day159-c-%'`
    )) as { total: number; missing: number; quarantined: number };
    const result = await runChunkOrgBackfill('day159-c-%');
    const after = (await dbGet(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE organization_id IS NULL)::int AS missing, COUNT(*) FILTER (WHERE org_quarantined)::int AS quarantined, COUNT(*) FILTER (WHERE org_backfilled_at IS NOT NULL)::int AS backfilled FROM knowledge_chunks WHERE id LIKE 'day159-c-%'`
    )) as { total: number; missing: number; quarantined: number; backfilled: number };
    expect(before).toEqual({ total: 10, missing: 9, quarantined: 0 });
    expect(result).toEqual({ backfilled: 6, quarantined: 3 });
    expect(after).toEqual({ total: 10, missing: 3, quarantined: 3, backfilled: 6 });
    const eligible = await listEligibleChunks(ids.orgA, 'day159-c-%');
    expect(eligible.map((row) => row.id).sort()).toEqual(ids.chunks.slice(0, 6).sort());
  });

  it('measures the quarantined candidate share and effectively silent parent documents', async () => {
    const impact = (await dbGet(
      `WITH scoped_chunks AS (
         SELECT * FROM knowledge_chunks WHERE id LIKE 'day159-c-%'
       ), document_links AS (
         SELECT doc_id AS document_id, org_quarantined FROM scoped_chunks WHERE doc_id IS NOT NULL
         UNION ALL
         SELECT document_id, org_quarantined FROM scoped_chunks WHERE document_id IS NOT NULL
       ), silent_documents AS (
         SELECT document_id
         FROM document_links
         GROUP BY document_id
         HAVING BOOL_AND(org_quarantined)
       )
       SELECT
         (SELECT COUNT(*)::int FROM scoped_chunks) AS total,
         (SELECT COUNT(*)::int FROM scoped_chunks WHERE org_quarantined) AS quarantined,
         (SELECT COUNT(*)::int FROM silent_documents) AS "silentDocuments"`
    )) as { total: number; quarantined: number; silentDocuments: number };
    expect(impact).toEqual({ total: 10, quarantined: 3, silentDocuments: 3 });
  });

  it('rolls back exactly rows marked as backfilled and preserves the pretagged row', async () => {
    const { rollbackChunkOrgBackfill } = await import('../chunkOrgBackfillService.js');
    const result = await rollbackChunkOrgBackfill('day159-c-%');
    const rows = await dbAll<{ id: string; organization_id: string | null }>(
      `SELECT id, organization_id FROM knowledge_chunks WHERE id LIKE 'day159-c-%' ORDER BY id`
    );
    expect(result).toEqual({ rolledBack: 6 });
    expect(rows.filter((row) => row.organization_id !== null)).toEqual([
      { id: ids.chunks[9], organization_id: ids.orgB },
    ]);
  });
});
