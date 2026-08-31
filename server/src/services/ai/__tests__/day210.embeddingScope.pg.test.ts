import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { vector } = vi.hoisted(() => ({
  vector: Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0)),
}));

vi.mock('../embeddingService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  class DeterministicEmbeddingService extends actual.EmbeddingService {
    async generateEmbedding(): Promise<number[]> {
      return vector;
    }
  }
  const deterministicSingleton = new DeterministicEmbeddingService();
  return {
    ...actual,
    EmbeddingService: DeterministicEmbeddingService,
    embeddingService: deterministicSingleton,
    default: {
      ...actual.default,
      EmbeddingService: DeterministicEmbeddingService,
      embeddingService: deterministicSingleton,
    },
  };
});

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import KnowledgeService from '../../KnowledgeService.js';
import RagService from '../../ragService.js';
import { EmbeddingService } from '../embeddingService.js';

// FIX-3 (dyżur 210): NIE `describe.skipIf` — to zwierało `assertRealPostgresTestEnvironment`
// (który sam sobie zakazuje SKIP-u, patrz jego nagłówek) przed jego pierwszym wywołaniem,
// więc bez zmiennych środowiskowych cała suite cicho pokazywała "4 skipped", exit 0 — w CI
// nieodróżnialne od PASS. `assertRealPostgresTestEnvironment()` w `beforeAll` poniżej jest
// TERAZ jedynym strażnikiem: brak `RUN_DB_TESTS=1`/`MOCK_DB=false`/`DATABASE_URL` prawidłowego
// realnego PostgreSQL rzuca `Error` z jego treścią, `beforeAll` pada, i vitest oznacza
// WSZYSTKIE testy tego `describe` jako FAILED (nigdy skipped) — porażka jest głośna i ma
// niezerowy exit code. `expect(process.env.DB_TYPE).toBe('postgres')` zaraz po nim jest drugą
// linią obrony na wypadek środowiska, które ma DATABASE_URL wskazujący na realny Postgres, ale
// literalnie inny `DB_TYPE` (dispatcher `EmbeddingService.search()` czyta `DB_TYPE`, nie samo
// istnienie połączenia).
describe('Day 210 embedding scope contract on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = 'day210-org-x';
  const userA = 'day210-user-a';
  const userB = 'day210-user-b';
  const privateDocId = 'day210-private-a';
  const organizationDocId = 'day210-organization';
  const marker = 'DAY210-PRIVATE-7f9c2e4a6b8d1f30527496ace013579b';
  const sharedMarker = 'DAY210-SHARED-9462bd870ae135cf5074186efab239dc';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    const deterministicEmbeddingService = new EmbeddingService();
    RagService.setDependencies({
      embeddingService: {
        generateEmbedding: async () => vector,
        search: async (_query: string, options: Record<string, unknown>) =>
          (deterministicEmbeddingService as any).searchPg(vector, options),
      } as any,
    });

    // Fresh migrations at marker 15c7a68b9d omit this column even though the
    // production writer names it. Keep the Day 210 fixture executable without
    // changing the out-of-scope baseline migration.
    await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()`);

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 210 organization']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email) VALUES
         ($1, $3, 'day210-a@example.invalid'),
         ($2, $3, 'day210-b@example.invalid')
       ON CONFLICT (id) DO NOTHING`,
      [userA, userB, organizationId]
    );

    await KnowledgeService.addDocument(
      'private-a.txt',
      '/day210/private-a.txt',
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

    await KnowledgeService.addDocument(
      'organization.txt',
      '/day210/organization.txt',
      organizationId,
      null,
      sharedMarker.length,
      'test',
      [],
      organizationDocId,
      userA,
      'organization'
    );
    await KnowledgeService.processDocument(organizationDocId, sharedMarker, organizationId);

    // KnowledgeService owns a private EmbeddingService instance. Normalize the
    // locally produced vectors without contacting an external provider.
    await pool.query(
      `UPDATE ai_knowledge_embeddings SET embedding = $1::vector
        WHERE document_id = ANY($2::text[])`,
      [`[${vector.join(',')}]`, [privateDocId, organizationDocId]]
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await pool.query(`DELETE FROM ai_knowledge_embeddings WHERE document_id = ANY($1::text[])`, [
      [privateDocId, organizationDocId],
    ]);
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id = ANY($1::text[])`, [
      [privateDocId, organizationDocId],
    ]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = ANY($1::text[])`, [
      [privateDocId, organizationDocId],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB]]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  });

  it('physically writes each Vault document to knowledge_chunks and ai_knowledge_embeddings', async () => {
    const counts = await pool.query(
      `SELECT d.id,
              (SELECT count(*)::int FROM knowledge_chunks c WHERE c.doc_id = d.id) AS knowledge_chunks,
              (SELECT count(*)::int FROM ai_knowledge_embeddings e WHERE e.document_id = d.id) AS embeddings
         FROM knowledge_docs d
        WHERE d.id = ANY($1::text[])
        ORDER BY d.id`,
      [[privateDocId, organizationDocId]]
    );
    expect(counts.rows).toHaveLength(2);
    for (const row of counts.rows) {
      expect(Number(row.knowledge_chunks), `${row.id} missing knowledge_chunks row`).toBeGreaterThan(0);
      expect(Number(row.embeddings), `${row.id} missing ai_knowledge_embeddings row`).toBeGreaterThan(0);
    }
  });

  it('does not return user A private Vault document to user B in the same organization', async () => {
    const result = await RagService.searchRelevantChunks(marker, {
      organizationId,
      userId: userB,
      limit: 10,
    } as any);
    const returned = result.map((row) => row.content).join('\n');
    expect(
      returned,
      `Private document owned by user A was returned to user B: ${returned}`
    ).not.toContain(marker);
  });

  it('returns an organization-scoped Vault document to another organization member', async () => {
    const result = await RagService.searchRelevantChunks(sharedMarker, {
      organizationId,
      userId: userB,
      limit: 10,
    } as any);
    expect(result.map((row) => row.content).join('\n')).toContain(sharedMarker);
  });

  it('returns user A own private Vault document to user A', async () => {
    const result = await RagService.searchRelevantChunks(marker, {
      organizationId,
      userId: userA,
      limit: 10,
    } as any);
    expect(result.map((row) => row.content).join('\n')).toContain(marker);
  });
});
