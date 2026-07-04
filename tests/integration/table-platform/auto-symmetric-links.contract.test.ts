/**
 * Auto-symmetric linkedRecord fields (Airtable-style backlink).
 *
 * PROBLEM (pre-fix): creating a `linkedRecord` field did NOT create a reverse
 * field in the target table. Backlinks then relied on the fragile
 * `RelationService.findBacklinkFieldId` heuristic ("first same-shaped field in
 * the target table wins"), which misfires when a table links the same target
 * twice, and leaves `reverseFieldId` unset on both sides.
 *
 * This runs the REAL `MetadataService.createField` against a faithful in-memory
 * pg pool storing `tp_fields` / `tp_tables` / `tp_bases`. After creating a
 * linkedRecord field it asserts that (a) a reverse linkedRecord field now
 * exists in the target table pointing back, and (b) reverseFieldId is
 * cross-wired on BOTH sides.
 *
 * Anti-false-green: assertions read the persisted `tp_fields` store. Before the
 * fix there is exactly ONE linkedRecord field and no reverseFieldId — RED.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FieldRow {
  id: string;
  table_id: string;
  name: string;
  field_type: string;
  options: Record<string, unknown>;
  field_order: number;
}

const fields: FieldRow[] = [];
const tables = new Map<string, { id: string; name: string; base_id: string; governance_mode?: string }>();

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `fld-auto-${++uuidCounter}`),
}));

const fakePool = {
  query: vi.fn(async (sqlRaw: string, params: unknown[] = []) => {
    const s = sqlRaw.replace(/\s+/g, ' ').trim();

    // governance check
    if (s.startsWith('SELECT governance_mode FROM tp_tables WHERE id = $1')) {
      const t = tables.get(params[0] as string);
      return { rows: t ? [{ governance_mode: t.governance_mode ?? 'open' }] : [], rowCount: 0 };
    }
    // max field order
    if (s.includes('COALESCE(MAX(field_order), -1) + 1 AS next_order')) {
      const tableId = params[0] as string;
      const max = fields
        .filter((f) => f.table_id === tableId)
        .reduce((m, f) => Math.max(m, f.field_order), -1);
      return { rows: [{ next_order: max + 1 }], rowCount: 1 };
    }
    // insert field
    if (s.startsWith('INSERT INTO tp_fields')) {
      const [id, tableId, name, fieldType, optionsJson, fieldOrder] = params as [
        string,
        string,
        string,
        string,
        string,
        number,
      ];
      fields.push({
        id,
        table_id: tableId,
        name,
        field_type: fieldType,
        options: JSON.parse(optionsJson),
        field_order: fieldOrder,
      });
      return { rows: [], rowCount: 1 };
    }
    // select field by id
    if (s.startsWith('SELECT * FROM tp_fields WHERE id = $1')) {
      const f = fields.find((x) => x.id === params[0]);
      return { rows: f ? [clone(f)] : [], rowCount: f ? 1 : 0 };
    }
    // update field options
    if (s.startsWith('UPDATE tp_fields SET options = $2')) {
      const f = fields.find((x) => x.id === params[0]);
      if (f) f.options = JSON.parse(params[1] as string);
      return { rows: [], rowCount: f ? 1 : 0 };
    }
    // table name / base_id lookups
    if (s.startsWith('SELECT name FROM tp_tables WHERE id = $1')) {
      const t = tables.get(params[0] as string);
      return { rows: t ? [{ name: t.name }] : [], rowCount: t ? 1 : 0 };
    }
    if (s.startsWith('SELECT base_id FROM tp_tables WHERE id = $1')) {
      const t = tables.get(params[0] as string);
      return { rows: t ? [{ base_id: t.base_id }] : [], rowCount: t ? 1 : 0 };
    }
    // schema version bump
    if (s.startsWith('UPDATE tp_bases SET schema_version')) {
      return { rows: [{ schema_version: 2 }], rowCount: 1 };
    }
    if (s.startsWith('INSERT INTO tp_schema_versions')) {
      return { rows: [], rowCount: 1 };
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
vi.mock('../../../server/src/services/tablePlatform/AuditService.js', () => ({
  default: { logEvent: vi.fn(async () => undefined) },
}));
vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: { invalidateCache: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/OrgMemberSyncService.js', () => ({
  default: {},
}));
vi.mock('../../../server/src/services/tablePlatform/WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatchEvent: vi.fn(async () => undefined) },
}));

import metadataService from '../../../server/src/services/tablePlatform/MetadataService.js';

const TASKS = 'tbl-tasks';
const PROJECTS = 'tbl-projects';

describe('Auto-symmetric linkedRecord field creation', () => {
  beforeEach(() => {
    fields.length = 0;
    tables.clear();
    tables.set(TASKS, { id: TASKS, name: 'Tasks', base_id: 'base-1' });
    tables.set(PROJECTS, { id: PROJECTS, name: 'Projects', base_id: 'base-1' });
    fakePool.query.mockClear();
    uuidCounter = 0;
  });

  it('creates a reverse linkedRecord field in the target table and cross-wires reverseFieldId', async () => {
    const created = await metadataService.createField(
      TASKS,
      'Project',
      'linkedRecord',
      { linkedTableId: PROJECTS },
      'user-1'
    );

    // Primary field exists on Tasks.
    const primary = fields.find((f) => f.id === created.id);
    expect(primary).toBeTruthy();
    expect(primary?.table_id).toBe(TASKS);

    // A reverse linkedRecord field now exists on Projects, pointing back to Tasks.
    const reverse = fields.find(
      (f) => f.table_id === PROJECTS && f.field_type === 'linkedRecord'
    );
    expect(reverse).toBeTruthy();
    expect(reverse?.options.linkedTableId).toBe(TASKS);
    expect(reverse?.options.isReverse).toBe(true);

    // reverseFieldId cross-wired on BOTH sides.
    expect(primary?.options.reverseFieldId).toBe(reverse?.id);
    expect(reverse?.options.reverseFieldId).toBe(primary?.id);
  });

  it('does not create a reverse field for non-link field types', async () => {
    await metadataService.createField(TASKS, 'Title', 'single_line_text', {}, 'user-1');
    expect(fields.filter((f) => f.field_type === 'linkedRecord')).toHaveLength(0);
    expect(fields).toHaveLength(1);
  });

  it('does not recurse: creating the reverse side (isReverse) makes no further field', async () => {
    // Simulate the reverse-side creation call directly — must NOT spawn a
    // third field (infinite recursion guard).
    await metadataService.createField(
      PROJECTS,
      'Tasks',
      'linkedRecord',
      { linkedTableId: TASKS, reverseFieldId: 'fld-existing', isReverse: true },
      'user-1'
    );
    expect(fields.filter((f) => f.field_type === 'linkedRecord')).toHaveLength(1);
  });

  it('respects an explicit reverseFieldId (does not auto-create a duplicate)', async () => {
    await metadataService.createField(
      TASKS,
      'Project',
      'linkedRecord',
      { linkedTableId: PROJECTS, reverseFieldId: 'fld-preexisting' },
      'user-1'
    );
    // Only the primary field; no auto reverse when caller already wired one.
    expect(fields.filter((f) => f.field_type === 'linkedRecord')).toHaveLength(1);
  });
});
