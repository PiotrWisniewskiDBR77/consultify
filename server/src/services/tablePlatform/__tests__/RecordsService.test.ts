import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../AuditService.js', () => ({
  default: { logEvent: vi.fn().mockResolvedValue(undefined) },
}));

const mockValidateRecord = vi.fn();
const mockValidateRecordSize = vi.fn();
vi.mock('../SchemaValidationService.js', () => ({
  default: {
    validateRecord: (...args: unknown[]) => mockValidateRecord(...args),
    validateRecordSize: (...args: unknown[]) => mockValidateRecordSize(...args),
  },
}));

const mockOnRecordDeleted = vi.fn();
vi.mock('../RelationService.js', () => ({
  default: { onRecordDeleted: (...args: unknown[]) => mockOnRecordDeleted(...args) },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'rec-uuid-001'),
}));

import { ValidationError } from '../ErrorHandling.js';
import recordsService from '../RecordsService.js';

describe('RecordsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateRecord.mockResolvedValue({ valid: true, errors: [] });
    mockValidateRecordSize.mockReturnValue(undefined);
    mockOnRecordDeleted.mockResolvedValue(undefined);
  });

  // 1. createRecord → calls validation, inserts, returns record
  it('createRecord calls validation, inserts, and returns record', async () => {
    const recordRow = { id: 'rec-uuid-001', table_id: 't-1', data: { Name: 'Test' } };
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // loadAutoFields
      .mockResolvedValueOnce({ rows: [{ display_name: 'user-1' }] }) // resolveUserName
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [recordRow] }) // SELECT after insert
      .mockResolvedValueOnce({
        rows: [{ id: 'f1', name: 'Name', field_type: 'single_line_text', options: {} }],
      }); // recomputeAffectedFields tp_fields

    const result = await recordsService.createRecord('t-1', { Name: 'Test' }, 'user-1');

    expect(mockValidateRecord).toHaveBeenCalledWith('t-1', { Name: 'Test' });
    expect(mockValidateRecordSize).toHaveBeenCalledWith({ Name: 'Test' });
    expect(result).toEqual(recordRow);
  });

  // 2. createRecord with invalid data → throws ValidationError
  it('createRecord throws ValidationError when validation fails', async () => {
    mockValidateRecord.mockResolvedValue({
      valid: false,
      errors: [{ fieldId: 'f1', message: 'must be a string' }],
    });

    await expect(
      recordsService.createRecord('t-1', { Title: 123 as any }, 'user-1')
    ).rejects.toThrow(ValidationError);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  // 3. updateRecord → calls validation, updates
  it('updateRecord calls validation and updates record', async () => {
    const before = { id: 'r-1', table_id: 't-1', data: { Name: 'Old' } };
    const after = { id: 'r-1', table_id: 't-1', data: { Name: 'New' } };
    mockQuery
      .mockResolvedValueOnce({ rows: [before] }) // SELECT before
      .mockResolvedValueOnce({ rows: [] }) // loadAutoFields
      .mockResolvedValueOnce({ rows: [{ display_name: 'user-1' }] }) // resolveUserName
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [after] }) // SELECT after
      .mockResolvedValueOnce({
        rows: [{ id: 'f1', name: 'Name', field_type: 'single_line_text', options: {} }],
      }); // recomputeAffectedFields tp_fields

    const result = await recordsService.updateRecord('r-1', { Name: 'New' }, 'user-1');

    expect(mockValidateRecord).toHaveBeenCalledWith('t-1', { Name: 'New' });
    expect(mockValidateRecordSize).toHaveBeenCalledWith({ Name: 'New' });
    expect(result).toEqual(after);
  });

  // 4. deleteRecord → calls relationService.onRecordDeleted, then deletes
  it('deleteRecord calls onRecordDeleted and then deletes', async () => {
    const before = { id: 'r-1', table_id: 't-1', data: {} };
    mockQuery
      .mockResolvedValueOnce({ rows: [before] }) // SELECT before
      .mockResolvedValueOnce({ rows: [] }); // DELETE

    const result = await recordsService.deleteRecord('r-1', 'user-1');

    expect(mockOnRecordDeleted).toHaveBeenCalledWith('r-1');
    expect(result).toBe(true);
  });

  it('deleteRecord returns false when record does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await recordsService.deleteRecord('nonexistent');
    expect(result).toBe(false);
    expect(mockOnRecordDeleted).not.toHaveBeenCalled();
  });

  // 5. getRecord → returns record with data
  it('getRecord returns record with data', async () => {
    const recordRow = { id: 'r-1', table_id: 't-1', data: { Name: 'Test' } };
    mockQuery
      .mockResolvedValueOnce({ rows: [recordRow] }) // SELECT record
      .mockResolvedValueOnce({ rows: [] }); // getAttachmentFieldIds

    const result = await recordsService.getRecord('r-1');
    expect(result).toEqual(recordRow);
    expect(result.data.Name).toBe('Test');
  });

  it('getRecord returns null for missing record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await recordsService.getRecord('nonexistent');
    expect(result).toBeNull();
  });

  // 6. listRecords → returns paginated results
  it('listRecords returns paginated results', async () => {
    const records = [
      { id: 'r-1', table_id: 't-1', data: { Name: 'A' }, created_at: '2024-01-01' },
      { id: 'r-2', table_id: 't-1', data: { Name: 'B' }, created_at: '2024-01-02' },
    ];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // COUNT
      .mockResolvedValueOnce({ rows: records }) // SELECT records (runs before getAttachmentFieldIds)
      .mockResolvedValueOnce({ rows: [] }); // getAttachmentFieldIds

    const result = await recordsService.listRecords('t-1', { pageSize: 10 });

    expect(result.records).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('listRecords returns hasMore=true when more records exist', async () => {
    const records = Array.from({ length: 4 }, (_, i) => ({
      id: `r-${i}`,
      table_id: 't-1',
      data: {},
      created_at: `2024-01-0${i + 1}`,
    }));
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10' }] }) // COUNT
      .mockResolvedValueOnce({ rows: records }) // SELECT records (runs before getAttachmentFieldIds)
      .mockResolvedValueOnce({ rows: [] }); // getAttachmentFieldIds

    const result = await recordsService.listRecords('t-1', { pageSize: 3 });

    expect(result.records).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBeDefined();
  });
});
