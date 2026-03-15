import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import schemaValidationService from '../SchemaValidationService.js';

function makeFieldRow(
  id: string,
  name: string,
  fieldType: string,
  options: Record<string, unknown> = {}
) {
  return { id, name, field_type: fieldType, options };
}

const TABLE_ID = 'tbl-001';

describe('SchemaValidationService.validateRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupFields(
    fields: Array<{ id: string; name: string; field_type: string; options?: Record<string, unknown> }>
  ) {
    mockQuery.mockResolvedValueOnce({ rows: fields });
  }

  // 1. Valid singleLineText
  it('passes for valid singleLineText', async () => {
    setupFields([makeFieldRow('f1', 'Title', 'singleLineText')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Title: 'Hello' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 2. singleLineText exceeding 10000 chars
  it('fails for singleLineText exceeding 10000 chars', async () => {
    setupFields([makeFieldRow('f1', 'Title', 'singleLineText')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      Title: 'x'.repeat(10001),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('exceeds max length');
  });

  // 3. Valid number
  it('passes for valid number', async () => {
    setupFields([makeFieldRow('f2', 'Amount', 'number')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Amount: 42.5 });
    expect(result.valid).toBe(true);
  });

  // 4. NaN number
  it('fails for NaN number', async () => {
    setupFields([makeFieldRow('f2', 'Amount', 'number')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Amount: NaN });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('finite number');
  });

  // 5. Valid checkbox (true)
  it('passes for valid checkbox true', async () => {
    setupFields([makeFieldRow('f3', 'Done', 'checkbox')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Done: true });
    expect(result.valid).toBe(true);
  });

  // 5b. Valid checkbox (false)
  it('passes for valid checkbox false', async () => {
    setupFields([makeFieldRow('f3', 'Done', 'checkbox')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Done: false });
    expect(result.valid).toBe(true);
  });

  // 6. Invalid checkbox (string)
  it('fails for invalid checkbox (string)', async () => {
    setupFields([makeFieldRow('f3', 'Done', 'checkbox')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Done: 'yes' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('boolean');
  });

  // 7. Valid date (ISO string)
  it('passes for valid ISO date', async () => {
    setupFields([makeFieldRow('f4', 'DueDate', 'date')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      DueDate: '2024-06-15T10:30:00Z',
    });
    expect(result.valid).toBe(true);
  });

  // 8. Invalid date
  it('fails for invalid date', async () => {
    setupFields([makeFieldRow('f4', 'DueDate', 'date')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      DueDate: 'not-a-date',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('valid ISO date');
  });

  // 9. Valid singleSelect (value in options)
  it('passes for valid singleSelect value', async () => {
    setupFields([
      makeFieldRow('f5', 'Status', 'singleSelect', {
        options: [{ value: 'Active' }, { value: 'Closed' }],
      }),
    ]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Status: 'Active' });
    expect(result.valid).toBe(true);
  });

  // 10. Invalid singleSelect (value not in options)
  it('fails for invalid singleSelect value', async () => {
    setupFields([
      makeFieldRow('f5', 'Status', 'singleSelect', {
        options: [{ value: 'Active' }, { value: 'Closed' }],
      }),
    ]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Status: 'Unknown' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('not in allowed options');
  });

  // 11. Valid multiSelect (array of valid values)
  it('passes for valid multiSelect array', async () => {
    setupFields([
      makeFieldRow('f6', 'Tags', 'multiSelect', {
        options: [{ value: 'A' }, { value: 'B' }, { value: 'C' }],
      }),
    ]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Tags: ['A', 'C'] });
    expect(result.valid).toBe(true);
  });

  // 12. Invalid multiSelect (non-array)
  it('fails for multiSelect non-array', async () => {
    setupFields([
      makeFieldRow('f6', 'Tags', 'multiSelect', {
        options: [{ value: 'A' }],
      }),
    ]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Tags: 'A' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('must be an array');
  });

  // 13. Valid email
  it('passes for valid email', async () => {
    setupFields([makeFieldRow('f7', 'Email', 'email')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      Email: 'user@example.com',
    });
    expect(result.valid).toBe(true);
  });

  // 14. Invalid email
  it('fails for invalid email', async () => {
    setupFields([makeFieldRow('f7', 'Email', 'email')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, { Email: 'not-email' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('valid email');
  });

  // 15. Valid URL
  it('passes for valid URL', async () => {
    setupFields([makeFieldRow('f8', 'Website', 'url')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      Website: 'https://example.com',
    });
    expect(result.valid).toBe(true);
  });

  // 16. Invalid URL
  it('fails for invalid URL', async () => {
    setupFields([makeFieldRow('f8', 'Website', 'url')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      Website: 'not a url',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('valid URL');
  });

  // 17. Auto field rejection (createdTime)
  it('rejects writing to auto field createdTime', async () => {
    setupFields([makeFieldRow('f9', 'Created', 'createdTime')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      Created: '2024-01-01',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('auto field');
  });

  // 18. Unknown field → passes (ignored)
  it('ignores unknown fields', async () => {
    setupFields([makeFieldRow('f1', 'Title', 'singleLineText')]);
    const result = await schemaValidationService.validateRecord(TABLE_ID, {
      NonExistent: 'anything',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
