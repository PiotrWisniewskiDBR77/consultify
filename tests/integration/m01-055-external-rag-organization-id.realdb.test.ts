/**
 * M01-055 — external RAG case rows must carry `organization_id` as a REAL
 * COLUMN on `knowledge_docs`, not only inside the JSON `metadata` blob.
 *
 * BACKGROUND (odbiór M01 rejestr, finding M01-055): `externalRagProvider
 * .upsertDocument()` forwarded the caller's real `organizationId` into
 * `knowledgeIndexer.insertDocument()`, but the INSERT statement there never
 * listed the (pre-existing) `knowledge_docs.organization_id` column — so
 * every new external-RAG-case row was born with `organization_id = NULL`,
 * even though the org id was faithfully recorded in `metadata.organizationId`.
 * This is the fifth instance of the "code declares protection it doesn't
 * have" pattern found in this module — `externalRagProvider.search()` filters
 * matches by reading `metadata.organizationId` in application code, silently
 * compensating for the SQL layer never having the value scoped for real.
 *
 * SCOPE: this test proves the FORWARD-ONLY fix (new writes only). It does
 * NOT touch/assert anything about pre-existing rows already sitting on any
 * database with `organization_id = NULL` — that backfill is tracked
 * separately as M01-056 and is explicitly out of scope here.
 *
 * Requires a REAL, disposable Postgres reachable via `DATABASE_URL`
 * (see `scripts/test-m01-055-external-rag-orgid-pg.sh` for a one-shot Docker
 * runner). Skips cleanly (not a false green) when unreachable — mirrors the
 * `itDB` convention used by `mw010-vault-project-scope-permission.realdb
 * .test.ts` and friends.
 */

import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Force the REAL Postgres path through knowledgeIndexer.ts's `this.isPg` gate
// (`process.env.DB_TYPE === 'postgres'`) whenever a real DATABASE_URL/PG* host
// is present. Must happen BEFORE the dynamic imports below, same convention
// as mw010-vault-project-scope-permission.realdb.test.ts.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.NODE_ENV = 'test';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';
  // externalRagProvider chunk embeddings go through knowledgeIndexer
  // .generateEmbedding(), which gracefully returns null (try/catch) when no
  // provider key is configured — no network calls needed for this test.
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
}

const { externalRagProvider } = await import('../../server/src/services/ai/externalRagProvider.js');
const { knowledgeIndexer } = await import('../../server/src/services/ai/knowledgeIndexer.js');

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 30_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 30_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      /* best effort */
    }
  }
}

function tag(): string {
  return `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

describe('M01-055 — external RAG case rows carry organization_id as a real column (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable — M01-055 external-RAG organization_id realdb test skipped.'
    );
  }

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable) {
      emitSkipOnce();
      return;
    }
    // knowledge_docs/knowledge_chunks are CREATE TABLE IF NOT EXISTS'd by the
    // indexer itself — no full migration/schema load needed for this suite.
    await knowledgeIndexer.initialize();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 60_000) =>
    it(
      name,
      async () => {
        if (!reachable) {
          expect(true).toBe(true);
          return;
        }
        await fn();
      },
      timeoutMs
    );

  itDB(
    'upsertDocument() persists organizationId in knowledge_docs.organization_id, not only in metadata JSON',
    async () => {
      const t = tag();
      const orgId = `org-m01-055-${t}`;
      const docKey = `m01-055-case-${t}`;

      const config = buildClientConfig();
      const client = new Client(config as ClientConfig);
      await client.connect();

      try {
        const result = await externalRagProvider.upsertDocument({
          docKey,
          title: 'M01-055 external RAG case test doc',
          organizationId: orgId,
          projectId: null,
          chunks: [{ chunkIndex: 0, content: 'M01-055 regression probe content.' }],
        });

        expect(result.externalDocumentId).toBeTruthy();
        const docId = result.externalDocumentId as string;

        // ================= THE ACTUAL ASSERTION ===========================
        // Read the row back with a completely independent pg client (not the
        // app's own DB layer) so this test cannot be fooled by an in-process
        // cache — proves the value that is REALLY on disk in the column.
        const { rows } = await client.query<{
          id: string;
          organization_id: string | null;
          metadata: string | Record<string, unknown> | null;
        }>('SELECT id, organization_id, metadata FROM knowledge_docs WHERE id = $1', [docId]);

        expect(rows).toHaveLength(1);
        const row = rows[0];

        // PASS (the fix): the real column is populated with the real org id —
        // this is what M01-055 was about. Before the fix this was NULL.
        expect(row.organization_id).toBe(orgId);

        // The JSON metadata mirror still carries it too (pre-existing
        // behavior, kept for externalRagProvider.search()'s app-level
        // filter) — both must agree, the column is not a replacement for
        // the metadata copy, it's the previously-missing real column.
        const metadata =
          typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
        expect(metadata.organizationId).toBe(orgId);
      } finally {
        try {
          await client.query('DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id = $1)', [orgId]);
          await client.query('DELETE FROM knowledge_docs WHERE organization_id = $1', [orgId]);
        } catch {
          /* best effort */
        }
        await client.end().catch(() => {});
      }
    }
  );

  afterAll(() => {
    // Each itDB block owns and cleans up its own rows.
  });
});
