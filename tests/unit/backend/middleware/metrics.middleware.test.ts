import { describe, expect, it, vi } from 'vitest';

import {
  __private__,
  getRequestMetrics,
  incrementAiTimeouts,
  incrementRateLimitHits,
  metricsMiddleware,
  getPrometheusMetrics,
} from '../../../../server/src/middleware/metrics.middleware.ts';
import { operationalAlerts } from '../../../../server/src/services/operationalAlertService.ts';

describe('metrics.middleware', () => {
  it('feeds completed authentication denials into the operational alert threshold', () => {
    operationalAlerts.resetForTests();

    for (let index = 0; index < 5; index += 1) {
      const req: any = {
        method: 'GET',
        headers: { 'x-request-id': `auth-denial-${index}` },
      };
      const res: any = { statusCode: index % 2 === 0 ? 401 : 403, end: vi.fn() };
      metricsMiddleware(req, res, vi.fn());
      res.end();
    }

    const alert = operationalAlerts
      .evaluate()
      .find((candidate) => candidate.kind === 'REPEATED_AUTH_DENIALS');
    expect(alert).toMatchObject({ active: true, value: 5, threshold: 5 });
    expect(alert?.correlationId).toBe('auth-denial-4');
  });

  it('addBoundedMetric caps counters at Number.MAX_SAFE_INTEGER', () => {
    const capped = __private__.addBoundedMetric(Number.MAX_SAFE_INTEGER - 1, 2);
    const staysCapped = __private__.addBoundedMetric(Number.MAX_SAFE_INTEGER, 1);
    const ignoresInvalid = __private__.addBoundedMetric(100, Number.NaN);

    expect(capped).toBe(Number.MAX_SAFE_INTEGER);
    expect(staysCapped).toBe(Number.MAX_SAFE_INTEGER);
    expect(ignoresInvalid).toBe(100);
  });

  it('tracks request even when method accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method getter failed');
      },
    });
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
    };
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.end();
    const snapshot = getRequestMetrics();
    expect(snapshot.requests).toBeGreaterThan(0);
    expect(snapshot.byMethod.UNKNOWN).toBeGreaterThan(0);
  });

  it('maps invalid method characters to OTHER metric bucket', () => {
    const req: any = { method: 'GET*' };
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
    };
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    res.end();

    const snapshot = getRequestMetrics();
    expect(snapshot.byMethod.OTHER).toBeGreaterThan(0);
  });

  it('continues response flow when statusCode accessor throws in wrapped end', () => {
    const req: any = { method: 'GET' };
    const res: any = {
      end: vi.fn(),
    };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('statusCode getter failed');
      },
    });
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    expect(() => res.end()).not.toThrow();
  });

  it('increments counters for rate limit and ai timeouts', () => {
    const before = getRequestMetrics();
    incrementRateLimitHits();
    incrementAiTimeouts();
    const after = getRequestMetrics();

    expect(after.rateLimitHits).toBe(before.rateLimitHits + 1);
    expect(after.aiTimeouts).toBe(before.aiTimeouts + 1);
  });

  it('records zero added latency when Date.now goes backward', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    const before = getRequestMetrics();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(5000).mockReturnValueOnce(1000);

    try {
      metricsMiddleware(req, res, next);
      res.end();
    } finally {
      nowSpy.mockRestore();
    }

    const after = getRequestMetrics();
    expect(after.requests).toBe(before.requests + 1);
    expect(after.latencySum).toBe(before.latencySum);
  });

  it('caps recorded duration when Date.now jump is excessively large', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    const before = getRequestMetrics();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1_000_000_000);

    try {
      metricsMiddleware(req, res, next);
      res.end();
    } finally {
      nowSpy.mockRestore();
    }

    const after = getRequestMetrics();
    expect(after.requests).toBe(before.requests + 1);
    expect(after.latencySum - before.latencySum).toBe(600_000);
  });

  it('keeps latencySum finite when duration is non-finite', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(5000).mockReturnValueOnce(Number.NaN);

    try {
      metricsMiddleware(req, res, next);
      res.end();
    } finally {
      nowSpy.mockRestore();
    }

    const after = getRequestMetrics();
    expect(Number.isFinite(after.latencySum)).toBe(true);
  });

  it('returns detached nested metric snapshots', () => {
    const snapshot = getRequestMetrics();
    snapshot.byStatus[418] = 12345;
    snapshot.byMethod.GET = 999999999;
    snapshot.latencyBuckets.le_50 = -1;

    const after = getRequestMetrics();
    expect(after.byStatus[418]).not.toBe(12345);
    expect(after.byMethod.GET).not.toBe(999999999);
    expect(after.latencyBuckets.le_50).not.toBe(-1);
  });

  it('uses null-prototype maps for byMethod and byStatus snapshots', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    res.end();

    const snapshot = getRequestMetrics();
    expect(Object.getPrototypeOf(snapshot.byMethod)).toBeNull();
    expect(Object.getPrototypeOf(snapshot.byStatus)).toBeNull();
    expect('toString' in snapshot.byMethod).toBe(false);
    expect('toString' in snapshot.byStatus).toBe(false);
  });

  it('tracks only once when middleware is mounted twice on same response', () => {
    const req: any = { method: 'POST' };
    const res: any = { statusCode: 201, end: vi.fn() };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    metricsMiddleware(req, res, next);
    res.end();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(2);
    expect(after.requests).toBe(before.requests + 1);
    expect((after.byStatus[201] || 0) - (before.byStatus[201] || 0)).toBe(1);
  });

  it('records completion metrics once even when res.end is invoked twice', () => {
    const req: any = { method: 'POST' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    res.end();
    res.end();

    const after = getRequestMetrics();
    expect(after.requests).toBe(before.requests + 1);
    expect((after.byStatus[200] || 0) - (before.byStatus[200] || 0)).toBe(1);
  });

  it('does not increment request counters when response end cannot be patched', () => {
    const req: any = { method: 'GET' };
    const res: any = {};
    Object.defineProperty(res, 'end', {
      configurable: true,
      writable: false,
      value: function end() {},
    });
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      writable: true,
      value: 200,
    });
    const next = vi.fn();
    const before = getRequestMetrics();

    expect(() => metricsMiddleware(req, res, next)).not.toThrow();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(after.requests).toBe(before.requests);
  });

  it('restores res.end and skips accounting when listener registration throws', () => {
    const req: any = { method: 'GET' };
    const originalEnd = vi.fn(function thisAwareEnd() {
      return undefined;
    });
    const res: any = {
      statusCode: 200,
      end: originalEnd,
      once: vi.fn(() => {
        throw new Error('once failed');
      }),
    };
    const next = vi.fn();
    const before = getRequestMetrics();

    expect(() => metricsMiddleware(req, res, next)).not.toThrow();
    res.end();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(typeof res.end).toBe('function');
    expect(originalEnd).toHaveBeenCalledTimes(1);
    expect(after.requests).toBe(before.requests);
  });

  it('restores patched response state when downstream next throws', () => {
    const req: any = { method: 'POST' };
    const originalEnd = vi.fn(function thisAwareEnd() {
      return undefined;
    });
    const res: any = {
      statusCode: 200,
      end: originalEnd,
      once: vi.fn(),
      removeListener: vi.fn(),
    };
    const before = getRequestMetrics();
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    expect(() => metricsMiddleware(req, res, next)).toThrow('next failed');
    expect(next).toHaveBeenCalledTimes(1);
    expect(typeof res.end).toBe('function');
    res.end();
    expect(originalEnd).toHaveBeenCalledTimes(1);

    const after = getRequestMetrics();
    expect(after.requests).toBe(before.requests);
    expect(after.byMethod.POST || 0).toBe(before.byMethod.POST || 0);
  });

  it('normalizes invalid statusCode values to 500', () => {
    const req: any = { method: 'GET' };
    const res: any = { end: vi.fn() };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => Number.NaN,
    });
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    res.end();

    const after = getRequestMetrics();
    expect((after.byStatus[500] || 0) - (before.byStatus[500] || 0)).toBe(1);
  });

  it('exports prometheus counters as finite numeric values', () => {
    const output = getPrometheusMetrics();
    expect(output).toContain('http_requests_total ');
    expect(output).toContain('http_errors_total ');
    expect(output).toContain('http_request_duration_ms_sum ');
    expect(output).toContain('http_requests_by_method_total');
    expect(output).toContain('# TYPE http_requests_by_status counter');
    expect(output).toContain('# HELP http_requests_by_status');
    expect(output).not.toContain('NaN');
    expect(output).not.toContain('Infinity');
  });

  it('exports by-method prometheus series for normalized methods', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();

    metricsMiddleware(req, res, next);
    res.end();

    const output = getPrometheusMetrics();
    expect(output).toContain('http_requests_by_method_total{method="GET"}');
  });

  it('exports histogram bucket counters as integer values', () => {
    const output = getPrometheusMetrics();
    const bucketLines = output
      .split('\n')
      .filter((line) => line.startsWith('http_request_duration_ms_bucket{le='));
    expect(bucketLines.length).toBeGreaterThan(0);
    for (const line of bucketLines) {
      const value = line.trim().split(/\s+/).pop();
      expect(value).toMatch(/^\d+$/);
    }
  });

  it('exports histogram bucket boundaries in non-decreasing order', () => {
    const output = getPrometheusMetrics();
    const finiteBoundaries = output
      .split('\n')
      .filter((line) => line.startsWith('http_request_duration_ms_bucket{le="'))
      .map((line) => line.match(/le="([^"]+)"/)?.[1] ?? '')
      .filter((value) => value !== '+Inf')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    for (let i = 1; i < finiteBoundaries.length; i += 1) {
      expect(finiteBoundaries[i]).toBeGreaterThanOrEqual(finiteBoundaries[i - 1]);
    }
  });

  it('returns a safe fallback when prometheus export throws unexpectedly', () => {
    const entriesSpy = vi.spyOn(Object, 'entries').mockImplementationOnce(() => {
      throw new Error('entries failed');
    });
    try {
      const output = getPrometheusMetrics();
      expect(output).toBe('# consultify metrics export failed\n');
    } finally {
      entriesSpy.mockRestore();
    }
  });

  it('escapes carriage return and tab in prometheus label values', () => {
    const escaped = __private__.escapePrometheusLabelValue('A\rB\tC"\\D\nE');
    expect(escaped).toBe('A\\rB\\tC\\"\\\\D\\nE');
  });

  it('records completion metrics from close event when end is not called', () => {
    const closeHandlers: Array<() => void> = [];
    const req: any = { method: 'GET' };
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') closeHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    closeHandlers[0]?.();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(after.requests).toBe(before.requests + 1);
    expect((after.byStatus[200] || 0) - (before.byStatus[200] || 0)).toBe(1);
  });

  it('records final statusCode set during original end execution', () => {
    const req: any = { method: 'GET' };
    const innerEnd = vi.fn();
    const res: any = {
      statusCode: 200,
      end: function (...args: any[]) {
        this.statusCode = 404;
        return innerEnd(...args);
      },
      once: vi.fn(),
    };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    res.end();

    const after = getRequestMetrics();
    expect((after.byStatus[404] || 0) - (before.byStatus[404] || 0)).toBe(1);
    expect((after.byStatus[200] || 0) - (before.byStatus[200] || 0)).toBe(0);
  });

  it('records completion metrics from finish event when end is not called', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = { method: 'GET' };
    const res: any = {
      statusCode: 204,
      end: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(after.requests).toBe(before.requests + 1);
    expect((after.byStatus[204] || 0) - (before.byStatus[204] || 0)).toBe(1);
  });

  it('detaches finish/close listeners after first completion when using on listeners', () => {
    const finishHandlers: Array<() => void> = [];
    const closeHandlers: Array<() => void> = [];
    const req: any = { method: 'GET' };
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
        if (event === 'close') closeHandlers.push(cb);
      }),
      removeListener: vi.fn(),
    };
    const next = vi.fn();
    const before = getRequestMetrics();

    metricsMiddleware(req, res, next);
    finishHandlers[0]?.();
    finishHandlers[0]?.();
    closeHandlers[0]?.();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect((after.byStatus[200] || 0) - (before.byStatus[200] || 0)).toBe(1);
    expect(res.removeListener).toHaveBeenCalledWith('finish', finishHandlers[0]);
    expect(res.removeListener).toHaveBeenCalledWith('close', closeHandlers[0]);
  });

  it('attempts to detach both listeners even if finish detach throws', () => {
    const finishHandlers: Array<() => void> = [];
    const closeHandlers: Array<() => void> = [];
    const req: any = { method: 'GET' };
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
        if (event === 'close') closeHandlers.push(cb);
      }),
      removeListener: vi.fn((event: string) => {
        if (event === 'finish') throw new Error('detach finish failed');
      }),
    };
    const next = vi.fn();

    metricsMiddleware(req, res, next);

    expect(() => finishHandlers[0]?.()).not.toThrow();
    expect(res.removeListener).toHaveBeenCalledWith('finish', finishHandlers[0]);
    expect(res.removeListener).toHaveBeenCalledWith('close', closeHandlers[0]);
  });

  it('caps distinct method labels by routing excess labels to OTHER bucket', () => {
    const before = getRequestMetrics();
    for (let i = 0; i < 70; i += 1) {
      const req: any = { method: `M${String(i).padStart(3, '0')}` };
      const res: any = { statusCode: 200, end: vi.fn() };
      const next = vi.fn();
      metricsMiddleware(req, res, next);
      res.end();
    }

    const after = getRequestMetrics();
    expect(Object.keys(after.byMethod).length).toBeLessThanOrEqual(64);
    expect(after.byMethod.OTHER || 0).toBeGreaterThanOrEqual(before.byMethod.OTHER || 0);
  });
});
