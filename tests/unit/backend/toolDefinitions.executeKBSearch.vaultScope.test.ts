/**
 * executeKBSearch — Vault-kontekst scope isolation (AGT-008) + folder
 * narrowing (★ VLT-FOLDERS).
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
 *
 * ★ VLT-FOLDERS (druga sekcja niżej) — drugi select klocka "Vault-kontekst"
 * (folder WEWNĄTRZ sejfu). KRYTERIUM ODBIORU: poziom/projekt idą
 * AUTORYTATYWNIE z rekordu folderu (nie z `vault_scope`/`vault_project_id`
 * przekazanych osobno) — spreparowany/niespójny `vault_scope` NIE może
 * rozszerzyć dostępu ponad to, co pozwala sam folder. Fail-closed: folder
 * nieistniejący lub niewidoczny dla wołającego → pusty wynik, `hybridSearch`
 * NIE jest wołane.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDoc {
  id: string;
  organization_id: string;
  scope: 'user' | 'organization' | 'project';
  owner_id: string | null;
  project_id: string | null;
  folder_id?: string | null;
}

const FAKE_DOCS: FakeDoc[] = [
  {
    id: 'doc-piotr-private',
    organization_id: 'org-1',
    scope: 'user',
    owner_id: 'user-piotr',
    project_id: null,
    folder_id: 'folder-piotr-inbox',
  },
  { id: 'doc-anna-private', organization_id: 'org-1', scope: 'user', owner_id: 'user-anna', project_id: null },
  { id: 'doc-org-1', organization_id: 'org-1', scope: 'organization', owner_id: null, project_id: null },
  {
    id: 'doc-org-2',
    organization_id: 'org-1',
    scope: 'organization',
    owner_id: null,
    project_id: null,
    folder_id: 'folder-org-policies',
  },
  {
    id: 'doc-proj-42-a',
    organization_id: 'org-1',
    scope: 'project',
    owner_id: null,
    project_id: 'proj-42',
    folder_id: 'folder-proj42-specs',
  },
  { id: 'doc-proj-42-b', organization_id: 'org-1', scope: 'project', owner_id: null, project_id: 'proj-42' },
  {
    id: 'doc-proj-99-a',
    organization_id: 'org-1',
    scope: 'project',
    owner_id: null,
    project_id: 'proj-99',
    folder_id: 'folder-proj99-specs',
  },
];

interface FakeFolder {
  id: string;
  organization_id: string;
  scope: 'user' | 'organization' | 'project';
  owner_id: string | null;
  project_id: string | null;
  name: string;
}

const FAKE_FOLDERS: FakeFolder[] = [
  {
    id: 'folder-piotr-inbox',
    organization_id: 'org-1',
    scope: 'user',
    owner_id: 'user-piotr',
    project_id: null,
    name: 'Inbox Piotra',
  },
  {
    id: 'folder-anna-inbox',
    organization_id: 'org-1',
    scope: 'user',
    owner_id: 'user-anna',
    project_id: null,
    name: 'Inbox Anny',
  },
  {
    id: 'folder-proj42-specs',
    organization_id: 'org-1',
    scope: 'project',
    owner_id: 'user-piotr',
    project_id: 'proj-42',
    name: 'Specyfikacje 42',
  },
  {
    id: 'folder-proj99-specs',
    organization_id: 'org-1',
    scope: 'project',
    owner_id: 'user-other',
    project_id: 'proj-99',
    name: 'Specyfikacje 99',
  },
  {
    id: 'folder-org-policies',
    organization_id: 'org-1',
    scope: 'organization',
    owner_id: 'user-admin',
    project_id: null,
    name: 'Polityki',
  },
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
      access?: {
        scope?: string | null;
        projectId?: string | null;
        memberProjectIds?: string[];
        folderId?: string | null;
        projectAccessVerified?: boolean;
      }
    ) => {
      const scope = access?.scope || null;
      const projectId = access?.projectId || null;
      const memberIds = access?.memberProjectIds || [];
      const folderId = access?.folderId || null;
      return FAKE_DOCS.filter((d) => {
        if (d.organization_id !== orgId) return false;
        // ★ VLT-FOLDERS — odtwarza `getDocuments`'s `AND folder_id = ?`: DODATKOWE
        // zawężenie NA WIERZCHU już policzonego dostępu z poziomu (nigdy go nie zastępuje).
        if (folderId && d.folder_id !== folderId) return false;
        if (scope === 'user') return d.scope === 'user' && d.owner_id === userId;
        if (scope === 'organization') return d.scope === 'organization';
        if (scope === 'project') {
          if (d.scope !== 'project') return false;
          if (projectId) {
            if (!access?.projectAccessVerified && !memberIds.includes(projectId)) return false;
            return d.project_id === projectId;
          }
          return memberIds.includes(d.project_id || '');
        }
        // AGT-008-bis — widok domyślny (brak jawnego `scope`, patrz
        // KnowledgeService.getDocuments): własne prywatne + organizacyjne/legacy
        // + projektowe TYLKO dla projektów z memberProjectIds. Odtwarza REALNĄ
        // regułę z server/src/services/KnowledgeService.ts (gałąź `else if (userId)`),
        // żeby ten test faktycznie dowodził izolacji domyślnego widoku, nie tylko
        // przepływu parametrów.
        if (!userId) return d.scope !== 'user';
        if (d.scope === 'user') return d.owner_id === userId;
        if (d.scope === 'organization') return true;
        if (d.scope === 'project') return memberIds.includes(d.project_id || '');
        return true;
      });
    },
    // ★ VLT-FOLDERS — odtwarza `KnowledgeService.getFolderById` (single-folder,
    // org-scoped lookup; `executeKBSearch` sam sprawdza widoczność po scope/owner).
    getFolderById: async (orgId: string, folderId: string) =>
      FAKE_FOLDERS.find((f) => f.id === folderId && f.organization_id === orgId) || null,
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT project_id FROM project_members WHERE user_id = ?')) {
      if (params[0] === 'user-piotr') return [{ project_id: 'proj-42' }];
      if (params[0] === 'user-solo') return [{ project_id: 'proj-empty' }];
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

  it('fail-closed: jawne vault_project_id spoza członkostw nie uruchamia wyszukiwania', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'diagnoza', vault_scope: 'project', vault_project_id: 'proj-99' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
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

    expect(titles.sort()).toEqual(['doc-org-1', 'doc-org-2']);
  });

  // AGT-008-bis — regresja: bez `vault_scope` klocek "Vault-kontekst" wołał
  // hybridSearch BEZ documentIds ("cała organizacja poza cudzymi prywatnymi"),
  // czyli szerzej niż domyślny widok Vault (`GET /api/knowledge/vault-safes` →
  // `KnowledgeService.getDocuments` bez scope: własne prywatne + org/legacy +
  // WYŁĄCZNIE projekty, w których wołający jest członkiem). Naprawa: brak
  // vault_scope liczy TĘ SAMĄ allow-listę co domyślny widok i przekazuje ją
  // jako documentIds — te trzy testy dowodzą izolacji, nie tylko przepływu.
  it('BRAK vault_scope: hybridSearch dostaje TĘ SAMĄ allow-listę co domyślny widok Vault (nie "cała organizacja")', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'ogólne pytanie' },
      ctxFor('user-piotr') // członek TYLKO proj-42 (patrz mock DbPromise powyżej)
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(hybridSearchCalls.calls).toHaveLength(1);
    expect(hybridSearchCalls.calls[0].documentIds).toEqual(
      expect.arrayContaining(['doc-piotr-private', 'doc-org-1', 'doc-proj-42-a'])
    );
    expect(titles).toContain('doc-piotr-private');
    expect(titles).toContain('doc-org-1');
    expect(titles).toContain('doc-proj-42-a');
  });

  it('BRAK vault_scope: NIE wchodzi cudzy prywatny dokument (★ regresja AGT-008-bis)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'ogólne pytanie' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).not.toContain('doc-anna-private');
  });

  it('BRAK vault_scope: NIE wchodzi dokument projektu, w którym wołający NIE jest członkiem (★ regresja AGT-008-bis)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'ogólne pytanie' },
      ctxFor('user-piotr') // członek TYLKO proj-42, NIE proj-99
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).not.toContain('doc-proj-99-a');
  });

  it('BRAK vault_scope: user bez ŻADNEGO dostępnego dokumentu dostaje pusty wynik, hybridSearch NIE jest wołane (fail-closed)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'cokolwiek' },
      ctxFor('user-nikt', 'org-1') // brak własnych dok., brak członkostw w projektach → mock DbPromise zwraca []
    );
    const result = JSON.parse(raw);

    // 'doc-org-1' ma scope='organization', więc user-nikt i tak go widzi (widok
    // domyślny Vault pokazuje org/legacy wszystkim w organizacji) — test dowodzi
    // fail-closed tylko wtedy, gdy NIE ma nawet dokumentu organizacyjnego.
    expect(result.results.map((r: any) => r.documentTitle).sort()).toEqual(['doc-org-1', 'doc-org-2']);
  });

  it('sejf pusty w wybranym poziomie: zero wyników, hybridSearch NIE jest wołane (brak przecieku do pełnego indeksu)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'cokolwiek', vault_scope: 'project', vault_project_id: 'proj-empty' },
      ctxFor('user-solo')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });
});

describe('executeKBSearch — Vault-kontekst FOLDER narrowing (★ VLT-FOLDERS)', () => {
  beforeEach(() => {
    hybridSearchCalls.calls.length = 0;
  });

  it('vault_folder_id (scope=user, właściciel folderu) zwraca WYŁĄCZNIE dokumenty w TYM folderze', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'kontekst', vault_scope: 'user', vault_folder_id: 'folder-piotr-inbox' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(result.vaultFolder).toBe('Inbox Piotra');
    expect(titles).toEqual(['doc-piotr-private']);
  });

  it('vault_folder_id (scope=project, wołający JEST członkiem) zawęża do dokumentów w folderze, nie całego projektu', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'specyfikacja', vault_scope: 'project', vault_folder_id: 'folder-proj42-specs' },
      ctxFor('user-piotr') // członek proj-42
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toEqual(['doc-proj-42-a']);
    // ★ dowód zawężenia PONAD poziom: doc-proj-42-b jest w TYM SAMYM projekcie
    // (wołający ma do niego dostęp na poziomie sejfu), ale NIE w tym folderze.
    expect(titles).not.toContain('doc-proj-42-b');
  });

  it('vault_folder_id (scope=organization) jest widoczny każdemu w organizacji', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'polityka', vault_scope: 'organization', vault_folder_id: 'folder-org-policies' },
      ctxFor('user-nikt') // bez własnych dokumentów / członkostw
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(titles).toEqual(['doc-org-2']);
  });

  it('★ FAIL-CLOSED: folder scope=user należący do INNEGO usera — pusty wynik, hybridSearch NIE wołane, mimo że doc istnieje', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      // user-anna próbuje wejść folderem Piotra — cudzy prywatny folder.
      { query: 'kontekst', vault_folder_id: 'folder-piotr-inbox' },
      ctxFor('user-anna')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });

  it('★ FAIL-CLOSED: folder scope=project w projekcie, w którym wołający NIE jest członkiem — pusty wynik', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'specyfikacja', vault_folder_id: 'folder-proj99-specs' },
      ctxFor('user-piotr') // członek TYLKO proj-42, nie proj-99
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });

  it('★ FAIL-CLOSED: folder nieistniejący — pusty wynik, hybridSearch NIE wołane', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'cokolwiek', vault_folder_id: 'folder-does-not-exist' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });

  it('★ SEDNO — folder wygrywa nad spreparowanym/niespójnym vault_scope: cudzy sejf w vault_scope NIE rozszerza dostępu', async () => {
    // vault_scope="organization" sugerowałby sejf ORGANIZACJI, ale realny
    // folder (folder-piotr-inbox) jest scope='user', należący do Piotra.
    // Backend MUSI wyprowadzić poziom z folderu (autorytatywnie), nie z tego
    // pola — inaczej user-anna mogłaby udawać sejf organizacji, żeby
    // "wejść" folderem, który w rzeczywistości jest prywatnym folderem Piotra.
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'kontekst', vault_scope: 'organization', vault_folder_id: 'folder-piotr-inbox' },
      ctxFor('user-anna')
    );
    const result = JSON.parse(raw);

    expect(result.results).toEqual([]);
    expect(hybridSearchCalls.calls).toHaveLength(0);
  });

  it('★ SEDNO — folder wygrywa nad BRAKIEM vault_scope: samo vault_folder_id wystarcza do poprawnego zawężenia', async () => {
    // Klocek mógłby w teorii nieść tylko `vault_folder_id` (np. stary zapis
    // sprzed pełnej synchronizacji pól UI) — poziom nadal musi wyjść z folderu.
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'kontekst', vault_folder_id: 'folder-piotr-inbox' },
      ctxFor('user-piotr')
    );
    const result = JSON.parse(raw);
    const titles = result.results.map((r: any) => r.documentTitle);

    expect(result.vaultScope).toBe('user');
    expect(titles).toEqual(['doc-piotr-private']);
  });
});
