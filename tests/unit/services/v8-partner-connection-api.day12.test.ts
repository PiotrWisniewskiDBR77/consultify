import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Delete: vi.fn(),
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { v8Get } from '@/services/api/v8/client';
import { V8PartnerApi } from '@/services/api/v8/partner';

describe('V8 Partner connection API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads connection from the canonical V8 Partner namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      connected: true,
      partnerOrganizationId: 'partner-org-1',
    });

    const data = await V8PartnerApi.getConnection();

    expect(v8Get).toHaveBeenCalledWith('/partner/connection');
    expect(data).toEqual({ connected: true, partnerOrganizationId: 'partner-org-1' });
  });
});
