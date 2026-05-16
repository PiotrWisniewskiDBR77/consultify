import { describe, expect, it } from 'vitest';

import { scopeFromAuthRequest } from '../../../../server/src/routes/v10/runtimeRouteUtils.ts';

describe('v10 runtimeRouteUtils scopeFromAuthRequest', () => {
  it('falls back to req.userId when req.user.id accessor throws', () => {
    const user: any = { organizationId: 'org-1' };
    Object.defineProperty(user, 'id', {
      configurable: true,
      get: () => {
        throw new Error('id getter failed');
      },
    });
    const req: any = { user, userId: 'user-fallback' };

    const scope = scopeFromAuthRequest(req);

    expect(scope.userId).toBe('user-fallback');
    expect(scope.tenantId).toBe('org-1');
  });

  it('falls back to req.organizationId when req.user.organizationId accessor throws', () => {
    const user: any = { id: 'u-1' };
    Object.defineProperty(user, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const req: any = { user, organizationId: 'org-fallback' };

    const scope = scopeFromAuthRequest(req);

    expect(scope.tenantId).toBe('org-fallback');
    expect(scope.userId).toBe('u-1');
  });
});
