/**
 * FIX-206 (pkt 2) — tryb prywatny MUSI realnie zawężać zakres retrievalu
 * w pętli narzędziowej, nie tylko podróżować jako etykieta.
 *
 * Miara jest behawioralna: patrzymy, jakie `documentIds` `executeKBSearch`
 * poda wyszukiwarce. W trybie prywatnym dokument organizacji nie ma prawa tam
 * być; poza trybem prywatnym — ma (czułość testu).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

process.env.DB_TYPE = 'postgres';

const searchCalls = vi.hoisted(() => [] as Array<{ query: string; documentIds?: string[] }>);

vi.mock('../../ragService.js', () => ({
  default: {
    hybridSearch: vi.fn(async (query: string, opts: any) => {
      searchCalls.push({ query, documentIds: opts?.documentIds });
      return [];
    }),
  },
}));

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB !== 'true';

describe.skipIf(!enabled)('FIX-206 pkt 2 — privateMode zawęża zakres knowledge base', () => {
  const orgId = `org-fix206-${randomUUID()}`;
  const userId = `user-fix206-${randomUUID()}`;
  const orgDocId = `doc-org-${randomUUID()}`;
  const privateDocId = `doc-private-${randomUUID()}`;
  let run: any;

  beforeAll(async () => {
    const { run: dbRun } = await import('../../../utils/DbPromise.js');
    run = dbRun;
    const { default: KnowledgeService } = await import('../../KnowledgeService.js');
    // Wymusza ensureKnowledgeSchema() (kolumny scope/owner_id) przed INSERT-ami.
    await KnowledgeService.getDocuments(orgId, userId);

    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      'Org FIX-206',
    ]);
    await run(
      `INSERT INTO knowledge_docs (id, filename, organization_id, scope, status)
       VALUES (?, ?, ?, 'organization', 'ready') ON CONFLICT (id) DO NOTHING`,
      [orgDocId, 'strategia-organizacji.pdf', orgId]
    );
    await run(
      `INSERT INTO knowledge_docs (id, filename, organization_id, scope, owner_id, status)
       VALUES (?, ?, ?, 'user', ?, 'ready') ON CONFLICT (id) DO NOTHING`,
      [privateDocId, 'moje-notatki.pdf', orgId, userId]
    );
  });

  afterAll(async () => {
    if (!run) return;
    await run(`DELETE FROM knowledge_docs WHERE id IN (?, ?)`, [orgDocId, privateDocId]);
    await run(`DELETE FROM organizations WHERE id = ?`, [orgId]);
  });

  it('privateMode=true: dokument organizacji NIE wchodzi w zakres wyszukiwania', async () => {
    searchCalls.length = 0;
    const { executeToolCall } = await import('../toolDefinitions.js');

    await executeToolCall(
      'search_knowledge_base',
      { query: 'strategia' },
      { organizationId: orgId, userId, privateMode: true }
    );

    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].documentIds).toContain(privateDocId);
    expect(searchCalls[0].documentIds).not.toContain(orgDocId);
  });

  it('privateMode=false: dokument organizacji jest w zakresie (czułość testu)', async () => {
    searchCalls.length = 0;
    const { executeToolCall } = await import('../toolDefinitions.js');

    await executeToolCall(
      'search_knowledge_base',
      { query: 'strategia' },
      { organizationId: orgId, userId, privateMode: false }
    );

    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].documentIds).toContain(orgDocId);
  });

  it('privateMode=true: jawne żądanie sejfu organizacji jest odrzucane fail-closed', async () => {
    searchCalls.length = 0;
    const { executeToolCall } = await import('../toolDefinitions.js');

    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'strategia', vault_scope: 'organization' },
      { organizationId: orgId, userId, privateMode: true }
    );

    expect(searchCalls).toHaveLength(0);
    const parsed = JSON.parse(raw);
    expect(parsed.privateMode).toBe(true);
    expect(parsed.results).toEqual([]);
  });
});
