import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const filterRecordFields = vi.fn();
const tableHasFieldPermissions = vi.fn();
vi.mock('../FieldPermissionService.js', () => ({
  fieldPermissionService: {
    tableHasFieldPermissions: (...args: unknown[]) => tableHasFieldPermissions(...args),
    filterRecordFields: (...args: unknown[]) => filterRecordFields(...args),
  },
}));

import viewQueryEngine from '../ViewQueryEngine.js';

beforeEach(() => {
  mockQuery.mockReset();
  filterRecordFields.mockReset();
  tableHasFieldPermissions.mockReset();
  // loadFieldTypes / loadFieldNameToId: empty field list is enough for these cases.
  mockQuery.mockResolvedValue({ rows: [] });
});

describe('ViewQueryEngine — filterByFormula fails closed', () => {
  it('a malformed formula (unbalanced paren) rejects instead of returning the whole table', async () => {
    await expect(
      viewQueryEngine.executeQuery({
        tableId: 't1',
        filterByFormula: 'LOWER({Name}',
      })
    ).rejects.toThrow(/invalid filterByFormula/);
  });

  it('an unsupported function call rejects instead of silently no-op TRUE', async () => {
    await expect(
      viewQueryEngine.executeQuery({
        tableId: 't1',
        filterByFormula: 'NOTAREALFUNCTION({Name})',
      })
    ).rejects.toThrow(/unsupported/);
  });
});

describe('ViewQueryEngine — field-read masking on the view/list read path', () => {
  it('masks record.data via FieldPermissionService when userRole is present and the table has field perms', async () => {
    // Route by SQL shape so this isn't brittle to the exact query count/order
    // (e.g. the row-policy lookup only fires because userRole is set).
    mockQuery.mockImplementation((sql: string) => {
      if (/COUNT\(\*\)/i.test(sql)) return Promise.resolve({ rows: [{ total: '1' }] });
      if (/FROM tp_records/i.test(sql)) {
        return Promise.resolve({
          rows: [{ id: 'r1', table_id: 't1', data: { secret: 'x', public: 'y' } }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    tableHasFieldPermissions.mockResolvedValue(true);
    filterRecordFields.mockResolvedValue({ public: 'y' });

    const result = await viewQueryEngine.executeQuery({
      tableId: 't1',
      userRole: 'viewer',
    });

    expect(filterRecordFields).toHaveBeenCalledTimes(1);
    expect(filterRecordFields.mock.calls[0][1]).toBe('t1');
    expect(filterRecordFields.mock.calls[0][2]).toBe('viewer');
    expect((result.records[0] as { data: unknown }).data).toEqual({ public: 'y' });
  });

  it('does not call FieldPermissionService when no userRole is provided (internal/service callers)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'r1', table_id: 't1', data: { secret: 'x' } }],
      });

    await viewQueryEngine.executeQuery({ tableId: 't1' });

    expect(filterRecordFields).not.toHaveBeenCalled();
  });
});
