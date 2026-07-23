/**
 * VLT-002 — test negatywny prywatności Vault (DEC-003), część (a): LISTA.
 *
 * Dokument `scope='user'` należący do usera A NIE MOŻE pojawić się na liście
 * `/documents` usera B tej samej organizacji (domyślny widok bez `?scope=`).
 * User A widzi swój własny prywatny dokument.
 *
 * Fake-DB w pamięci odwzorowuje semantykę realnej klauzuli WHERE z
 * `KnowledgeService.getDocuments` — widok domyślny (feat/vlt-001-vault-scope,
 * `server/src/services/KnowledgeService.ts` ok. :736-747):
 *   ((scope = 'user' AND owner_id = ?) OR (scope = 'organization' OR scope IS NULL) OR <project>)
 * Wzorzec zgodny z `tests/backend/harvey-vault/knowledgeOrgScope.test.ts` (HP-22):
 * mock przechwytuje SQL+params, sprawdzamy KONTRAKT (userId jest bound param, nie
 * ozdobnikiem), nie tylko wynik.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DocRow {
  id: string;
  organization_id: string | null;
  owner_id: string | null;
  scope: string | null;
  project_id: string | null;
  filename: string;
  deleted_at?: string | null;
}

const docs: DocRow[] = [];

const ORG = 'org-1';
const USER_A = 'user-A';
const USER_B = 'user-B';

/** Emuluje `getDocuments` widok domyślny (brak `?scope=`) — patrz nagłówek pliku. */
function applyDefaultViewFilter(sql: string, params: unknown[]): DocRow[] {
  if (!/FROM knowledge_docs/.test(sql)) return [];
  const orgParam = String(params[0]);
  let rows = docs.filter(
    (r) => !r.deleted_at && (r.organization_id === orgParam || r.organization_id === null)
  );

  const isDefaultViewBranch = /\(scope = 'user' AND owner_id = \?\) OR \(scope = 'organization' OR scope IS NULL\)/.test(
    sql
  );
  if (isDefaultViewBranch) {
    const uid = String(params[1]);
    rows = rows.filter(
      (r) => (r.scope === 'user' && r.owner_id === uid) || r.scope === 'organization' || r.scope == null
    );
  }
  return rows;
}

const mockAll = vi.fn(async (sql: string, params: unknown[]) => applyDefaultViewFilter(sql, params));
const mockRun = vi.fn(async () => ({ changes: 0 }));
const mockGet = vi.fn(async () => undefined);

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (sql: string, params: unknown[]) => mockAll(sql, params),
  run: (sql: string, params: unknown[]) => mockRun(sql, params),
  get: (sql: string, params: unknown[]) => mockGet(sql, params),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import KnowledgeService from '../../../server/src/services/KnowledgeService.js';

describe('VLT-002 — test negatywny prywatności Vault: LISTA /documents', () => {
  beforeEach(() => {
    docs.length = 0;
    docs.push(
      {
        id: 'doc-a-private',
        organization_id: ORG,
        owner_id: USER_A,
        scope: 'user',
        project_id: null,
        filename: 'notatki-prywatne-A.pdf',
      },
      {
        id: 'doc-org',
        organization_id: ORG,
        owner_id: null,
        scope: 'organization',
        project_id: null,
        filename: 'polityka-firmy.pdf',
      }
    );
    mockAll.mockClear();
    mockRun.mockClear();
    mockGet.mockClear();
  });

  it('user B (ta sama org) NIE widzi prywatnego dokumentu user A w domyślnym widoku', async () => {
    const docsForB = await KnowledgeService.getDocuments(ORG, USER_B, 'USER', {
      scope: null,
      projectId: null,
      memberProjectIds: [],
    });
    const ids = docsForB.map((d: any) => d.id);
    expect(ids).not.toContain('doc-a-private'); // ★ negatywny test prywatności
    expect(ids).toContain('doc-org'); // organizacyjny nadal widoczny
  });

  it('user A widzi WŁASNY prywatny dokument w domyślnym widoku', async () => {
    const docsForA = await KnowledgeService.getDocuments(ORG, USER_A, 'USER', {
      scope: null,
      projectId: null,
      memberProjectIds: [],
    });
    const ids = docsForA.map((d: any) => d.id);
    expect(ids).toContain('doc-a-private');
    expect(ids).toContain('doc-org');
  });

  it('userId jest bound param (nie ozdobnik) — dowód kontraktu jak w HP-22', async () => {
    await KnowledgeService.getDocuments(ORG, USER_B, 'USER', {
      scope: null,
      projectId: null,
      memberProjectIds: [],
    });
    const call = mockAll.mock.calls.find((c) => /FROM knowledge_docs/.test(String(c[0])));
    expect(call?.[1]).toContain(USER_B);
  });
});
