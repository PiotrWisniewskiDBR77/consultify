import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet, mockDbAll, mockLogger } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
  mockDbAll: vi.fn(),
  mockLogger: {
    error: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: mockDbGet,
  all: mockDbAll,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

const { default: orgContextMiddleware } = await import(
  '../../../../server/src/middleware/orgContext.middleware.js'
);

describe('orgContext.middleware safety guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
  });

  it('sanitizes whitespace-padded membership role before attaching org context', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'm-role-trim',
      role: '  ADMIN  ',
      status: 'ACTIVE',
      permission_scope: null,
    });

    const req: any = {
      method: 'GET',
      params: { orgId: 'org-1' },
      headers: {},
      user: { id: 'u-1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await orgContextMiddleware()(req, res, next);

    expect(req.org?.role).toBe('ADMIN');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to MEMBER role when membership role contains control characters', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'm-role-ctrl',
      role: 'ADMIN\u0007',
      status: 'ACTIVE',
      permission_scope: null,
    });

    const req: any = {
      method: 'GET',
      params: { orgId: 'org-1' },
      headers: {},
      user: { id: 'u-1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await orgContextMiddleware()(req, res, next);

    expect(req.org?.role).toBe('MEMBER');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not attempt catch-path 500 write when headers are already sent', async () => {
    mockDbGet.mockRejectedValueOnce(new Error('simulated db failure'));

    const req: any = {
      method: 'GET',
      params: { orgId: 'org-1' },
      headers: {},
      user: { id: 'u-1', organizationId: '' },
    };
    const res: any = {
      headersSent: true,
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await expect(orgContextMiddleware()(req, res, next)).resolves.toBeUndefined();

    expect(mockDbGet).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
