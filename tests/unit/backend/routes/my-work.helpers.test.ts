import { describe, expect, it, vi } from 'vitest';

import { requireUser } from '../../../../server/src/routes/my-work/_helpers.ts';

describe('my-work/_helpers requireUser', () => {
  it('falls back to req.user.id when req.userId accessor throws', () => {
    const req: any = { user: { id: 'user-fallback', organizationId: 'org-1' } };
    Object.defineProperty(req, 'userId', {
      configurable: true,
      get: () => {
        throw new Error('userId getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    const out = requireUser(req, res);

    expect(out).toEqual({ userId: 'user-fallback', orgId: 'org-1' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('falls back to req.user.organizationId when req.organizationId accessor throws', () => {
    const req: any = { user: { id: 'u-1', organizationId: 'org-fallback' } };
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    const out = requireUser(req, res);

    expect(out).toEqual({ userId: 'u-1', orgId: 'org-fallback' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
