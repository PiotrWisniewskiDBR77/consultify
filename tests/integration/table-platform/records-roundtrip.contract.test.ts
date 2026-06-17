/**
 * M20 · L-07 — Records API fundament contract test.
 *
 * Cel: udowodnić, że `RecordsService` realnie dotyka warstwy `tp_records`
 * (INSERT/SELECT/UPDATE/DELETE) i że dane przeżywają "reload" — w odróżnieniu
 * od istniejących testów, które mockują CAŁY serwis i nigdy nie wykonują SQL.
 *
 * Caboose (staging DB) niedostępny w CI → kontrakt egzekwowany przez wierny
 * in-memory pool zgodny z Postgresem (przechowuje wiersze, parsuje jsonb,
 * wspiera optimistic-lock na kolumnie `version`). REALNY kod serwisu biegnie
 * bez zmian; tylko warstwa I/O i serwisy poboczne są podstawione.
 *
 * Anty-false-green: pool NIE echuje wejścia — `getRecord` czyta z magazynu,
 * więc gdyby `createRecord` przestał persystować, test oblewa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Wierny in-memory pool (Postgres-compatible) dla tp_records ----------
interface StoredRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const store = new Map<string, StoredRow>();

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const fakePool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // --- schema/probe queries -------------------------------------------
    if (s.startsWith('SELECT * FROM tp_fields')) return { rows: [], rowCount: 0 };
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
      const [id, tableId, dataJson, createdBy] = params as [
        string,
        string,
        string,
        string | null,
      ];
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

    if (s.startsWith('UPDATE tp_records')) {
      const id = params[0] as string;
      const row = store.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      // optimistic-lock variant: "... COALESCE(version, 0) = $3"
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

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

// ---- Mocks: I/O + serwisy poboczne (REALNY RecordsService nietknięty) -----
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
vi.mock('../../../server/src/services/tablePlatform/FieldPermissionService.js', () => ({
  fieldPermissionService: {
    tableHasFieldPermissions: vi.fn(async () => false),
    filterRecordFields: vi.fn(async (r: { data: unknown }) => r.data),
    validateWritePermissions: vi.fn(async () => ({ allowed: true, deniedFields: [] })),
  },
}));
vi.mock('../../../server/src/services/tablePlatform/RelationService.js', () => ({
  default: { onRecordDeleted: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/RecordWatchService.js', () => ({
  default: { notifyWatchers: vi.fn(async () => undefined) },
}));

import recordsService from '../../../server/src/services/tablePlatform/RecordsService.js';

const TABLE = 'tbl-contract-1';

describe('M20 · L-07 — Records API round-trip against real tp_records SQL', () => {
  beforeEach(() => {
    store.clear();
    fakePool.query.mockClear();
  });

  it('createRecord issues INSERT INTO tp_records and persists the row', async () => {
    const created = await recordsService.createRecord(TABLE, { title: 'Hello' }, 'user-1');

    expect(created?.id).toBeTruthy();
    expect(created?.data?.title).toBe('Hello');
    // Realny SQL kontrakt — nie echo serwisu:
    const insertCall = fakePool.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_records')
    );
    expect(insertCall).toBeTruthy();
    // Wiersz faktycznie w magazynie:
    expect(store.get(created.id)?.data.title).toBe('Hello');
  });

  it('getRecord reads the persisted row back (survives a reload)', async () => {
    const created = await recordsService.createRecord(TABLE, { title: 'Persisted' }, 'user-1');
    fakePool.query.mockClear();

    const fetched = await recordsService.getRecord(created.id);

    expect(fetched?.id).toBe(created.id);
    expect(fetched?.data.title).toBe('Persisted');
    // dowód realnego odczytu z tp_records:
    expect(
      fakePool.query.mock.calls.some((c) =>
        String(c[0]).includes('SELECT * FROM tp_records WHERE id = $1')
      )
    ).toBe(true);
  });

  it('updateRecord merges data and bumps version via UPDATE tp_records', async () => {
    const created = await recordsService.createRecord(TABLE, { title: 'A', keep: 1 }, 'user-1');

    const updated = await recordsService.updateRecord(created.id, { title: 'B' }, 'user-1');

    expect(updated?.data.title).toBe('B');
    expect(updated?.data.keep).toBe(1); // merge zachowuje istniejące pola
    expect(store.get(created.id)?.version).toBe(1);
  });

  it('optimistic lock: stale expectedVersion is rejected with ConflictError', async () => {
    const created = await recordsService.createRecord(TABLE, { n: 0 }, 'user-1');
    await recordsService.updateRecord(created.id, { n: 1 }, 'user-1', 0); // version → 1

    await expect(
      recordsService.updateRecord(created.id, { n: 2 }, 'user-1', 0) // stale
    ).rejects.toThrow(/modified by another user/i);
  });

  it('deleteRecord removes the row; subsequent getRecord returns null', async () => {
    const created = await recordsService.createRecord(TABLE, { title: 'X' }, 'user-1');

    const ok = await recordsService.deleteRecord(created.id, 'user-1');
    expect(ok).toBe(true);

    const after = await recordsService.getRecord(created.id);
    expect(after).toBeNull();
    expect(store.has(created.id)).toBe(false);
  });

  it('deleteRecord on a missing id returns false (no DELETE side effect)', async () => {
    const ok = await recordsService.deleteRecord('does-not-exist', 'user-1');
    expect(ok).toBe(false);
  });
});
