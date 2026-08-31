import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { EmbeddingService, embeddingService } from '../../ai/embeddingService.js';
import { searchKnowledgeBase } from '../../ai/tools/searchKnowledgeBase.js';
import {
  deckArtifactToKnowledgeMarkdown,
  indexDeckArtifactForKnowledge,
  indexDocumentArtifactForKnowledge,
  inferKnowledgeScope,
} from '../artifactKnowledgeIndexer.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 209 R1 artifact knowledge index (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const organizationId = `day209_org_${suffix}`;
  const ownerA = `day209_owner_a_${suffix}`;
  const ownerB = `day209_owner_b_${suffix}`;
  const internalArtifactId = `day209_internal_${suffix}`;
  const privateArtifactId = `day209_private_${suffix}`;
  const privateDeckId = `day209_private_deck_${suffix}`;
  const internalDocumentId = `generated-document-${internalArtifactId}`;
  const privateDocumentId = `generated-document-${privateArtifactId}`;
  const privateDeckDocumentId = `generated-deck-${privateDeckId}`;
  const internalSecret = `DAY209_INTERNAL_SEARCHABLE_CONTENT_FOR_REAL_POSTGRES_${suffix}`;
  const privateSecret = `DAY209_PRIVATE_CONTENT_MUST_NEVER_LEAK_TO_ANOTHER_USER_${suffix}`;
  const privateDeckSecret = `DAY209_PRIVATE_DECK_MUST_NEVER_LEAK_TO_ANOTHER_USER_${suffix}`;
  let pool: Pool;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    pool = new Pool({ connectionString: DATABASE_URL });

    // No provider call: deterministic vectors still exercise the real
    // pgvector INSERT and similarity SQL used by the default search path.
    vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(
      Array.from({ length: 1536 }, () => 0.01)
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (!pool) return;
    await pool.query('DELETE FROM ai_knowledge_embeddings WHERE document_id = ANY($1)', [
      [internalDocumentId, privateDocumentId, privateDeckDocumentId],
    ]);
    await pool.query('DELETE FROM knowledge_chunks WHERE doc_id = ANY($1)', [
      [internalDocumentId, privateDocumentId, privateDeckDocumentId],
    ]);
    await pool.query('DELETE FROM knowledge_docs WHERE id = ANY($1)', [
      [internalDocumentId, privateDocumentId, privateDeckDocumentId],
    ]);
    await pool.end();
  });

  it('uses the effective PostgreSQL test environment and maps confidentiality fail-closed', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(inferKnowledgeScope('internal')).toBe('organization');
    expect(inferKnowledgeScope('confidential')).toBe('user');
    expect(inferKnowledgeScope('restricted')).toBe('user');
  });

  it('indexes an internal document into both Vault chunks and the default embedding search', async () => {
    const indexed = await indexDocumentArtifactForKnowledge({
      artifactId: internalArtifactId,
      organizationId,
      ownerId: ownerA,
      title: 'Internal day 209 document',
      contentMd: internalSecret,
      confidentiality: 'internal',
    });

    expect(indexed.scope).toBe('organization');
    const doc = await pool.query(
      'SELECT scope, owner_id, organization_id FROM knowledge_docs WHERE id = $1',
      [internalDocumentId]
    );
    expect(doc.rows[0]).toMatchObject({
      scope: 'organization',
      owner_id: ownerA,
      organization_id: organizationId,
    });
    const globalCount = await pool.query(
      'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
      [internalDocumentId]
    );
    expect(globalCount.rows[0]?.count).toBeGreaterThan(0);

    const found = await embeddingService.search(internalSecret, {
      organizationId,
      limit: 20,
      minSimilarity: 0,
    });
    expect(found.some((row) => row.document_id === internalDocumentId)).toBe(true);
  });

  it('keeps a confidential document in scoped Vault tables and out of the global embedding index', async () => {
    const indexed = await indexDocumentArtifactForKnowledge({
      artifactId: privateArtifactId,
      organizationId,
      ownerId: ownerA,
      title: 'Private day 209 document',
      contentMd: privateSecret,
      confidentiality: 'confidential',
    });

    expect(indexed.scope).toBe('user');
    const doc = await pool.query(
      'SELECT scope, owner_id, organization_id FROM knowledge_docs WHERE id = $1',
      [privateDocumentId]
    );
    expect(doc.rows[0]).toMatchObject({
      scope: 'user',
      owner_id: ownerA,
      organization_id: organizationId,
    });
    const chunkCount = await pool.query(
      'SELECT count(*)::int AS count FROM knowledge_chunks WHERE doc_id = $1',
      [privateDocumentId]
    );
    expect(chunkCount.rows[0]?.count).toBeGreaterThan(0);
    const globalCount = await pool.query(
      'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
      [privateDocumentId]
    );
    expect(globalCount.rows[0]?.count).toBe(0);
  });

  it('does not return user A private content to user B through search_knowledge_base', async () => {
    expect(ownerB).not.toBe(ownerA);
    const result = await searchKnowledgeBase(
      { query: privateSecret, maxResults: 20 },
      { organizationId }
    );

    expect(result.results.some((row) => row.content.includes(privateSecret))).toBe(false);
  });

  it('extracts deck titles and block content from canonical deck_json', () => {
    const markdown = deckArtifactToKnowledgeMarkdown({
      title: 'Day 209 deck',
      cards: [
        {
          title: 'Decision',
          key_message: 'Approve the guarded index',
          blocks: [{ content: { text: privateDeckSecret } }],
        },
      ],
    });

    expect(markdown).toContain('Day 209 deck');
    expect(markdown).toContain('Decision');
    expect(markdown).toContain(privateDeckSecret);
  });

  it('keeps a confidential deck out of the global embedding index', async () => {
    const indexed = await indexDeckArtifactForKnowledge({
      artifactId: privateDeckId,
      organizationId,
      ownerId: ownerA,
      title: 'Private day 209 deck',
      contentMd: privateDeckSecret,
      confidentiality: 'confidential',
    });

    expect(indexed.scope).toBe('user');
    const doc = await pool.query('SELECT scope, owner_id FROM knowledge_docs WHERE id = $1', [
      privateDeckDocumentId,
    ]);
    expect(doc.rows[0]).toMatchObject({ scope: 'user', owner_id: ownerA });
    const globalCount = await pool.query(
      'SELECT count(*)::int AS count FROM ai_knowledge_embeddings WHERE document_id = $1',
      [privateDeckDocumentId]
    );
    expect(globalCount.rows[0]?.count).toBe(0);
    const searchAsOtherUser = await searchKnowledgeBase(
      { query: privateDeckSecret, maxResults: 20 },
      { organizationId }
    );
    expect(searchAsOtherUser.results.some((row) => row.content.includes(privateDeckSecret))).toBe(
      false
    );
  });
});
