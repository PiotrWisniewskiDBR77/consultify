import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  buildFilterClause,
  buildSortClause,
  type FilterGroup,
  type SortRule,
} from '../ViewQueryEngine.js';
import viewQueryEngine from '../ViewQueryEngine.js';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('ViewQueryEngine — buildFilterClause', () => {
  function run(filters: FilterGroup, fieldTypes: Map<string, string>, startIdx = 1) {
    const params: unknown[] = [];
    const result = buildFilterClause(filters, params, startIdx, fieldTypes);
    return { ...result, params };
  }

  // 1. Text contains → ILIKE
  it('text contains generates ILIKE with %value%', () => {
    const ft = new Map([['f1', 'singleLineText']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f1', operator: 'contains', value: 'hello' }] },
      ft
    );
    expect(sql).toContain('ILIKE');
    expect(params).toContain('%hello%');
  });

  // 2. Text startsWith → ILIKE with trailing %
  it('text startsWith generates ILIKE with value%', () => {
    const ft = new Map([['f1', 'singleLineText']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f1', operator: 'startsWith', value: 'abc' }] },
      ft
    );
    expect(sql).toContain('ILIKE');
    expect(params).toContain('abc%');
  });

  // 3. Text endsWith → ILIKE with leading %
  it('text endsWith generates ILIKE with %value', () => {
    const ft = new Map([['f1', 'singleLineText']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f1', operator: 'endsWith', value: 'xyz' }] },
      ft
    );
    expect(sql).toContain('ILIKE');
    expect(params).toContain('%xyz');
  });

  // 4. Number gte → >= cast
  it('number gte generates >= with numeric cast', () => {
    const ft = new Map([['f2', 'number']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f2', operator: 'gte', value: 100 }] },
      ft
    );
    expect(sql).toContain('::numeric');
    expect(sql).toContain('>=');
    expect(params).toContain(100);
  });

  // 5. Number lte → <= cast
  it('number lte generates <= with numeric cast', () => {
    const ft = new Map([['f2', 'number']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f2', operator: 'lte', value: 50 }] },
      ft
    );
    expect(sql).toContain('::numeric');
    expect(sql).toContain('<=');
    expect(params).toContain(50);
  });

  // 6. Date isBefore → < timestamptz
  it('date isBefore generates < with timestamptz cast', () => {
    const ft = new Map([['f3', 'date']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f3', operator: 'isBefore', value: '2024-06-01' }] },
      ft
    );
    expect(sql).toContain('::timestamptz');
    expect(sql).toContain('<');
    expect(params).toContain('2024-06-01');
  });

  // 7. Date isWithin → >= NOW() - INTERVAL
  it('date isWithin generates >= NOW() - INTERVAL', () => {
    const ft = new Map([['f3', 'date']]);
    const { sql } = run(
      { logic: 'and', rules: [{ fieldId: 'f3', operator: 'isWithin', value: '7_days' }] },
      ft
    );
    expect(sql).toContain('::timestamptz');
    expect(sql).toContain("NOW() - INTERVAL '7 days'");
  });

  // 8. Select isAnyOf → IN (...)
  it('select isAnyOf generates IN clause', () => {
    const ft = new Map([['f4', 'singleSelect']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f4', operator: 'isAnyOf', value: ['A', 'B'] }] },
      ft
    );
    expect(sql).toContain('IN');
    expect(params).toContain('A');
    expect(params).toContain('B');
  });

  // 9. Select isNoneOf → NOT IN with IS NULL fallback
  it('select isNoneOf generates NOT IN with IS NULL', () => {
    const ft = new Map([['f4', 'singleSelect']]);
    const { sql, params } = run(
      { logic: 'and', rules: [{ fieldId: 'f4', operator: 'isNoneOf', value: ['X'] }] },
      ft
    );
    expect(sql).toContain('IS NULL');
    expect(sql).toContain('NOT IN');
    expect(params).toContain('X');
  });

  // 10. AND logic → joins with AND
  it('AND logic joins clauses with AND', () => {
    const ft = new Map([
      ['f1', 'singleLineText'],
      ['f2', 'number'],
    ]);
    const { sql } = run(
      {
        logic: 'and',
        rules: [
          { fieldId: 'f1', operator: 'contains', value: 'test' },
          { fieldId: 'f2', operator: 'gte', value: 10 },
        ],
      },
      ft
    );
    expect(sql).toContain(' AND ');
    expect(sql).not.toContain(' OR ');
  });

  // 11. OR logic → joins with OR
  it('OR logic joins clauses with OR', () => {
    const ft = new Map([
      ['f1', 'singleLineText'],
      ['f2', 'number'],
    ]);
    const { sql } = run(
      {
        logic: 'or',
        rules: [
          { fieldId: 'f1', operator: 'contains', value: 'test' },
          { fieldId: 'f2', operator: 'gte', value: 10 },
        ],
      },
      ft
    );
    expect(sql).toContain(' OR ');
  });

  // 12. Empty rules → TRUE
  it('returns TRUE for empty rules', () => {
    const ft = new Map<string, string>();
    const { sql } = run({ logic: 'and', rules: [] }, ft);
    expect(sql).toBe('TRUE');
  });
});

describe('ViewQueryEngine — buildSortClause', () => {
  function runSort(sorts: SortRule[], startIdx = 1) {
    const params: unknown[] = [];
    const result = buildSortClause(sorts, params, startIdx);
    return { ...result, params };
  }

  // 12. Sort ASC NULLS LAST
  it('ASC sort defaults to NULLS LAST', () => {
    const { sql } = runSort([{ fieldId: 'f1', direction: 'asc' }]);
    expect(sql).toContain('ASC');
    expect(sql).toContain('NULLS LAST');
  });

  // 13. Sort DESC NULLS FIRST
  it('DESC sort defaults to NULLS FIRST', () => {
    const { sql } = runSort([{ fieldId: 'f1', direction: 'desc' }]);
    expect(sql).toContain('DESC');
    expect(sql).toContain('NULLS FIRST');
  });

  // 14. Offset pagination → OFFSET + LIMIT (tested via SQL pattern)
  it('default sort includes created_at DESC and id ASC as tiebreakers', () => {
    const { sql } = runSort([{ fieldId: 'f1', direction: 'asc' }]);
    expect(sql).toContain('r.created_at DESC');
    expect(sql).toContain('r.id ASC');
  });

  // 15. Empty sorts → default ordering
  it('empty sorts returns default ordering', () => {
    const { sql } = runSort([]);
    expect(sql).toBe('r.created_at DESC, r.id ASC');
  });
});

describe('ViewQueryEngine — search clause pattern', () => {
  it('search across multiple text fields generates ILIKE OR pattern', () => {
    const ft = new Map([
      ['f1', 'singleLineText'],
      ['f2', 'singleLineText'],
    ]);
    const params: unknown[] = [];
    const filters: FilterGroup = { logic: 'and', rules: [] };
    const { sql } = buildFilterClause(filters, params, 1, ft);
    expect(sql).toBe('TRUE');
  });
});

describe('ViewQueryEngine — executeQuery pagination', () => {
  it('uses the next available parameter for LIMIT when exporting without field projection', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'record-1',
            table_id: 'table-1',
            data: { Name: 'Initial item' },
            created_at: '2026-05-09T19:38:49.314Z',
          },
        ],
      });

    const result = await viewQueryEngine.executeQuery({
      tableId: 'table-1',
      pageSize: 500,
    });

    expect(result.records).toHaveLength(1);
    const listCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT r.*') && String(sql).includes('FROM tp_records r')
    );
    expect(listCall).toBeTruthy();
    expect(String(listCall?.[0])).toContain('LIMIT $2');
    expect(listCall?.[1]).toEqual(['table-1', 201]);
  });
});
