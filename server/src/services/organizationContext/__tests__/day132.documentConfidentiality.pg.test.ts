import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)(
  'Day 132 R1 — attachment confidentiality governance (real PostgreSQL)',
  () => {
    const suffix = randomUUID().slice(0, 8);
    const orgId = `day132_org_${suffix}`;
    const userId = `day132_user_${suffix}`;
    const docId = 'day132_r1_confidential_proof';
    const chunkId = `day132_chunk_${suffix}`;
    let pool: Pool;

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      pool = new Pool({ connectionString: DATABASE_URL });
      await pool.query(
        `INSERT INTO knowledge_docs
       (id, filename, status, organization_id, owner_id, scope, ai_visibility, sensitivity)
       VALUES ($1, 'day132-confidential-strategy.txt', 'ready', $2, $3, 'user', 'allowed', 'confidential')`,
        [docId, orgId, userId]
      );
      await pool.query(
        `INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index)
       VALUES ($1, $2, 'DAY132 CONFIDENTIAL CONTENT MUST NEVER REACH TERESA', 0)`,
        [chunkId, docId]
      );
    });

    afterAll(async () => {
      if (!pool) return;
      await pool.query('DELETE FROM knowledge_chunks WHERE id = $1', [chunkId]);
      await pool.query('DELETE FROM knowledge_docs WHERE id = $1', [docId]);
      await pool.end();
    });

    it('uses the effective PostgreSQL test environment', () => {
      expect(process.env.DB_TYPE).toBe('postgres');
    });

    it('excludes an explicitly confidential selected document with a distinguishable reason', async () => {
      const { retrieveContext } = await import('../ContextRetrievalService.js');
      const result = await retrieveContext({
        organizationId: orgId,
        userId,
        workflow: 'ai_chat',
        workflowMode: 'selected_material_plus_selected_context',
        retrievalQuery: 'strategy',
        retrievalReason: 'day132_r1_proof',
        selectedDocumentIds: [docId],
        conversationId: `day132_conversation_${suffix}`,
      });

      expect(result.chunks).toEqual([]);
      expect(result.selectedDocumentIds).toEqual([]);
      expect(result.excludedReasons).toContainEqual({
        documentId: docId,
        reason: 'document_confidentiality_governance_blocked',
      });
    });
  }
);
