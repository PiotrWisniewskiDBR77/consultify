import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: getMock,
}));

import { highRiskSurfaceGuard } from '../../../../server/src/middleware/highRiskSurfaceGuard.middleware.ts';

function makeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status } as any, status, json };
}

describe('highRiskSurfaceGuard.middleware', () => {
  const originalEnv = process.env.TRIAL_UPLOAD_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TRIAL_UPLOAD_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TRIAL_UPLOAD_ENABLED;
    else process.env.TRIAL_UPLOAD_ENABLED = originalEnv;
  });

  it('blocks trial upload when TRIAL_UPLOAD_ENABLED is not true', async () => {
    getMock.mockResolvedValueOnce({ user_status: 'ACTIVE' });
    getMock.mockResolvedValueOnce({ organization_type: 'TRIAL' });
    const req: any = {
      method: 'POST',
      originalUrl: '/api/knowledge/upload',
      user: { id: 'user-1', organizationId: 'trial-org' },
    };
    const { res, status, json } = makeResponse();
    const next = vi.fn();

    await highRiskSurfaceGuard({ categories: ['upload'] })(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TRIAL_UPLOAD_DISABLED',
        error: 'TRIAL_UPLOAD_DISABLED',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows paid upload even when trial upload flag is false', async () => {
    getMock.mockResolvedValueOnce({ user_status: 'ACTIVE' });
    getMock.mockResolvedValueOnce({ organization_type: 'PAID' });
    const req: any = {
      method: 'POST',
      originalUrl: '/api/knowledge/upload',
      user: { id: 'user-1', organizationId: 'paid-org' },
    };
    const { res } = makeResponse();
    const next = vi.fn();

    await highRiskSurfaceGuard({ categories: ['upload'] })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks demo high-risk writes deny-by-default', async () => {
    const req: any = {
      method: 'POST',
      originalUrl: '/api/report-builder/report-1/share',
      demo: { enabled: true, organizationId: 'demo-org' },
      user: { id: 'user-1', organizationId: 'demo-org' },
    };
    const { res, status, json } = makeResponse();
    const next = vi.fn();

    await highRiskSurfaceGuard({ categories: ['public_share'] })(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PUBLIC_SHARE_DISABLED',
        error: 'PUBLIC_SHARE_DISABLED',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });
});
