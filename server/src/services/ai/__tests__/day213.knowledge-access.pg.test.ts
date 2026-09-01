import { randomUUID } from 'node:crypto';

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
  return { ...actual, EmbeddingService: DeterministicEmbeddingService };
});

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import RagService from '../../ragService.js';
import { EmbeddingService } from '../embeddingService.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 213 unified knowledge document access filter on real PostgreSQL', NO_RETRY, () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomUUID();
  const organizationId = `day213-access-org-${suffix}`;
  const projectId = `day213-project-${suffix}`;
  const otherProjectId = `day213-other-project-${suffix}`;
  const projectDocId = `day213-project-doc-${suffix}`;
  const blockedDocId = `day213-blocked-doc-${suffix}`;
  const confidentialDocId = `day213-confidential-doc-${suffix}`;
  const projectMarker = `DAY213_PROJECT_${suffix}`;
  const blockedMarker = `DAY213_BLOCKED_${suffix}`;
  const confidentialMarker = `DAY213_CONFIDENTIAL_${suffix}`;
  let embeddings: EmbeddingService;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    embeddings = new EmbeddingService();
    RagService.setDependencies({
      embeddingService: {
        generateEmbedding: async () => vector,
        search: (query: string, options: any) => embeddings.search(query, options),
      } as any,
    });
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
      organizationId,
      'Day 213 access',
    ]);
    await pool.query(
      `INSERT INTO knowledge_docs
         (id, filename, filepath, status, organization_id, scope, project_id, ai_visibility, sensitivity)
       VALUES
         ($1, 'project.txt', '/day213/project', 'indexed', $4, 'project', $5, 'allowed', 'internal'),
         ($2, 'blocked.txt', '/day213/blocked', 'indexed', $4, 'organization', NULL, 'blocked', 'internal'),
         ($3, 'confidential.txt', '/day213/confidential', 'indexed', $4, 'organization', NULL, 'allowed', 'confidential')`,
      [projectDocId, blockedDocId, confidentialDocId, organizationId, projectId]
    );
    const docs = [
      [projectDocId, projectMarker],
      [blockedDocId, blockedMarker],
      [confidentialDocId, confidentialMarker],
    ];
    for (const [index, [docId, marker]] of docs.entries()) {
      await pool.query(
        `INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, 0, $4)`,
        [`${docId}-chunk`, docId, marker, JSON.stringify(vector)]
      );
      await pool.query(
        `INSERT INTO ai_knowledge_embeddings
           (id, organization_id, document_id, chunk_index, chunk_text, embedding, metadata, source_type)
         VALUES ($1, $2, $3, 0, $4, $5::vector, '{}', 'test')`,
        [String(Date.now() * 10 + index), organizationId, docId, marker, `[${vector.join(',')}]`]
      );
    }
  });

  afterAll(async () => {
    const ids = [projectDocId, blockedDocId, confidentialDocId];
    await pool.query('DELETE FROM ai_knowledge_embeddings WHERE document_id = ANY($1::text[])', [
      ids,
    ]);
    await pool.query('DELETE FROM knowledge_chunks WHERE doc_id = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM knowledge_docs WHERE id = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('embedding dispatcher excludes project documents without an allowed-project list', async () => {
    const rows = await embeddings.search(projectMarker, { organizationId, limit: 10 });
    expect(rows.map((row) => row.content).join('\n')).not.toContain(projectMarker);
  });

  it('embedding dispatcher includes only a project present in the allowed-project list', async () => {
    const denied = await embeddings.search(projectMarker, {
      organizationId,
      projectIds: [otherProjectId],
      limit: 10,
    });
    const allowed = await embeddings.search(projectMarker, {
      organizationId,
      projectIds: [projectId],
      limit: 10,
    });
    expect(denied.map((row) => row.content).join('\n')).not.toContain(projectMarker);
    expect(allowed.map((row) => row.content).join('\n')).toContain(projectMarker);
  });

  it('rag hybrid path enforces the same project allow-list', async () => {
    const denied = await RagService.searchRelevantChunks(projectMarker, {
      organizationId,
      documentIds: [projectDocId],
      projectIds: [otherProjectId],
      limit: 10,
    });
    const allowed = await RagService.searchRelevantChunks(projectMarker, {
      organizationId,
      documentIds: [projectDocId],
      projectIds: [projectId],
      limit: 10,
    });
    expect(denied.map((row) => row.content).join('\n')).not.toContain(projectMarker);
    expect(allowed.map((row) => row.content).join('\n')).toContain(projectMarker);
  });

  it.each([
    ['blocked visibility', blockedMarker, blockedDocId],
    ['confidential sensitivity', confidentialMarker, confidentialDocId],
  ])('embedding and rag paths both exclude %s', async (_label, marker, docId) => {
    const embeddingRows = await embeddings.search(marker, { organizationId, limit: 10 });
    const ragRows = await RagService.searchRelevantChunks(marker, {
      organizationId,
      documentIds: [docId],
      limit: 10,
    });
    expect(embeddingRows.map((row) => row.content).join('\n')).not.toContain(marker);
    expect(ragRows.map((row) => row.content).join('\n')).not.toContain(marker);
  });
});
