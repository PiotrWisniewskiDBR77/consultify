import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import rowPolicyService, { type RowPolicy } from '../RowPolicyService.js';

const TABLE_ID = 'tbl-1';

function makePolicy(overrides: Partial<RowPolicy> = {}): RowPolicy {
  return {
    id: 'policy-1',
    table_id: TABLE_ID,
    name: 'Test Policy',
    role: 'viewer',
    condition_field_id: 'f_status',
    condition_operator: 'equals',
    condition_value: 'Confidential',
    permission: 'none',
    is_active: true,
    created_at: '2024-01-01',
    ...overrides,
  };
}

describe('RowPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPolicy', () => {
    it('creates a policy with valid operator and permission', async () => {
      const row = makePolicy();
      mockQuery.mockResolvedValueOnce({ rows: [row] });
      const result = await rowPolicyService.createPolicy(
        TABLE_ID,
        'Test Policy',
        'viewer',
        'f_status',
        'equals',
        'Confidential',
        'none'
      );
      expect(result).toEqual(row);
    });

    it('rejects an invalid condition_operator', async () => {
      await expect(
        rowPolicyService.createPolicy(TABLE_ID, 'P', 'viewer', 'f1', 'bogus_op', 'x', 'read')
      ).rejects.toThrow('Invalid condition_operator');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects an invalid permission value', async () => {
      await expect(
        rowPolicyService.createPolicy(TABLE_ID, 'P', 'viewer', 'f1', 'equals', 'x', 'admin')
      ).rejects.toThrow('Invalid permission');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('listPolicies', () => {
    it('returns policies ordered by creation', async () => {
      const rows = [makePolicy()];
      mockQuery.mockResolvedValueOnce({ rows });
      const result = await rowPolicyService.listPolicies(TABLE_ID);
      expect(result).toEqual(rows);
    });

    it('propagates db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      await expect(rowPolicyService.listPolicies(TABLE_ID)).rejects.toThrow('db down');
    });
  });

  describe('updatePolicy', () => {
    it('updates provided fields only', async () => {
      const updated = makePolicy({ name: 'Renamed' });
      mockQuery.mockResolvedValueOnce({ rows: [updated] });
      const result = await rowPolicyService.updatePolicy('policy-1', { name: 'Renamed' });
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('name = $1'), [
        'Renamed',
        'policy-1',
      ]);
    });

    it('returns null when no updates provided', async () => {
      const result = await rowPolicyService.updatePolicy('policy-1', {});
      expect(result).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects invalid condition_operator on update', async () => {
      await expect(
        rowPolicyService.updatePolicy('policy-1', { condition_operator: 'bogus' as any })
      ).rejects.toThrow('Invalid condition_operator');
    });

    it('rejects invalid permission on update', async () => {
      await expect(
        rowPolicyService.updatePolicy('policy-1', { permission: 'admin' as any })
      ).rejects.toThrow('Invalid permission');
    });

    it('returns null when policy row not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await rowPolicyService.updatePolicy('policy-1', { name: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('deletePolicy', () => {
    it('returns true when a row was deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await rowPolicyService.deletePolicy('policy-1');
      expect(result).toBe(true);
    });

    it('returns false when no row matched', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      const result = await rowPolicyService.deletePolicy('missing');
      expect(result).toBe(false);
    });
  });

  describe('evaluateAccess — row filtering by role/condition', () => {
    it('grants write by default when no policies exist for the role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await rowPolicyService.evaluateAccess(TABLE_ID, { Status: 'Public' }, 'u1', 'viewer');
      expect(result).toBe('write');
    });

    it('denies access (none) when a matching policy has permission=none', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makePolicy({ permission: 'none', condition_operator: 'equals', condition_value: 'Confidential' })],
      });
      const result = await rowPolicyService.evaluateAccess(
        TABLE_ID,
        { f_status: 'Confidential' },
        'u1',
        'viewer'
      );
      expect(result).toBe('none');
    });

    it('downgrades to read when a matching policy has permission=read', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makePolicy({ permission: 'read', condition_value: 'Confidential' })],
      });
      const result = await rowPolicyService.evaluateAccess(
        TABLE_ID,
        { f_status: 'Confidential' },
        'u1',
        'viewer'
      );
      expect(result).toBe('read');
    });

    it('keeps write access when the condition does not match', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makePolicy({ permission: 'none', condition_value: 'Confidential' })],
      });
      const result = await rowPolicyService.evaluateAccess(
        TABLE_ID,
        { f_status: 'Public' },
        'u1',
        'viewer'
      );
      expect(result).toBe('write');
    });

    it('applies unconditional policy (no condition_field_id) to every row', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makePolicy({ permission: 'read', condition_field_id: null })],
      });
      const result = await rowPolicyService.evaluateAccess(TABLE_ID, { anything: 'x' }, 'u1', 'viewer');
      expect(result).toBe('read');
    });

    it('returns write (fail-open) when the query throws', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      const result = await rowPolicyService.evaluateAccess(TABLE_ID, {}, 'u1', 'viewer');
      expect(result).toBe('write');
    });

    it.each([
      ['not_equals', 'Public', 'Confidential', true],
      ['not_equals', 'Confidential', 'Confidential', false],
      ['contains', 'this is Confidential text', 'confidential', true],
      ['contains', 'public text', 'confidential', false],
      ['is_empty', '', '', true],
      ['is_empty', 'value', '', false],
      ['is_not_empty', 'value', '', true],
      ['is_not_empty', '', '', false],
      ['gt', '10', '5', true],
      ['gt', '3', '5', false],
      ['lt', '3', '5', true],
      ['gte', '5', '5', true],
      ['lte', '5', '5', true],
    ] as const)(
      'operator=%s value=%s vs cond=%s → matches=%s',
      async (operator, fieldValue, conditionValue, expectMatch) => {
        mockQuery.mockResolvedValueOnce({
          rows: [
            makePolicy({
              permission: 'none',
              condition_operator: operator,
              condition_value: conditionValue,
            }),
          ],
        });
        const result = await rowPolicyService.evaluateAccess(
          TABLE_ID,
          { f_status: fieldValue },
          'u1',
          'viewer'
        );
        expect(result).toBe(expectMatch ? 'none' : 'write');
      }
    );
  });

  describe('buildRowFilterClause', () => {
    it('returns TRUE when there are no deny policies', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const params: unknown[] = [];
      const result = await rowPolicyService.buildRowFilterClause(TABLE_ID, 'viewer', params, 1);
      expect(result).toEqual({ sql: 'TRUE', nextIdx: 1 });
      expect(params).toEqual([]);
    });

    it('returns FALSE for an unconditional deny policy', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makePolicy({ permission: 'none', condition_field_id: null })],
      });
      const params: unknown[] = [];
      const result = await rowPolicyService.buildRowFilterClause(TABLE_ID, 'viewer', params, 1);
      expect(result.sql).toBe('FALSE');
    });

    it('builds an exclusion clause for an equals deny policy', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          makePolicy({
            permission: 'none',
            condition_field_id: 'f_status',
            condition_operator: 'equals',
            condition_value: 'Confidential',
          }),
        ],
      });
      const params: unknown[] = [];
      const result = await rowPolicyService.buildRowFilterClause(TABLE_ID, 'viewer', params, 1);
      expect(result.sql).toContain('NOT (');
      expect(result.sql).toContain('r.data->>$1');
      expect(params).toEqual(['f_status', 'Confidential']);
      expect(result.nextIdx).toBe(3);
    });

    it('fail-safe returns TRUE on db error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      const params: unknown[] = [];
      const result = await rowPolicyService.buildRowFilterClause(TABLE_ID, 'viewer', params, 1);
      expect(result).toEqual({ sql: 'TRUE', nextIdx: 1 });
    });
  });
});
