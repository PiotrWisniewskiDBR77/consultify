import { describe, expect, it, vi } from 'vitest';

import auditLogMiddleware from '../../../../server/src/middleware/auditLog.middleware.ts';

describe('auditLogMiddleware (server/src/middleware/auditLog.middleware.ts)', () => {
  it('skips GET/OPTIONS/HEAD requests and calls next()', async () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/projects',
    };
    const res = {
      end: vi.fn(),
      statusCode: 200,
    };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledTimes(0);
  });

  it('wraps res.end for state-changing requests and does not throw (no org/user context)', async () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects/123',
      body: { name: 'X' },
      ip: '127.0.0.1',
      get: () => 'UA',
      user: null,
    };
    const originalEnd = vi.fn();
    const res = {
      end: originalEnd,
      statusCode: 201,
    };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Middleware replaces res.end; calling it should still call original end.
    res.end('ok');
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });
});
