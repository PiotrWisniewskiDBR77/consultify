/**
 * Anti-data-leak proof for field-read permission masking in the list-by-view
 * path (DEFECT 2).
 *
 * BEFORE this fix: viewQueryEngine.executeQuery applied the ROW policy
 * (RowPolicyService) but NEVER the FIELD-read policy — it never called
 * FieldPermissionService.filterRecordFields. Listing records through a view
 * (the main read path) therefore returned EVERY column, including columns a
 * role had no field-read permission for. Compare RecordsService.listRecords,
 * which does mask fields when a userRole is present.
 *
 * AFTER this fix: when `options.userRole` is present AND the table declares
 * field permissions, executeQuery masks unreadable fields from each returned
 * record's `data`, using the exact same FieldPermissionService.filterRecordFields
 * semantics as RecordsService. When `userRole` is absent (internal / service
 * callers), nothing is masked — those paths must see everything.
 *
 * This is proven with a mocked DB (no real Postgres). We drive the REAL
 * FieldPermissionService (only Database.js is mocked), so the masking logic
 * under test is genuine, not a re-implementation.
 *
 * Red-before/green-after: run this file against the pre-fix ViewQueryEngine
 * (git stash the fix) — the "field X is masked" cases fail because the secret
 * column is still present in the returned record. All pass after the fix.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import viewQueryEngine from '../ViewQueryEngine.js';

const TABLE_ID = 'table-1';
const FIELD_PUBLIC = 'field-public';
const FIELD_SECRET = 'field-secret';

/**
 * Wire up all the SQL surfaces executeQuery + RowPolicyService +
 * FieldPermissionService touch:
 *  - field-types metadata lookup
 *  - row-policy lookup (empty => no row restriction)
 *  - statement timeout SET
 *  - count query
 *  - list query (returns one record with BOTH a public and a secret field)
 *  - tableHasFieldPermissions EXISTS check
 *  - filterRecordFields field-options lookup
 *
 * `secretReadableBy` controls which role may read FIELD_SECRET; FIELD_PUBLIC
 * has no permissions (readable by all). `hasFieldPerms` toggles the EXISTS
 * short-circuit.
 */
function mockDb(opts: { secretReadRoles: string[]; hasFieldPerms: boolean }) {
  const recordRow = () => ({
    id: 'r1',
    table_id: TABLE_ID,
    data: { [FIELD_PUBLIC]: 'visible-value', [FIELD_SECRET]: 'TOP-SECRET' },
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    created_by: 'u1',
  });

  mockQuery.mockImplementation(async (sql: string) => {
    if (typeof sql !== 'string') return { rows: [] };

    if (sql.includes('SELECT id, field_type FROM tp_fields')) {
      return {
        rows: [
          { id: FIELD_PUBLIC, field_type: 'singleLineText' },
          { id: FIELD_SECRET, field_type: 'singleLineText' },
        ],
      };
    }
    // RowPolicyService.buildRowFilterClause — no policies => filter is TRUE.
    if (sql.includes('FROM tp_row_policies')) {
      return { rows: [] };
    }
    if (sql.includes('SET LOCAL statement_timeout')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT COUNT(*) AS total')) {
      return { rows: [{ total: '1' }] };
    }
    // FieldPermissionService.tableHasFieldPermissions
    if (sql.includes("options ? 'permissions'")) {
      return { rows: [{ has_field_perms: opts.hasFieldPerms }] };
    }
    // FieldPermissionService.filterRecordFields
    if (sql.includes('SELECT id, options FROM tp_fields')) {
      return {
        rows: [
          { id: FIELD_PUBLIC, options: {} },
          { id: FIELD_SECRET, options: { permissions: { readRoles: opts.secretReadRoles } } },
        ],
      };
    }
    // list query
    if (sql.includes('FROM tp_records r') && sql.includes('ORDER BY')) {
      return { rows: [recordRow()] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('ViewQueryEngine.executeQuery — field-read masking (anti-data-leak)', () => {
  it('masks a field the userRole cannot read (secret column absent from returned data)', async () => {
    mockDb({ secretReadRoles: ['admin'], hasFieldPerms: true });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      userRole: 'viewer', // NOT in readRoles for FIELD_SECRET
    });

    expect(result.records).toHaveLength(1);
    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
    expect(data).not.toHaveProperty(FIELD_SECRET);
  });

  it('keeps a field the userRole CAN read (role present in readRoles)', async () => {
    mockDb({ secretReadRoles: ['admin', 'viewer'], hasFieldPerms: true });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      userRole: 'viewer',
    });

    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
  });

  it('a wildcard "*" readRole keeps the field for any role', async () => {
    mockDb({ secretReadRoles: ['*'], hasFieldPerms: true });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      userRole: 'nobody-in-particular',
    });

    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
  });

  it('does NOT mask when userRole is ABSENT — internal/service callers see every field', async () => {
    mockDb({ secretReadRoles: ['admin'], hasFieldPerms: true });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      // no userRole
    });

    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
    // The permission EXISTS check must not even be issued without a role.
    const permCheckIssued = mockQuery.mock.calls.some(
      ([sql]) => typeof sql === 'string' && sql.includes("options ? 'permissions'")
    );
    expect(permCheckIssued).toBe(false);
  });

  it('does NOT mask when the table declares no field permissions (short-circuits)', async () => {
    mockDb({ secretReadRoles: ['admin'], hasFieldPerms: false });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      userRole: 'viewer',
    });

    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
    // filterRecordFields (field-options lookup) must NOT run once EXISTS is false.
    const fieldOptionsLookup = mockQuery.mock.calls.some(
      ([sql]) => typeof sql === 'string' && sql.includes('SELECT id, options FROM tp_fields')
    );
    expect(fieldOptionsLookup).toBe(false);
  });

  it('masks on the OFFSET-pagination path too (page > 0)', async () => {
    mockDb({ secretReadRoles: ['admin'], hasFieldPerms: true });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      userRole: 'viewer',
      page: 1,
    });

    expect(result.page).toBe(1);
    const data = (result.records[0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty(FIELD_SECRET);
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
  });
});
