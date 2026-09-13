import { beforeEach, describe, expect, it, vi } from 'vitest';

const { acquirePgClient } = vi.hoisted(() => ({ acquirePgClient: vi.fn() }));
vi.mock('../../database/PostgresDatabase.js', () => ({ acquirePgClient }));
vi.mock('../../utils/queryHelpers.js', () => ({}));

import { upsertOrgPolicy } from '../OrgPoliciesService.js';

describe('Organization policy transaction cleanup', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['BEGIN acknowledgement lost', 'policy update failed']) (
    '%s preserves the original error and discards the client if rollback fails',
    async (failurePoint) => {
      const original = new Error(failurePoint);
      const release = vi.fn();
      const query = vi.fn(async (sql: string) => {
        if (sql === 'ROLLBACK') throw new Error('rollback not confirmed');
        if (sql === 'BEGIN' && failurePoint === 'BEGIN acknowledgement lost') throw original;
        if (sql.startsWith('UPDATE org_policies')) throw original;
        if (sql.startsWith('SELECT * FROM org_policies')) {
          return { rows: [{ id: 'policy', organization_id: 'owned-org', retention_days: 30,
            legal_hold_enabled: 0, residency_region: 'EU' }] };
        }
        return { rows: [] };
      });
      acquirePgClient.mockResolvedValue({ query, release });

      await expect(upsertOrgPolicy('owned-org', { legalHoldEnabled: true })).rejects.toBe(original);

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
      expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    }
  );
});
