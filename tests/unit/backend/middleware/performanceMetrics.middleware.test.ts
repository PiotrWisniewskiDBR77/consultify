import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';
import { getMetricsService } from '../../../../server/src/services/metricsService.js';

const {
  recordDbQueryMock,
  recordHttpRequestMock,
  recordErrorMock,
  loggerWarnMock,
  getMetricsServiceMock,
} = vi.hoisted(() => ({
  recordDbQueryMock: vi.fn(),
  recordHttpRequestMock: vi.fn(),
  recordErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  getMetricsServiceMock: vi.fn(),
}));

getMetricsServiceMock.mockImplementation(() => ({
  recordDbQuery: recordDbQueryMock,
  recordHttpRequest: recordHttpRequestMock,
  recordError: recordErrorMock,
}));

vi.mock('../../../../server/src/services/metricsService.js', () => ({
  getMetricsService: getMetricsServiceMock,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: loggerWarnMock,
  },
}));

import {
  clearMetrics,
  metricsStore,
  performanceMetricsMiddleware,
  resolveSlowRequestThresholdMs,
} from '../../../../server/src/middleware/performanceMetrics.middleware.ts';

describe('performanceMetrics.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetrics();
  });

  it('does not crash when request accessors throw in finish handler', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = { user: { id: 'u-1', organizationId: 'org-1' }, _performanceMetrics: undefined };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method failed');
      },
    });
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path failed');
      },
    });
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => {
        throw new Error('originalUrl failed');
      },
    });

    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    } as unknown as Response;
    const next = vi.fn();

    expect(() =>
      performanceMetricsMiddleware(req as Request, res, next as unknown as NextFunction)
    ).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);

    expect(() => finishHandlers.forEach((fn) => fn())).not.toThrow();
    expect(metricsStore.requests.length).toBe(1);
  });

  it('logs warning and continues when response accessor throws in finish handler', () => {
    const finishHandlers: Array<() => void> = [];
    recordHttpRequestMock.mockImplementationOnce(() => {
      throw new Error('metrics service failed');
    });
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    } as unknown as Response;

    performanceMetricsMiddleware(req as any, res, vi.fn() as unknown as NextFunction);
    expect(() => finishHandlers.forEach((fn) => fn())).not.toThrow();

    expect(metricsStore.requests.length).toBe(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Performance middleware recordHttpRequest failed',
      expect.any(Error)
    );
  });

  it('continues pipeline when enablePerformanceTracking throws during registration', () => {
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      on: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();
    const enableSpy = vi.spyOn(queryHelpers, 'enablePerformanceTracking').mockImplementation(() => {
      throw new Error('enable failed');
    });

    expect(() =>
      performanceMetricsMiddleware(req as any, res, next as unknown as NextFunction)
    ).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Performance middleware enablePerformanceTracking failed',
      expect.any(Error)
    );

    enableSpy.mockRestore();
  });

  it('continues request pipeline when getMetricsService throws', () => {
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      on: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();
    const getMetricsServiceSpy = vi.mocked(getMetricsService);
    getMetricsServiceSpy.mockImplementationOnce(() => {
      throw new Error('metrics service init failed');
    });

    expect(() =>
      performanceMetricsMiddleware(req as any, res, next as unknown as NextFunction)
    ).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Performance middleware getMetricsService failed',
      expect.any(Error)
    );
  });

  it('stores metric and logs when recordError fails for error status', () => {
    const finishHandlers: Array<() => void> = [];
    recordErrorMock.mockImplementation(() => {
      throw new Error('recordError failed');
    });
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 404,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    } as unknown as Response;

    performanceMetricsMiddleware(req as any, res, vi.fn() as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.statusCode).toBe(404);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Performance middleware recordError failed',
      expect.any(Error)
    );
  });

  it('calls next when res.on throws while attaching finish listener', () => {
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
      on: vi.fn(() => {
        throw new Error('on failed');
      }),
    } as unknown as Response;
    const next = vi.fn();

    expect(() =>
      performanceMetricsMiddleware(req as any, res, next as unknown as NextFunction)
    ).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(metricsStore.requests.length).toBe(0);
  });

  it('releases tracking when response does not support finish listener registration', () => {
    const req = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = {
      statusCode: 200,
    } as unknown as Response;
    const next = vi.fn();
    const disableSpy = vi.spyOn(queryHelpers, 'disablePerformanceTracking');

    performanceMetricsMiddleware(req as any, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(disableSpy).toHaveBeenCalledTimes(1);
  });

  it('uses fallback metrics when _performanceMetrics accessor throws', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    Object.defineProperty(req, '_performanceMetrics', {
      configurable: true,
      get: () => {
        throw new Error('_performanceMetrics getter failed');
      },
      set: vi.fn(),
    });

    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    } as unknown as Response;

    performanceMetricsMiddleware(req as Request, res, vi.fn() as unknown as NextFunction);
    expect(() => finishHandlers.forEach((fn) => fn())).not.toThrow();
    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.dbQueryCount).toBe(0);
    expect(metricsStore.requests[0]?.dbQueryTime).toBe(0);
  });

  it('keeps DB timing aggregates sane when tracker callback gets invalid durations', () => {
    const finishHandlers: Array<() => void> = [];
    const onceHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') onceHandlers.push(cb);
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const enableSpy = vi.spyOn(queryHelpers, 'enablePerformanceTracking');
    enableSpy.mockImplementation((cb: (queryType: string, duration: number) => void) => {
      cb('select', Number.NaN);
      cb('select', -1);
      cb('select', 5);
      cb('SELECT '.repeat(40), 10);
      cb({ queryType: 'obj' } as unknown as string, 15);
    });

    performanceMetricsMiddleware(req, res as unknown as Response, vi.fn() as unknown as NextFunction);
    (onceHandlers[0] || finishHandlers[0])?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.dbQueryCount).toBe(3);
    expect(metricsStore.requests[0]?.dbQueryTime).toBe(30);
    expect(recordDbQueryMock).toHaveBeenCalledTimes(3);
    expect(recordDbQueryMock).toHaveBeenCalledWith('select', expect.any(String), 0.005);
    const longQueryLabel = recordDbQueryMock.mock.calls[1]?.[0];
    expect(typeof longQueryLabel).toBe('string');
    expect(longQueryLabel.startsWith('select')).toBe(true);
    expect(longQueryLabel.length).toBeLessThanOrEqual(128);
    expect(recordDbQueryMock.mock.calls[1]?.[2]).toBe(0.01);
    expect(recordDbQueryMock).toHaveBeenCalledWith('unknown', expect.any(String), 0.015);
  });

  it('registers finish handler only once when middleware runs twice on same response', () => {
    const finishHandlers: Array<() => void> = [];
    const onceHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 404,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') onceHandlers.push(cb);
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    performanceMetricsMiddleware(req as Request, res as unknown as Response, next as unknown as NextFunction);
    performanceMetricsMiddleware(req as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.once).toHaveBeenCalledTimes(2);
    expect(onceHandlers).toHaveLength(1);
    expect(res.on).toHaveBeenCalledTimes(0);
    (onceHandlers[0] || finishHandlers[0])?.();
    expect(metricsStore.requests).toHaveLength(1);
  });

  it('records metrics only once when finish callback is invoked twice', () => {
    const onceHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') onceHandlers.push(cb);
      }),
      on: vi.fn(),
    };

    performanceMetricsMiddleware(req, res as unknown as Response, vi.fn() as unknown as NextFunction);
    onceHandlers[0]?.();
    onceHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(recordHttpRequestMock).toHaveBeenCalledTimes(1);
  });

  it('keeps request DB aggregates when recordDbQuery throws in tracking callback', () => {
    const onceHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') onceHandlers.push(cb);
      }),
      on: vi.fn(),
    };
    const enableSpy = vi.spyOn(queryHelpers, 'enablePerformanceTracking');
    recordDbQueryMock.mockImplementation(() => {
      throw new Error('export failed');
    });

    enableSpy.mockImplementation((cb: (queryType: string, duration: number) => void) => {
      cb('select', 10);
      cb('select', 20);
    });

    performanceMetricsMiddleware(req, res as unknown as Response, vi.fn() as unknown as NextFunction);
    onceHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.dbQueryCount).toBe(2);
    expect(metricsStore.requests[0]?.dbQueryTime).toBe(30);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Performance middleware DB tracking callback failed',
      expect.any(Error)
    );
  });

  it('normalizes invalid or extreme slow-threshold environment values', () => {
    expect(resolveSlowRequestThresholdMs(undefined)).toBe(1000);
    expect(resolveSlowRequestThresholdMs('')).toBe(1000);
    expect(resolveSlowRequestThresholdMs('abc')).toBe(1000);
    expect(resolveSlowRequestThresholdMs('-10')).toBe(1000);
    expect(resolveSlowRequestThresholdMs('0')).toBe(1000);
    expect(resolveSlowRequestThresholdMs('2500')).toBe(2500);
    expect(resolveSlowRequestThresholdMs('999999999')).toBe(86_400_000);
  });

  it('sanitizes invalid status code to 500 in stored metric', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: Number.NaN,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    performanceMetricsMiddleware(req, res as unknown as Response, next as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.statusCode).toBe(500);
    expect(recordErrorMock).toHaveBeenCalledWith('server_error', 'http');
  });

  it('stores non-negative response time when clock goes backwards', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(900);

    performanceMetricsMiddleware(req, res as unknown as Response, next as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.responseTime).toBe(0);
    nowSpy.mockRestore();
  });

  it('stores finite memory delta values when memory usage fields are non-finite', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const memorySpy = vi.spyOn(process, 'memoryUsage');
    memorySpy
      .mockReturnValueOnce({
        rss: 10,
        heapTotal: 10,
        heapUsed: 10,
        external: 10,
        arrayBuffers: 10,
      } as unknown as NodeJS.MemoryUsage)
      .mockReturnValueOnce({
        rss: Number.POSITIVE_INFINITY,
        heapTotal: 10,
        heapUsed: Number.NaN,
        external: Number.NaN,
        arrayBuffers: 10,
      } as unknown as NodeJS.MemoryUsage);

    performanceMetricsMiddleware(req, res as unknown as Response, vi.fn() as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.memoryDelta).toEqual({
      heapUsed: 0,
      external: 0,
      rss: 0,
    });
    memorySpy.mockRestore();
  });

  it('releases performance tracking when next throws synchronously', () => {
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn(),
      on: vi.fn(),
    };
    const disableSpy = vi.spyOn(queryHelpers, 'disablePerformanceTracking');
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    expect(() =>
      performanceMetricsMiddleware(req as Request, res as unknown as Response, next as unknown as NextFunction)
    ).toThrow('next failed');
    expect(disableSpy).toHaveBeenCalledTimes(1);
  });

  it('caps oversized originalUrl before storing metric path and route label', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: `/${'a'.repeat(5000)}`,
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn(),
    };
    const next = vi.fn();

    performanceMetricsMiddleware(req as Request, res as unknown as Response, next as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.path.length).toBeLessThanOrEqual(2048);
    expect(recordHttpRequestMock).toHaveBeenCalledWith(
      'GET',
      expect.stringMatching(/^\/a+/),
      200,
      expect.any(Number)
    );
    const routeArg = recordHttpRequestMock.mock.calls[0]?.[1] as string;
    expect(routeArg.length).toBeLessThanOrEqual(2048);
  });

  it('releases tracking on close when finish is never emitted', () => {
    const closeHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') closeHandlers.push(cb);
      }),
      on: vi.fn(),
    };
    const disableSpy = vi.spyOn(queryHelpers, 'disablePerformanceTracking');

    performanceMetricsMiddleware(req as Request, res as unknown as Response, vi.fn() as unknown as NextFunction);
    closeHandlers[0]?.();

    expect(disableSpy).toHaveBeenCalledTimes(1);
  });

  it('caps oversized method before recording exported HTTP metric labels', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: `METHOD-${'x'.repeat(120)}`,
      path: '/api/example',
      originalUrl: '/api/example',
      user: { id: 'u-1', organizationId: 'org-1' },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn(),
    };
    const next = vi.fn();

    performanceMetricsMiddleware(req as Request, res as unknown as Response, next as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    const storedMethod = metricsStore.requests[0]?.method ?? '';
    const exportedMethod = String(recordHttpRequestMock.mock.calls[0]?.[0] ?? '');
    expect(storedMethod.length).toBeLessThanOrEqual(32);
    expect(exportedMethod.length).toBeLessThanOrEqual(32);
    expect(exportedMethod).toBe(storedMethod);
  });

  it('caps oversized user context identifiers before storing metrics', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {
      method: 'GET',
      path: '/api/example',
      originalUrl: '/api/example',
      user: {
        id: 'u'.repeat(5000),
        organizationId: 'o'.repeat(5000),
      },
    };
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn(),
    };

    performanceMetricsMiddleware(req as Request, res as unknown as Response, vi.fn() as unknown as NextFunction);
    finishHandlers[0]?.();

    expect(metricsStore.requests).toHaveLength(1);
    expect(metricsStore.requests[0]?.userId?.length).toBeLessThanOrEqual(256);
    expect(metricsStore.requests[0]?.organizationId?.length).toBeLessThanOrEqual(256);
  });
});
