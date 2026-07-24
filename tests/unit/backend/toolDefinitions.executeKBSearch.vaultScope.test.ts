/**
 * executeKBSearch — Vault-kontekst scope isolation (AGT-008).
 *
 * KRYTERIUM ODBIORU AGT-008: klocek "Vault-kontekst" w procesie realnie
 * wciąga dokumenty z właściwego poziomu — prywatny dokument właściciela
 * wchodzi w JEGO proces, NIE wchodzi w cudzy (test izolacji). Ten plik
 * dowodzi tego na poziomie `executeKBSearch` (server/src/services/ai/
 * toolDefinitions.ts): gdy `args.vault_scope` jest podane (przez
 * `toolInput` klocka Vault-kontekst, patrz AgentPlanCanvas.tsx
 * `setBlockVaultSafe`), retrieval jest ograniczony do dokumentów TEGO
 * JEDNEGO sejfu przez allow-list `documentIds` przekazaną do
 * `ragService.hybridSearch` — dokładnie tą samą regułą dostępu, jakiej
 * używa `GET /api/knowledge/vault-safes` (`KnowledgeService.getDocuments`).
 *
 * Mockowany fake `KnowledgeService.getDocuments` odtwarza REALNĄ logikę
 * filtrowania (scope='user' => WYŁĄCZNIE owner_id === userId; scope='project'
 * => WYŁĄCZNIE projekty z memberProjectIds) tak, by test faktycznie dowodził
 * izolacji, nie tylko przepływu parametrów.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDoc {
  id: string;
  organization_id: string;
  scope: 'user' | 'organization' | 'project';
  owner_id: string | null;
  project_id: string | null;
}

const FAKE_DOCS: FakeDoc[] = [
  { id: 'doc-piotr-private', organization_id: 'org-1', scope: 'user', owner_id: 'user-piotr', project_id: null },
  { id: 'doc-anna-private', organization_id: 'org-1', scope: 'user', owner_id: 'user-anna', project_id: null },
  { id: 'doc-org-1', organization_id: 'org-1', scope: 'organization', owner_id: null, project_id: null },
  { id: 'doc-proj-42-a', organization_id: 'org-1', scope: 'project', owner_id: null, project_id: 'proj-42' },
  { id: 'doc-proj-99-a', organization_id: 'org-1', scope: 'project', owner_id: null, project_id: 'proj-99' },
];

const hybridSearchCalls = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('../../../server/src/services/ai/chatPolicyGateway.js', () => ({
  evaluateRetrievalPolicyDecision: async () => ({
    decision: { id: 'decision-1', allowed: true, outcome: 'allowed' },
    sanitizedQuery: 'query',
  }),
}));

vi.mock('../../../server/src/services/ragService.js', () => ({
  default: {
    hybridSearch: async (query: string, opts: Record<string, unknown>) => {
      hybridSearchCalls.calls.push({ query, ...opts });
      const documentIds = opts.documentIds as string[] | undefined;
      const visible = documentIds
        ? FAKE_DOCS.filter((d) => documentIds.includes(d.id))
        : FAKE_DOCS;
      return visible.map((d) => ({
        content: `content of ${d.id}`,
        metadata: { documentTitle: d.id, documentId: d.id },
        score: 0.9,
      }));
    },
  },
}));

vi.mock('../../../server/src/services/KnowledgeService.js', () => ({
  default: {
    // Odtwarza REALNĄ regułę z KnowledgeService.getDocuments (server/src/services/KnowledgeService.ts)
    // wystarczająco wiernie, by dowieść izolacji — nie tylko przepływu parametrów.
    getDocuments: async (
      orgId: string,
      userId: string | undefined,
      _role: unknown,
      access?: { scope?: string | null; projectId?: string | null; memberProjectIds?: string[] }
    ) => {
      const scope = access?.scope || null;
      const projectId = access?.projectId || null;
      const memberIds = access?.memberProjectIds || [];
      return FAKE_DOCS.filter((d) => {
        if (d.organization_id !== orgId) return false;
        if (scope === 'user') return d.scope === 'user' && d.owner_id === userId;
        if (scope === 'organization') return d.scope === 'organization';
        if (scope === 'project') {
          if (d.scope !== 'project') return false;
          if (projectId) return d.project_id === projectId;
          return memberIds.includes(d.project_id || '');
        }
        return true;
      });
    },
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT project_id FROM project_members WHERE user_id = ?')) {
      if (params[0] === 'user-piotr') return [{ project_id: 'proj-42' }];
      return [];
    }
    throw new Error(`Unmocked SQL in vaultScope test: ${s}`);
  },
}));

const { executeToolCall } = await import('../../../server/src/services/ai/toolDefinitions.js');

function ctxFor(userId: string, organizationId = 'org-1') {
  return { userId, organizationId };
}

describe('executeKBSearch — Vault-kontekst scope isolation (AGT-008)', () => {
  beforeEach(() => {
    hybridSearchCalls.calls.length = 0;
  });

  it('vault_scope="user": zwraca WYŁĄCZNIE prywatne dokumenty WOŁAJĄCEGO, nie cudze', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'kontekst wejściowy', vault_scope: 'user' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);

    expect(result.vaultScope).toBe('user');
    const titles = result.results.map((r: any) => r.documentTitle);
    expect(titles).toContain('doc-piotr-private');
    expect(titles).not.toContain('doc-anna-private'); // ★ izolacja: cudzy prywatny dokument NIE wchodzi
  });

  it('vault_scope="user" dla INNEGO usera zwraca JEGO WŁASNE dokumenty, nie te z poprzedniego testu', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'kontekst wejściowy', vault_scope: 'user' },
      ctxFor('user-anna')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toContain('doc-anna-private');
    expect(titles).not.toContain('doc-piotr-private');
  });

  it('vault_scope="project" z jawnym vault_project_id ogranicza do TEGO projektu (nie innego)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'diagnoza', vault_scope: 'project', vault_project_id: 'proj-42' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toContain('doc-proj-42-a');
    expect(titles).not.toContain('doc-proj-99-a'); // ★ izolacja: inny projekt nie wchodzi
  });

  it('vault_scope="project" BEZ jawnego project_id dociąga memberProjectIds z DbPromise', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'diagnoza', vault_scope: 'project' },
      ctxFor('user-piotr') // członek TYLKO proj-42 (patrz mock DbPromise powyżej)
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toContain('doc-proj-42-a');
    expect(titles).not.toContain('doc-proj-99-a'); // nie jest członkiem proj-99
  });

  it('vault_scope="organization" ogranicza do sejfu organizacji, nie prywatnych dokumentów', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'polityka', vault_scope: 'organization' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toEqual(['doc-org-1']);
  });

  it('BRAK vault_scope: hybridSearch wołane BEZ documentIds (zachowanie sprzed AGT-008 bez zmian)', async () => {
    await executeToolCall('search_knowledge_base', { query: 'ogólne pytanie' }, ctxFor('user-piotr'));

    expect(hybridSearchCalls.calls).toHaveLength(1);
    expect(hybridSearchCalls.calls[0].documentIds).toBeUndefined();
  });

  it('sejf pusty w wybranym poziomie: zero wyników, hybridSearch NIE jest wołane (brak przecieku do pełnego indeksu)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'cokolwiek', vault_scope: 'project', vault_project_id: 'proj-does-not-exist' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });
});
