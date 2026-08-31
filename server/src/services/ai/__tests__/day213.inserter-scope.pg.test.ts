import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { upsertKnowledgeDocs } from '../../demo/demoSeedService.js';
import { indexInsightInKnowledgeBase } from '../../v8/insightSignalBridgeService.js';
import { knowledgeIndexer } from '../knowledgeIndexer.js';

vi.mock('../../v8/interviewInsightFindingsService.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, listFindings: vi.fn().mockResolvedValue([]) };
});

const NO_RETRY = { retry: 0 } as const;

describe(
  'Day 213 explicit organization scope for service inserters on real PostgreSQL',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const suffix = randomUUID();
    const organizationId = `day213-org-${suffix}`;
    const indexerDocId = `day213-indexer-${suffix}`;
    const insightId = `day213-insight-${suffix}`;

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      expect(process.env.DB_TYPE).toBe('postgres');
      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        organizationId,
        'Day 213 scope proof',
      ]);
    });

    afterAll(async () => {
      // Broad cleanup by organization_id: also removes the demo-seed knowledge docs/chunks
      // inserted by upsertKnowledgeDocs (their ids are derived from demo template slugs,
      // not known ahead of time).
      await pool
        .query(
          'DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id = $1)',
          [organizationId]
        )
        .catch(() => undefined);
      await pool.query('DELETE FROM knowledge_docs WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await pool.end();
    });

    it('knowledgeIndexer.insertDocument writes organization scope explicitly', async () => {
      await knowledgeIndexer.insertDocument({
        id: indexerDocId,
        filename: 'methodology.md',
        filepath: '/day213/methodology.md',
        sourceType: 'methodology',
        organizationId,
        chunkCount: 0,
      });
      const result = await pool.query('SELECT scope FROM knowledge_docs WHERE id = $1', [
        indexerDocId,
      ]);
      expect(result.rows[0]?.scope).toBe('organization');
    });

    it('indexInsightInKnowledgeBase writes organization scope explicitly', async () => {
      const result = await indexInsightInKnowledgeBase(
        {
          id: insightId,
          title: 'Published insight',
          promptType: 'custom',
          status: 'published',
          publishedAt: new Date().toISOString(),
          sourceSessionCount: 1,
          executiveSummary: 'Summary',
          themes: [],
          issues: [],
          opportunities: [],
        } as any,
        organizationId
      );
      expect(result.error).toBeUndefined();
      const row = await pool.query('SELECT scope FROM knowledge_docs WHERE id = $1', [
        result.docId,
      ]);
      expect(row.rows[0]?.scope).toBe('organization');
    });

    it('demoSeedService.upsertKnowledgeDocs (the fifth inserter, FIX-213-1) writes organization scope explicitly', async () => {
      const docCount = await upsertKnowledgeDocs(organizationId, 'en');
      expect(docCount).toBeGreaterThan(0);
      const rows = await pool.query('SELECT scope FROM knowledge_docs WHERE organization_id = $1', [
        organizationId,
      ]);
      expect(rows.rows.length).toBeGreaterThan(0);
      for (const row of rows.rows) {
        expect(row.scope).toBe('organization');
      }
    });
  }
);
