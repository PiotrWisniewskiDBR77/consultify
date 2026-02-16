import { describe, expect, it } from 'vitest';

import { getRequestContext } from '../../../../server/src/utils/requestContext.js';

function makeReq(overrides: any = {}) {
  return {
    ip: '1.2.3.4',
    method: 'GET',
    path: '/x',
    get: (h: string) => {
      if (h === 'User-Agent') return 'ua';
      if (h === 'X-Request-Id') return 'rid';
      return undefined;
    },
    ...overrides,
  } as any;
}

describe('server utils/requestContext', () => {
  it('prefers req.user when present', () => {
    const req = makeReq({
      user: { id: 'u1', organization_id: 'o1', role: 'ADMIN' },
    });
    expect(getRequestContext(req)).toMatchObject({ userId: 'u1', orgId: 'o1', role: 'ADMIN' });
  });

  it('falls back to req.session.user when req.user is missing', () => {
    const req = makeReq({
      session: { user: { id: 'u2', organizationId: 'o2', role: 'USER' } },
    });
    expect(getRequestContext(req)).toMatchObject({ userId: 'u2', orgId: 'o2', role: 'USER' });
  });

  it('uses safe defaults for role, ip, userAgent and requestId', () => {
    const req = makeReq({
      ip: undefined,
      connection: { remoteAddress: '9.9.9.9' },
      get: () => undefined,
    });
    expect(getRequestContext(req)).toMatchObject({
      role: 'GUEST',
      ip: '9.9.9.9',
      userAgent: 'unknown',
      requestId: 'none',
    });
  });

  it('includes method and path from request', () => {
    const req = makeReq({ method: 'POST', path: '/api' });
    expect(getRequestContext(req)).toMatchObject({ method: 'POST', path: '/api' });
  });
});
