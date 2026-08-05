import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * M01-006 (Chat citation panel) — FIX_REQUIRED round, real-Postgres proof.
 *
 * WHY THIS TEST EXISTS: the first version of this packet's ACL test
 * (`server/src/services/ai/__tests__/citationVerifier.aclCheckAccess.test.ts`)
 * mocks `dbAll` completely — it hands `checkAccess` a hand-authored row
 * `{id, organization_id:'org-OTHER'}` and asserts `'no_access'`. That test
 * passes REGARDLESS of which table name `checkAccess` actually queries,
 * because the mock never checks the SQL text or table name — it just
 * returns the row. It is therefore incapable of catching the real bug an
 * independent reviewer found on a live Postgres: `checkAccess`'s type→table
 * map sent `document`/`knowledge` citations (ordinary chat RAG citations) to
 * `knowledge_documents`, but the ONLY table a real chat RAG citation's
 * `sourceId` can ever resolve to is `knowledge_docs` — verified here:
 *   - `citationExtractor.ts` sets `sourceId = meta.documentId`.
 *   - `ragService.ts`'s `documentIds`-filtered search path sets
 *     `documentId: (r as any)?.doc_id`.
 *   - `knowledge_chunks.doc_id` has an actual FK to `knowledge_docs(id)`
 *     (see `PostgresDatabase.ts`'s inline bootstrap schema).
 * `knowledge_documents` is a DIFFERENT table (created by migration
 * `266_knowledge_rag.sql`) that only `coreDocsService.ts` ever writes to,
 * for `system_doc`/`core_doc` citations (a type no producer in this repo
 * currently emits).
 *
 * This test inserts REAL rows into the REAL `knowledge_docs` table on a
 * throwaway local Postgres (no `dbAll` mock anywhere in this file) and
 * calls `citationVerifier.verify()` unmocked. On the pre-fix table map this
 * suite's "no_access" assertion FAILS CLOSED THE WRONG WAY: the row is never
 * found in `knowledge_documents` (0 rows), so the citation is reported
 * `'broken'`, not `'no_access'` — proving the bug empirically rather than by
 * assertion. See this packet's return summary for the negative-control run
 * (table map reverted, this suite re-run, confirmed red, then restored).
 *
 * Requires a LOCAL DATABASE_URL with `tests/acceptance/schema.mjs` applied
 * (see `vitest.acceptance.config.ts`). Cleans up everything it inserts.
 */
const OTHER_ORG_ID = 'odbior--org-0002-other-m01-006';
const DOC_OWN_ID = 'odbior--doc-0001-own-m01-006';
const DOC_OTHER_ID = 'odbior--doc-0002-other-m01-006';
const DOC_MISSING_ID = 'odbior--doc-missing-m01-006';
const CORE_DOC_NULL_ORG_ID = 'odbior--coredoc-0001-null-org-m01-006';

let citationVerifier: typeof import('../../server/src/services/ai/citationVerifier.js').citationVerifier;

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM knowledge_docs WHERE id = ANY($1::text[])`, [
      [DOC_OWN_ID, DOC_OTHER_ID],
    ]);
    await client.query(`DELETE FROM knowledge_documents WHERE id = $1`, [CORE_DOC_NULL_ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [OTHER_ORG_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  await cleanup();

  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();

    // A SECOND organization, distinct from SEED.ORG_ID — needed so the
    // "belongs to a different org" scenario is a real FK-valid row, not a
    // dangling/forged organization_id.
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_ORG_ID, 'M01-006 Other Org (ACL real-DB proof)', now]
    );

    // Real `knowledge_docs` row owned by the CALLER's own org (SEED.ORG_ID).
    await client.query(
      `INSERT INTO knowledge_docs (id, filename, filepath, status, organization_id, created_at)
       VALUES ($1, $2, $3, 'indexed', $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [DOC_OWN_ID, 'own-doc.md', '/tmp/own-doc.md', SEED.ORG_ID, now]
    );

    // Real `knowledge_docs` row owned by the OTHER org — this is the row a
    // stale/forged/misrouted citation would point at.
    await client.query(
      `INSERT INTO knowledge_docs (id, filename, filepath, status, organization_id, created_at)
       VALUES ($1, $2, $3, 'indexed', $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [DOC_OTHER_ID, 'other-org-doc.md', '/tmp/other-org-doc.md', OTHER_ORG_ID, now]
    );

    // A real `knowledge_documents` row with NULL organization_id, mirroring
    // what `coreDocsService.ts#ingestSingle` inserts for a system-wide core
    // doc — proves the NULL-org semantics for system_doc/core_doc are
    // untouched by this fix. NOTE: this scratch DB's `knowledge_documents`
    // (built from `server/migrations/266_knowledge_rag.sql` + later ALTERs
    // via `schema.mjs`) does NOT have `version`/`chunk_count` columns that
    // `coreDocsService.ts`'s own INSERT references — a pre-existing schema
    // drift unrelated to this fix (out of scope per the task's "don't touch
    // coreDocsService.ts / don't chase data backfill" instruction). This
    // insert uses only the columns confirmed present on this real schema.
    await client.query(
      `INSERT INTO knowledge_documents (id, title, file_path, file_hash, scope, organization_id, processing_status, created_at, updated_at, document_type)
       VALUES ($1, 'Core doc (null org)', 'docs/core-doc.md', 'hash-m01-006', 'system', NULL, 'completed', $2, $2, 'markdown')
       ON CONFLICT (id) DO NOTHING`,
      [CORE_DOC_NULL_ORG_ID, now]
    );
  } finally {
    await client.end();
  }

  citationVerifier = (await import('../../server/src/services/ai/citationVerifier.js'))
    .citationVerifier;
});

afterAll(cleanup);

function makeCitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cit_1',
    index: 1,
    text: '[1]',
    sourceType: 'document' as const,
    confidence: 0.5,
    ...overrides,
  };
}

describe('M01-006 real-DB — citationVerifier table map (document/knowledge -> knowledge_docs)', () => {
  it('reports verified for a real knowledge_docs row owned by the caller org', async () => {
    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: DOC_OWN_ID })],
      'conv-m01-006',
      'msg-m01-006',
      SEED.ORG_ID
    );
    expect(report.results[0].status).toBe('verified');
    expect(report.results[0].sourceExists).toBe(true);
  });

  it('reports no_access (not broken/verified) for a real knowledge_docs row owned by a DIFFERENT org', async () => {
    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: DOC_OTHER_ID })],
      'conv-m01-006',
      'msg-m01-006',
      SEED.ORG_ID
    );
    // This is the assertion that actually depends on querying the RIGHT
    // table: on the pre-fix map (document -> knowledge_documents), this row
    // does not exist there at all, so the result would be 'broken', not
    // 'no_access'. See the M01-006 negative-control run in the return
    // summary for the empirical before/after of this exact assertion.
    expect(report.results[0].status).toBe('no_access');
    expect(report.results[0].sourceExists).toBe(true);
  });

  it('sourceType "knowledge" resolves against the same real knowledge_docs table', async () => {
    const report = await citationVerifier.verify(
      [makeCitation({ sourceType: 'knowledge', sourceId: DOC_OTHER_ID })],
      'conv-m01-006',
      'msg-m01-006',
      SEED.ORG_ID
    );
    expect(report.results[0].status).toBe('no_access');
  });

  it('reports broken for a sourceId that genuinely does not exist in knowledge_docs', async () => {
    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: DOC_MISSING_ID })],
      'conv-m01-006',
      'msg-m01-006',
      SEED.ORG_ID
    );
    expect(report.results[0].status).toBe('broken');
    expect(report.results[0].sourceExists).toBe(false);
  });

  it('regression guard: system_doc with a real NULL-organization_id knowledge_documents row stays verified (not no_access)', async () => {
    // Confirms this fix did NOT touch the documented NULL = system-wide
    // semantics for system_doc/core_doc (coreDocsService.ts always inserts
    // organization_id = NULL).
    const report = await citationVerifier.verify(
      [
        makeCitation({
          sourceType: 'system_doc',
          sourceId: CORE_DOC_NULL_ORG_ID,
        }),
      ],
      'conv-m01-006',
      'msg-m01-006',
      SEED.ORG_ID
    );
    expect(report.results[0].status).toBe('verified');
    expect(report.results[0].sourceExists).toBe(true);
  });
});
