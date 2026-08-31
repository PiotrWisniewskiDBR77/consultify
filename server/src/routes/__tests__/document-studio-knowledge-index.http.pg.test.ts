/**
 * @vitest-environment node
 *
 * FIX-209 punkt 3 — dowod HTTP end-to-end dla indeksacji dokumentow do bazy
 * wiedzy AI (dyzur 209 / 17-J).
 *
 * Odbior adwersaryjny (docs/program/funkcje/ODBIOR_209.md) potwierdzil, ze
 * `indexDocumentArtifactForKnowledge` dziala i jest bezpieczny — ale
 * WYLACZNIE przez bezposrednie wywolanie z testu jednostkowego. Nikt nie
 * dowiodl, ze prawdziwe zadanie HTTP przez prawdziwa trase produkcyjna
 * (`POST /api/document-studio/generate`, real `verifyToken`, real JWT,
 * real Postgres) faktycznie konczy sie wpisem w indeksie z poprawnym
 * zasiegiem. Ten plik zamyka dokladnie ta luke.
 *
 * Wzor: `server/src/method-core/__tests__/rolesAndApprovals.http.pg.test.ts`
 * (montuje REALNY router bezposrednio, podpisuje REALNY JWT `config.JWT_SECRET`,
 * seeduje `users`/`organizations`, real Postgres — ten sam wzorzec uznany w
 * tym repo za dowod HTTP e2e, nie za skrot).
 *
 * Flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` MUSI byc ustawiona `true` w
 * srodowisku URUCHOMIENIA tego pliku (nigdy w kodzie produkcyjnym — domyslnie
 * zostaje OFF, patrz FeatureFlags.ts:238). `isArtifactKnowledgeIndexEnabled()`
 * czyta `process.env` dynamicznie przy kazdym wywolaniu, wiec wystarczy
 * ustawic zmienna przed odpaleniem vitest.
 *
 * Run (z korzenia worktree):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true \
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:6301/consultinity" \
 *   npx vitest run server/src/routes/__tests__/document-studio-knowledge-index.http.pg.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmbeddingService } from '../../services/ai/embeddingService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
const FLAG_ON = process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX === 'true';

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB || !FLAG_ON)(
  'FIX-209.3 — document-studio /generate → knowledge index, real HTTP (real PostgreSQL)',
  () => {
    let app: Express;
    let pool: import('pg').Pool;

    const SUFFIX = randomUUID().slice(0, 8);
    const ORG = `org-fix209-${SUFFIX}`;
    const OWNER = `user-fix209-owner-${SUFFIX}`;
    let ownerToken = '';

    beforeAll(async () => {
      if (!REAL_DB) {
        throw new Error(
          'Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.'
        );
      }
      if (!FLAG_ON) {
        throw new Error('Requires ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true for this proof run.');
      }

      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: CONNECTION_STRING });

      await pool.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [ORG, 'FIX-209 knowledge index HTTP proof org']
      );
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [OWNER, ORG, `${OWNER}@example.test`, 'user']
      );

      const { default: config } = await import('../../config/Config.js');
      ownerToken = jwt.sign({ id: OWNER, organizationId: ORG, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });

      // Mount the REAL router directly (same convention as
      // rolesAndApprovals.http.pg.test.ts) — document-studio.routes.ts wires
      // its own `router.use(verifyToken); router.use(requireOrgAccess());`
      // internally, so this exercises the real auth + real route handler +
      // real materializeDocumentArtifact + real knowledge-index hook.
      const { default: documentStudioRoutes } = await import('../document-studio.routes.js');
      app = express();
      app.use(express.json());
      app.use('/api/document-studio', documentStudioRoutes);
    });

    // ★ FIX-209 lesson (see artifactKnowledgeIndexer.pg.test.ts for the full
    // writeup) — `tests/setup.ts`'s GLOBAL `beforeEach(() => vi.clearAllMocks())`
    // strips a `vi.spyOn(...).mockResolvedValue(...)` installed in a local
    // `beforeAll`, because it runs AFTER that `beforeAll` but BEFORE this
    // file's own `it()`. Installing the spy in a LOCAL `beforeEach` instead
    // works because file-local hooks run after the global ones in the same
    // phase, so it is re-armed right before the test body executes. Without
    // this, `generateEmbedding` silently falls through to the REAL
    // implementation, which (no OpenAI key in tests) hits the global `fetch`
    // mock and returns `[]` without throwing — `KnowledgeService.processDocument`
    // then skips the global embedding write entirely (`embedding.length > 0`
    // guard), which is exactly the false negative this whole file exists to
    // rule out.
    beforeEach(() => {
      vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(
        Array.from({ length: 1536 }, () => 0.01)
      );
    });

    afterAll(async () => {
      if (!pool) return;
      await pool.query(`DELETE FROM ai_knowledge_embeddings WHERE organization_id = $1`, [ORG]);
      await pool.query(
        `DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id = $1)`,
        [ORG]
      );
      await pool.query(`DELETE FROM knowledge_docs WHERE organization_id = $1`, [ORG]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [OWNER]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
      await pool.end();
    });

    it('real HTTP POST /generate materializes a document AND indexes it into the global knowledge search with organization scope', async () => {
      const secretMarker = `FIX209_HTTP_E2E_SEARCHABLE_${SUFFIX}`;

      const res = await request(app)
        .post('/api/document-studio/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          intake: {
            title: 'FIX-209 HTTP e2e proof document',
            description: `Internal proof document. Marker: ${secretMarker}`,
            documentType: 'executive_memo',
            confidentiality: 'internal',
          },
          useLlm: false,
        });

      expect(res.status).toBe(200);
      expect(res.body?.artifactId).toBeTruthy();
      const artifactId = String(res.body.artifactId);
      const knowledgeDocumentId = `generated-document-${artifactId}`;

      // The hook is deliberately fire-and-forget (`void indexDocumentArtifactForKnowledge(...)`,
      // see documentStudioService.ts around the `isArtifactKnowledgeIndexEnabled()`
      // guard) so the artifact write itself is never blocked or slowed down by
      // indexing. Poll briefly for the background write to land instead of
      // assuming it is synchronous with the HTTP response.
      let docRow: { rows: any[] } = { rows: [] };
      for (let attempt = 0; attempt < 20; attempt++) {
        docRow = await pool.query(
          'SELECT scope, owner_id, organization_id FROM knowledge_docs WHERE id = $1',
          [knowledgeDocumentId]
        );
        if (docRow.rows[0]) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 1. The Vault metadata row exists with the expected owner/org and was
      //    classified 'organization' scope (confidentiality: 'internal').
      expect(docRow.rows[0]).toMatchObject({
        scope: 'organization',
        owner_id: OWNER,
        organization_id: ORG,
      });

      // 2. The content actually landed in the GLOBAL embedding index (this is
      //    the exact assertion that was flaky pre-FIX-209 in the unit test,
      //    and the exact promise — "the system feeds on its own work" — the
      //    odbior found unproven end-to-end). Same fire-and-forget race as
      //    above: poll instead of assuming completion by now.
      let globalCount: { rows: any[] } = { rows: [{ count: 0 }] };
      for (let attempt = 0; attempt < 20; attempt++) {
        globalCount = await pool.query(
          'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
          [knowledgeDocumentId]
        );
        if ((globalCount.rows[0]?.count ?? 0) > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(globalCount.rows[0]?.count).toBeGreaterThan(0);

      // 3. It is actually findable through the real search_knowledge_base
      //    tool surface, scoped to the SAME organization — the retrieval
      //    side of the "odżywia się pracą" promise, not just the write side.
      const { searchKnowledgeBase } =
        await import('../../services/ai/tools/searchKnowledgeBase.js');
      const found = await searchKnowledgeBase(
        { query: secretMarker, maxResults: 20 },
        { organizationId: ORG }
      );
      expect(found.results.some((row) => row.content.includes(secretMarker))).toBe(true);
    });
  }
);
