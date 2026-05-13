import { describe, expect, it, vi } from 'vitest';

import {
  __private__,
  getRequestMetrics,
  incrementAiTimeouts,
  incrementRateLimitHits,
  metricsMiddleware,
  getPrometheusMetrics,
} from '../../../../server/src/middleware/metrics.middleware.ts';

describe('metrics.middleware', () => {
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
});
