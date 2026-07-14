/**
 * HP-22 — izolacja org-scope Client Vault (Blok F Harvey-Parity).
 *
 * Klient org A NIE MOŻE zobaczyć/edytować/skasować dokumentów org B.
 * Test podstawia fake-DB, który emuluje realną semantykę WHERE z SQL-a
 * KnowledgeService (organization_id = ? [OR IS NULL]) i wiąże parametry.
 * Dzięki temu weryfikujemy KONTRAKT: orgId jest parametrem filtra, a nie
 * pochodzi z ciała/zapytania (lekcja z fixu SCIM 07-14).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  organization_id: string | null;
  filename: string;
  category?: string | null;
  deleted_at?: string | null;
}

// In-memory tabela knowledge_docs współdzielona przez fake-DB.
const table: Row[] = [];

/**
 * Emuluje SQL WHERE po parametrach — TYLKO tyle, ile trzeba do udowodnienia
 * org-scope. Klucz: filtr używa `orgParam` z bound-params, nie stałej.
 */
function applyOrgFilter(sql: string, params: unknown[]): Row[] {
  const orgParam = String(params[0]);
  const allowNull = /organization_id IS NULL/.test(sql);
  return table.filter((r) => {
    if (r.deleted_at) return false;
    if (r.organization_id === orgParam) return true;
    if (allowNull && r.organization_id === null) return true;
    return false;
  });
}

const mockAll = vi.fn(async (sql: string, params: unknown[]) => applyOrgFilter(sql, params));
const mockRun = vi.fn(async (sql: string, params: unknown[]) => {
  // deleteDocument / updateDocumentMetadata: WHERE id = ? AND (org = ? [OR IS NULL])
  const id = String(params[params.length - 2] ?? params[0]);
  const orgParam = String(params[params.length - 1] ?? '');
  const allowNull = /organization_id IS NULL/.test(sql);
  let changes = 0;
  for (const r of table) {
    const orgOk = r.organization_id === orgParam || (allowNull && r.organization_id === null);
    if (r.id === id && orgOk) {
      if (/deleted_at/.test(sql)) r.deleted_at = 'now';
      changes++;
    }
  }
  return { changes };
});

vi.mock('../../src/utils/DbPromise.js', () => ({
  all: (sql: string, params: unknown[]) => mockAll(sql, params),
  run: (sql: string, params: unknown[]) => mockRun(sql, params),
  get: vi.fn(),
}));

vi.mock('../../src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ensureKnowledgeSchema wykonuje DDL — w teście no-op przez powyższy mock run.
import KnowledgeService from '../../src/services/KnowledgeService.js';

const ORG_A = 'org-aaaa';
const ORG_B = 'org-bbbb';

describe('HP-22 KnowledgeService org-scope izolacja', () => {
  beforeEach(() => {
    table.length = 0;
    table.push(
      { id: 'doc-a1', organization_id: ORG_A, filename: 'a-secret.pdf', category: 'X' },
      { id: 'doc-b1', organization_id: ORG_B, filename: 'b-secret.pdf', category: 'X' },
      { id: 'doc-glob', organization_id: null, filename: 'global.pdf', category: 'X' }
    );
    mockAll.mockClear();
    mockRun.mockClear();
  });

  it('getDocuments(orgA) NIE zwraca dokumentu org B', async () => {
    const docs = await KnowledgeService.getDocuments(ORG_A);
    const ids = docs.map((d: any) => d.id);
    expect(ids).toContain('doc-a1');
    expect(ids).not.toContain('doc-b1'); // cross-org leak guard
    // orgId związany jako parametr (nie stała w SQL)
    const call = mockAll.mock.calls.find((c) => /knowledge_docs/.test(String(c[0])));
    expect(call?.[1]?.[0]).toBe(ORG_A);
  });

  it('getDocumentsByCategory(orgA) też izoluje po org', async () => {
    const docs = await KnowledgeService.getDocumentsByCategory(ORG_A, 'X');
    const ids = docs.map((d: any) => d.id);
    expect(ids).not.toContain('doc-b1');
  });

  it('deleteDocument(orgA, docB) NIE kasuje dokumentu org B', async () => {
    const res = await KnowledgeService.deleteDocument(ORG_A, 'doc-b1');
    expect(res.deleted).toBe(false);
    expect(table.find((r) => r.id === 'doc-b1')?.deleted_at).toBeFalsy();
  });

  it('deleteDocument(orgA, docA) kasuje własny dokument', async () => {
    const res = await KnowledgeService.deleteDocument(ORG_A, 'doc-a1');
    expect(res.deleted).toBe(true);
    expect(table.find((r) => r.id === 'doc-a1')?.deleted_at).toBeTruthy();
  });
});
