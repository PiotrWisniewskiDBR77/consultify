import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

import { getValuation } from '../../../server/src/services/valuationService';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';

describe('valuationService.getValuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no valuation is found', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue(null);
    const result = await getValuation('org-1', 'val-x');
    expect(result).toBeNull();
  });

  it('parses json fields and normalizes status', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      status: 'approved',
      assumptions: JSON.stringify({ horizonYears: 5, waccPercent: 12 }),
      peers: JSON.stringify([{ name: 'Peer 1' }]),
      results: JSON.stringify({ dcf: { enterpriseValue: 123 } }),
      advisory: JSON.stringify({ recommendations: [] }),
      negotiation_pack: JSON.stringify({ proPoints: [] }),
    });

    const result = await getValuation('org-1', 'val-1');

    expect(result?.status).toBe('APPROVED');
    expect(result?.assumptions).toMatchObject({ horizonYears: 5, waccPercent: 12 });
    expect(Array.isArray(result?.peers)).toBe(true);
    expect(result?.results?.dcf?.enterpriseValue).toBe(123);
    expect(result?.advisory).toMatchObject({ recommendations: [] });
    expect(result?.negotiation_pack).toMatchObject({ proPoints: [] });
  });
});
