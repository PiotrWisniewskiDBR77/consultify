import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

if (process.env.DATABASE_URL) {
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'postgres';
}

const PREFIX = `day131_${Date.now()}`;
const ORG_A = `${PREFIX}_org_a`;
const ORG_B = `${PREFIX}_org_b`;
const IDS = {
  own: `${PREFIX}_own`,
  foreign: `${PREFIX}_foreign`,
  legacy: `${PREFIX}_legacy`,
  global: `${PREFIX}_global`,
};
const GOVERNED_DOCS = {
  allowed: `${PREFIX}_allowed_doc`,
  blocked: `${PREFIX}_blocked_doc`,
  confidential: `${PREFIX}_confidential_doc`,
  missing: `${PREFIX}_missing_doc`,
};

let client: Client;

const vector = `[${Array.from({ length: 1536 }, () => '0.01').join(',')}]`;

beforeAll(async () => {
  expect(process.env.DB_TYPE).toBe('postgres');
  await assertRealPostgresTestEnvironment();
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const [kind, id] of Object.entries(IDS)) {
    const organizationId = kind === 'own' ? ORG_A : kind === 'foreign' ? ORG_B : null;
    const sourceType = kind === 'global' ? 'methodology' : 'project';
    await client.query(
      `INSERT INTO ai_knowledge_embeddings
         (organization_id, document_id, chunk_index, chunk_text, embedding, metadata, source_type)
       VALUES ($1, $2, 0, $3, $4::vector, '{}'::jsonb, $5)`,
      [organizationId, id, `${kind} content`, vector, sourceType]
    );
  }
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, status, organization_id, scope, ai_visibility, sensitivity)
     VALUES
       ($1, 'allowed.txt', 'ready', $4, 'project', 'allowed', 'internal'),
       ($2, 'blocked.txt', 'ready', $4, 'project', 'blocked', 'internal'),
       ($3, 'confidential.txt', 'ready', $4, 'project', 'allowed', 'confidential')`,
    [GOVERNED_DOCS.allowed, GOVERNED_DOCS.blocked, GOVERNED_DOCS.confidential, ORG_A]
  );
  // Fragmenty istnieją dla KAŻDEGO z trzech dokumentów — jedyne, co ma je rozdzielić,
  // to strażnik poufności w ścieżce wiedzy organizacji.
  for (const [kind, docId] of Object.entries(GOVERNED_DOCS)) {
    if (kind === 'missing') continue;
    await client.query(
      `INSERT INTO knowledge_chunks (id, doc_id, document_id, content, chunk_index, metadata)
       VALUES ($1, $2, $2, $3, 0, '{}')`,
      [`${docId}_chunk`, docId, `TRESC-${kind.toUpperCase()}-131`]
    );
  }
});

afterAll(async () => {
  if (!client) return;
  await client.query(`DELETE FROM ai_knowledge_embeddings WHERE document_id = ANY($1::text[])`, [
    Object.values(IDS),
  ]);
  await client.query(`DELETE FROM knowledge_chunks WHERE doc_id = ANY($1::text[])`, [
    Object.values(GOVERNED_DOCS),
  ]);
  await client.query(`DELETE FROM knowledge_docs WHERE id = ANY($1::text[])`, [
    Object.values(GOVERNED_DOCS),
  ]);
  await client.end();
});

describe('Day 131 real-PG organization embedding boundary', () => {
  it('returns own and explicitly global chunks but not foreign or unowned legacy chunks', async () => {
    const { EmbeddingService } = await import('../../../server/src/services/ai/embeddingService.js');
    const service = new EmbeddingService();
    const rows = await (service as any).searchPg(Array.from({ length: 1536 }, () => 0.01), {
      organizationId: ORG_A,
      minSimilarity: 0.5,
      limit: 20,
    });
    const ids = rows.map((row: any) => String(row.document_id));

    expect(ids).toContain(IDS.own);
    expect(ids).toContain(IDS.global);
    expect(ids).not.toContain(IDS.foreign);
    expect(ids).not.toContain(IDS.legacy);
  });

  it('migration exposes the indexed first-class ownership column', async () => {
    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ai_knowledge_embeddings'`
    );
    expect(columns.rows.map((row) => row.column_name)).toContain('organization_id');
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'ai_knowledge_embeddings'`
    );
    expect(indexes.rows.map((row) => row.indexname)).toContain('idx_ai_embeddings_org_source');
  });

  it('governance reads knowledge_docs and denies blocked, confidential and unknown documents', async () => {
    const { filterDocumentsByVisibility } = await import(
      '../../../server/src/services/ai/documentGovernance.js'
    );
    const access = await filterDocumentsByVisibility(Object.values(GOVERNED_DOCS));

    expect(access.allowed).toEqual([GOVERNED_DOCS.allowed]);
    expect(access.blocked).toEqual(
      expect.arrayContaining([
        GOVERNED_DOCS.blocked,
        GOVERNED_DOCS.confidential,
        GOVERNED_DOCS.missing,
      ])
    );
  });

  it('org knowledge retrieval on a live database never returns blocked or confidential content', async () => {
    const { retrieveContext } = await import(
      '../../../server/src/services/organizationContext/ContextRetrievalService.js'
    );

    const result = await retrieveContext({
      organizationId: ORG_A,
      userId: `${PREFIX}_user`,
      workflow: 'ai_chat',
      workflowMode: 'org_context_research_mode',
      retrievalQuery: 'strategia',
      retrievalReason: 'ai_chat_organization_knowledge',
      selectedDocumentIds: [],
      perDocumentChunkLimit: 5,
      totalChunkLimit: 12,
    });

    const documentIds = result.documents.map((doc: any) => String(doc.id));
    expect(documentIds).toContain(GOVERNED_DOCS.allowed);
    expect(documentIds).not.toContain(GOVERNED_DOCS.blocked);
    expect(documentIds).not.toContain(GOVERNED_DOCS.confidential);

    const text = result.chunks.map((chunk: any) => String(chunk.content)).join('\n');
    expect(text).toContain('TRESC-ALLOWED-131');
    expect(text).not.toContain('TRESC-BLOCKED-131');
    expect(text).not.toContain('TRESC-CONFIDENTIAL-131');
  });
});
