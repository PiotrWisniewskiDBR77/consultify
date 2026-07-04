/**
 * Cross-record recompute — root fix for "tabele kłamią" (rollup/lookup stale).
 *
 * PROBLEM (pre-fix): `RecordsService.updateRecord` only recomputed formula and
 * confidence fields for the record being edited. Rollup/lookup fields on OTHER
 * records that LINK the edited one were only refreshed on link/unlink/delete —
 * so a plain cell edit on source record A left the SUM rollup on record B
 * pointing at the OLD value. B lied.
 *
 * This test runs the REAL `RecordsService` AND the REAL `RelationService`
 * (nothing in the relation/rollup path is mocked) against a faithful in-memory
 * Postgres-compatible pool that persists `tp_records`, `tp_fields` and
 * `tp_record_links`. Caboose (staging DB) is unavailable in CI, so this is the
 * established faithful-pool pattern used by records-roundtrip.contract.test.ts.
 *
 * Anti-false-green: the assertion reads B's rollup back from the persisted
 * store AFTER updating A. Before the fix the rollup stays at the old SUM (5);
 * after the fix it reflects the new SUM (12). Both branches proven below.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Faithful in-memory Postgres-compatible pool for tp_records / tp_fields /
// tp_record_links. Only the columns the real code touches are modeled.
// ---------------------------------------------------------------------------
interface RecordRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
interface FieldRow {
  id: string;
  table_id: string;
  name: string;
  field_type: string;
  options: Record<string, unknown>;
}
interface LinkRow {
  from_record_id: string;
  from_field_id: string;
  to_record_id: string;
  created_at: string;
}

const records = new Map<string, RecordRow>();
const fields: FieldRow[] = [];
const links: LinkRow[] = [];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const fakePool = {
  query: vi.fn(async (sqlRaw: string, params: unknown[] = []) => {
    const s = sqlRaw.replace(/\s+/g, ' ').trim();

    // ---- users / probes -------------------------------------------------
    if (s.includes('FROM users WHERE id'))
      return { rows: [{ display_name: 'Tester' }], rowCount: 1 };
    if (s.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
    if (s.startsWith('SELECT base_id FROM tp_tables'))
      return { rows: [{ base_id: 'base-1' }], rowCount: 1 };

    // ---- tp_fields ------------------------------------------------------
    // createRecord default-value scan: SELECT * FROM tp_fields WHERE table_id = $1
    if (s.startsWith('SELECT * FROM tp_fields WHERE table_id = $1')) {
      const tableId = params[0] as string;
      return { rows: fields.filter((f) => f.table_id === tableId).map(clone), rowCount: 0 };
    }
    // loadAutoFields
    if (s.startsWith('SELECT id, field_type AS type, options FROM tp_fields')) {
      return { rows: [], rowCount: 0 };
    }
    // getFieldOptions: SELECT field_type, options FROM tp_fields WHERE id = $1
    if (s.startsWith('SELECT field_type, options FROM tp_fields WHERE id = $1')) {
      const f = fields.find((x) => x.id === params[0]);
      return {
        rows: f ? [{ field_type: f.field_type, options: clone(f.options) }] : [],
        rowCount: f ? 1 : 0,
      };
    }
    // recomputeComputedFields field scan (count/lookup/rollup) for a table
    if (
      s.startsWith('SELECT id, field_type FROM tp_fields WHERE table_id = $1') &&
      s.includes("IN ('count', 'lookup', 'rollup')")
    ) {
      const tableId = params[0] as string;
      const matched = fields.filter(
        (f) =>
          f.table_id === tableId &&
          (f.field_type === 'count' || f.field_type === 'lookup' || f.field_type === 'rollup')
      );
      return { rows: matched.map((f) => ({ id: f.id, field_type: f.field_type })), rowCount: 0 };
    }
    // recomputeDependentsOfSource computed-field scan (rollup/lookup only)
    if (
      s.startsWith('SELECT id, field_type, options FROM tp_fields') &&
      s.includes("IN ('rollup', 'lookup')")
    ) {
      const tableId = params[0] as string;
      const matched = fields.filter(
        (f) =>
          f.table_id === tableId && (f.field_type === 'rollup' || f.field_type === 'lookup')
      );
      return {
        rows: matched.map((f) => ({
          id: f.id,
          field_type: f.field_type,
          options: clone(f.options),
        })),
        rowCount: 0,
      };
    }
    // generic SELECT id FROM tp_fields ... (expandRecord linkedRecord scan etc.)
    if (s.startsWith('SELECT id FROM tp_fields')) return { rows: [], rowCount: 0 };

    // ---- tp_record_links ------------------------------------------------
    if (s.startsWith('INSERT INTO tp_record_links')) {
      const [fromRec, fromField, toRec] = params as [string, string, string];
      const exists = links.some(
        (l) =>
          l.from_record_id === fromRec &&
          l.from_field_id === fromField &&
          l.to_record_id === toRec
      );
      if (!exists) {
        links.push({
          from_record_id: fromRec,
          from_field_id: fromField,
          to_record_id: toRec,
          created_at: new Date().toISOString(),
        });
      }
      return { rows: [], rowCount: 1 };
    }
    // recomputeDependentsOfSource: DISTINCT from_record_id, from_field_id WHERE to_record_id = $1
    if (
      s.startsWith('SELECT DISTINCT from_record_id, from_field_id FROM tp_record_links') &&
      s.includes('WHERE to_record_id = $1')
    ) {
      const toRec = params[0] as string;
      const seen = new Set<string>();
      const rows: Array<{ from_record_id: string; from_field_id: string }> = [];
      for (const l of links) {
        if (l.to_record_id !== toRec) continue;
        const key = `${l.from_record_id}|${l.from_field_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ from_record_id: l.from_record_id, from_field_id: l.from_field_id });
      }
      return { rows, rowCount: rows.length };
    }
    // computeCount: COUNT(*) WHERE from_record_id = $1 AND from_field_id = $2
    if (s.includes('SELECT COUNT(*)::int AS cnt FROM tp_record_links')) {
      const [fromRec, fromField] = params as [string, string];
      const cnt = links.filter(
        (l) => l.from_record_id === fromRec && l.from_field_id === fromField
      ).length;
      return { rows: [{ cnt }], rowCount: 1 };
    }
    // getLinkedRecords: JOIN tp_records ... WHERE from_record_id = $1 AND from_field_id = $2
    if (
      s.startsWith('SELECT r.* FROM tp_record_links l JOIN tp_records r') &&
      s.includes('l.from_record_id = $1 AND l.from_field_id = $2')
    ) {
      const [fromRec, fromField] = params as [string, string];
      const matched = links
        .filter((l) => l.from_record_id === fromRec && l.from_field_id === fromField)
        .map((l) => records.get(l.to_record_id))
        .filter((r): r is RecordRow => Boolean(r))
        .map(clone);
      return { rows: matched, rowCount: matched.length };
    }

    // ---- tp_records: id lookups ----------------------------------------
    if (s.startsWith('SELECT * FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    if (s.startsWith('SELECT data FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [{ data: clone(row.data) }] : [], rowCount: row ? 1 : 0 };
    }
    // tp_records by id list (recomputeDependentsOfSource table resolution)
    if (s.startsWith('SELECT id, table_id FROM tp_records WHERE id = ANY($1)')) {
      const ids = params[0] as string[];
      const rows = ids
        .map((id) => records.get(id))
        .filter((r): r is RecordRow => Boolean(r))
        .map((r) => ({ id: r.id, table_id: r.table_id }));
      return { rows, rowCount: rows.length };
    }

    // ---- tp_records: writes --------------------------------------------
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
      const id = params[0] as string;
      const row = records.get(id);
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

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

// ---------------------------------------------------------------------------
// Mocks: I/O + tangential services. REAL RecordsService + REAL RelationService
// (+ real formulaEngine) run unchanged.
// ---------------------------------------------------------------------------
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
vi.mock('../../../server/src/services/tablePlatform/RecordWatchService.js', () => ({
  default: { notifyWatchers: vi.fn(async () => undefined) },
}));
// NOTE: RelationService is deliberately NOT mocked — it is the code under test.

import recordsService from '../../../server/src/services/tablePlatform/RecordsService.js';

const SRC_TABLE = 'tbl-src';
const AGG_TABLE = 'tbl-agg';
const LINK_FIELD = 'fld-link'; // linkedRecord field on AGG_TABLE → SRC_TABLE
const AMOUNT_FIELD = 'fld-amount'; // number field on SRC_TABLE
const ROLLUP_FIELD = 'fld-rollup'; // rollup SUM(amount) over linked src records

function seedSchema() {
  fields.length = 0;
  fields.push({
    id: AMOUNT_FIELD,
    table_id: SRC_TABLE,
    name: 'Amount',
    field_type: 'number',
    options: {},
  });
  fields.push({
    id: LINK_FIELD,
    table_id: AGG_TABLE,
    name: 'Sources',
    field_type: 'linkedRecord',
    options: { linkedTableId: SRC_TABLE },
  });
  fields.push({
    id: ROLLUP_FIELD,
    table_id: AGG_TABLE,
    name: 'Total',
    field_type: 'rollup',
    options: { linkedFieldId: LINK_FIELD, lookupFieldId: AMOUNT_FIELD, aggregation: 'sum' },
  });
}

async function seedLinkedScenario() {
  // Two source records A1 (amount 2), A2 (amount 3); aggregate B links both.
  const a1 = await recordsService.createRecord(SRC_TABLE, { [AMOUNT_FIELD]: 2 }, 'user-1');
  const a2 = await recordsService.createRecord(SRC_TABLE, { [AMOUNT_FIELD]: 3 }, 'user-1');
  const b = await recordsService.createRecord(AGG_TABLE, {}, 'user-1');

  // Materialize links (aggregate B → sources A1, A2).
  links.push({
    from_record_id: b.id,
    from_field_id: LINK_FIELD,
    to_record_id: a1.id,
    created_at: new Date().toISOString(),
  });
  links.push({
    from_record_id: b.id,
    from_field_id: LINK_FIELD,
    to_record_id: a2.id,
    created_at: new Date().toISOString(),
  });

  // Initial rollup materialization (as link mutation would do).
  const relationService = (
    await import('../../../server/src/services/tablePlatform/RelationService.js')
  ).default;
  await relationService.recomputeComputedFields(b.id);

  return { a1, a2, b };
}

describe('Cross-record recompute — rollup on B refreshes when linked source A changes', () => {
  beforeEach(() => {
    records.clear();
    links.length = 0;
    seedSchema();
    fakePool.query.mockClear();
    notifyRecordUpdated.mockClear();
  });

  it('baseline: initial rollup SUM(amount) over linked records = 5', async () => {
    const { b } = await seedLinkedScenario();
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(5);
  });

  it('updating source A2 amount 3→10 refreshes aggregate B rollup 5→12', async () => {
    const { a2, b } = await seedLinkedScenario();

    // Sanity: rollup starts at 5 (2 + 3).
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(5);

    // Edit a plain cell on the SOURCE record via the real RecordsService.
    await recordsService.updateRecord(a2.id, { [AMOUNT_FIELD]: 10 }, 'user-1');

    // ROOT ASSERTION: dependent aggregate B must reflect the new SUM (2 + 10).
    // Pre-fix this stayed 5 (B lied); post-fix it is 12.
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(12);
  });

  it('emits a realtime update for the affected aggregate record B', async () => {
    const { a1, b } = await seedLinkedScenario();
    notifyRecordUpdated.mockClear();

    await recordsService.updateRecord(a1.id, { [AMOUNT_FIELD]: 100 }, 'user-1');

    // B refreshed to 2? no — a1 was 2, now 100, plus a2=3 → 103.
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(103);
    // A realtime notify targeting B was emitted (in addition to A's own).
    const emittedForB = notifyRecordUpdated.mock.calls.some((c) => c[1] === b.id);
    expect(emittedForB).toBe(true);
  });

  it('changing an UNRELATED field on the source does not cascade (count/no-lookup safe)', async () => {
    const { a2, b } = await seedLinkedScenario();
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(5);

    // Edit a field the rollup does not read.
    await recordsService.updateRecord(a2.id, { 'fld-unrelated': 'note' }, 'user-1');

    // Rollup unchanged; no wasted recompute cascade broke the value.
    expect(records.get(b.id)?.data[ROLLUP_FIELD]).toBe(5);
  });
});
