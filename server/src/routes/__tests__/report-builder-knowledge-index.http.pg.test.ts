/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { EmbeddingService } from '../../services/ai/embeddingService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const FLAG_ON = process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX === 'true';

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB || !FLAG_ON)(
  'Day 215 report-builder /generate → knowledge index, real HTTP (real PostgreSQL)',
  () => {
    const suffix = randomUUID().slice(0, 8);
    const organizationId = `day215_http_org_${suffix}`;
    const ownerId = `day215_http_owner_${suffix}`;
    const internalReportId = `day215_http_internal_${suffix}`;
    const confidentialReportId = `day215_http_confidential_${suffix}`;
    const internalSecret = `DAY215_HTTP_INTERNAL_SEARCHABLE_${suffix}`;
    const confidentialSecret = `DAY215_HTTP_CONFIDENTIAL_NOT_GLOBAL_${suffix}`;
    let app: Express;
    let pool: import('pg').Pool;
    let ownerToken = '';

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      expect(process.env.DB_TYPE).toBe('postgres');
      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: DATABASE_URL });
      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        organizationId,
        'Day 215 HTTP report proof',
      ]);
      await pool.query(
        'INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)',
        [ownerId, organizationId, `${ownerId}@example.test`, 'user']
      );

      for (const [reportId, confidentiality, secret] of [
        [internalReportId, 'internal', internalSecret],
        [confidentialReportId, 'confidential', confidentialSecret],
      ]) {
        await pool.query(
          `INSERT INTO report_builder_reports
           (id, organization_id, source_type, source_id, title, report_type, status, created_by, confidentiality)
           VALUES ($1, $2, 'ASSESSMENT', $3, $4, 'CUSTOM', 'DRAFT', $5, $6)`,
          [
            reportId,
            organizationId,
            `source_${reportId}`,
            `Report ${reportId}`,
            ownerId,
            confidentiality,
          ]
        );
        await pool.query(
          `INSERT INTO report_builder_sections
           (id, report_id, section_key, section_type, title, order_index, enabled, generated_content)
           VALUES ($1, $2, 'summary', 'summary', 'Executive summary', 1, true, $3)`,
          [`section_${reportId}`, reportId, secret]
        );
      }

      const { default: config } = await import('../../config/Config.js');
      ownerToken = jwt.sign({ id: ownerId, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
      const { default: reportBuilderRoutes } = await import('../report-builder.routes.js');
      app = express();
      app.use(express.json());
      app.use('/api/report-builder', reportBuilderRoutes);
    });

    beforeEach(() => {
      vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(
        Array.from({ length: 1536 }, () => 0.01)
      );
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      if (!pool) return;
      await pool.query('DELETE FROM ai_knowledge_embeddings WHERE organization_id = $1', [
        organizationId,
      ]);
      await pool.query(
        'DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id = $1)',
        [organizationId]
      );
      await pool.query('DELETE FROM knowledge_docs WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM report_builder_reports WHERE organization_id = $1', [
        organizationId,
      ]);
      await pool.query('DELETE FROM users WHERE id = $1', [ownerId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await pool.end();
    });

    async function generate(reportId: string) {
      return request(app)
        .post(`/api/report-builder/${reportId}/generate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ regenerateAll: false });
    }

    async function waitForDocument(documentId: string) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const row = await pool.query(
          'SELECT scope, owner_id, organization_id FROM knowledge_docs WHERE id = $1',
          [documentId]
        );
        if (row.rows[0]) return row.rows[0];
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return undefined;
    }

    it('indexes an internal report through signed HTTP and makes its fresh section content searchable', async () => {
      const response = await generate(internalReportId);
      expect(response.status).toBe(200);
      const documentId = `generated-report-${internalReportId}`;
      expect(await waitForDocument(documentId)).toMatchObject({
        scope: 'organization',
        owner_id: ownerId,
        organization_id: organizationId,
      });

      const { searchKnowledgeBase } =
        await import('../../services/ai/tools/searchKnowledgeBase.js');
      const found = await searchKnowledgeBase(
        { query: internalSecret, maxResults: 20 },
        { organizationId }
      );
      expect(found.results.some((row) => row.content.includes(internalSecret))).toBe(true);
    });

    it('reads confidential scope from the database and keeps the report out of global search', async () => {
      const response = await generate(confidentialReportId);
      expect(response.status).toBe(200);
      const documentId = `generated-report-${confidentialReportId}`;
      expect(await waitForDocument(documentId)).toMatchObject({
        scope: 'user',
        owner_id: ownerId,
        organization_id: organizationId,
      });
      const globalCount = await pool.query(
        'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
        [documentId]
      );
      expect(globalCount.rows[0]?.count).toBe(0);

      const { searchKnowledgeBase } =
        await import('../../services/ai/tools/searchKnowledgeBase.js');
      const found = await searchKnowledgeBase(
        { query: confidentialSecret, maxResults: 20 },
        { organizationId }
      );
      expect(found.results.some((row) => row.content.includes(confidentialSecret))).toBe(false);
    });
  }
);
