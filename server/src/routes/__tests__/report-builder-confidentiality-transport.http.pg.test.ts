/** @vitest-environment node */
/**
 * FIX-215 punkt 1 (BLOKUJĄCY) — dowód, że `confidentiality` wybrana przez
 * użytkownika faktycznie dojeżdża z żądania HTTP `POST /api/report-builder`
 * do kolumny `report_builder_reports.confidentiality`, i że ta kolumna
 * poprawnie steruje widocznością zaindeksowanej treści w bazie wiedzy.
 *
 * Diagnoza (ODBIOR_215.md, "Luka poufności"): trasa `POST /` destrukturyzowała
 * `req.body` i przekazywała do `ReportBuilderService.createReport` WYŁĄCZNIE
 * `config` — `confidentiality` nigdy nie docierała jako top-level parametr,
 * mimo że serwis (`hasV3Configuration`) sprawdza dokładnie `params.confidentiality`.
 * Efekt: każdy raport tworzony przez żywe POST zawsze lądował na
 * DEFAULT 'internal', niezależnie od wyboru użytkownika.
 *
 * Ten test NIE zakłada, że którykolwiek z dzisiejszych wołaczy UI faktycznie
 * wysyła `confidentiality` (żaden nie wysyła — `useReportBuilder`/`IntentStep`
 * jest kodem osieroconym, nieużywanym przez żaden zamontowany ekran; pozostali
 * wołacze `Api.post('/report-builder', ...)` w ogóle nie znają tego pola).
 * Test bije wprost w kontrakt HTTP trasy, żeby udowodnić transport niezależnie
 * od tego, który przyszły/istniejący caller go użyje.
 */
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
  'FIX-215 pkt 1: confidentiality transport HTTP → kolumna → indeksacja (real PostgreSQL)',
  () => {
    const suffix = randomUUID().slice(0, 8);
    const organizationId = `fix215_org_${suffix}`;
    const ownerId = `fix215_owner_${suffix}`;
    const otherMemberId = `fix215_other_member_${suffix}`;
    const confidentialSecret = `FIX215_CONFIDENTIAL_MUST_NOT_LEAK_${suffix}`;
    const internalSecret = `FIX215_INTERNAL_SHOULD_BE_FOUND_${suffix}`;

    let app: Express;
    let pool: import('pg').Pool;
    let ownerToken = '';
    const createdReportIds: string[] = [];

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      expect(process.env.DB_TYPE).toBe('postgres');
      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: DATABASE_URL });

      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        organizationId,
        'FIX-215 confidentiality transport proof',
      ]);
      await pool.query(
        'INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)',
        [ownerId, organizationId, `${ownerId}@example.test`, 'user']
      );
      await pool.query(
        'INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)',
        [otherMemberId, organizationId, `${otherMemberId}@example.test`, 'user']
      );

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
      if (createdReportIds.length > 0) {
        await pool.query('DELETE FROM report_builder_sections WHERE report_id = ANY($1)', [
          createdReportIds,
        ]);
        await pool.query('DELETE FROM report_builder_reports WHERE id = ANY($1)', [
          createdReportIds,
        ]);
      }
      await pool.query('DELETE FROM users WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await pool.end();
    });

    async function createReportViaHttp(confidentiality: string | undefined, title: string) {
      const body: Record<string, unknown> = {
        sourceType: 'FINANCE_SECTION',
        sourceId: `src_${randomUUID()}`,
        title,
      };
      if (confidentiality !== undefined) body.confidentiality = confidentiality;

      const response = await request(app)
        .post('/api/report-builder')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);

      expect(response.status).toBe(201);
      const reportId = response.body?.report?.id as string;
      expect(reportId).toBeTruthy();
      createdReportIds.push(reportId);
      return reportId;
    }

    // ── BRAMKA (gate): pole musi dojechać z HTTP do kolumny ──
    it('creates a report with confidentiality=confidential (non-default) via real HTTP and the DB column reflects it, not the DEFAULT internal', async () => {
      const reportId = await createReportViaHttp('confidential', `Confidential ${suffix}`);

      const row = await pool.query(
        'SELECT confidentiality FROM report_builder_reports WHERE id = $1',
        [reportId]
      );
      expect(row.rows[0]?.confidentiality).toBe('confidential');
    });

    it('creates a report without specifying confidentiality and the DB column keeps the DEFAULT internal (baseline, unchanged semantics)', async () => {
      const reportId = await createReportViaHttp(undefined, `No selection ${suffix}`);

      const row = await pool.query(
        'SELECT confidentiality FROM report_builder_reports WHERE id = $1',
        [reportId]
      );
      expect(row.rows[0]?.confidentiality).toBe('internal');
    });

    // ── Domyka pętlę z dyżurem 215: raport oznaczony jako poufny nie jest
    //    widoczny dla innego członka organizacji po zaindeksowaniu ──
    it('a report created as confidential via HTTP is indexed with user scope and its content is NOT visible to another org member after indexing; an internal one IS visible', async () => {
      const confidentialReportId = await createReportViaHttp(
        'confidential',
        `Confidential content ${suffix}`
      );
      const internalReportId = await createReportViaHttp('internal', `Internal content ${suffix}`);

      // Seed one section's generated_content per report (mirrors day209/215
      // pattern: with regenerateAll:false only sections WITHOUT existing
      // generated_content are (re)generated by AI — pre-filled sections are
      // used as-is for indexing, so no AI call is needed here).
      for (const [reportId, secret] of [
        [confidentialReportId, confidentialSecret],
        [internalReportId, internalSecret],
      ] as const) {
        const section = await pool.query(
          `SELECT id FROM report_builder_sections WHERE report_id = $1 ORDER BY order_index ASC LIMIT 1`,
          [reportId]
        );
        expect(section.rows[0]?.id).toBeTruthy();
        await pool.query(
          `UPDATE report_builder_sections SET generated_content = $1 WHERE id = $2`,
          [secret, section.rows[0].id]
        );
      }

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

      const confResponse = await generate(confidentialReportId);
      expect(confResponse.status).toBe(200);
      const confDocId = `generated-report-${confidentialReportId}`;
      expect(await waitForDocument(confDocId)).toMatchObject({
        scope: 'user',
        owner_id: ownerId,
        organization_id: organizationId,
      });
      const confGlobalCount = await pool.query(
        'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
        [confDocId]
      );
      expect(confGlobalCount.rows[0]?.count).toBe(0);

      const intResponse = await generate(internalReportId);
      expect(intResponse.status).toBe(200);
      const intDocId = `generated-report-${internalReportId}`;
      expect(await waitForDocument(intDocId)).toMatchObject({
        scope: 'organization',
        owner_id: ownerId,
        organization_id: organizationId,
      });

      const { searchKnowledgeBase } = await import('../../services/ai/tools/searchKnowledgeBase.js');

      // "Inny czlonek organizacji" — wyszukanie w kontekscie INNEGO userId niz
      // wlasciciel raportu, w tej samej organizacji.
      const foundConfidential = await searchKnowledgeBase(
        { query: confidentialSecret, maxResults: 20 },
        { organizationId, userId: otherMemberId }
      );
      expect(
        foundConfidential.results.some((row) => row.content.includes(confidentialSecret))
      ).toBe(false);

      // Kontrola pozytywna: wyszukiwarka dziala i widzi tresc organizacyjna —
      // brak wyniku dla confidential nie jest artefaktem zepsutego wyszukiwania.
      const foundInternal = await searchKnowledgeBase(
        { query: internalSecret, maxResults: 20 },
        { organizationId, userId: otherMemberId }
      );
      expect(foundInternal.results.some((row) => row.content.includes(internalSecret))).toBe(
        true
      );
    });
  }
);
