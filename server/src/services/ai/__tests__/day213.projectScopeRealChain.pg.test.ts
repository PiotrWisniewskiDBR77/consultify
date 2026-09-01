/**
 * FIX-213-6 real-chain proof.
 *
 * ODBIÓR_213.md confirmed the project-scope safe was closed by EXTINCTION,
 * not by admitting the right people: no production caller of
 * `ragService.hybridSearch` passed `projectIds`, so a `scope='project'`
 * document created through the real `POST /api/knowledge/documents` route
 * was invisible in retrieval to EVERYONE — including members of that exact
 * project.
 *
 * `executeKBSearch` (toolDefinitions.ts) already computes `memberProjectIds`
 * from the request's own identity (`project_members` for `ctx.userId`) to
 * build its `documentIds` allow-list — that allow-list already, correctly,
 * includes/excludes the project doc for member/non-member. The bug is a
 * SECOND, redundant filter: `ragService.hybridSearch` → `bm25Search`/
 * `_vectorSearch` → `appendKnowledgeDocAccessFilter` → the shared
 * `buildKnowledgeDocAccessFilter` applies its OWN scope check on top of the
 * documentIds allow-list, and without `projectIds` its `scope = 'project'`
 * branch never matches — so even an already-allow-listed project doc gets
 * excluded a second time. The fix threads that same `memberProjectIds` (or
 * the single selected project) into the `hybridSearch` call as `projectIds`.
 *
 * This test proves the REAL chain end to end —
 * `executeToolCall('search_knowledge_base', ...)` → `executeKBSearch` →
 * `ragService.hybridSearch` — the same production surface as
 * `day210.realchain.proof.pg.test.ts`, not a lab call directly into
 * `ragService`/`buildKnowledgeDocAccessFilter`. No `vi.mock` of
 * embeddingService: BM25 (plain SQL over `knowledge_chunks.content`) is
 * what actually proves this, exactly like day210's real-chain test — no
 * live embedding provider is available in this environment either way.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import KnowledgeService from '../../KnowledgeService.js';
import { executeToolCall } from '../toolDefinitions.js';

describe('Day 213 real-chain proof: project-scoped Vault doc visibility through search_knowledge_base', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = 'day213-ps-org';
  const projectId = 'day213-ps-project';
  const memberUserId = 'day213-ps-member';
  const outsiderUserId = 'day213-ps-outsider';
  const projectDocId = 'day213-ps-project-doc';
  const marker = 'DAY213PS-PROJECT-4c1a6e9f27bd48e0a3c56198fd7302e1';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 213 project-scope org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email) VALUES
         ($1, $3, 'day213-ps-member@example.invalid'),
         ($2, $3, 'day213-ps-outsider@example.invalid')
       ON CONFLICT (id) DO NOTHING`,
      [memberUserId, outsiderUserId, organizationId]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, organizationId, 'Day 213 project-scope project']
    );
    // memberUserId is a project member; outsiderUserId is in the SAME
    // organization but never added to this project's members.
    await pool.query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [projectId, memberUserId]
    );

    await KnowledgeService.addDocument(
      'project-doc.txt',
      '/day213/project-doc.txt',
      organizationId,
      projectId,
      marker.length,
      'test',
      [],
      projectDocId,
      memberUserId,
      'project'
    );
    await KnowledgeService.processDocument(projectDocId, marker, organizationId);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ai_knowledge_embeddings WHERE document_id = $1`, [projectDocId]);
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id = $1`, [projectDocId]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = $1`, [projectDocId]);
    await pool.query(`DELETE FROM project_members WHERE project_id = $1`, [projectId]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
      [memberUserId, outsiderUserId],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  });

  it('project member sees the project-scoped Vault document through executeToolCall(search_knowledge_base)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: marker },
      { userId: memberUserId, organizationId }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(marker);
  });

  it('org member who is NOT a project member does not see the project-scoped Vault document', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: marker },
      { userId: outsiderUserId, organizationId }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).not.toContain(marker);
  });
});
