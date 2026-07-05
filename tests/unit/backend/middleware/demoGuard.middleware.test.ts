import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  DEMO_ORG_ID,
  demoContextMiddleware,
  demoWriteProtection,
} from '../../../../server/src/middleware/demoGuard.middleware.ts';

describe('demoGuard.middleware runtime safety', () => {
  it('demoContextMiddleware continues when req.get throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => {
        throw new Error('get failed');
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    expect(() =>
      demoContextMiddleware(req as Request, res, next as unknown as NextFunction)
    ).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoContextMiddleware continues when req.user accessor throws', async () => {
    const req: any = {};
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return 'true';
        if (header === 'X-Demo-Session-Org') return 'demo-session-org';
        return null;
      },
    });
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    // Secure contract: a session-org header that cannot be validated (no resolvable
    // user → no DB lookup) is NOT trusted; org falls back to the base demo org.
    await demoContextMiddleware(req as Request, res, next as unknown as NextFunction);
    expect((req as any).demo).toEqual({
      enabled: true,
      organizationId: DEMO_ORG_ID,
      sessionValidated: false,
    });
    expect((req as any).organizationId).toBe(DEMO_ORG_ID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoContextMiddleware does not attach partial demo context when user org assignment throws', async () => {
    const req: any = { user: {} };
    Object.defineProperty(req.user, 'organizationId', {
      configurable: true,
      set: () => {
        throw new Error('organizationId setter failed');
      },
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return 'true';
        if (header === 'X-Demo-Session-Org') return 'demo-session-org';
        return null;
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    // A failed user-org write must roll back fully — no partial demo context leaks.
    await demoContextMiddleware(req as Request, res, next as unknown as NextFunction);
    expect((req as any).demo).toBeUndefined();
    expect((req as any).organizationId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoContextMiddleware enables demo mode for whitespace-padded X-Demo-Mode header', async () => {
    const req: any = {};
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return '  TRUE  ';
        if (header === 'X-Demo-Session-Org') return 'demo-session-org';
        return null;
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    // Trimmed/cased header still enables demo; unvalidated session org → base demo org.
    await demoContextMiddleware(req as Request, res, next as unknown as NextFunction);

    expect((req as any).demo).toEqual({
      enabled: true,
      organizationId: DEMO_ORG_ID,
      sessionValidated: false,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoContextMiddleware falls back to DEMO_ORG_ID for malformed session org header', async () => {
    const req: any = {};
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return 'true';
        if (header === 'X-Demo-Session-Org') return `demo-org\r\nbad`;
        return null;
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    await demoContextMiddleware(req as Request, res, next as unknown as NextFunction);

    expect((req as any).demo).toEqual({
      enabled: true,
      organizationId: DEMO_ORG_ID,
      sessionValidated: false,
    });
    expect((req as any).organizationId).toBe(DEMO_ORG_ID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoContextMiddleware ignores oversized X-Demo-Mode header payloads', () => {
    const req: any = {};
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return `true${'x'.repeat(80)}`;
        if (header === 'X-Demo-Session-Org') return 'demo-session-org';
        return null;
      },
    });
    const res = {} as Response;
    const next = vi.fn();

    demoContextMiddleware(req as Request, res, next as unknown as NextFunction);

    expect((req as any).demo).toBeUndefined();
    expect((req as any).organizationId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('demoWriteProtection blocks writes when req.get throws and org is demo', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => {
        throw new Error('get failed');
      },
    });

    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect((res as any).setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect((res as any).setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect((res as any).setHeader).toHaveBeenCalledWith('Expires', '0');
    expect((res as any).setHeader).toHaveBeenCalledWith('CDN-Cache-Control', 'no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection skips response write when headers already sent', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => 'true',
    });

    const res = {
      headersSent: true,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).not.toHaveBeenCalled();
    expect((res as any).json).not.toHaveBeenCalled();
  });

  it('demoWriteProtection skips response write when writableEnded is true', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => 'true',
    });

    const res = {
      headersSent: false,
      writableEnded: true,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).not.toHaveBeenCalled();
    expect((res as any).json).not.toHaveBeenCalled();
  });

  it('demoWriteProtection skips response write when finished is true', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => 'true',
    });

    const res = {
      headersSent: false,
      finished: true,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).not.toHaveBeenCalled();
    expect((res as any).json).not.toHaveBeenCalled();
  });

  it('demoWriteProtection skips response write when destroyed is true', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => 'true',
    });

    const res = {
      headersSent: false,
      destroyed: true,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).not.toHaveBeenCalled();
    expect((res as any).json).not.toHaveBeenCalled();
  });

  it('demoWriteProtection blocks writes for whitespace-padded X-Demo-Mode header', () => {
    const middleware = demoWriteProtection();
    const req: any = {};
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return '  TRUE  ';
        return null;
      },
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection ignores oversized X-Demo-Mode header for non-demo organization', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: 'org-live-1' };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return `true${'x'.repeat(80)}`;
        return null;
      },
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('demoWriteProtection forwards error when response json writer throws', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });

    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    } as unknown as Response;
    const statusSpy = vi.spyOn(res as any, 'status');
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(statusSpy).toHaveBeenCalledWith(403);
  });

  it('demoWriteProtection forwards error when response header write fails before status/json', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });

    const res = {
      setHeader: vi.fn(() => {
        throw new Error('setHeader failed');
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((res as any).status).not.toHaveBeenCalled();
    expect((res as any).json).not.toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('demoWriteProtection blocks writes when org id matches DEMO_ORG_ID after trimming', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: `  ${DEMO_ORG_ID}  ` };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect((res as any).setHeader).toHaveBeenCalledWith('Expires', '0');
    expect((res as any).setHeader).toHaveBeenCalledWith('CDN-Cache-Control', 'no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection treats malformed session org header as non-interactive demo', () => {
    const middleware = demoWriteProtection();
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: (header: string) => {
        if (header === 'X-Demo-Mode') return 'true';
        if (header === 'X-Demo-Session-Org') return 'a'.repeat(300);
        return null;
      },
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection blocks writes when organizationId accessor throws but user.organizationId is demo', () => {
    const middleware = demoWriteProtection();
    const req: any = { user: { organizationId: DEMO_ORG_ID } };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => {
        throw new Error('get failed');
      },
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection blocks writes when only req.demo.organizationId is demo', () => {
    const middleware = demoWriteProtection();
    const req: any = { demo: { enabled: true, organizationId: DEMO_ORG_ID } };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/api/protected',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection falls back to req.url when originalUrl is whitespace-only', () => {
    const middleware = demoWriteProtection({ allowedRoutes: ['/api/allowed'] });
    const req: any = { organizationId: DEMO_ORG_ID, url: '/api/allowed/health' };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '   ',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('demoWriteProtection allowlist matches path even when query string is present', () => {
    const middleware = demoWriteProtection({ allowedRoutes: ['/api/allowed'] });
    const req: any = { organizationId: DEMO_ORG_ID, originalUrl: '/api/allowed/health?trace=1' };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('demoWriteProtection does not allow allowlist bypass for oversized URL payloads', () => {
    const middleware = demoWriteProtection({ allowedRoutes: ['/api/allowed'] });
    const req: any = { organizationId: DEMO_ORG_ID };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => `/api/allowed/health?${'x'.repeat(10_000)}`,
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('demoWriteProtection does not allow all writes when allowedRoutes contains empty prefix', () => {
    const middleware = demoWriteProtection({ allowedRoutes: [''] });
    const req: any = { organizationId: DEMO_ORG_ID, originalUrl: '/api/protected' };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => 'POST',
    });
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => null,
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
