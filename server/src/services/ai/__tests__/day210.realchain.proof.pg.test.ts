/**
 * FIX-210 real-chain proof (dyżur 210, follow-up to §4/FIX-2 of ODBIÓR_210.md).
 *
 * Proves owner visibility through the REAL production chat surface —
 * `executeToolCall('search_knowledge_base', ...)` → `executeKBSearch` →
 * `KnowledgeService.getDocuments` allow-list → `ragService.hybridSearch` —
 * NOT the lab harness in `day210.embeddingScope.pg.test.ts` (which calls
 * `RagService.searchRelevantChunks` / `EmbeddingService.search()` directly
 * and never touches `toolDefinitions.ts`).
 *
 * Discovery: `executeKBSearch` already pre-filters `documentIds` to an
 * owner-aware allow-list (AGT-008), but it called
 * `ragService.hybridSearch()` WITHOUT `userId` — and
 * `appendKnowledgeDocAccessFilter` unconditionally strips `scope='user'`
 * rows whenever no `userId` is passed, even ones already present in the
 * allow-list. Net effect: the real chat path could not show an owner their
 * OWN private Vault document (verified red before the `toolDefinitions.ts`
 * fix that threads `ctx.userId` into that `hybridSearch` call — see the
 * ODBIÓR_210 fix report). This test pins that fix.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import KnowledgeService from '../../KnowledgeService.js';
import { executeToolCall } from '../toolDefinitions.js';

describe('Day 210 real-chain proof: chat search_knowledge_base tool sees owner private doc', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = 'day210-rc-org';
  const userA = 'day210-rc-user-a';
  const userB = 'day210-rc-user-b';
  const privateDocId = 'day210-rc-private-a';
  const marker = 'DAY210RC-PRIVATE-3e8a71c0f2b94d6ea5c710f8b2934dd1';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 210 realchain org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email) VALUES
         ($1, $3, 'day210-rc-a@example.invalid'),
         ($2, $3, 'day210-rc-b@example.invalid')
       ON CONFLICT (id) DO NOTHING`,
      [userA, userB, organizationId]
    );
    await KnowledgeService.addDocument(
      'rc-private-a.txt',
      '/day210/rc-private-a.txt',
      organizationId,
      null,
      marker.length,
      'test',
      [],
      privateDocId,
      userA,
      'user'
    );
    await KnowledgeService.processDocument(privateDocId, marker, organizationId);
    await pool.query(
      `UPDATE ai_knowledge_embeddings SET embedding = $1::vector WHERE document_id = $2`,
      [`[${Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`, privateDocId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ai_knowledge_embeddings WHERE document_id = $1`, [privateDocId]);
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id = $1`, [privateDocId]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = $1`, [privateDocId]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB]]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  });

  it('owner (userA) sees own private Vault doc through executeToolCall(search_knowledge_base)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: marker, vault_scope: 'user' },
      { userId: userA, organizationId }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(marker);
  });

  it('other org member (userB) does NOT see user A private Vault doc through executeToolCall', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: marker, vault_scope: 'user' },
      { userId: userB, organizationId }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).not.toContain(marker);
  });
});
