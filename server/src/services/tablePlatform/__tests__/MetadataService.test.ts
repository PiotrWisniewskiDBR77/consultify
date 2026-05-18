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

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-001'),
}));

import metadataService from '../MetadataService.js';

describe('MetadataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. createBase → returns base with id, name
  it('createBase returns base with id and name', async () => {
    const baseRow = {
      id: 'mock-uuid-001',
      name: 'My Base',
      workspace_id: 'ws-1',
      organization_id: 'org-1',
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [baseRow] }) // SELECT after insert
      .mockResolvedValueOnce({ rows: [] }) // INSERT/UPSERT tp_base_members base_owner
      .mockResolvedValueOnce({ rows: [] }) // OrgMemberSync: SELECT org members
      .mockResolvedValueOnce({ rows: [] }); // OrgMemberSync: SELECT existing base members

    const result = await metadataService.createBase('ws-1', 'org-1', 'My Base', 'user-1');
    expect(result).toEqual(baseRow);
    expect(result.id).toBe('mock-uuid-001');
    expect(result.name).toBe('My Base');

    const ownerRoleInsert = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('INSERT INTO tp_base_members') &&
        String(call[1]?.[0]) === 'mock-uuid-001' &&
        String(call[1]?.[1]) === 'user-1'
    );
    expect(ownerRoleInsert).toBeDefined();
  });

  // 2. getBase → returns base
  it('getBase returns base with tables', async () => {
    const baseRow = { id: 'b-1', name: 'Base', workspace_id: 'ws-1' };
    const tableRows = [{ id: 't-1', name: 'Table 1', base_id: 'b-1' }];
    mockQuery.mockResolvedValueOnce({ rows: [baseRow] }).mockResolvedValueOnce({ rows: tableRows });

    const result = await metadataService.getBase('b-1');
    expect(result.id).toBe('b-1');
    expect(result.tables).toEqual(tableRows);
  });

  // 3. updateBase → updates name
  it('updateBase updates name and returns updated base', async () => {
    const before = { id: 'b-1', name: 'Old' };
    const after = { id: 'b-1', name: 'New' };
    mockQuery
      .mockResolvedValueOnce({ rows: [before] }) // SELECT before
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [after] }); // SELECT after

    const result = await metadataService.updateBase('b-1', { name: 'New' }, 'user-1');
    expect(result.name).toBe('New');
  });

  // 4. deleteBase → deletes
  it('deleteBase returns true when base exists', async () => {
    const before = { id: 'b-1', name: 'Base' };
    mockQuery
      .mockResolvedValueOnce({ rows: [before] }) // SELECT before
      .mockResolvedValueOnce({ rows: [] }); // DELETE

    const result = await metadataService.deleteBase('b-1', 'user-1');
    expect(result).toBe(true);
  });

  it('deleteBase returns false when base does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await metadataService.deleteBase('nonexistent');
    expect(result).toBe(false);
  });

  // 5. createTable → returns table with id, name, base_id
  it('createTable returns table with id, name, base_id', async () => {
    const tableRow = { id: 'mock-uuid-001', name: 'Tasks', base_id: 'b-1' };
    const fieldsRows = [{ id: 'mock-uuid-001', name: 'Name', field_type: 'single_line_text' }];
    const viewsRows = [{ id: 'mock-uuid-001', name: 'Grid view', view_type: 'grid' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // INSERT table
      .mockResolvedValueOnce({ rows: [] }) // INSERT default field
      .mockResolvedValueOnce({ rows: [] }) // UPDATE primary_field_id
      .mockResolvedValueOnce({ rows: [] }) // INSERT default view
      .mockResolvedValueOnce({ rows: [tableRow] }) // getTable: SELECT table
      .mockResolvedValueOnce({ rows: fieldsRows }) // getTable: SELECT fields
      .mockResolvedValueOnce({ rows: viewsRows }) // getTable: SELECT views
      .mockResolvedValueOnce({ rows: [{ schema_version: 2 }] }) // bumpSchemaVersion UPDATE
      .mockResolvedValueOnce({ rows: [] }); // bumpSchemaVersion INSERT

    const result = await metadataService.createTable('b-1', 'Tasks', undefined, 'user-1');
    expect(result.id).toBe('mock-uuid-001');
    expect(result.name).toBe('Tasks');
    expect(result.base_id).toBe('b-1');
  });

  // 6. createField → returns field with correct type
  it('createField returns field with correct type', async () => {
    const fieldRow = {
      id: 'mock-uuid-001',
      name: 'Priority',
      field_type: 'singleSelect',
      table_id: 't-1',
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ next_order: 1 }] }) // MAX order
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: [{ base_id: 'b-1' }] }) // SELECT table for base_id
      .mockResolvedValueOnce({ rows: [{ schema_version: 3 }] }) // bumpSchemaVersion UPDATE
      .mockResolvedValueOnce({ rows: [] }); // bumpSchemaVersion INSERT

    const result = await metadataService.createField(
      't-1',
      'Priority',
      'singleSelect',
      { options: [{ value: 'High' }] },
      'user-1'
    );
    expect(result.name).toBe('Priority');
    expect(result.field_type).toBe('singleSelect');
  });

  // 7. updateField → updates name/options
  it('updateField updates name and options', async () => {
    const before = { id: 'f-1', name: 'Old', options: '{}', table_id: 't-1' };
    const after = { id: 'f-1', name: 'New', options: '{"color":"red"}', table_id: 't-1' };
    mockQuery
      .mockResolvedValueOnce({ rows: [before] }) // SELECT before
      .mockResolvedValueOnce({ rows: [{ governance_mode: 'operational' }] }) // assertNotGoverned
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [after] }) // SELECT after
      .mockResolvedValueOnce({ rows: [{ base_id: 'b-1' }] }) // SELECT table
      .mockResolvedValueOnce({ rows: [{ schema_version: 4 }] }) // bumpSchemaVersion
      .mockResolvedValueOnce({ rows: [] }); // bumpSchemaVersion INSERT

    const result = await metadataService.updateField('f-1', {
      name: 'New',
      options: { color: 'red' },
    });
    expect(result.name).toBe('New');
  });

  // 8. deleteField → deletes
  it('deleteField returns true when field exists', async () => {
    const before = { id: 'f-1', name: 'Field', table_id: 't-1' };
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM tp_fields WHERE id'))
        return Promise.resolve({ rows: [before] });
      if (sql.includes('SELECT governance_mode FROM tp_tables'))
        return Promise.resolve({ rows: [{ governance_mode: 'operational' }] });
      if (sql.includes('UPDATE tp_views') || sql.includes('DELETE FROM tp_fields WHERE id'))
        return Promise.resolve({ rows: [] });
      if (sql.includes('SELECT id, config FROM tp_forms WHERE table_id'))
        return Promise.resolve({ rows: [] });
      if (sql.includes('SELECT base_id FROM tp_tables WHERE id'))
        return Promise.resolve({ rows: [{ base_id: 'b-1' }] });
      if (sql.includes('schema_version = schema_version + 1'))
        return Promise.resolve({ rows: [{ schema_version: 5 }] });
      if (sql.includes('INSERT INTO tp_schema_versions')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const result = await metadataService.deleteField('f-1', 'user-1');
    expect(result).toBe(true);
  });

  // 9. createView → returns view
  it('createView returns view object', async () => {
    const viewRow = { id: 'mock-uuid-001', name: 'Kanban', view_type: 'kanban', table_id: 't-1' };
    mockQuery.mockImplementation((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO tp_views') &&
        sql.includes('config')
      ) {
        return Promise.resolve({ rows: [] });
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM tp_views WHERE id')) {
        return Promise.resolve({ rows: [viewRow] });
      }
      if (typeof sql === 'string' && sql.includes('SELECT base_id FROM tp_tables')) {
        return Promise.resolve({ rows: [{ base_id: 'b-1' }] });
      }
      if (typeof sql === 'string' && sql.includes('schema_version = schema_version + 1')) {
        return Promise.resolve({ rows: [{ schema_version: 6 }] });
      }
      if (typeof sql === 'string' && sql.includes('tp_schema_versions')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await metadataService.createView('t-1', 'Kanban', 'kanban', {}, 'user-1');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Kanban');
    expect(result?.view_type).toBe('kanban');
  });

  // 10. Schema versioning → version increments after createTable, createField
  it('schema versioning: bumpSchemaVersion is called on createTable and createField', async () => {
    // createTable triggers bumpSchemaVersion
    const tableRow = { id: 'mock-uuid-001', name: 'T', base_id: 'b-1' };
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // INSERT table
      .mockResolvedValueOnce({ rows: [] }) // INSERT field
      .mockResolvedValueOnce({ rows: [] }) // UPDATE primary_field_id
      .mockResolvedValueOnce({ rows: [] }) // INSERT view
      .mockResolvedValueOnce({ rows: [tableRow] }) // getTable: SELECT
      .mockResolvedValueOnce({ rows: [] }) // getTable: fields
      .mockResolvedValueOnce({ rows: [] }) // getTable: views
      .mockResolvedValueOnce({ rows: [{ schema_version: 2 }] }) // bumpSchemaVersion UPDATE
      .mockResolvedValueOnce({ rows: [] }); // bumpSchemaVersion INSERT

    await metadataService.createTable('b-1', 'T', undefined, 'user-1');

    const bumpCalls = mockQuery.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('schema_version = schema_version + 1')
    );
    expect(bumpCalls.length).toBeGreaterThanOrEqual(1);
    expect(bumpCalls[0][1]).toContain('b-1');
  });
});

// ── Part 3: changeFieldType ───────────────────────────────────────────────────

describe('changeFieldType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns preview with compatible/incompatible counts', async () => {
    const fieldRow = {
      id: 'f-text',
      field_type: 'single_line_text',
      table_id: 't-1',
      options: '{}',
    };
    const records = [
      { id: 'r-1', data: { 'f-text': '42' } },
      { id: 'r-2', data: { 'f-text': '3.14' } },
      { id: 'r-3', data: { 'f-text': 'not-a-number' } },
    ];

    mockQuery
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: records }); // SELECT records

    const result = await metadataService.changeFieldType('f-text', 'number', 'user-1', {}, true);

    expect(result).toHaveProperty('compatible', 2);
    expect(result).toHaveProperty('incompatible', 1);
    expect(result).toHaveProperty('samples');
    expect((result as any).samples.length).toBe(3);
  });

  it('converts text values to numbers on execute', async () => {
    const fieldRow = {
      id: 'f-text',
      field_type: 'single_line_text',
      table_id: 't-1',
      options: '{}',
    };
    const records = [
      { id: 'r-1', data: { 'f-text': '42' } },
      { id: 'r-2', data: { 'f-text': '3.14' } },
    ];

    mockQuery
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: records }) // SELECT records
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE field type
      .mockResolvedValueOnce({ rows: [] }) // UPDATE record r-1
      .mockResolvedValueOnce({ rows: [] }) // UPDATE record r-2
      .mockResolvedValueOnce({ rows: [{ schema_version: 5 }] }) // bump schema version
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await metadataService.changeFieldType('f-text', 'number', 'user-1');

    expect(result).toEqual({ success: true });

    const recordUpdates = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE tp_records SET data')
    );
    expect(recordUpdates.length).toBe(2);

    const r1Data = JSON.parse(recordUpdates[0][1][0] as string);
    expect(r1Data['f-text']).toBe(42);

    const r2Data = JSON.parse(recordUpdates[1][1][0] as string);
    expect(r2Data['f-text']).toBe(3.14);
  });

  it('sets incompatible values to null', async () => {
    const fieldRow = {
      id: 'f-text',
      field_type: 'single_line_text',
      table_id: 't-1',
      options: '{}',
    };
    const records = [{ id: 'r-1', data: { 'f-text': 'abc' } }];

    mockQuery
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: records }) // SELECT records
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE field type
      .mockResolvedValueOnce({ rows: [] }) // UPDATE record (null)
      .mockResolvedValueOnce({ rows: [{ schema_version: 6 }] }) // bump schema version
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await metadataService.changeFieldType('f-text', 'number', 'user-1');

    const recordUpdates = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE tp_records SET data')
    );
    expect(recordUpdates.length).toBe(1);

    const data = JSON.parse(recordUpdates[0][1][0] as string);
    expect(data['f-text']).toBeNull();
  });

  it('bumps schema version', async () => {
    const fieldRow = {
      id: 'f-text',
      field_type: 'single_line_text',
      table_id: 't-1',
      options: '{}',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: [] }) // SELECT records (empty)
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE field type
      .mockResolvedValueOnce({ rows: [{ schema_version: 7 }] }) // bump schema version
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await metadataService.changeFieldType('f-text', 'number', 'user-1');

    const bumpCalls = mockQuery.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('schema_version = schema_version + 1')
    );
    expect(bumpCalls.length).toBe(1);
  });

  it('rolls back on error', async () => {
    const fieldRow = {
      id: 'f-text',
      field_type: 'single_line_text',
      table_id: 't-1',
      options: '{}',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
      .mockResolvedValueOnce({ rows: [] }) // SELECT records
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB write failure')); // UPDATE field type fails

    await expect(metadataService.changeFieldType('f-text', 'number', 'user-1')).rejects.toThrow(
      'DB write failure'
    );

    const rollbackCalls = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0] === 'ROLLBACK'
    );
    expect(rollbackCalls.length).toBe(1);
  });
});
