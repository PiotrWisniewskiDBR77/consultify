/**
 * Auto-trigger date dependency cascade (#3).
 *
 * PROBLEM (pre-fix): DateDependencyEngine only ran from a manual
 * `/date-dependencies/recalculate` endpoint. Editing a predecessor's end date
 * via RecordsService.update never moved its successors — the Gantt lied.
 *
 * This runs the REAL RecordsService.update (which now calls the REAL
 * DateDependencyEngine) against a faithful in-memory pg pool storing
 * `tp_records` and a `tp_tables.dependency_config`. FS (Finish-to-Start):
 * successor.start = predecessor.end + lag.
 *
 * Anti-false-green: after moving predecessor P's end date, the assertion reads
 * successor S's start date back from the store. Before the wiring S stays put
 * — RED. After — S.start advances to P.end.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const records = new Map<string, RecordRow>();
let dependencyConfig: Record<string, unknown> | null = null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const fakePool = {
  query: vi.fn(async (sqlRaw: string, params: unknown[] = []) => {
    const s = sqlRaw.replace(/\s+/g, ' ').trim();

    if (s.includes('FROM users WHERE id'))
      return { rows: [{ display_name: 'Tester' }], rowCount: 1 };
    if (s.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT base_id FROM tp_tables'))
      return { rows: [{ base_id: 'base-1' }], rowCount: 1 };
    if (s.startsWith('SELECT dependency_config FROM tp_tables'))
      return { rows: [{ dependency_config: dependencyConfig }], rowCount: 1 };

    // field probes → none (no auto/computed fields in this scenario)
    if (s.startsWith('SELECT * FROM tp_fields WHERE table_id = $1')) return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT id, field_type AS type, options FROM tp_fields'))
      return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT id, field_type FROM tp_fields')) return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT id, field_type, options FROM tp_fields'))
      return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT id FROM tp_fields')) return { rows: [], rowCount: 0 };

    // cross-record recompute back-ref scan → none
    if (s.startsWith('SELECT DISTINCT from_record_id, from_field_id FROM tp_record_links'))
      return { rows: [], rowCount: 0 };

    // tp_records by id
    if (s.startsWith('SELECT * FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (s.startsWith('SELECT data FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [{ data: clone(row.data) }] : [], rowCount: row ? 1 : 0 };
    }
    // whole-table scan (date engine)
    if (s.startsWith('SELECT * FROM tp_records WHERE table_id = $1')) {
      const tableId = params[0] as string;
      const rows = [...records.values()].filter((r) => r.table_id === tableId).map(clone);
      return { rows, rowCount: rows.length };
    }

    if (s.startsWith('INSERT INTO tp_records')) {
      const [id, tableId, dataJson, createdBy] = params as [string, string, string, string | null];
      const now = new Date().toISOString();
      records.set(id, {
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
    if (s.startsWith('UPDATE tp_records')) {
      const id = (s.includes('WHERE id = $2') ? params[1] : params[0]) as string;
      const dataJson = (s.includes('WHERE id = $2') ? params[0] : params[1]) as string;
      const row = records.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      if (s.includes('COALESCE(version, 0) = $3')) {
        const expected = params[2] as number;
        if (row.version !== expected) return { rows: [], rowCount: 0 };
      }
      row.data = JSON.parse(dataJson);
      if (s.includes('version = COALESCE(version, 0) + 1')) row.version += 1;
      row.updated_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    if (s.startsWith('DELETE FROM tp_records WHERE id = $1')) {
      const id = params[0] as string;
      const existed = records.delete(id);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }

    if (s.startsWith('SELECT * FROM tp_row_policies')) return { rows: [], rowCount: 0 };

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

vi.mock('../../../server/src/database/Database.js', () => ({ getDatabase: () => fakePool }));
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
const notifyRecordUpdated = vi.fn();
vi.mock('../../../server/src/services/tablePlatform/RealtimeService.js', () => ({
  tablePlatformRealtime: {
    notifyRecordCreated: vi.fn(),
    notifyRecordUpdated: (...a: unknown[]) => notifyRecordUpdated(...a),
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
  default: {
    onRecordDeleted: vi.fn(async () => undefined),
    recomputeDependentsOfSource: vi.fn(async () => []),
  },
}));
vi.mock('../../../server/src/services/tablePlatform/RecordWatchService.js', () => ({
  default: { notifyWatchers: vi.fn(async () => undefined) },
}));
// NOTE: DateDependencyEngine is deliberately NOT mocked — it is under test.

import recordsService from '../../../server/src/services/tablePlatform/RecordsService.js';

const TABLE = 'tbl-schedule';
const F_START = 'f-start';
const F_END = 'f-end';
const F_PRED = 'f-pred';

describe('Date dependency cascade auto-triggers on RecordsService.update', () => {
  beforeEach(() => {
    records.clear();
    fakePool.query.mockClear();
    notifyRecordUpdated.mockClear();
    dependencyConfig = {
      startDateFieldId: F_START,
      endDateFieldId: F_END,
      predecessorFieldId: F_PRED,
      defaultDependencyType: 'FS',
      defaultLagDays: 0,
      skipWeekends: false,
    };
  });

  async function seedChain() {
    // Predecessor P: 2024-01-01 → 2024-01-05
    const p = await recordsService.createRecord(
      TABLE,
      { [F_START]: '2024-01-01', [F_END]: '2024-01-05', [F_PRED]: [] },
      'user-1'
    );
    // Successor S depends on P (FS): its start should follow P.end.
    const sStart = await recordsService.createRecord(
      TABLE,
      { [F_START]: '2024-01-05', [F_END]: '2024-01-08', [F_PRED]: [p.id] },
      'user-1'
    );
    return { p, s: sStart };
  }

  it('moving predecessor end date cascades successor start date (FS)', async () => {
    const { p, s } = await seedChain();
    expect(records.get(s.id)?.data[F_START]).toBe('2024-01-05');

    // Push P's finish out by 5 days: 2024-01-05 → 2024-01-10.
    await recordsService.updateRecord(p.id, { [F_END]: '2024-01-10' }, 'user-1');

    // ROOT ASSERTION: successor S start must follow to 2024-01-10 (FS, lag 0).
    // Pre-fix S.start stays 2024-01-05.
    expect(records.get(s.id)?.data[F_START]).toBe('2024-01-10');
    // Realtime update emitted for the cascaded successor.
    expect(notifyRecordUpdated.mock.calls.some((c) => c[1] === s.id)).toBe(true);
  });

  it('no dependency_config → no cascade (fail-soft, dates untouched)', async () => {
    const { p, s } = await seedChain();
    dependencyConfig = null; // table without scheduling config

    await recordsService.updateRecord(p.id, { [F_END]: '2024-01-20' }, 'user-1');

    // S unchanged because the engine never ran.
    expect(records.get(s.id)?.data[F_START]).toBe('2024-01-05');
  });

  it('editing a non-date field does not trigger the cascade', async () => {
    const { p, s } = await seedChain();

    await recordsService.updateRecord(p.id, { note: 'hello' }, 'user-1');

    expect(records.get(s.id)?.data[F_START]).toBe('2024-01-05');
  });

  it('creating a successor with a predecessor already out of sync cascades on create', async () => {
    // Predecessor P finishes 2024-01-10, but the successor is created with a
    // stale start date (2024-01-05) that predates P's finish — the cascade
    // triggered on create must pull it forward.
    const p = await recordsService.createRecord(
      TABLE,
      { [F_START]: '2024-01-01', [F_END]: '2024-01-10', [F_PRED]: [] },
      'user-1'
    );

    const s = await recordsService.createRecord(
      TABLE,
      { [F_START]: '2024-01-05', [F_END]: '2024-01-08', [F_PRED]: [p.id] },
      'user-1'
    );

    // ROOT ASSERTION: cascade runs on create, pulling S.start to P.end.
    // Pre-fix (no cascade on create), S.start stays at its stale 2024-01-05.
    expect(records.get(s.id)?.data[F_START]).toBe('2024-01-10');
  });

  it('deleting a predecessor triggers a cascade recompute (fail-soft, no crash)', async () => {
    const { p, s } = await seedChain();
    notifyRecordUpdated.mockClear();

    const ok = await recordsService.deleteRecord(p.id, 'user-1');

    expect(ok).toBe(true);
    expect(records.has(p.id)).toBe(false);
    // Successor still exists — deleting the predecessor must not crash the
    // cascade path (fail-soft), and the record store is left consistent.
    expect(records.has(s.id)).toBe(true);
  });
});
