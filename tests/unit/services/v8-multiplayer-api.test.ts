import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8MultiplayerApi } from '@/services/api/v8/multiplayer';
import { v8Get } from '@/services/api/v8/client';

describe('V8MultiplayerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed workspace resource mapping from the V8 multiplayer namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      mapping: {
        mappingId: 'mapping-1',
        resourceType: 'workspace',
        roomGranularity: 'resource',
        embeddedIn: null,
        surfaceAware: true,
        organizationId: 'org-1',
        createdAt: '2026-03-25T00:00:00Z',
      },
      resourceType: 'workspace',
    });

    const data = await V8MultiplayerApi.getWorkspaceMapping();

    expect(v8Get).toHaveBeenCalledWith('/multiplayer/resource-mappings/workspace');
    expect(data.mapping?.surfaceAware).toBe(true);
    expect(data.mapping?.roomGranularity).toBe('resource');
  });
});
