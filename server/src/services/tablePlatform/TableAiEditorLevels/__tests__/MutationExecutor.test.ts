/**
 * Unit tests for the AI Editor MutationExecutor (Block C apply path).
 *
 * Focus: the executor turns a proposal's `operations` array into REAL calls on
 * RecordsService / MetadataService (no longer a no-op), with:
 *   - per-op zod validation (invalid op aborts the whole apply),
 *   - cross-tenant defense (foreign tableId refused before any mutation),
 *   - read-only levels (methodological/source) skipped cleanly,
 *   - correct service-call mapping for every operation type.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQuery,
  mockUpdateRecord,
  mockCreateRecord,
  mockGetRecord,
  mockCreateField,
  mockUpdateField,
  mockChangeFieldType,
  mockDeleteField,
  mockCreateView,
  mockUpdateView,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockUpdateRecord: vi.fn(),
  mockCreateRecord: vi.fn(),
  mockGetRecord: vi.fn(),
  mockCreateField: vi.fn(),
  mockUpdateField: vi.fn(),
  mockChangeFieldType: vi.fn(),
  mockDeleteField: vi.fn(),
  mockCreateView: vi.fn(),
  mockUpdateView: vi.fn(),
}));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../RecordsService.js', () => ({
  default: {
    updateRecord: (...a: unknown[]) => mockUpdateRecord(...a),
    createRecord: (...a: unknown[]) => mockCreateRecord(...a),
    getRecord: (...a: unknown[]) => mockGetRecord(...a),
  },
}));
vi.mock('../../MetadataService.js', () => ({
  default: {
    createField: (...a: unknown[]) => mockCreateField(...a),
    updateField: (...a: unknown[]) => mockUpdateField(...a),
    changeFieldType: (...a: unknown[]) => mockChangeFieldType(...a),
    deleteField: (...a: unknown[]) => mockDeleteField(...a),
    createView: (...a: unknown[]) => mockCreateView(...a),
    updateView: (...a: unknown[]) => mockUpdateView(...a),
  },
}));

import { executeProposalOperations, MutationExecutorError } from '../MutationExecutor.js';

const WS = 'ws-A';
const ORG = 'org-A';
const ACTOR = 'user-1';
const TABLE = 'tbl-1';

function tenantOkRow() {
  return { rows: [{ workspace_id: WS, organization_id: ORG }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every table resolves to the actor tenant.
  mockQuery.mockResolvedValue(tenantOkRow());
  mockCreateRecord.mockResolvedValue({ id: 'rec-new' });
  mockCreateField.mockResolvedValue({ id: 'fld-new' });
  mockCreateView.mockResolvedValue({ id: 'view-new' });
  mockUpdateRecord.mockResolvedValue({ id: 'rec-1' });
});

const baseInput = { workspaceId: WS, organizationId: ORG, actorUserId: ACTOR };

describe('MutationExecutor — cell + record levels', () => {
  it('op_cell_set → updateRecord with single field patch', async () => {
    const res = await executeProposalOperations({
      ...baseInput,
      level: 'cell',
      operations: [
        {
          id: 'op-1',
          type: 'op_cell_set',
          target: { tableId: TABLE, recordId: 'rec-1', fieldId: 'fld-status' },
          before: 'Todo',
          after: 'Done',
          manualOverride: false,
        },
      ],
    });

    expect(res.applied).toBe(1);
    expect(mockUpdateRecord).toHaveBeenCalledWith('rec-1', { 'fld-status': 'Done' }, ACTOR);
  });

  it('op_record_update → updateRecord with multi-field patch', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'record',
      operations: [
        {
          id: 'op-1',
          type: 'op_record_update',
          target: { tableId: TABLE, recordId: 'rec-2' },
          fieldChanges: [
            { fieldId: 'f1', before: 1, after: 2 },
            { fieldId: 'f2', before: 'a', after: 'b' },
          ],
        },
      ],
    });
    expect(mockUpdateRecord).toHaveBeenCalledWith('rec-2', { f1: 2, f2: 'b' }, ACTOR);
  });

  it('op_record_create → createRecord on the table', async () => {
    const res = await executeProposalOperations({
      ...baseInput,
      level: 'record',
      operations: [
        {
          id: 'op-1',
          type: 'op_record_create',
          target: { tableId: TABLE },
          data: { f1: 'hello' },
        },
      ],
    });
    expect(mockCreateRecord).toHaveBeenCalledWith(TABLE, { f1: 'hello' }, ACTOR);
    expect(res.outcomes[0]!.entityId).toBe('rec-new');
  });

  it('op_column_fill → one updateRecord per cell', async () => {
    const res = await executeProposalOperations({
      ...baseInput,
      level: 'column',
      operations: [
        {
          id: 'op-1',
          type: 'op_column_fill',
          target: { tableId: TABLE, fieldId: 'f1' },
          cells: [
            { recordId: 'r1', before: null, after: 'x' },
            { recordId: 'r2', before: null, after: 'y' },
          ],
        },
      ],
    });
    expect(mockUpdateRecord).toHaveBeenCalledTimes(2);
    expect(mockUpdateRecord).toHaveBeenNthCalledWith(1, 'r1', { f1: 'x' }, ACTOR);
    expect(mockUpdateRecord).toHaveBeenNthCalledWith(2, 'r2', { f1: 'y' }, ACTOR);
    expect(res.outcomes[0]!.reason).toBe('filled_2_cells');
  });
});

describe('MutationExecutor — structure + view + relational levels', () => {
  it('op_schema_add_field → createField', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'structure',
      operations: [
        {
          id: 'op-1',
          type: 'op_schema_add_field',
          target: { tableId: TABLE },
          payload: { name: 'Priority', fieldType: 'singleSelect' },
        },
      ],
    });
    expect(mockCreateField).toHaveBeenCalledWith(
      TABLE,
      'Priority',
      'singleSelect',
      undefined,
      ACTOR
    );
  });

  it('op_schema_rename_field → updateField(name)', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'structure',
      operations: [
        {
          id: 'op-1',
          type: 'op_schema_rename_field',
          target: { tableId: TABLE, fieldId: 'fld-1' },
          payload: { from: 'Old', to: 'New' },
        },
      ],
    });
    expect(mockUpdateField).toHaveBeenCalledWith('fld-1', { name: 'New' });
  });

  it('op_schema_retype_field → changeFieldType', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'structure',
      operations: [
        {
          id: 'op-1',
          type: 'op_schema_retype_field',
          target: { tableId: TABLE, fieldId: 'fld-1' },
          payload: { from: 'text', to: 'number' },
        },
      ],
    });
    expect(mockChangeFieldType).toHaveBeenCalledWith('fld-1', 'number', ACTOR, undefined, false);
  });

  it('op_schema_drop_field → deleteField', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'structure',
      operations: [
        {
          id: 'op-1',
          type: 'op_schema_drop_field',
          target: { tableId: TABLE, fieldId: 'fld-1' },
        },
      ],
    });
    expect(mockDeleteField).toHaveBeenCalledWith('fld-1', ACTOR);
  });

  it('op_view_create → createView', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'view',
      operations: [
        {
          id: 'op-1',
          type: 'op_view_create',
          target: { tableId: TABLE },
          payload: { name: 'Kanban', viewType: 'kanban', config: { groupBy: 'status' } },
        },
      ],
    });
    expect(mockCreateView).toHaveBeenCalledWith(
      TABLE,
      'Kanban',
      'kanban',
      { groupBy: 'status' },
      ACTOR
    );
  });

  it('op_view_update → updateView(config)', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'view',
      operations: [
        {
          id: 'op-1',
          type: 'op_view_update',
          target: { tableId: TABLE, viewId: 'v-1' },
          payload: { config: { sort: 'asc' } },
        },
      ],
    });
    expect(mockUpdateView).toHaveBeenCalledWith('v-1', { config: { sort: 'asc' } });
  });

  it('op_relation_create → createField(linkedRecord) with tenant check on both endpoints', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'relational',
      operations: [
        {
          id: 'op-1',
          type: 'op_relation_create',
          target: { tableId: TABLE },
          payload: {
            fromTableId: TABLE,
            toTableId: 'tbl-2',
            fromFieldName: 'Linked',
            bidirectional: true,
          },
        },
      ],
    });
    expect(mockCreateField).toHaveBeenCalledWith(
      TABLE,
      'Linked',
      'linkedRecord',
      { linkedTableId: 'tbl-2', bidirectional: true },
      ACTOR
    );
  });
});

describe('MutationExecutor — read-only levels', () => {
  it('op_methodological_flag is skipped (read_only) — no mutations', async () => {
    const res = await executeProposalOperations({
      ...baseInput,
      level: 'methodological',
      operations: [
        {
          id: 'op-1',
          type: 'op_methodological_flag',
          target: { tableId: TABLE, recordId: 'r1' },
          payload: { deviationKind: 'invalid_value', message: 'bad', severity: 'warn' },
        },
      ],
    });
    expect(res.applied).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.outcomes[0]!.reason).toBe('read_only');
    expect(mockUpdateRecord).not.toHaveBeenCalled();
    expect(mockCreateField).not.toHaveBeenCalled();
  });

  it('op_source_suggest is skipped (read_only)', async () => {
    const res = await executeProposalOperations({
      ...baseInput,
      level: 'source',
      operations: [
        {
          id: 'op-1',
          type: 'op_source_suggest',
          target: { tableId: TABLE, recordId: 'r1' },
          payload: { candidates: [{ kind: 'url', ref: 'https://x', confidence: 0.9 }] },
        },
      ],
    });
    expect(res.skipped).toBe(1);
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  });
});

describe('MutationExecutor — validation + cross-tenant defense', () => {
  it('invalid operation aborts the whole apply', async () => {
    await expect(
      executeProposalOperations({
        ...baseInput,
        level: 'cell',
        operations: [{ id: 'op-1', type: 'op_cell_set', target: { tableId: TABLE } }],
      })
    ).rejects.toBeInstanceOf(MutationExecutorError);
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  });

  it('foreign tableId is refused before any mutation (TENANT_VIOLATION)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ workspace_id: 'ws-OTHER', organization_id: 'org-OTHER' }],
    });
    await expect(
      executeProposalOperations({
        ...baseInput,
        level: 'cell',
        operations: [
          {
            id: 'op-1',
            type: 'op_cell_set',
            target: { tableId: 'tbl-foreign', recordId: 'r1', fieldId: 'f1' },
            before: 1,
            after: 2,
            manualOverride: false,
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION' });
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  });

  it('missing table is refused (TABLE_NOT_FOUND)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(
      executeProposalOperations({
        ...baseInput,
        level: 'cell',
        operations: [
          {
            id: 'op-1',
            type: 'op_cell_set',
            target: { tableId: 'tbl-missing', recordId: 'r1', fieldId: 'f1' },
            before: 1,
            after: 2,
            manualOverride: false,
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND' });
  });

  it('a failing mutation wraps into EXECUTION_FAILED', async () => {
    mockUpdateRecord.mockRejectedValueOnce(new Error('db down'));
    await expect(
      executeProposalOperations({
        ...baseInput,
        level: 'cell',
        operations: [
          {
            id: 'op-1',
            type: 'op_cell_set',
            target: { tableId: TABLE, recordId: 'r1', fieldId: 'f1' },
            before: 1,
            after: 2,
            manualOverride: false,
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
  });

  it('tenant check is memoised: two ops on same table → one tenant query', async () => {
    await executeProposalOperations({
      ...baseInput,
      level: 'cell',
      operations: [
        {
          id: 'op-1',
          type: 'op_cell_set',
          target: { tableId: TABLE, recordId: 'r1', fieldId: 'f1' },
          before: 1,
          after: 2,
          manualOverride: false,
        },
        {
          id: 'op-2',
          type: 'op_cell_set',
          target: { tableId: TABLE, recordId: 'r2', fieldId: 'f1' },
          before: 3,
          after: 4,
          manualOverride: false,
        },
      ],
    });
    // Only one tenant-resolution query despite two ops on the same table.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
