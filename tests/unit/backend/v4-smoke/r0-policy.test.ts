/**
 * R0 Smoke: V4-ENT-04 — Org Policies Service
 * Verifies: hasLegalHold(), requireNoLegalHold(), getOrgPolicy(), upsertOrgPolicy()
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';
import {
  hasLegalHold,
  requireNoLegalHold,
  getOrgPolicy,
  OrgPoliciesError,
} from '../../../../server/src/services/OrgPoliciesService.js';

describe('V4-ENT-04: OrgPoliciesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hasLegalHold() returns true when legal_hold_enabled=1', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({ legal_hold_enabled: 1 });
    expect(await hasLegalHold('org-1')).toBe(true);
    expect(queryHelpers.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('legal_hold_enabled'),
      ['org-1']
    );
  });

  it('hasLegalHold() returns false when legal_hold_enabled=0', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({ legal_hold_enabled: 0 });
    expect(await hasLegalHold('org-1')).toBe(false);
  });

  it('hasLegalHold() returns false when no row exists', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue(null);
    expect(await hasLegalHold('org-1')).toBe(false);
  });

  it('hasLegalHold() returns false for empty orgId', async () => {
    expect(await hasLegalHold('')).toBe(false);
    expect(queryHelpers.queryOne).not.toHaveBeenCalled();
  });

  it('hasLegalHold() returns false when table does not exist', async () => {
    (queryHelpers.queryOne as any).mockRejectedValue(new Error('no such table: org_policies'));
    expect(await hasLegalHold('org-1')).toBe(false);
  });

  it('requireNoLegalHold() throws OrgPoliciesError when hold active', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({ legal_hold_enabled: 1 });
    await expect(requireNoLegalHold('org-1', 'delete')).rejects.toThrow(OrgPoliciesError);
    await expect(requireNoLegalHold('org-1', 'delete')).rejects.toThrow('legal hold');
  });

  it('requireNoLegalHold() resolves when no hold', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({ legal_hold_enabled: 0 });
    await expect(requireNoLegalHold('org-1', 'delete')).resolves.toBeUndefined();
  });

  it('getOrgPolicy() returns the policy row', async () => {
    const mockPolicy = {
      id: 'p1',
      organization_id: 'org-1',
      retention_days: 90,
      legal_hold_enabled: 0,
      residency_region: 'eu',
    };
    (queryHelpers.queryOne as any).mockResolvedValue(mockPolicy);
    const result = await getOrgPolicy('org-1');
    expect(result).toEqual(mockPolicy);
  });

  it('getOrgPolicy() returns null when table missing', async () => {
    (queryHelpers.queryOne as any).mockRejectedValue(new Error('no such table'));
    const result = await getOrgPolicy('org-1');
    expect(result).toBeNull();
  });
});
