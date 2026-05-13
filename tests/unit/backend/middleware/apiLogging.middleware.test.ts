import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runMock, loggerWarnMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: runMock,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: loggerWarnMock,
  },
}));

import { apiLoggingMiddleware } from '../../../../server/src/middleware/apiLogging.middleware.ts';

type MutableResponse = Response & {
  end: (...args: unknown[]) => unknown;
  statusCode: number;
  statusMessage: string;
};

describe('apiLogging.middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    runMock.mockReset();
    loggerWarnMock.mockReset();
    runMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses CURRENT_TIMESTAMP in api_logs insert SQL', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;

    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;

    apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    res.end();

    expect(runMock).toHaveBeenCalledTimes(1);
    const sql = String(runMock.mock.calls[0]?.[0] || '');
    expect(sql).toContain('CURRENT_TIMESTAMP');
    expect(sql).not.toContain("datetime('now')");
  });

  it('does not crash when req.get/path accessors throw', () => {
    process.env.NODE_ENV = 'development';
    const req: any = { method: 'POST', user: { id: 'user-1', organizationId: 'org-1' } };
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => {
        throw new Error('header getter failed');
      },
    });
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    expect(() => apiLoggingMiddleware(req as Request, res, next as unknown as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);

    res.end();
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('does not crash when res.setHeader throws', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(() => {
        throw new Error('setHeader failed');
      }),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    expect(() => apiLoggingMiddleware(req, res, next as unknown as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not try to set correlation header when headers were already sent', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      headersSent: true,
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
  });

  it('keeps response flow when authReq.user accessor throws inside end wrapper', () => {
    process.env.NODE_ENV = 'development';
    const req: any = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
    };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });

    const originalEnd = vi.fn();
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req as Request, res, next as unknown as NextFunction);
    expect(() => res.end()).not.toThrow();
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps response flow when res.statusCode accessor throws inside end wrapper', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;

    const originalEnd = vi.fn();
    const resObj: any = {
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    };
    Object.defineProperty(resObj, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('statusCode getter failed');
      },
    });
    const res = resObj as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    expect(() => res.end()).not.toThrow();
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('persists top-level req.organizationId when req.user accessor throws', () => {
    process.env.NODE_ENV = 'development';
    const req: any = {
      method: 'POST',
      path: '/api/example',
      organizationId: 'org-top-level',
      get: vi.fn().mockReturnValue(undefined),
    };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });

    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;

    apiLoggingMiddleware(req as Request, res, vi.fn() as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[6]).toBe('org-top-level');
  });

  it('does not double-persist logs when middleware is mounted twice on same response', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    expect(next).toHaveBeenCalledTimes(2);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('keeps response unpatched when patched marker cannot be defined', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const originalEnd = vi.fn();
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;
    const next = vi.fn();

    const defineSpy = vi
      .spyOn(Object, 'defineProperty')
      .mockImplementation(((target: object, prop: PropertyKey, attributes: PropertyDescriptor) => {
        if (typeof prop === 'symbol' && prop === Symbol.for('consultify.apiLogging.endPatched')) {
          throw new Error('defineProperty blocked');
        }
        return Reflect.defineProperty(target, prop, attributes)
          ? target
          : (() => {
              throw new Error('defineProperty failed');
            })();
      }) as typeof Object.defineProperty);

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    expect(next).toHaveBeenCalledTimes(1);
    expect(runMock).not.toHaveBeenCalled();
    expect(originalEnd).toHaveBeenCalledTimes(1);

    defineSpy.mockRestore();
  });

  it('does not patch response end when res.end is not callable', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res: any = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: 'not-a-function',
    };
    const next = vi.fn();

    expect(() => apiLoggingMiddleware(req, res as MutableResponse, next as unknown as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(runMock).not.toHaveBeenCalled();
    expect(res.end).toBe('not-a-function');
  });

  it('coerces non-finite status code to 200 before persisting api log row', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const resObj: any = {
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    Object.defineProperty(resObj, 'statusCode', {
      configurable: true,
      get: () => Number.NaN,
    });
    const res = resObj as MutableResponse;

    apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[3]).toBe(200);
    expect(insertParams[8]).toBeNull();
  });

  it('clamps response_time_ms to non-negative when clock goes backwards', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(900);

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[4]).toBe(0);

    nowSpy.mockRestore();
  });

  it('caps response_time_ms to max safety bound when clock jumps forward massively', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(1000 + 86_400_000 + 12345);

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[4]).toBe(86_400_000);

    nowSpy.mockRestore();
  });

  it('strips query and fragment from originalUrl fallback before persisting endpoint', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      originalUrl: '/api/example/path?token=secret#section',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[1]).toBe('/api/example/path');
  });

  it('strips control characters from persisted endpoint', () => {
    process.env.NODE_ENV = 'development';
    const rawPath = `/api/example\r\n\t${String.fromCharCode(0)}suffix`;
    const req = {
      method: 'POST',
      path: rawPath,
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;

    apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[1]).toBe('/api/examplesuffix');
  });

  it('strips control characters from persisted status message on error responses', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 400,
      statusMessage: `Bad\r\nRequest${String.fromCharCode(0)}!`,
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;

    apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[3]).toBe(400);
    expect(insertParams[8]).toBe('BadRequest!');
  });

  it('caps correlation id length from request header before setting response header and persist', () => {
    process.env.NODE_ENV = 'development';
    const oversizedCorrelationId = 'x'.repeat(300);
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn((header: string) => (header === 'X-Correlation-ID' ? oversizedCorrelationId : undefined)),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const expectedCorrelationId = oversizedCorrelationId.slice(0, 128);
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expectedCorrelationId);
    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[7]).toBe(expectedCorrelationId);
  });

  it('sanitizes control characters in correlation id header before setting response header and persist', () => {
    process.env.NODE_ENV = 'development';
    const rawCorrelationId = `ab\r\ncd${String.fromCharCode(0)}ef`;
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn((header: string) => (header === 'X-Correlation-ID' ? rawCorrelationId : undefined)),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'abcdef');
    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[7]).toBe('abcdef');
  });

  it('regenerates correlation id when sanitized header becomes empty', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn((header: string) =>
        header === 'X-Correlation-ID' ? `${String.fromCharCode(0)}${String.fromCharCode(1)}` : undefined
      ),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const setCorrelationCall = (res.setHeader as any).mock.calls.find(
      (call: unknown[]) => call[0] === 'X-Correlation-ID'
    );
    expect(setCorrelationCall?.[1]).toBeTypeOf('string');
    expect(setCorrelationCall?.[1]).not.toBe('');
    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(insertParams[7]).toBe(setCorrelationCall?.[1]);
  });

  it('falls back to deterministic correlation id when uuid generation throws', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    vi.doMock('uuid', () => ({
      v4: () => {
        throw new Error('uuid failed');
      },
    }));
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();
    const { apiLoggingMiddleware: isolatedApiLoggingMiddleware } = await import(
      '../../../../server/src/middleware/apiLogging.middleware.ts'
    );

    expect(() =>
      isolatedApiLoggingMiddleware(req, res, next as unknown as NextFunction)
    ).not.toThrow();
    res.end();

    const fallbackId = '00000000-0000-4000-8000-000000000000';
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', fallbackId);
    expect((req as any).correlationId).toBe(fallbackId);
  });

  it('persists at most once when response end is invoked multiple times', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const originalEnd = vi.fn();
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;

    apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    res.end();
    res.end();

    expect(originalEnd).toHaveBeenCalledTimes(2);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('still persists when first uuidv4 row id generation throws during initial end call', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    vi.doMock('uuid', () => {
      const uuidMock = vi
        .fn()
        .mockReturnValueOnce('corr-id')
        .mockImplementationOnce(() => {
          throw new Error('row id failed');
        })
        .mockReturnValueOnce('row-id-second-end');
      return { v4: uuidMock };
    });
    const { apiLoggingMiddleware: isolatedApiLoggingMiddleware } = await import(
      '../../../../server/src/middleware/apiLogging.middleware.ts'
    );

    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const originalEnd = vi.fn();
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;

    isolatedApiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
    expect(() => res.end()).not.toThrow();
    expect(() => res.end()).not.toThrow();

    expect(originalEnd).toHaveBeenCalledTimes(2);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('calls original end with bound response even when patched end is invoked detached', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const thisValues: unknown[] = [];
    const originalEnd = vi.fn(function (this: unknown) {
      thisValues.push(this);
      return this;
    });
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    const detachedEnd = res.end as (...args: unknown[]) => unknown;

    expect(() => detachedEnd()).not.toThrow();
    expect(originalEnd).toHaveBeenCalledTimes(1);
    expect(thisValues[0]).toBe(res);
  });

  it('still calls original end with response context when Function.prototype.bind throws', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const bindSpy = vi.spyOn(Function.prototype, 'bind').mockImplementation(function () {
      throw new Error('bind blocked');
    });
    const req = {
      method: 'POST',
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: { id: 'user-1', organizationId: 'org-1' },
    } as unknown as Request;
    const thisValues: unknown[] = [];
    const originalEnd = vi.fn(function (this: unknown) {
      thisValues.push(this);
      return this;
    });
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: originalEnd,
    } as unknown as MutableResponse;
    const next = vi.fn();
    const { apiLoggingMiddleware: isolatedApiLoggingMiddleware } = await import(
      '../../../../server/src/middleware/apiLogging.middleware.ts'
    );

    expect(() =>
      isolatedApiLoggingMiddleware(req, res, next as unknown as NextFunction)
    ).not.toThrow();
    const detachedEnd = res.end as (...args: unknown[]) => unknown;
    expect(() => detachedEnd()).not.toThrow();

    expect(originalEnd).toHaveBeenCalledTimes(1);
    expect(thisValues[0]).toBe(res);
    bindSpy.mockRestore();
  });

  it('caps logged method, user id, and organization id lengths before insert', () => {
    process.env.NODE_ENV = 'development';
    const req = {
      method: 'x'.repeat(80),
      path: '/api/example',
      get: vi.fn().mockReturnValue(undefined),
      user: {
        id: 'u'.repeat(200),
        organizationId: 'o'.repeat(200),
      },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      getHeader: vi.fn().mockReturnValue(undefined),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as MutableResponse;
    const next = vi.fn();

    apiLoggingMiddleware(req, res, next as unknown as NextFunction);
    res.end();

    const insertParams = runMock.mock.calls[0]?.[1] as unknown[];
    expect(String(insertParams[2]).length).toBeLessThanOrEqual(32);
    expect(String(insertParams[5]).length).toBeLessThanOrEqual(128);
    expect(String(insertParams[6]).length).toBeLessThanOrEqual(128);
  });
});
