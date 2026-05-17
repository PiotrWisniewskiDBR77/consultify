import { describe, expect, it, vi } from 'vitest';

import {
  errorHandler,
  notFoundHandler,
  validationErrorHandler,
} from '../../../../server/src/middleware/errorHandler.ts';
import { AppError, ValidationError } from '../../../../server/src/types/index.ts';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
}

describe('errorHandler middleware (L1)', () => {
  it('handles AppError with status + code + details', () => {
    const err = new AppError(418, 'teapot', 'IM_A_TEAPOT', { a: 1 });
    const req: any = { method: 'GET', path: '/x', correlationId: 'c1' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(418);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'teapot',
        code: 'IM_A_TEAPOT',
        details: { a: 1 },
      })
    );
  });

  it('maps validation-ish errors to 400', () => {
    const err: any = new Error('some validation failed');
    err.name = 'Whatever';
    const req: any = { method: 'POST', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
      })
    );
  });

  it('maps JsonWebTokenError to 401 INVALID_TOKEN', () => {
    const err: any = new Error('bad jwt');
    err.name = 'JsonWebTokenError';
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      })
    );
  });

  it('maps TokenExpiredError to 401 TOKEN_EXPIRED', () => {
    const err: any = new Error('expired');
    err.name = 'TokenExpiredError';
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      })
    );
  });

  it('maps connection errors to 503 SERVICE_UNAVAILABLE', () => {
    const err: any = new Error('ECONNREFUSED something');
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      })
    );
  });

  it('defaults to 500 for unknown errors', () => {
    const err: any = new Error('boom');
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
      })
    );
  });

  it('sanitizes invalid statusCode from custom errors to 500', () => {
    const err: any = new Error('bad status');
    err.statusCode = 999;
    err.code = 'BAD_STATUS';
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    errorHandler(err, req, res as any, (() => {}) as any);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'BAD_STATUS',
      })
    );
  });

  it('does not attempt to write when headers are already sent', () => {
    const err: any = new Error('late');
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();
    res.headersSent = true;
    const statusSpy = vi.fn(res.status);
    const jsonSpy = vi.fn(res.json);
    res.status = statusSpy;
    res.json = jsonSpy;

    expect(() => errorHandler(err, req, res as any, (() => {}) as any)).not.toThrow();
    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('does not attempt to write when response is already writableEnded', () => {
    const err: any = new Error('late');
    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();
    res.writableEnded = true;
    const statusSpy = vi.fn(res.status);
    const jsonSpy = vi.fn(res.json);
    res.status = statusSpy;
    res.json = jsonSpy;

    expect(() => errorHandler(err, req, res as any, (() => {}) as any)).not.toThrow();
    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('classifies safely when error name/message accessors throw', () => {
    const err: any = new Error('boom');
    Object.defineProperty(err, 'name', {
      configurable: true,
      get: () => {
        throw new Error('name getter failed');
      },
    });
    Object.defineProperty(err, 'message', {
      configurable: true,
      get: () => {
        throw new Error('message getter failed');
      },
    });

    const req: any = { method: 'GET', path: '/x' };
    const res = makeRes();

    expect(() => errorHandler(err, req, res as any, (() => {}) as any)).not.toThrow();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      })
    );
  });

  it('includes stack when not in production', () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const err: any = new Error('boom');
      err.stack = 'stack-trace';
      const req: any = { method: 'GET', path: '/x' };
      const res = makeRes();

      errorHandler(err, req, res as any, (() => {}) as any);
      expect(res.body.stack).toBe('stack-trace');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('notFoundHandler (L1)', () => {
  it('returns 404 with ROUTE_NOT_FOUND', () => {
    const req: any = { method: 'GET', path: '/missing' };
    const res = makeRes();
    notFoundHandler(req, res as any);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'ROUTE_NOT_FOUND',
      })
    );
  });

  it('handles throwing request method/path accessors', () => {
    const req: any = {};
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method getter failed');
      },
    });
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => '/fallback-url',
    });
    const res = makeRes();

    expect(() => notFoundHandler(req, res as any)).not.toThrow();
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('UNKNOWN');
    expect(res.body.error).toContain('/fallback-url');
  });

  it('does not attempt 404 write when headers are already sent', () => {
    const req: any = { method: 'GET', path: '/missing' };
    const res = makeRes();
    res.headersSent = true;
    const statusSpy = vi.fn(res.status);
    const jsonSpy = vi.fn(res.json);
    res.status = statusSpy;
    res.json = jsonSpy;

    expect(() => notFoundHandler(req, res as any)).not.toThrow();
    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('does not attempt 404 write when response is writableEnded', () => {
    const req: any = { method: 'GET', path: '/missing' };
    const res = makeRes();
    res.writableEnded = true;
    const statusSpy = vi.fn(res.status);
    const jsonSpy = vi.fn(res.json);
    res.status = statusSpy;
    res.json = jsonSpy;

    expect(() => notFoundHandler(req, res as any)).not.toThrow();
    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('does not throw when notFoundHandler response json writer throws', () => {
    const req: any = { method: 'GET', path: '/missing' };
    const res = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });

    expect(() => notFoundHandler(req, res as any)).not.toThrow();
    expect(res.statusCode).toBe(404);
  });
});

describe('validationErrorHandler (L1)', () => {
  it('throws ValidationError with reduced details map', () => {
    expect(() =>
      validationErrorHandler([
        { path: 'a', message: 'bad' },
        { path: 'b.c', message: 'worse' },
      ])
    ).toThrow(ValidationError);

    try {
      validationErrorHandler([{ path: 'a', message: 'bad' }]);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(400);
      expect(e.details).toEqual({ errors: { a: 'bad' } });
    }
  });
});

