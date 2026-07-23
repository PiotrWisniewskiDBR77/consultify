/**
 * VLT-002 — test negatywny prywatności Vault (DEC-003), część (b): RETRIEVAL RAG.
 *
 * Dokument `scope='user'` (prywatny, VLT-001) NIE MOŻE ugruntować odpowiedzi AI
 * — ani dla właściciela, ani (a fortiori) dla innego usera tej samej organizacji.
 * `ragService.bm25Search`/`_vectorSearch` (przez wspólny
 * `appendKnowledgeDocAccessFilter`) i `getContextKeyword` NIE mają w ogóle
 * `userId` w swoim wywołaniu (patrz `searchKnowledgeBase.ts` → `SearchContext`
 * ma tylko `organizationId`) — dlatego naprawa VLT-002 wyklucza `scope='user'`
 * z tych ścieżek KATEGORYCZNIE, niezależnie kto pyta (ten sam wzorzec co
 * `KnowledgeService.getDocuments`'s "brak userId" branch — patrz DZIENNIK).
 *
 * Fake-DB w pamięci odwzorowuje PRAGMA table_info + faktyczny JOIN
 * `knowledge_chunks c JOIN knowledge_docs d` z bound-params w kolejności, w jakiej
 * buduje je `appendKnowledgeDocAccessFilter` (organizationId → deleted_at → status
 * → scope). Test dowodzi KONTRAKT: klauzula scope jest w SQL-u i faktycznie
 * filtruje wynik, nie tylko że funkcja "nie rzuca wyjątku".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DocRow {
  id: string;
  organization_id: string | null;
  scope: string | null;
  status: string | null;
  deleted_at: string | null;
  filename: string;
}
interface ChunkRow {
  id: string;
  doc_id: string;
  content: string;
}

const docs: DocRow[] = [];
const chunks: ChunkRow[] = [];

const ORG = 'org-1';

const DOCS_COLUMNS = ['id', 'organization_id', 'scope', 'owner_id', 'status', 'deleted_at', 'filename', 'category', 'version'];
const CHUNKS_COLUMNS = ['id', 'doc_id', 'content', 'metadata', 'embedding'];

/** Emuluje `SELECT ... FROM knowledge_chunks c JOIN knowledge_docs d WHERE ... [access filter]`. */
function applyChunkDocFilter(sql: string, params: unknown[]) {
  let rows = chunks
    .map((c) => ({ chunk: c, doc: docs.find((d) => d.id === c.doc_id) }))
    .filter((r): r is { chunk: ChunkRow; doc: DocRow } => Boolean(r.doc));

  let paramIdx = 0;
  if (/d\.organization_id = \?/.test(sql)) {
    const orgParam = String(params[paramIdx++]);
    rows = rows.filter((r) => r.doc.organization_id === orgParam);
  }
  if (/d\.deleted_at IS NULL/.test(sql)) {
    rows = rows.filter((r) => !r.doc.deleted_at);
  }
  // ★ VLT-002 — the clause under test.
  if (/d\.scope IS NULL OR d\.scope != 'user'/.test(sql)) {
    rows = rows.filter((r) => r.doc.scope == null || r.doc.scope !== 'user');
  }
  return rows.map((r) => ({
    id: r.chunk.id,
    content: r.chunk.content,
    chunk_metadata: null,
    filename: r.doc.filename,
    doc_id: r.doc.id,
  }));
}

const mockAll = vi.fn(async (sql: string, params: unknown[]) => {
  if (/table_info\(knowledge_docs\)/.test(sql)) return DOCS_COLUMNS.map((name) => ({ name }));
  if (/table_info\(knowledge_chunks\)/.test(sql)) return CHUNKS_COLUMNS.map((name) => ({ name }));
  if (/FROM knowledge_chunks c/.test(sql) && /JOIN knowledge_docs d/.test(sql)) {
    return applyChunkDocFilter(sql, params);
  }
  return [];
});
const mockRun = vi.fn(async () => ({ changes: 0 }));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (sql: string, params: unknown[]) => mockAll(sql, params),
  run: (sql: string, params: unknown[]) => mockRun(sql, params),
  get: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// getDatabase is only reached on the isPg() branch — DB_TYPE is unset in this test,
// so it is never called, but the module must resolve.
vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

import RagService from '../../../server/src/services/ragService.js';

describe('VLT-002 — test negatywny prywatności Vault: RETRIEVAL RAG (Teresa/agent)', () => {
  beforeEach(() => {
    docs.length = 0;
    chunks.length = 0;
    docs.push(
      {
        id: 'doc-a-private',
        organization_id: ORG,
        scope: 'user',
        status: 'indexed',
        deleted_at: null,
        filename: 'notatki-prywatne-A.pdf',
      },
      {
        id: 'doc-org',
        organization_id: ORG,
        scope: 'organization',
        status: 'indexed',
        deleted_at: null,
        filename: 'polityka-firmy.pdf',
      }
    );
    chunks.push(
      { id: 'chunk-a-private', doc_id: 'doc-a-private', content: 'sekret finansowy klienta A tajne dane' },
      { id: 'chunk-org', doc_id: 'doc-org', content: 'jawna polityka organizacji dostepna wszystkim' }
    );
    mockAll.mockClear();
    mockRun.mockClear();
  });

  it('bm25Search(orgId) NIE zwraca chunka z prywatnego dokumentu (żadnego usera)', async () => {
    const results = await RagService.bm25Search('sekret tajne dane', 10, ORG);
    const ids = results.map((r: any) => r.id);
    expect(ids).not.toContain('chunk-a-private'); // ★ negatywny test prywatności RAG
  });

  it('bm25Search(orgId) nadal zwraca chunk z organizacyjnego dokumentu', async () => {
    const results = await RagService.bm25Search('jawna polityka dostepna', 10, ORG);
    const ids = results.map((r: any) => r.id);
    expect(ids).toContain('chunk-org');
  });

  it('getContextKeyword(orgId) NIE wplata prywatnej treści do kontekstu AI', async () => {
    const context = await RagService.getContextKeyword('sekret tajne dane finansowy', 5, ORG);
    expect(context).not.toMatch(/sekret finansowy/);
  });

  it('scope clause jest faktycznie w wygenerowanym SQL (dowód, że filtr nie zniknął przy refaktorze)', async () => {
    await RagService.bm25Search('cokolwiek', 10, ORG);
    const dataCall = mockAll.mock.calls.find(
      (c) => /FROM knowledge_chunks c/.test(String(c[0])) && /JOIN knowledge_docs d/.test(String(c[0]))
    );
    expect(String(dataCall?.[0])).toMatch(/d\.scope IS NULL OR d\.scope != 'user'/);
  });
});
