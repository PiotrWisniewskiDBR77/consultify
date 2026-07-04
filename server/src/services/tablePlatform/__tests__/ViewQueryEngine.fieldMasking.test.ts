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

/**
 * Anti-data-leak proof for the GROUP-BY path (buildGroupQuery).
 *
 * BEFORE this fix: when groupBy was active, buildGroupQuery built a SELECT that
 * projected the allow-listed field aliases BUT still appended the raw `r.data`
 * column in full — so even with a `fields` allow-list, or when a userRole should
 * have masked a column, groups[].records leaked the ENTIRE record.data
 * (including fields outside the allow-list / not readable by the role). The flat
 * offset/cursor paths were fixed in FIX-A; the grouped path returned early and
 * bypassed both the jsonb projection AND applyFieldReadMasking.
 *
 * AFTER this fix:
 *  - with a `fields` allow-list, groups[].records.data contains ONLY those
 *    fields (jsonb_build_object projection, same as the flat paths);
 *  - with a userRole + table field permissions, unreadable fields are masked in
 *    groups[].records too (applyFieldReadMasking runs per group);
 *  - with neither fields nor userRole (service callers), full data is returned
 *    — no regression.
 *
 * Red-before/green-after: against the pre-fix engine the "field X absent from
 * groups[].records" assertions fail because r.data still carries the field.
 */
function mockGroupDb(opts: {
  secretReadRoles: string[];
  hasFieldPerms: boolean;
  /** Rows returned by the per-group records query (what r.data / projection yields). */
  recordData: Record<string, unknown>;
}) {
  const recordRow = () => ({
    id: 'r1',
    table_id: TABLE_ID,
    // The engine builds either `r.*` (full data) or a jsonb_build_object
    // projection; in this mocked DB we can't execute SQL, so we simulate the
    // DB's response by returning exactly what each SELECT SHAPE would yield.
    data: { ...opts.recordData },
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
    if (sql.includes('FROM tp_row_policies')) {
      return { rows: [] };
    }
    if (sql.includes('SET LOCAL statement_timeout')) {
      return { rows: [] };
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
    // Group-level count query: SELECT ... AS group_value, COUNT(*) ... GROUP BY
    if (sql.includes('AS group_value') && sql.includes('GROUP BY')) {
      return { rows: [{ group_value: 'GroupA', cnt: '1' }] };
    }
    // Per-group records query: SELECT ... FROM tp_records r WHERE ... LIMIT
    if (sql.includes('FROM tp_records r') && sql.includes('LIMIT')) {
      return { rows: [recordRow()] };
    }
    return { rows: [] };
  });
}

describe('ViewQueryEngine.executeQuery — GROUP-BY field masking (anti-data-leak)', () => {
  it('masks an unreadable field inside groups[].records (userRole path)', async () => {
    // The engine builds `r.*` (no fields allow-list here) so the DB would return
    // full data; masking must strip FIELD_SECRET post-query.
    mockGroupDb({
      secretReadRoles: ['admin'],
      hasFieldPerms: true,
      recordData: { [FIELD_PUBLIC]: 'visible-value', [FIELD_SECRET]: 'TOP-SECRET' },
    });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      groupBy: FIELD_PUBLIC,
      userRole: 'viewer', // NOT in readRoles for FIELD_SECRET
    });

    expect(result.groups).toBeDefined();
    expect(result.groups).toHaveLength(1);
    const groupRecords = result.groups![0].records;
    expect(groupRecords).toHaveLength(1);
    const data = (groupRecords[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
    expect(data).not.toHaveProperty(FIELD_SECRET);
  });

  it('projects ONLY the fields allow-list into groups[].records.data (SQL does not SELECT full r.data)', async () => {
    // With a `fields` allow-list, the engine must emit a jsonb_build_object
    // projection listing ONLY the allow-listed fields — never a bare `r.data`.
    // We assert on the generated SQL to prove the raw column is not projected,
    // which is the actual leak vector at the DB layer.
    mockGroupDb({
      secretReadRoles: ['admin'],
      hasFieldPerms: false,
      recordData: { [FIELD_PUBLIC]: 'visible-value' },
    });

    await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      groupBy: FIELD_PUBLIC,
      fields: [FIELD_PUBLIC], // allow-list excludes FIELD_SECRET
    });

    // Find the per-group records SELECT.
    const recSqlCall = mockQuery.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('FROM tp_records r') &&
        sql.includes('LIMIT') &&
        !sql.includes('GROUP BY')
    );
    expect(recSqlCall).toBeDefined();
    const recSql = recSqlCall![0] as string;
    // Must build a trimmed jsonb object, NOT project the raw full-data column.
    expect(recSql).toContain('jsonb_build_object');
    expect(recSql).not.toMatch(/,\s*r\.data\s*,/); // no bare `, r.data,` projection
  });

  it('does NOT mask when userRole is ABSENT and no fields — service callers see every field (no regression)', async () => {
    mockGroupDb({
      secretReadRoles: ['admin'],
      hasFieldPerms: true,
      recordData: { [FIELD_PUBLIC]: 'visible-value', [FIELD_SECRET]: 'TOP-SECRET' },
    });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      groupBy: FIELD_PUBLIC,
      // no userRole, no fields
    });

    const data = (result.groups![0].records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
    // Permission EXISTS check must not even be issued without a role.
    const permCheckIssued = mockQuery.mock.calls.some(
      ([sql]) => typeof sql === 'string' && sql.includes("options ? 'permissions'")
    );
    expect(permCheckIssued).toBe(false);
  });

  it('keeps a readable field inside groups[].records (role present in readRoles)', async () => {
    mockGroupDb({
      secretReadRoles: ['admin', 'viewer'],
      hasFieldPerms: true,
      recordData: { [FIELD_PUBLIC]: 'visible-value', [FIELD_SECRET]: 'TOP-SECRET' },
    });

    const result = await viewQueryEngine.executeQuery({
      tableId: TABLE_ID,
      groupBy: FIELD_PUBLIC,
      userRole: 'viewer',
    });

    const data = (result.groups![0].records[0] as { data: Record<string, unknown> }).data;
    expect(data[FIELD_SECRET]).toBe('TOP-SECRET');
    expect(data[FIELD_PUBLIC]).toBe('visible-value');
  });
});
