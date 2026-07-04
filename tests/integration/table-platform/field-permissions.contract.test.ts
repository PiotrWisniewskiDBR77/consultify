/**
 * Table Platform · Field-level permissions enforcement contract test.
 *
 * Cel (anty-false-green): udowodnić, że per-pole uprawnienia SĄ egzekwowane
 * DOPIERO gdy `userRole` jest przewleczony do RecordsService — dokładnie ta
 * wartość, którą trasy REST wcześniej gubiły.
 *
 * REALNY FieldPermissionService (NIE mock) biegnie przeciw wiernemu in-memory
 * poolowi Postgresa (przechowuje tp_fields z opcjami `permissions` oraz wiersze
 * tp_records, parsuje jsonb). Serwisy poboczne (audit/webhooki/realtime/…) są
 * mockowane, bo nie dotyczą kontraktu uprawnień.
 *
 * Dowód:
 *  - getRecord(id) BEZ roli  → pole `salary` OBECNE  (stan sprzed fixu tras)
 *  - getRecord(id, 'viewer') → pole `salary` USUNIĘTE (stan po fixie)
 *  - listRecords bez roli    → `salary` obecne; z 'viewer' → usunięte
 *  - updateRecord({salary}, 'viewer') → PermissionError (write denied)
 *  - updateRecord({salary}, 'base_owner') → przechodzi (rola z prawem zapisu)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Wierny in-memory pool (Postgres-compatible) --------------------------
interface StoredRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface StoredField {
  id: string;
  name: string;
  field_type: string;
  options: Record<string, unknown> | null;
}

interface StoredRowPolicy {
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
const fields: StoredField[] = [];
const rowPolicies: StoredRowPolicy[] = [];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const TABLE = 'tbl-fieldperm-1';

const fakePool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // --- FieldPermissionService: has-any-permissions probe --------------
    if (s.startsWith('SELECT EXISTS(') && s.includes("options ? 'permissions'")) {
      const has = fields.some(
        (f) => f.table_id === undefined || (f.options && 'permissions' in (f.options as object))
      );
      return { rows: [{ has_field_perms: has }], rowCount: 1 };
    }

    // --- FieldPermissionService: filterRecordFields ---------------------
    if (s.startsWith('SELECT id, options FROM tp_fields WHERE table_id = $1')) {
      return {
        rows: fields.map((f) => ({ id: f.id, options: f.options })),
        rowCount: fields.length,
      };
    }
    // --- FieldPermissionService: validateWritePermissions ---------------
    if (s.startsWith('SELECT id, name, options FROM tp_fields WHERE table_id = $1')) {
      return {
        rows: fields.map((f) => ({ id: f.id, name: f.name, options: f.options })),
        rowCount: fields.length,
      };
    }

    // --- generic tp_fields probes used elsewhere in RecordsService ------
    if (s.startsWith('SELECT * FROM tp_fields')) {
      return { rows: fields.map(clone), rowCount: fields.length };
    }
    if (s.startsWith('SELECT id, field_type AS type, options FROM tp_fields'))
      return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT id FROM tp_fields')) return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT base_id FROM tp_tables'))
      return { rows: [{ base_id: 'base-1' }], rowCount: 1 };
    if (s.includes('FROM users WHERE id'))
      return { rows: [{ display_name: 'Tester' }], rowCount: 1 };
    if (s.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };

    // --- tp_records writes ----------------------------------------------
    if (s.startsWith('INSERT INTO tp_records')) {
      const [id, tableId, dataJson, createdBy] = params as [string, string, string, string | null];
      const now = new Date().toISOString();
      store.set(id, {
        id,
        table_id: tableId,
        data: JSON.parse(dataJson),
        created_by: createdBy ?? null,
        version: 0,
        created_at: now,
        updated_at: now,
      });
      return { rows: [], rowCount: 1 };
    }

    if (s.startsWith('SELECT * FROM tp_records WHERE id = $1')) {
      const row = store.get(params[0] as string);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }

    // listRecords: COUNT
    if (s.startsWith('SELECT COUNT(*) AS total FROM tp_records r')) {
      const rows = [...store.values()].filter((r) => r.table_id === (params[0] as string));
      return { rows: [{ total: String(rows.length) }], rowCount: 1 };
    }

    // listRecords: SELECT r.* ...
    if (s.includes('FROM tp_records r') && s.startsWith('SELECT r.*')) {
      const rows = [...store.values()]
        .filter((r) => r.table_id === (params[0] as string))
        .map(clone);
      return { rows, rowCount: rows.length };
    }

    if (s.startsWith('UPDATE tp_records')) {
      const id = params[0] as string;
      const row = store.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      if (s.includes('COALESCE(version, 0) = $3')) {
        const expected = params[2] as number;
        if (row.version !== expected) return { rows: [], rowCount: 0 };
      }
      row.data = JSON.parse(params[1] as string);
      if (s.includes('version = COALESCE(version, 0) + 1')) row.version += 1;
      row.updated_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    if (s.startsWith('DELETE FROM tp_records WHERE id = $1')) {
      const existed = store.delete(params[0] as string);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }

    // --- RowPolicyService.evaluateAccess (used by deleteRecord's role gate)
    if (s.startsWith('SELECT * FROM tp_row_policies')) {
      const [tableId, role] = params as [string, string];
      const rows = rowPolicies.filter(
        (p) => p.table_id === tableId && p.is_active === true && p.role === role
      );
      return { rows: rows.map(clone), rowCount: rows.length };
    }

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

// ---- Mocks: I/O + serwisy poboczne (REALNY FieldPermissionService NIETKNIĘTY)
vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => fakePool,
}));
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () =>
    new Set(['id', 'table_id', 'data', 'created_by', 'version', 'created_at', 'updated_at'])
  ),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/SchemaValidationService.js', () => ({
  default: {
    validateRecord: vi.fn(async () => ({ valid: true, errors: [] })),
    validateRecordSize: vi.fn(),
  },
}));
vi.mock('../../../server/src/services/tablePlatform/formulaEngine.js', () => ({
  recomputeAffectedFields: vi.fn(async () => undefined),
}));
vi.mock('../../../server/src/services/tablePlatform/ConfidenceScoringService.js', () => ({
  default: { recompute: vi.fn(async () => ({ applied: false })) },
}));
vi.mock('../../../server/src/services/tablePlatform/AutomationService.js', () => ({
  automationService: { evaluateTriggers: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatchEvent: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/WebhookRelayService.js', () => ({
  webhookRelayService: { dispatchEvent: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/RealtimeService.js', () => ({
  tablePlatformRealtime: {
    notifyRecordCreated: vi.fn(),
    notifyRecordUpdated: vi.fn(),
    notifyRecordDeleted: vi.fn(),
  },
}));
vi.mock('../../../server/src/services/tablePlatform/AuditService.js', () => ({
  default: { logEvent: vi.fn(async () => undefined), logCellChanges: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/AttachmentService.js', () => ({
  default: { getAttachmentsByIds: vi.fn(async () => []) },
}));
vi.mock('../../../server/src/services/tablePlatform/RelationService.js', () => ({
  default: { onRecordDeleted: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/RecordWatchService.js', () => ({
  default: { notifyWatchers: vi.fn(async () => undefined) },
}));
// NOTE: FieldPermissionService celowo NIE jest mockowany — testujemy realny kod.

import recordsService from '../../../server/src/services/tablePlatform/RecordsService.js';
import { PermissionError } from '../../../server/src/services/tablePlatform/ErrorHandling.js';

function seedFieldsWithSalaryRestrictedToOwner(): void {
  fields.length = 0;
  fields.push(
    { id: 'name', name: 'Name', field_type: 'text', options: null },
    {
      id: 'salary',
      name: 'Salary',
      field_type: 'number',
      // viewer NIE może czytać ani pisać; base_owner może oboje.
      options: {
        permissions: {
          readRoles: ['base_owner'],
          writeRoles: ['base_owner'],
        },
      },
    }
  );
}

function seedNonePolicyForViewer(): void {
  rowPolicies.length = 0;
  rowPolicies.push({
    id: 'pol-1',
    table_id: TABLE,
    role: 'viewer',
    permission: 'none',
    condition_field_id: null, // unconditional deny for this role
    condition_operator: null,
    condition_value: null,
    is_active: true,
    created_at: new Date().toISOString(),
  });
}

describe('Table Platform · field-level permission enforcement (anty-false-green)', () => {
  beforeEach(() => {
    store.clear();
    rowPolicies.length = 0;
    fakePool.query.mockClear();
    seedFieldsWithSalaryRestrictedToOwner();
  });

  it('getRecord: BEZ userRole zwraca `salary`; Z rolą "viewer" USUWA `salary`', async () => {
    const rec = await recordsService.createRecord(
      TABLE,
      { name: 'Alice', salary: 12345 },
      'user-1'
    );

    // Pre-fix: trasa nie przekazywała userRole → dane niefiltrowane.
    const leaked = await recordsService.getRecord(rec.id);
    expect(leaked.data.salary).toBe(12345);
    expect(leaked.data.name).toBe('Alice');

    // Post-fix: rola z ograniczeniem odczytu pola → `salary` znika.
    const filtered = await recordsService.getRecord(rec.id, 'viewer');
    expect(filtered.data.salary).toBeUndefined();
    expect(filtered.data.name).toBe('Alice');

    // Rola z prawem odczytu widzi pełny rekord.
    const owner = await recordsService.getRecord(rec.id, 'base_owner');
    expect(owner.data.salary).toBe(12345);
  });

  it('listRecords: BEZ userRole zawiera `salary`; Z rolą "viewer" go usuwa', async () => {
    await recordsService.createRecord(TABLE, { name: 'A', salary: 100 }, 'user-1');
    await recordsService.createRecord(TABLE, { name: 'B', salary: 200 }, 'user-1');

    const leaked = await recordsService.listRecords(TABLE, { pageSize: 50 });
    expect(leaked.records.length).toBe(2);
    expect((leaked.records as any[]).every((r) => r.data.salary !== undefined)).toBe(true);

    const filtered = await recordsService.listRecords(TABLE, { pageSize: 50, userRole: 'viewer' });
    expect(filtered.records.length).toBe(2); // wiersze widoczne (to per-pole, nie per-wiersz)
    expect((filtered.records as any[]).every((r) => r.data.salary === undefined)).toBe(true);
    expect((filtered.records as any[]).every((r) => r.data.name !== undefined)).toBe(true);
  });

  it('updateRecord: zapis do `salary` przez "viewer" → PermissionError; przez "base_owner" → OK', async () => {
    const rec = await recordsService.createRecord(TABLE, { name: 'A', salary: 1 }, 'user-1');

    await expect(
      recordsService.updateRecord(rec.id, { salary: 999 }, 'user-1', undefined, 'viewer')
    ).rejects.toBeInstanceOf(PermissionError);

    // rola z prawem zapisu przechodzi
    const ok = await recordsService.updateRecord(
      rec.id,
      { salary: 999 },
      'user-1',
      undefined,
      'base_owner'
    );
    expect(ok.data.salary).toBe(999);

    // BEZ userRole (stan sprzed fixu) — brak egzekucji, zapis przechodzi.
    const unguarded = await recordsService.updateRecord(rec.id, { salary: 42 }, 'user-1');
    expect(unguarded.data.salary).toBe(42);
  });

  it('createRecord: zapis do `salary` przez "viewer" → PermissionError; przez "base_owner" → OK', async () => {
    await expect(
      recordsService.createRecord(TABLE, { name: 'A', salary: 999 }, 'user-1', 'viewer')
    ).rejects.toBeInstanceOf(PermissionError);
    // Rejected create must not have persisted a row.
    expect([...store.values()].some((r) => r.data.name === 'A')).toBe(false);

    const ok = await recordsService.createRecord(
      TABLE,
      { name: 'B', salary: 500 },
      'user-1',
      'base_owner'
    );
    expect(ok.data.salary).toBe(500);

    // BEZ userRole (stan sprzed fixu) — brak egzekucji, zapis przechodzi.
    const unguarded = await recordsService.createRecord(TABLE, { name: 'C', salary: 1 }, 'user-1');
    expect(unguarded.data.salary).toBe(1);
  });

  it('batch create op: zapis do `salary` przez "viewer" → odrzucony (error w wyniku, brak wiersza)', async () => {
    const resp = await recordsService.batchRecords(
      TABLE,
      [{ type: 'create', data: { name: 'Batched', salary: 777 } }],
      'user-1',
      true, // continueOnError — errors collected instead of thrown
      'viewer'
    );

    expect(resp.errors.length).toBe(1);
    expect(resp.errors[0].error).toMatch(/Write denied/);
    expect(resp.results.length).toBe(0);
    expect([...store.values()].some((r) => r.data.name === 'Batched')).toBe(false);
  });

  it('batch create op: "base_owner" scope przechodzi i wiersz jest zapisany', async () => {
    const resp = await recordsService.batchRecords(
      TABLE,
      [{ type: 'create', data: { name: 'Batched2', salary: 777 } }],
      'user-1',
      true,
      'base_owner'
    );

    expect(resp.errors.length).toBe(0);
    expect(resp.results.length).toBe(1);
    expect([...store.values()].some((r) => r.data.name === 'Batched2')).toBe(true);
  });

  it('deleteRecord: row-policy "none" dla "viewer" → PermissionError; rola bez policy → OK', async () => {
    seedNonePolicyForViewer();
    const rec = await recordsService.createRecord(TABLE, { name: 'ToDelete' }, 'user-1');

    await expect(
      recordsService.deleteRecord(rec.id, 'user-1', 'viewer')
    ).rejects.toBeInstanceOf(PermissionError);
    // Rejected delete must not have removed the row.
    expect(store.has(rec.id)).toBe(true);

    // rola bez restrykcyjnej policy przechodzi
    const ok = await recordsService.deleteRecord(rec.id, 'user-1', 'base_owner');
    expect(ok).toBe(true);
    expect(store.has(rec.id)).toBe(false);
  });

  it('deleteRecord: BEZ userRole (stan sprzed fixu) — brak egzekucji, delete przechodzi mimo policy "none"', async () => {
    seedNonePolicyForViewer();
    const rec = await recordsService.createRecord(TABLE, { name: 'Unguarded' }, 'user-1');

    const ok = await recordsService.deleteRecord(rec.id, 'user-1');
    expect(ok).toBe(true);
    expect(store.has(rec.id)).toBe(false);
  });

  it('batch delete op: row-policy "none" dla "viewer" → odrzucony (error w wyniku, wiersz zostaje)', async () => {
    seedNonePolicyForViewer();
    const rec = await recordsService.createRecord(TABLE, { name: 'BatchDelete' }, 'user-1');

    const resp = await recordsService.batchRecords(
      TABLE,
      [{ type: 'delete', recordId: rec.id }],
      'user-1',
      true,
      'viewer'
    );

    expect(resp.errors.length).toBe(1);
    expect(resp.errors[0].error).toMatch(/Delete denied/);
    expect(store.has(rec.id)).toBe(true);
  });
});
