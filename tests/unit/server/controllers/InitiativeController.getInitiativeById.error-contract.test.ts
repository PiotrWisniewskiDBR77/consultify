import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInitiativeDetailRead = vi.fn();

vi.mock('../../../../server/src/services/v8/planningPortfolioReadService.js', () => ({
  getInitiativeDetailRead: (...args: unknown[]) => mockGetInitiativeDetailRead(...args),
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

describe('InitiativeController.getInitiativeById error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 with machine-readable code when organization is missing', async () => {
    const req: any = {
      params: { id: 'init-1' },
      user: null,
      headers: {},
    };
    const res = createRes();

    await InitiativeController.getInitiativeById(req, res as any, vi.fn() as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      code: 'INITIATIVES_UNAUTHORIZED',
    });
  });

  it('returns 404 with machine-readable code when initiative is not found', async () => {
    mockGetInitiativeDetailRead.mockResolvedValueOnce(null);
    const req: any = {
      params: { id: 'init-1' },
      user: { organizationId: 'org-1' },
      headers: {},
    };
    const res = createRes();

    await InitiativeController.getInitiativeById(req, res as any, vi.fn() as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Initiative not found',
      code: 'INITIATIVE_NOT_FOUND',
    });
  });
});
