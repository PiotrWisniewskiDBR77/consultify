import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { EmbeddingService } from '../../ai/embeddingService.js';
import { searchKnowledgeBase } from '../../ai/tools/searchKnowledgeBase.js';
import {
  indexReportArtifactForKnowledge,
  reportArtifactToKnowledgeMarkdown,
} from '../artifactKnowledgeIndexer.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 215 report artifact knowledge index (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const organizationId = `day215_org_${suffix}`;
  const ownerA = `day215_owner_a_${suffix}`;
  const ownerB = `day215_owner_b_${suffix}`;
  const reportId = `day215_report_${suffix}`;
  const knowledgeDocumentId = `generated-report-${reportId}`;
  const privateSecret = `DAY215_CONFIDENTIAL_REPORT_MUST_NOT_LEAK_${suffix}`;
  let pool: Pool;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
      organizationId,
      'Day 215 report index proof',
    ]);
    for (const [id, email] of [
      [ownerA, `${ownerA}@example.test`],
      [ownerB, `${ownerB}@example.test`],
    ]) {
      await pool.query(
        'INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)',
        [id, organizationId, email, 'user']
      );
    }
    await pool.query(
      `INSERT INTO report_builder_reports
       (id, organization_id, source_type, source_id, title, report_type, status, created_by, confidentiality)
       VALUES ($1, $2, 'ASSESSMENT', $3, $4, 'CUSTOM', 'GENERATED', $5, 'confidential')`,
      [reportId, organizationId, `source_${suffix}`, 'Confidential day 215 report', ownerA]
    );
    await pool.query(
      `INSERT INTO report_builder_sections
       (id, report_id, section_key, section_type, title, order_index, enabled, generated_content)
       VALUES ($1, $2, 'summary', 'summary', 'Executive summary', 1, true, $3)`,
      [`section_${suffix}`, reportId, privateSecret]
    );
  });

  beforeEach(() => {
    vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(
      Array.from({ length: 1536 }, () => 0.01)
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (!pool) return;
    await pool.query('DELETE FROM ai_knowledge_embeddings WHERE document_id = $1', [
      knowledgeDocumentId,
    ]);
    await pool.query('DELETE FROM knowledge_chunks WHERE doc_id = $1', [knowledgeDocumentId]);
    await pool.query('DELETE FROM knowledge_docs WHERE id = $1', [knowledgeDocumentId]);
    await pool.query('DELETE FROM report_builder_reports WHERE id = $1', [reportId]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ownerA, ownerB]]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('builds ordered markdown from enabled report sections', () => {
    const markdown = reportArtifactToKnowledgeMarkdown([
      {
        title: 'Second',
        generated_content: 'Generated second',
        edited_content: 'Edited second',
        order_index: 2,
      },
      { title: 'Hidden', generated_content: 'Do not index', order_index: 0, enabled: false },
      { title: 'First', edited_content: 'Edited first', order_index: 1 },
    ]);

    expect(markdown).toBe('## First\n\nEdited first\n\n## Second\n\nGenerated second');
    expect(markdown).not.toContain('Do not index');
  });

  it('keeps a database-backed confidential report out of search_knowledge_base for another user', async () => {
    const classification = await pool.query(
      'SELECT confidentiality FROM report_builder_reports WHERE id = $1 AND organization_id = $2',
      [reportId, organizationId]
    );
    const sections = await pool.query(
      `SELECT title, generated_content, edited_content, order_index
       FROM report_builder_sections
       WHERE report_id = $1 AND enabled = true
       ORDER BY order_index ASC`,
      [reportId]
    );

    const indexed = await indexReportArtifactForKnowledge({
      artifactId: reportId,
      organizationId,
      ownerId: ownerA,
      title: 'Confidential day 215 report',
      contentMd: reportArtifactToKnowledgeMarkdown(sections.rows),
      confidentiality: classification.rows[0]?.confidentiality,
    });

    expect(ownerB).not.toBe(ownerA);
    const foundAsOtherUser = await searchKnowledgeBase(
      { query: privateSecret, maxResults: 20 },
      { organizationId }
    );
    expect(foundAsOtherUser.results.some((row) => row.content.includes(privateSecret))).toBe(false);

    expect(indexed.scope).toBe('user');
    const doc = await pool.query(
      'SELECT scope, owner_id, organization_id FROM knowledge_docs WHERE id = $1',
      [knowledgeDocumentId]
    );
    expect(doc.rows[0]).toMatchObject({
      scope: 'user',
      owner_id: ownerA,
      organization_id: organizationId,
    });
    const globalCount = await pool.query(
      'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
      [knowledgeDocumentId]
    );
    expect(globalCount.rows[0]?.count).toBe(0);
  });
});
