import { describe, expect, it, vi } from 'vitest';

import { demoContextMiddleware, demoWriteProtection } from '../../../server/src/middleware/demoGuard.middleware.ts';

function makeReq(opts: { method: string; originalUrl: string; demoHeader?: string }) {
  const headers: Record<string, string | undefined> = {
    'x-demo-mode': opts.demoHeader,
  };
  return {
    method: opts.method,
    originalUrl: opts.originalUrl,
    url: opts.originalUrl,
    headers,
    get: (name: string) => headers[name.toLowerCase()],
    user: { id: 'u-1', organizationId: 'o-1', role: 'USER' },
  } as any;
}

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('Demo write protection', () => {
  it('blocks writes when X-Demo-Mode=true', async () => {
    const req = makeReq({ method: 'POST', originalUrl: '/api/initiatives', demoHeader: 'true' });
    const res = makeRes();
    const next1 = vi.fn();
    demoContextMiddleware(req, res as any, next1);
    expect(next1).toHaveBeenCalled();
    expect(req.demo).toEqual(expect.objectContaining({ enabled: true }));

    const next2 = vi.fn();
    const mw = demoWriteProtection({ allowedRoutes: ['/api/demo/', '/api/auth/'] });
    mw(req, res as any, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual(expect.objectContaining({ code: 'DEMO_READ_ONLY' }));
  });

  it('allows reads when X-Demo-Mode=true', async () => {
    const req = makeReq({ method: 'GET', originalUrl: '/api/initiatives', demoHeader: 'true' });
    const res = makeRes();
    const next1 = vi.fn();
    demoContextMiddleware(req, res as any, next1);

    const next2 = vi.fn();
    const mw = demoWriteProtection({ allowedRoutes: ['/api/demo/', '/api/auth/'] });
    mw(req, res as any, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('allows writes to whitelisted prefixes when X-Demo-Mode=true', async () => {
    const req = makeReq({ method: 'POST', originalUrl: '/api/demo/toggle', demoHeader: 'true' });
    const res = makeRes();
    const next1 = vi.fn();
    demoContextMiddleware(req, res as any, next1);

    const next2 = vi.fn();
    const mw = demoWriteProtection({ allowedRoutes: ['/api/demo/', '/api/auth/'] });
    mw(req, res as any, next2);
    expect(next2).toHaveBeenCalled();
  });
});
