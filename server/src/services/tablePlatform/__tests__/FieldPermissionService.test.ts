import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fieldPermissionService } from '../FieldPermissionService.js';

const TABLE_ID = 'tbl-1';
const USER_ID = 'user-1';

describe('FieldPermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tableHasFieldPermissions', () => {
    it('returns true when a field has permissions configured', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ has_field_perms: true }] });
      const result = await fieldPermissionService.tableHasFieldPermissions(TABLE_ID);
      expect(result).toBe(true);
    });

    it('returns false when no field has permissions configured', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ has_field_perms: false }] });
      const result = await fieldPermissionService.tableHasFieldPermissions(TABLE_ID);
      expect(result).toBe(false);
    });
  });

  describe('canReadField', () => {
    it('defaults to true when no permissions are set on the field', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ options: {} }] });
      const result = await fieldPermissionService.canReadField(USER_ID, 'f1', 'viewer');
      expect(result).toBe(true);
    });

    it('returns false for a field hidden from the given role', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { readRoles: ['base_owner', 'data_editor'] } } }],
      });
      const result = await fieldPermissionService.canReadField(USER_ID, 'f1', 'viewer');
      expect(result).toBe(false);
    });

    it('returns true for a role explicitly included in readRoles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { readRoles: ['base_owner', 'viewer'] } } }],
      });
      const result = await fieldPermissionService.canReadField(USER_ID, 'f1', 'viewer');
      expect(result).toBe(true);
    });

    it('returns true when readRoles contains wildcard "*"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { readRoles: ['*'] } } }],
      });
      const result = await fieldPermissionService.canReadField(USER_ID, 'f1', 'form_submitter');
      expect(result).toBe(true);
    });

    it('returns false when field does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await fieldPermissionService.canReadField(USER_ID, 'missing', 'viewer');
      expect(result).toBe(false);
    });
  });

  describe('canWriteField', () => {
    it('defaults to true when no writeRoles configured', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ options: {} }] });
      const result = await fieldPermissionService.canWriteField(USER_ID, 'f1', 'data_editor');
      expect(result).toBe(true);
    });

    it('rejects write for a role not in writeRoles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { writeRoles: ['base_owner'] } } }],
      });
      const result = await fieldPermissionService.canWriteField(USER_ID, 'f1', 'data_editor');
      expect(result).toBe(false);
    });

    it('allows write for a role included in writeRoles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { writeRoles: ['data_editor'] } } }],
      });
      const result = await fieldPermissionService.canWriteField(USER_ID, 'f1', 'data_editor');
      expect(result).toBe(true);
    });

    it('allows write when writeRoles contains wildcard "*"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ options: { permissions: { writeRoles: ['*'] } } }],
      });
      const result = await fieldPermissionService.canWriteField(USER_ID, 'f1', 'viewer');
      expect(result).toBe(true);
    });

    it('returns false when field does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await fieldPermissionService.canWriteField(USER_ID, 'missing', 'data_editor');
      expect(result).toBe(false);
    });
  });

  describe('filterRecordFields', () => {
    it('removes a field hidden for the given role from the record data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'f_public', options: {} },
          { id: 'f_secret', options: { permissions: { readRoles: ['base_owner'] } } },
        ],
      });

      const record = { data: { f_public: 'visible', f_secret: 'ssn-123-45-6789' } };
      const result = await fieldPermissionService.filterRecordFields(record, TABLE_ID, 'viewer');

      expect(result).toEqual({ f_public: 'visible' });
      expect(result.f_secret).toBeUndefined();
    });

    it('keeps a field readable by the given role', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'f_secret', options: { permissions: { readRoles: ['base_owner', 'viewer'] } } }],
      });

      const record = { data: { f_secret: 'value' } };
      const result = await fieldPermissionService.filterRecordFields(record, TABLE_ID, 'viewer');
      expect(result).toEqual({ f_secret: 'value' });
    });

    it('omits fields that are undefined in record data even if readable', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'f_missing', options: {} }],
      });
      const record = { data: {} };
      const result = await fieldPermissionService.filterRecordFields(record, TABLE_ID, 'viewer');
      expect(result).toEqual({});
    });

    it('keeps all fields when no field has permissions configured', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'f1', options: {} },
          { id: 'f2', options: {} },
        ],
      });
      const record = { data: { f1: 'a', f2: 'b' } };
      const result = await fieldPermissionService.filterRecordFields(record, TABLE_ID, 'form_submitter');
      expect(result).toEqual({ f1: 'a', f2: 'b' });
    });
  });

  describe('validateWritePermissions', () => {
    it('rejects a write to a field forbidden for the role', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'f_public', name: 'Public', options: {} },
          {
            id: 'f_locked',
            name: 'Locked Field',
            options: { permissions: { writeRoles: ['base_owner'] } },
          },
        ],
      });

      const result = await fieldPermissionService.validateWritePermissions(
        { f_public: 'ok', f_locked: 'attempt' },
        TABLE_ID,
        'viewer'
      );

      expect(result.allowed).toBe(false);
      expect(result.deniedFields).toEqual(['Locked Field']);
    });

    it('allows the write when all fields are permitted for the role', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'f_public', name: 'Public', options: {} }],
      });

      const result = await fieldPermissionService.validateWritePermissions(
        { f_public: 'ok' },
        TABLE_ID,
        'data_editor'
      );

      expect(result).toEqual({ allowed: true, deniedFields: [] });
    });

    it('ignores keys in the payload that do not correspond to any field', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await fieldPermissionService.validateWritePermissions(
        { ghostField: 'x' },
        TABLE_ID,
        'viewer'
      );
      expect(result).toEqual({ allowed: true, deniedFields: [] });
    });

    it('allows write when writeRoles includes wildcard "*"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'f1', name: 'F1', options: { permissions: { writeRoles: ['*'] } } }],
      });
      const result = await fieldPermissionService.validateWritePermissions(
        { f1: 'value' },
        TABLE_ID,
        'form_submitter'
      );
      expect(result).toEqual({ allowed: true, deniedFields: [] });
    });

    it('collects multiple denied fields', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'f_a', name: 'Field A', options: { permissions: { writeRoles: ['base_owner'] } } },
          { id: 'f_b', name: 'Field B', options: { permissions: { writeRoles: ['schema_editor'] } } },
        ],
      });
      const result = await fieldPermissionService.validateWritePermissions(
        { f_a: 1, f_b: 2 },
        TABLE_ID,
        'viewer'
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedFields).toEqual(['Field A', 'Field B']);
    });
  });
});
