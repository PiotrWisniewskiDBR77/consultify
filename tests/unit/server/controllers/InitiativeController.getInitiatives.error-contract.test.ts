import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  // not part of the real module, but the controller probes it via `typeof qh.getTableColumns`
  // and vitest 4 throws on undefined-export access of a mocked module
  getTableColumns: undefined,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { InitiativeController } from '../../../../server/src/controllers/InitiativeController.js';

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('InitiativeController.getInitiatives error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 with machine-readable code when organization is missing', async () => {
    const req: any = {
      user: null,
      headers: {},
      query: {},
    };
    const res = createRes();

    await InitiativeController.getInitiatives(req, res as any, vi.fn() as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      code: 'INITIATIVES_UNAUTHORIZED',
    });
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('returns 500 with machine-readable code when queryAll throws', async () => {
    mockQueryAll.mockRejectedValueOnce(new Error('db down'));
    const req: any = {
      user: { organizationId: 'org-1' },
      headers: {},
      query: {},
    };
    const res = createRes();

    await InitiativeController.getInitiatives(req, res as any, vi.fn() as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to load initiatives',
      code: 'INITIATIVES_LIST_FAILED',
    });
  });
});
