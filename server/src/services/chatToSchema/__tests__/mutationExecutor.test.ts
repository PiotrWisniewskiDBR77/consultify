import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockCreateBase = vi.fn();
const mockCreateTable = vi.fn();
const mockCreateField = vi.fn();
const mockCreateView = vi.fn();
const mockUpdateField = vi.fn();
const mockDeleteField = vi.fn();
const mockDeleteTable = vi.fn();
const mockDeleteBase = vi.fn();
const mockDeleteView = vi.fn();

vi.mock('../../tablePlatform/MetadataService.js', () => ({
  default: {
    createBase: (...args: unknown[]) => mockCreateBase(...args),
    createTable: (...args: unknown[]) => mockCreateTable(...args),
    createField: (...args: unknown[]) => mockCreateField(...args),
    createView: (...args: unknown[]) => mockCreateView(...args),
    updateField: (...args: unknown[]) => mockUpdateField(...args),
    deleteField: (...args: unknown[]) => mockDeleteField(...args),
    deleteTable: (...args: unknown[]) => mockDeleteTable(...args),
    deleteBase: (...args: unknown[]) => mockDeleteBase(...args),
    deleteView: (...args: unknown[]) => mockDeleteView(...args),
  },
}));

const mockCreateRecord = vi.fn();
const mockDeleteRecord = vi.fn();

vi.mock('../../tablePlatform/RecordsService.js', () => ({
  default: {
    createRecord: (...args: unknown[]) => mockCreateRecord(...args),
    deleteRecord: (...args: unknown[]) => mockDeleteRecord(...args),
  },
}));

import { MutationExecutor } from '../mutationExecutor.js';
import type { SchemaOperation } from '../proposalGenerator.js';

describe('MutationExecutor', () => {
  let executor: MutationExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new MutationExecutor();
  });

  it('executes create_table → calls metadataService.createTable', async () => {
    mockCreateTable.mockResolvedValue({ id: 'tbl-1', name: 'Leads' });

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'Leads' },
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1', 'user-1');
    expect(outcome.allSucceeded).toBe(true);
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].success).toBe(true);
    expect(mockCreateTable).toHaveBeenCalledWith('base-1', 'Leads', undefined, 'user-1');
  });

  it('executes create_field → calls metadataService.createField', async () => {
    mockCreateField.mockResolvedValue({ id: 'fld-1', name: 'Email' });

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'create_field',
        target: { type: 'field', table_id: 'tbl-1' },
        payload: { name: 'Email', fieldType: 'email' },
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1', 'user-1');
    expect(outcome.allSucceeded).toBe(true);
    expect(mockCreateField).toHaveBeenCalledWith('tbl-1', 'Email', 'email', {}, 'user-1');
  });

  it('executes operations in dependency order', async () => {
    const callOrder: string[] = [];
    mockCreateTable.mockImplementation(async () => {
      callOrder.push('create_table');
      return { id: 'tbl-1', name: 'Tasks' };
    });
    mockCreateField.mockImplementation(async () => {
      callOrder.push('create_field');
      return { id: 'fld-1', name: 'Name' };
    });

    const ops: SchemaOperation[] = [
      {
        id: 'op_2',
        operation_type: 'create_field',
        target: { type: 'field', table_id: 'op_1' },
        payload: { name: 'Name', fieldType: 'singleLineText' },
        dependencies: ['op_1'],
        reversible: true,
      },
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'Tasks' },
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1', 'user-1');
    expect(outcome.allSucceeded).toBe(true);
    expect(callOrder).toEqual(['create_table', 'create_field']);
  });

  it('rolls back previous operations on failure', async () => {
    mockCreateTable.mockResolvedValue({ id: 'tbl-1', name: 'Tasks' });
    mockCreateField.mockRejectedValue(new Error('DB constraint violation'));
    mockDeleteTable.mockResolvedValue(undefined);

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'Tasks' },
        reversible: true,
      },
      {
        id: 'op_2',
        operation_type: 'create_field',
        target: { type: 'field', table_id: 'tbl-1' },
        payload: { name: 'Name', fieldType: 'singleLineText' },
        dependencies: ['op_1'],
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1', 'user-1');
    expect(outcome.allSucceeded).toBe(false);
    expect(mockDeleteTable).toHaveBeenCalledWith('tbl-1');
  });

  it('resolves @ref:TableName references to actual IDs', async () => {
    mockCreateTable.mockResolvedValueOnce({ id: 'real-tbl-id', name: 'Contacts' });
    mockCreateField.mockResolvedValue({ id: 'fld-1', name: 'Email' });

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'Contacts' },
        reversible: true,
      },
      {
        id: 'op_2',
        operation_type: 'create_field',
        target: { type: 'field', table_id: '@ref:Contacts' },
        payload: { name: 'Email', fieldType: 'email' },
        dependencies: ['op_1'],
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1', 'user-1');
    expect(outcome.allSucceeded).toBe(true);
    expect(mockCreateField).toHaveBeenCalledWith(
      'real-tbl-id',
      'Email',
      'email',
      {},
      'user-1',
    );
  });

  it('rollback of create_table calls deleteTable', async () => {
    mockCreateTable.mockResolvedValueOnce({ id: 'tbl-1', name: 'T1' });
    mockCreateTable.mockRejectedValueOnce(new Error('fail'));
    mockDeleteTable.mockResolvedValue(undefined);

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'T1' },
        reversible: true,
      },
      {
        id: 'op_2',
        operation_type: 'create_table',
        target: { type: 'table' },
        payload: { name: 'T2' },
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1');
    expect(outcome.allSucceeded).toBe(false);
    expect(mockDeleteTable).toHaveBeenCalledWith('tbl-1');
  });

  it('rollback of modify_field restores old values', async () => {
    const oldField = { id: 'fld-1', name: 'OldName', field_type: 'text', options: {} };
    mockQuery.mockResolvedValue({ rows: [oldField] });
    mockUpdateField.mockResolvedValueOnce(undefined);
    mockCreateField.mockRejectedValue(new Error('fail'));
    mockUpdateField.mockResolvedValueOnce(undefined);

    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'modify_field',
        target: { type: 'field', field_id: 'fld-1' },
        payload: { name: 'NewName' },
        reversible: true,
      },
      {
        id: 'op_2',
        operation_type: 'create_field',
        target: { type: 'field', table_id: 'tbl-1' },
        payload: { name: 'Extra', fieldType: 'text' },
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1');
    expect(outcome.allSucceeded).toBe(false);
    expect(mockUpdateField).toHaveBeenCalledWith('fld-1', {
      name: 'OldName',
      options: {},
    });
  });

  it('returns unknown operation type error', async () => {
    const ops: SchemaOperation[] = [
      {
        id: 'op_1',
        operation_type: 'teleport_table' as string,
        target: { type: 'table' },
        payload: {},
        reversible: true,
      },
    ];

    const outcome = await executor.executeOperations(ops, 'base-1');
    expect(outcome.allSucceeded).toBe(false);
    expect(outcome.results[0].error).toContain('Unknown operation type');
  });
});
