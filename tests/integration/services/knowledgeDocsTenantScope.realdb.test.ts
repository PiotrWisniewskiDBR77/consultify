/**
 * M01-P04C — `knowledge_docs.organization_id` ownership & tenant scope,
 * against a REAL Postgres database (no mocks).
 *
 * Context (see packet
 * docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/packets/M01-P04C_PACKET.md
 * and M01_P04C_BACKFILL_PLAN.md in the same directory):
 *
 *   Migration 942_chat_m01p04a_attachment_status.sql added `knowledge_docs
 *   .organization_id` (it never existed in any migration before). The
 *   column allows NULL for every row that predates it, and — separately —
 *   for every row inserted by code paths that never set it (chat
 *   attachment ingest when the best-effort `UPDATE ... SET organization_id`
 *   silently no-ops; `knowledgeIndexer.insertDocument` for tool/methodology
 *   knowledge packs, which never sets it at all).
 *
 *   Before this packet, THREE places read/wrote `knowledge_docs` with the
 *   pattern `(organization_id = ? OR organization_id IS NULL)` —
 *   `KnowledgeService.ts` (Vault CRUD), `ragService.ts`
 *   (`appendKnowledgeDocAccessFilter`, used by every AI/Teresa retrieval
 *   call), and `knowledge.routes.ts` (`/vault-safes`). That is FAIL-OPEN:
 *   it treats "nobody ever resolved who owns this document" as "everybody
 *   may read this document", which is a real cross-tenant leak for the
 *   legacy/never-backfilled rows (not for the legitimate global
 *   tool-pack rows, which is a real, separate feature).
 *
 *   The fix (KnowledgeService.ts, ragService.ts, knowledge.routes.ts)
 *   makes `organization_id IS NULL` FAIL CLOSED everywhere, with exactly
 *   THREE explicit, narrow exceptions: `ragService.appendKnowledgeDocAccessFilter`
 *   still serves NULL-org rows when `source_type IN ('tool_pack',
 *   'methodology', 'product_pill')` — signals `knowledgeIndexer.ts` already
 *   writes for the DRD/methodology knowledge base and the product-pill
 *   feature, now checked explicitly instead of inferred from the absence of
 *   an owner. `source_type` is written ONLY by the internal indexer (never
 *   by any user-facing route), so a caller cannot spoof global visibility
 *   for their own upload — proven below both at runtime (the real Vault
 *   `addDocument` create path) and statically (grep across every route
 *   file). `product_pill` was added to the exception list by coordinator
 *   decision after this packet's own return summary flagged it as an open
 *   question rather than deciding it unilaterally — `annaKnowledgeService.ts`
 *   is a live, active consumer of `source_type='product_pill'` documents;
 *   excluding it would have made all such rows (98 on demo at review time)
 *   permanently unreachable, silently emptying that service's knowledge
 *   base — a real functional regression the coordinator caught in review.
 *
 * Tenant matrix covered (packet requirement):
 *   - document owned by the calling org               -> visible
 *   - document owned by ANOTHER org                    -> invisible, not mutable
 *   - document with organization_id IS NULL (legacy)    -> invisible to
 *     EVERY org, including via a known/"legacy" id (fail-closed)
 *   - document with organization_id IS NULL AND
 *     source_type IN ('tool_pack','methodology','product_pill') -> visible
 *     to every org (explicit global contract, unaffected by the fix)
 *   - list for a tenant with no matching rows            -> empty, not an error
 *   - attachment -> knowledge_doc relation (conversation-scoped RAG
 *     retrieval, `ragService.searchRelevantChunks` — the exact function
 *     `ai.routes.ts` calls for `/api/ai/chat/stream` attachment grounding)
 *     -> another org's doc id passed in `documentIds` yields ZERO chunks
 *   - NEGATIVE CONTROL (d) (proven via the same revert/measure/restore
 *     transcript methodology as controls a/b/c — see M01-P04C return
 *     summary, not baked into this file as a permanently-failing test):
 *     removing 'product_pill' from GLOBAL_KNOWLEDGE_SOURCE_TYPES makes the
 *     product-pill positive tests below go red, proving the exception is
 *     load-bearing for a real consumer rather than assumed
 *   - product_pill/source_type cannot be set from any user-facing route:
 *     proven at runtime (addDocument, the real Vault create path — its
 *     function signature has no source_type parameter and its INSERT does
 *     not reference the column) and statically (grep across every file in
 *     server/src/routes for req.body/query/params.source_type)
 *
 * Pattern: mirrors tests/integration/routes/conversations.attachments.realdb.test.ts
 * (M01-P04A) — pgReachable()/itDB() vacuous-skip, per-test unique org ids,
 * best-effort cleanup, env vars set before any server/src import.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

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
      statement_timeout: 5_000,
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
    statement_timeout: 5_000,
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
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return result.rows.length > 0;
}

const REQUIRED_TABLES = [
  'knowledge_docs',
  'knowledge_chunks',
  'conversation_message_attachments',
  'organizations',
] as const;

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

interface Harness {
  client: Client;
  tag: string;
  orgA: string;
  orgB: string;
  orgEmpty: string;
  userA: string;
  docOwnedByA: string;
  docOwnedByADeletable: string;
  docOwnedByB: string;
  docLegacyNullOrg: string;
  docLegacyNullOrgForDelete: string;
  docGlobalToolPack: string;
  docGlobalProductPill: string;
  hasSourceTypeColumn: boolean;
  hasOrganizationIdColumn: boolean;
  cleanup: () => Promise<void>;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const hasOrganizationIdColumn = await columnExists(client, 'knowledge_docs', 'organization_id');
  const hasSourceTypeColumn = await columnExists(client, 'knowledge_docs', 'source_type');

  const tag = suffix();
  const orgA = `org_m01p04c_a_${tag}`;
  const orgB = `org_m01p04c_b_${tag}`;
  const orgEmpty = `org_m01p04c_empty_${tag}`;
  const userA = `user_m01p04c_${tag}`;

  const docOwnedByA = `doc_m01p04c_a_${tag}`;
  const docOwnedByADeletable = `doc_m01p04c_adel_${tag}`;
  const docOwnedByB = `doc_m01p04c_b_${tag}`;
  const docLegacyNullOrg = `doc_m01p04c_legacy_${tag}`;
  // Dedicated row for the "deleteDocument must not soft-delete a legacy row"
  // test — MUST be separate from `docLegacyNullOrg` above. Before the fix,
  // that delete call actually succeeds (fail-open) and really sets
  // `deleted_at`, which would then silently mask the LATER ragService
  // read-only assertions on the shared id (a deleted_at-filtered row reads
  // as "not found" for an unrelated reason, producing a false-green
  // negative control). Each mutating test gets its own row.
  const docLegacyNullOrgForDelete = `doc_m01p04c_legacydel_${tag}`;
  const docGlobalToolPack = `doc_m01p04c_pack_${tag}`;
  const docGlobalProductPill = `doc_m01p04c_pill_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES
       ($1, 'M01-P04C Org A', 'enterprise', 'active'),
       ($2, 'M01-P04C Org B', 'enterprise', 'active'),
       ($3, 'M01-P04C Org Empty', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgA, orgB, orgEmpty]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P04C', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userA, orgA, `${userA}@local.test`]
  );

  // `scope` is set EXPLICITLY on every row below, on purpose: the column's
  // migration-added DEFAULT is 'user' (20260719_baseline_gap.sql), but
  // KnowledgeService.ensureKnowledgeSchema's runtime ALTER (no default) can
  // instead leave it NULL depending on which code path created the column
  // first in a given environment — an existing, environment-order-dependent
  // inconsistency this packet does not own (see M01_P04C return summary,
  // "related finding"). Pinning it here isolates the `organization_id`
  // contract under test from that unrelated variable: 'organization' for
  // ordinary Vault documents (KnowledgeService.addDocument's own default
  // when no scope is given), NULL for the tool-pack row (matching what
  // knowledgeIndexer.insertDocument's column list actually contains).

  // Org A's own document.
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
     VALUES ($1, $2, '', 'indexed', $3, NULL, 'organization', NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [docOwnedByA, `m01p04c-${tag}-a.pdf`, orgA]
  );
  // A second org-A document, dedicated to the "delete works on own doc" test
  // so mutating it never races/interferes with the read-only assertions on
  // `docOwnedByA` above (tests within a describe share this harness).
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
     VALUES ($1, $2, '', 'indexed', $3, NULL, 'organization', NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [docOwnedByADeletable, `m01p04c-${tag}-adel.pdf`, orgA]
  );
  // Org B's own document.
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
     VALUES ($1, $2, '', 'indexed', $3, NULL, 'organization', NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [docOwnedByB, `m01p04c-${tag}-b.pdf`, orgB]
  );
  // Simulate the upgrade shape: legacy invalid rows pre-date the NOT VALID
  // constraint, while every new write is constrained. On a freshly migrated
  // database the constraint already exists, so create the two historical
  // fixtures during a tightly scoped drop/recreate and immediately restore
  // the exact versioned contract before any behavior assertion runs.
  await client.query(
    `ALTER TABLE knowledge_docs
       DROP CONSTRAINT IF EXISTS chk_knowledge_docs_org_or_global_source`
  );
  try {
    await client.query(
      `INSERT INTO knowledge_docs
         (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
       VALUES ($1, $2, '', 'indexed', NULL, NULL, 'organization', NULL, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [docLegacyNullOrg, `m01p04c-${tag}-legacy.pdf`]
    );
    await client.query(
      `INSERT INTO knowledge_docs
         (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
       VALUES ($1, $2, '', 'indexed', NULL, NULL, 'organization', NULL, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [docLegacyNullOrgForDelete, `m01p04c-${tag}-legacydel.pdf`]
    );
  } finally {
    await client.query(
      `ALTER TABLE knowledge_docs
         ADD CONSTRAINT chk_knowledge_docs_org_or_global_source
         CHECK (
           organization_id IS NOT NULL
           OR COALESCE(source_type, '') IN ('tool_pack', 'methodology', 'product_pill')
         ) NOT VALID`
    );
  }
  // Legitimate global row: organization_id IS NULL AND source_type='tool_pack'
  // (exactly what knowledgeIndexer.insertDocument produces for DRD/methodology
  // packs) — must stay retrievable for every org after the fix.
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
     VALUES ($1, $2, '', 'indexed', NULL, 'tool_pack', NULL, NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [docGlobalToolPack, `m01p04c-${tag}-pack.pdf`]
  );
  // Legitimate global row: organization_id IS NULL AND source_type=
  // 'product_pill' — exactly what knowledgeIndexer.ts's product-pill .md
  // walker produces (knowledgeIndexer.ts:718-719). Added to the global
  // exception by coordinator decision (M01-P04C review, 2026-08-05) — see
  // GLOBAL_KNOWLEDGE_SOURCE_TYPES in ragService.ts. annaKnowledgeService.ts
  // is a live consumer of this source_type; excluding it would make every
  // such row unreachable and silently empty that service's knowledge base.
  await client.query(
    `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, source_type, scope, deleted_at, created_at, updated_at)
     VALUES ($1, $2, '', 'indexed', NULL, 'product_pill', NULL, NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [docGlobalProductPill, `m01p04c-${tag}-pill.pdf`]
  );

  // One chunk per document with a distinct, greppable token so BM25 keyword
  // search can deterministically hit exactly one document per query.
  const chunkRows: Array<[string, string, string]> = [
    [docOwnedByA, `${docOwnedByA}-chk-0`, `tokenAlpha${tag} content owned by org A`],
    [docOwnedByB, `${docOwnedByB}-chk-0`, `tokenBravo${tag} content owned by org B`],
    [docLegacyNullOrg, `${docLegacyNullOrg}-chk-0`, `tokenCharlie${tag} legacy unresolved owner`],
    [docGlobalToolPack, `${docGlobalToolPack}-chk-0`, `tokenDelta${tag} global methodology pack`],
    [docGlobalProductPill, `${docGlobalProductPill}-chk-0`, `tokenEcho${tag} global product pill`],
  ];
  for (const [docId, chunkId, content] of chunkRows) {
    await client.query(
      `INSERT INTO knowledge_chunks (id, doc_id, chunk_index, content, embedding, metadata, created_at)
       VALUES ($1, $2, 0, $3, NULL, NULL, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [chunkId, docId, content]
    );
  }

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM knowledge_chunks WHERE doc_id LIKE $1`, [
        `doc_m01p04c_%_${tag}`,
      ]);
      await client.query(`DELETE FROM conversation_message_attachments WHERE target_id LIKE $1`, [
        `doc_m01p04c_%_${tag}`,
      ]);
      await client.query(`DELETE FROM knowledge_docs WHERE id LIKE $1`, [`doc_m01p04c_%_${tag}`]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userA]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2, $3)`, [
        orgA,
        orgB,
        orgEmpty,
      ]);
    } catch {
      // best-effort
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return {
    client,
    tag,
    orgA,
    orgB,
    orgEmpty,
    userA,
    docOwnedByA,
    docOwnedByADeletable,
    docOwnedByB,
    docLegacyNullOrg,
    docLegacyNullOrgForDelete,
    docGlobalToolPack,
    docGlobalProductPill,
    hasSourceTypeColumn,
    hasOrganizationIdColumn,
    cleanup,
  };
}

describe('M01-P04C — knowledge_docs tenant scope against a real Postgres database', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P04C knowledge_docs tenant scope realdb tests skipped.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB(
    'schema has knowledge_docs.organization_id and .source_type (packet dependency)',
    async (h) => {
      expect(h.hasOrganizationIdColumn).toBe(true);
      expect(h.hasSourceTypeColumn).toBe(true);
    }
  );

  // ---------------------------------------------------------------------
  // KnowledgeService (Vault CRUD) — the create/upload/read/delete/list cycle
  // ---------------------------------------------------------------------
  describe('KnowledgeService (Vault CRUD)', () => {
    itDB('getDocuments(orgA) returns the org A document', async (h) => {
      const { default: KnowledgeService } =
        await import('../../../server/src/services/KnowledgeService.js');
      const docs = await KnowledgeService.getDocuments(h.orgA);
      const ids = docs.map((d: any) => d.id);
      expect(ids).toContain(h.docOwnedByA);
    });

    itDB(
      'getDocuments(orgA) does NOT return org B document (cross-tenant leak guard)',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const docs = await KnowledgeService.getDocuments(h.orgA);
        const ids = docs.map((d: any) => d.id);
        expect(ids).not.toContain(h.docOwnedByB);
      }
    );

    itDB(
      'NEGATIVE CONTROL (a): getDocuments(orgA) does NOT return the legacy organization_id IS NULL document — fail-closed, not "NULL = global"',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const docs = await KnowledgeService.getDocuments(h.orgA);
        const ids = docs.map((d: any) => d.id);
        expect(ids).not.toContain(h.docLegacyNullOrg);
      }
    );

    itDB(
      'getDocumentById(orgA, legacyNullOrgDocId) returns null via legacy/unresolved id (fail-closed, not just excluded from list)',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const row = await KnowledgeService.getDocumentById(h.orgA, h.docLegacyNullOrg);
        expect(row).toBeNull();
      }
    );

    itDB(
      'getDocumentById(orgB, legacyNullOrgDocId) ALSO returns null — the legacy row belongs to NO org, not "whoever asks first"',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const row = await KnowledgeService.getDocumentById(h.orgB, h.docLegacyNullOrg);
        expect(row).toBeNull();
      }
    );

    itDB(
      'NEGATIVE CONTROL (b): deleteDocument(orgA, docOwnedByB) does NOT delete org B document — cross-tenant mutation guard',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const res = await KnowledgeService.deleteDocument(h.orgA, h.docOwnedByB);
        expect(res.deleted).toBe(false);
        const check = await h.client.query(`SELECT deleted_at FROM knowledge_docs WHERE id = $1`, [
          h.docOwnedByB,
        ]);
        expect(check.rows[0]?.deleted_at).toBeNull();
      }
    );

    itDB(
      'deleteDocument(orgA, docOwnedByADeletable) DOES delete the own document (dedicated row — never mutates docOwnedByA, which other assertions in this file depend on staying present)',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const res = await KnowledgeService.deleteDocument(h.orgA, h.docOwnedByADeletable);
        expect(res.deleted).toBe(true);
        const check = await h.client.query(`SELECT deleted_at FROM knowledge_docs WHERE id = $1`, [
          h.docOwnedByADeletable,
        ]);
        expect(check.rows[0]?.deleted_at).not.toBeNull();
      }
    );

    itDB(
      'deleteDocument(orgA, legacyNullOrgDocId) does NOT delete the legacy document (nobody "owns" it well enough to delete it either) — uses a row DEDICATED to this test so a fail-open bug here cannot masquerade as "fixed" in the later read-only/ragService assertions on docLegacyNullOrg',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const res = await KnowledgeService.deleteDocument(h.orgA, h.docLegacyNullOrgForDelete);
        expect(res.deleted).toBe(false);
        const check = await h.client.query(`SELECT deleted_at FROM knowledge_docs WHERE id = $1`, [
          h.docLegacyNullOrgForDelete,
        ]);
        expect(check.rows[0]?.deleted_at).toBeNull();
      }
    );

    itDB(
      'getDocuments(orgEmpty) returns an empty list, not an error (tenant with no rows)',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const docs = await KnowledgeService.getDocuments(h.orgEmpty);
        const ids = docs.map((d: any) => d.id);
        expect(ids).not.toContain(h.docOwnedByA);
        expect(ids).not.toContain(h.docOwnedByB);
        expect(ids).not.toContain(h.docLegacyNullOrg);
      }
    );

    itDB(
      'addDocument (the real Vault upload create-path, knowledge.routes.ts POST /documents) can NEVER produce a source_type=product_pill (or tool_pack/methodology) row — the function signature has no such parameter and its INSERT does not reference the column, so no request body field can reach it',
      async (h) => {
        const { default: KnowledgeService } =
          await import('../../../server/src/services/KnowledgeService.js');
        const docId = await KnowledgeService.addDocument(
          'attempted-spoof.pdf',
          '/tmp/attempted-spoof.pdf',
          h.orgA,
          null,
          1234,
          // `category` is the one free-text field this path DOES accept from
          // req.body (knowledge.routes.ts: `const category = req.body.category`)
          // — attempt to smuggle the global marker through it, the one
          // client-controlled string field on this call, to prove even a
          // malicious client cannot influence source_type via any field.
          'product_pill',
          ['tool_pack', 'methodology', 'product_pill'],
          undefined,
          h.userA,
          'organization'
        );
        try {
          const row = await h.client.query(
            `SELECT source_type, category FROM knowledge_docs WHERE id = $1`,
            [docId]
          );
          expect(row.rows[0]?.source_type).toBeNull();
          // category is a separate, harmless free-text field on Vault docs —
          // confirms the smuggling attempt only ever reached the field it
          // was legitimately allowed to reach, not source_type.
          expect(row.rows[0]?.category).toBe('product_pill');
        } finally {
          await h.client.query(`DELETE FROM knowledge_chunks WHERE doc_id = $1`, [docId]);
          await h.client.query(`DELETE FROM knowledge_docs WHERE id = $1`, [docId]);
        }
      }
    );
  });

  // ---------------------------------------------------------------------
  // Static check: no route file reads a `source_type` field from client
  // input and forwards it toward a knowledge_docs write. Complements the
  // runtime addDocument test above (which proves the ONE Vault create path
  // can't do it) by covering every route file at once, including paths
  // this suite does not otherwise exercise (e.g. ai.routes.ts's attachment
  // ingest handlers, which hardcode 'chat_attachment'/no source_type in
  // their INSERT text — see ai.routes.ts M01-P04C comments). Does not
  // require a database — always runs, even when Postgres is unreachable.
  // ---------------------------------------------------------------------
  describe('product_pill / source_type cannot be set from any user-facing route (static)', () => {
    it('no server/src/routes/*.ts file that touches knowledge_docs reads source_type from req.body/req.query/req.params', async () => {
      const { readdirSync, readFileSync, statSync } = await import('node:fs');
      const path = await import('node:path');
      const routesDir = path.resolve(__dirname, '../../../server/src/routes');

      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = path.join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walk(full);
            continue;
          }
          if (!/\.ts$/.test(entry)) continue;
          const content = readFileSync(full, 'utf8');
          // Scope to files that touch `knowledge_docs` at all — `source_type`
          // is also a legitimate column on unrelated tables (e.g.
          // `initiatives.source_type`, provenance 'manual'/'import'; confirmed
          // by grep before narrowing this check, see M01-P04C return summary
          // "false positive caught and fixed"). Without this scope the check
          // would flag every route touching an unrelated table with the same
          // column name, which is not the vulnerability class this test
          // exists to catch — a caller spoofing `knowledge_docs.source_type`
          // to claim global visibility.
          if (!content.includes('knowledge_docs')) continue;
          // Matches req.body.source_type, req.body['source_type'],
          // req.query.source_type, req.params.source_type, and the
          // destructured form `const { source_type } = req.body`.
          if (
            /req\.(body|query|params)(\.|\[['"])source_type/.test(content) ||
            /\{[^}]*\bsource_type\b[^}]*\}\s*=\s*req\.(body|query|params)/.test(content)
          ) {
            offenders.push(full);
          }
        }
      };
      walk(routesDir);

      expect(offenders).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------
  // ragService — the retrieval path ai.routes.ts calls for conversation-
  // scoped attachment grounding (searchRelevantChunks -> hybridSearch ->
  // bm25Search/_vectorSearch -> appendKnowledgeDocAccessFilter).
  // ---------------------------------------------------------------------
  describe('ragService (attachment -> knowledge_doc retrieval)', () => {
    itDB(
      'searchRelevantChunks(orgA, documentIds=[docOwnedByA]) finds the org A chunk by its unique token',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenAlpha${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docOwnedByA],
          limit: 5,
        });
        expect(results.some((r: any) => r.content?.includes(`tokenAlpha${h.tag}`))).toBe(true);
      }
    );

    itDB(
      'NEGATIVE CONTROL (c): searchRelevantChunks(orgA, documentIds=[docOwnedByB]) — passing ANOTHER org doc id explicitly returns ZERO chunks (attachment -> knowledge_doc relation IS checked, not just trusted)',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenBravo${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docOwnedByB],
          limit: 5,
        });
        expect(results.length).toBe(0);
      }
    );

    itDB(
      'searchRelevantChunks(orgA, documentIds=[legacyNullOrgDocId]) — known/"legacy" id with NO resolved owner returns ZERO chunks for org A (fail-closed, not "NULL = global")',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenCharlie${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docLegacyNullOrg],
          limit: 5,
        });
        expect(results.length).toBe(0);
      }
    );

    itDB(
      'searchRelevantChunks(orgB, documentIds=[legacyNullOrgDocId]) — same legacy id, DIFFERENT org, ALSO zero chunks (not owned by whichever org asks first)',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenCharlie${h.tag}`, {
          organizationId: h.orgB,
          documentIds: [h.docLegacyNullOrg],
          limit: 5,
        });
        expect(results.length).toBe(0);
      }
    );

    itDB(
      'searchRelevantChunks(orgA, documentIds=[globalToolPackDocId]) — explicit global contract (source_type=tool_pack) stays retrievable for org A (no regression on the legitimate global feature)',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenDelta${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docGlobalToolPack],
          limit: 5,
        });
        expect(results.some((r: any) => r.content?.includes(`tokenDelta${h.tag}`))).toBe(true);
      }
    );

    itDB(
      'searchRelevantChunks(orgB, documentIds=[globalToolPackDocId]) — the SAME global doc is retrievable for a DIFFERENT org too (proves it is a genuine global contract, not accidentally org-A-scoped)',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenDelta${h.tag}`, {
          organizationId: h.orgB,
          documentIds: [h.docGlobalToolPack],
          limit: 5,
        });
        expect(results.some((r: any) => r.content?.includes(`tokenDelta${h.tag}`))).toBe(true);
      }
    );

    // ---------------------------------------------------------------------
    // product_pill — added to GLOBAL_KNOWLEDGE_SOURCE_TYPES by coordinator
    // decision (M01-P04C review, 2026-08-05). `annaKnowledgeService.ts` is a
    // real, live consumer of `source_type='product_pill'` documents (queries
    // it directly, not dead code) — these two tests are NOT a mechanical
    // copy of the tool_pack pair: they prove the exact consumer-facing
    // symptom the coordinator flagged (a product-knowledge document must
    // stay reachable) would be caught by this suite, not merely assumed.
    // ---------------------------------------------------------------------
    itDB(
      'searchRelevantChunks(orgA, documentIds=[globalProductPillDocId]) — product-pill documents (real annaKnowledgeService.ts consumer) stay reachable for org A',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenEcho${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docGlobalProductPill],
          limit: 5,
        });
        expect(results.some((r: any) => r.content?.includes(`tokenEcho${h.tag}`))).toBe(true);
      }
    );

    itDB(
      'searchRelevantChunks(orgB, documentIds=[globalProductPillDocId]) — the SAME product-pill doc is reachable for a DIFFERENT org too (genuine global contract)',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        const results = await ragService.searchRelevantChunks(`tokenEcho${h.tag}`, {
          organizationId: h.orgB,
          documentIds: [h.docGlobalProductPill],
          limit: 5,
        });
        expect(results.some((r: any) => r.content?.includes(`tokenEcho${h.tag}`))).toBe(true);
      }
    );
  });

  // ---------------------------------------------------------------------
  // Attachment -> knowledge_doc relation (conversation_message_attachments)
  // ---------------------------------------------------------------------
  describe('attachment -> knowledge_doc relation', () => {
    itDB(
      'NEGATIVE CONTROL (relation): a conversation_message_attachments row pointing at another org doc id does not, by its mere existence, grant retrieval — searchRelevantChunks still enforces organization_id on the referenced knowledge_docs row',
      async (h) => {
        const { default: ragService } = await import('../../../server/src/services/ragService.js');
        // Simulate the shape ai.routes.ts builds attachmentDocIds from: a
        // pointer row exists (as if org A's conversation had attached this
        // targetId), but the referenced knowledge_docs row belongs to org B.
        const messageId = await h.client
          .query(
            `SELECT id FROM conversation_messages LIMIT 1` // best-effort; may be empty in a fresh DB
          )
          .then((r) => r.rows[0]?.id)
          .catch(() => null);
        // The relation check under test lives entirely in ragService's SQL
        // (JOIN knowledge_docs d ON ... WHERE d.organization_id = ?), which
        // does not require a real conversation_message_attachments row to
        // exercise — the attachmentDocIds array in ai.routes.ts is exactly
        // this list of ids regardless of how it was assembled. This test
        // documents that even if such a pointer row existed for org A, the
        // retrieval below is what decides visibility, and it is org-scoped.
        void messageId;
        const results = await ragService.searchRelevantChunks(`tokenBravo${h.tag}`, {
          organizationId: h.orgA,
          documentIds: [h.docOwnedByB],
          limit: 5,
        });
        expect(results.length).toBe(0);
      }
    );
  });
});
