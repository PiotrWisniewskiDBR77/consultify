/**
 * Table Platform · row-level policy enforcement contract test.
 *
 * Cel (anty-false-green): udowodnić, że per-wiersz RowPolicy ('none') zawęża
 * zbiór wierszy DOPIERO gdy `userRole` jest przewleczony do
 * ViewQueryEngine.executeQuery — dokładnie ta wartość, którą trasy REST gubiły.
 *
 * REALNY RowPolicyService + REALNY ViewQueryEngine (NIE mocki) biegną przeciw
 * wiernemu in-memory poolowi Postgresa. Pool NIE echuje — faktycznie stosuje
 * wygenerowaną klauzulę WYKLUCZAJĄCĄ (NOT (r.data->>$k = $v)) do zapisanych
 * wierszy, więc gdyby RowPolicyService przestał generować klauzulę (albo trasa
 * nie podała userRole) — zbiór NIE zawęża się i test to wykrywa.
 *
 * Dowód:
 *  - executeQuery BEZ userRole → wszystkie wiersze (stan sprzed fixu tras)
 *  - executeQuery Z rolą "viewer" (policy 'none' na region='EU') → tylko nie-EU
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RowPolicy {
  id: string;
  table_id: string;
  role: string;
  permission: 'none' | 'read' | 'write';
  condition_field_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  is_active: boolean;
  created_at: string;
}

const store = new Map<string, StoredRow>();
const policies: RowPolicy[] = [];
const TABLE = 'tbl-rowpolicy-1';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Wierne zastosowanie klauzuli wykluczającej wygenerowanej przez REALNY
 * RowPolicyService. Parsujemy wzorce `NOT (r.data->>$A = $B)` z SQL i mapujemy
 * je na `params[A-1]` (klucz pola) i `params[B-1]` (wartość) — zero echa.
 */
function rowPassesWhere(row: StoredRow, sql: string, params: unknown[]): boolean {
  // wszystkie wykluczenia równościowe z klauzuli row-policy
  const re = /NOT \(r\.data->>\$(\d+) = \$(\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const fieldKey = String(params[Number(m[1]) - 1]);
    const value = String(params[Number(m[2]) - 1]);
    if (String(row.data[fieldKey] ?? '') === value) {
      return false; // wiersz wykluczony przez policy 'none'
    }
  }
  return true;
}

const fakePool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('SET LOCAL statement_timeout')) return { rows: [], rowCount: 0 };

    // loadFieldTypes
    if (s.startsWith('SELECT id, field_type FROM tp_fields')) {
      return {
        rows: [
          { id: 'name', field_type: 'text' },
          { id: 'region', field_type: 'text' },
        ],
        rowCount: 2,
      };
    }

    // RowPolicyService.buildRowFilterClause — realny kod czyta stąd policies
    if (s.startsWith('SELECT * FROM tp_row_policies')) {
      const [tableId, role] = params as [string, string];
      const rows = policies.filter(
        (p) =>
          p.table_id === tableId &&
          p.is_active === true &&
          p.role === role &&
          p.permission === 'none'
      );
      return { rows: rows.map(clone), rowCount: rows.length };
    }

    // COUNT — stosuje wygenerowaną klauzulę policy
    if (s.startsWith('SELECT COUNT(*) AS total FROM tp_records r')) {
      const rows = [...store.values()]
        .filter((r) => r.table_id === (params[0] as string))
        .filter((r) => rowPassesWhere(r, s, params));
      return { rows: [{ total: String(rows.length) }], rowCount: 1 };
    }

    // LIST — stosuje tę samą klauzulę
    if (s.includes('FROM tp_records r') && s.includes('SELECT r.*')) {
      const rows = [...store.values()]
        .filter((r) => r.table_id === (params[0] as string))
        .filter((r) => rowPassesWhere(r, s, params))
        .map(clone);
      return { rows, rowCount: rows.length };
    }

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => fakePool,
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// NOTE: RowPolicyService oraz ViewQueryEngine NIE są mockowane — realny kod.

import viewQueryEngine from '../../../server/src/services/tablePlatform/ViewQueryEngine.js';

function seedRows(): void {
  store.clear();
  const now = new Date().toISOString();
  const mk = (id: string, region: string) =>
    store.set(id, {
      id,
      table_id: TABLE,
      data: { name: id, region },
      created_by: 'user-1',
      created_at: now,
      updated_at: now,
    });
  mk('r-eu-1', 'EU');
  mk('r-eu-2', 'EU');
  mk('r-us-1', 'US');
  mk('r-apac-1', 'APAC');
}

function seedNonePolicyForViewerOnEU(): void {
  policies.length = 0;
  policies.push({
    id: 'pol-1',
    table_id: TABLE,
    role: 'viewer',
    permission: 'none',
    condition_field_id: 'region',
    condition_operator: 'equals',
    condition_value: 'EU',
    is_active: true,
    created_at: new Date().toISOString(),
  });
}

describe('Table Platform · row-level policy enforcement (anty-false-green)', () => {
  beforeEach(() => {
    fakePool.query.mockClear();
    seedRows();
    seedNonePolicyForViewerOnEU();
  });

  it('BEZ userRole: executeQuery zwraca WSZYSTKIE wiersze (stan sprzed fixu tras)', async () => {
    const result = await viewQueryEngine.executeQuery({ tableId: TABLE, pageSize: 50 });
    expect(result.total).toBe(4);
    expect(result.records.length).toBe(4);
    // policy nie została odpytana — brak userRole
    const policyQueried = fakePool.query.mock.calls.some((c) =>
      String(c[0]).includes('tp_row_policies')
    );
    expect(policyQueried).toBe(false);
  });

  it('Z rolą "viewer" (policy none na region=EU): zbiór ZAWĘŻONY do nie-EU', async () => {
    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE,
      pageSize: 50,
      userRole: 'viewer',
    });
    // 2 wiersze EU ukryte → zostają US + APAC
    expect(result.total).toBe(2);
    expect(result.records.length).toBe(2);
    const regions = (result.records as any[]).map((r) => r.data.region).sort();
    expect(regions).toEqual(['APAC', 'US']);
    // dowód realnego wejścia w RowPolicyService
    expect(
      fakePool.query.mock.calls.some((c) => String(c[0]).includes('tp_row_policies'))
    ).toBe(true);
  });

  it('Rola bez policy (base_owner): pełny zbiór mimo przekazanego userRole', async () => {
    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE,
      pageSize: 50,
      userRole: 'base_owner',
    });
    expect(result.total).toBe(4);
    expect(result.records.length).toBe(4);
  });
});
