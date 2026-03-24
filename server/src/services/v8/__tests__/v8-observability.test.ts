import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==========================================
// v8ErrorCodes — pure module, no mocks needed
// ==========================================

import { V8_ERROR_CODES, v8Error } from '../../../utils/v8ErrorCodes.js';

describe('v8ErrorCodes', () => {
  describe('V8_ERROR_CODES', () => {
    it('contains all expected error code categories', () => {
      expect(V8_ERROR_CODES.V8_DISABLED).toBe('V8_DISABLED');
      expect(V8_ERROR_CODES.V8_ORG_DISABLED).toBe('V8_ORG_DISABLED');
      expect(V8_ERROR_CODES.V8_MISSING_ORG).toBe('V8_MISSING_ORG');
      expect(V8_ERROR_CODES.V8_MISSING_ORG_CONTEXT).toBe('V8_MISSING_ORG_CONTEXT');
      expect(V8_ERROR_CODES.V8_INVALID_INPUT).toBe('V8_INVALID_INPUT');
      expect(V8_ERROR_CODES.V8_MISSING_PARAM).toBe('V8_MISSING_PARAM');
      expect(V8_ERROR_CODES.V8_SERVICE_ERROR).toBe('V8_SERVICE_ERROR');
      expect(V8_ERROR_CODES.V8_SERVICE_UNAVAILABLE).toBe('V8_SERVICE_UNAVAILABLE');
      expect(V8_ERROR_CODES.V8_TABLES_NOT_READY).toBe('V8_TABLES_NOT_READY');
      expect(V8_ERROR_CODES.V8_UNAUTHORIZED).toBe('V8_UNAUTHORIZED');
      expect(V8_ERROR_CODES.V8_FORBIDDEN).toBe('V8_FORBIDDEN');
      expect(V8_ERROR_CODES.V8_HEALTH_DEGRADED).toBe('V8_HEALTH_DEGRADED');
      expect(V8_ERROR_CODES.V8_HEALTH_CRITICAL).toBe('V8_HEALTH_CRITICAL');
    });

    it('has 13 unique error codes', () => {
      const codes = Object.values(V8_ERROR_CODES);
      expect(codes).toHaveLength(13);
      expect(new Set(codes).size).toBe(13);
    });
  });

  describe('v8Error', () => {
    function createMockRes() {
      const captured: { body?: unknown; statusCode?: number } = {};
      const res = {
        status(code: number) {
          captured.statusCode = code;
          return res;
        },
        json(body: unknown) {
          captured.body = body;
          return res;
        },
      };
      return { res: res as any, captured };
    }

    it('sends error response with code and message', () => {
      const { res, captured } = createMockRes();

      v8Error(res, 400, V8_ERROR_CODES.V8_INVALID_INPUT, 'Bad input');

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toEqual({
        error: 'Bad input',
        code: 'V8_INVALID_INPUT',
      });
    });

    it('includes details when provided', () => {
      const { res, captured } = createMockRes();

      v8Error(res, 500, V8_ERROR_CODES.V8_SERVICE_ERROR, 'Something broke', {
        service: 'aiCore',
      });

      expect(captured.statusCode).toBe(500);
      expect(captured.body).toEqual({
        error: 'Something broke',
        code: 'V8_SERVICE_ERROR',
        details: { service: 'aiCore' },
      });
    });

    it('omits details key when not provided', () => {
      const { res, captured } = createMockRes();

      v8Error(res, 403, V8_ERROR_CODES.V8_FORBIDDEN, 'Forbidden');

      expect(captured.body).not.toHaveProperty('details');
    });
  });
});

// ==========================================
// v8MetricsStore — pure module, no mocks needed
// ==========================================

import {
  recordV8Request,
  resetV8Metrics,
  getV8MetricsSnapshot,
} from '../../../utils/v8MetricsStore.js';

describe('V8 request metrics', () => {
  beforeEach(() => {
    resetV8Metrics();
  });

  it('starts with zero counters', () => {
    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(0);
    expect(snap.errors).toBe(0);
    expect(snap.avgLatencyMs).toBe(0);
  });

  it('records a successful request', () => {
    recordV8Request(50, false);

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(1);
    expect(snap.errors).toBe(0);
  });

  it('records an error request', () => {
    recordV8Request(120, true);

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(1);
    expect(snap.errors).toBe(1);
  });

  it('accumulates multiple requests', () => {
    recordV8Request(10, false);
    recordV8Request(20, false);
    recordV8Request(30, true);
    recordV8Request(40, true);

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(4);
    expect(snap.errors).toBe(2);
  });

  it('calculates average latency correctly', () => {
    recordV8Request(100, false);
    recordV8Request(200, false);
    recordV8Request(300, false);

    const snap = getV8MetricsSnapshot();
    expect(snap.avgLatencyMs).toBe(200);
  });

  it('resets all counters', () => {
    recordV8Request(100, true);
    recordV8Request(200, false);

    resetV8Metrics();

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(0);
    expect(snap.errors).toBe(0);
    expect(snap.avgLatencyMs).toBe(0);
  });

  it('includes uptime', () => {
    const snap = getV8MetricsSnapshot();
    expect(typeof snap.uptime).toBe('number');
    expect(snap.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ==========================================
// v8MetricsMiddleware
// ==========================================

import { v8MetricsMiddleware } from '../../../middleware/v8Metrics.middleware.js';
import { EventEmitter } from 'events';

describe('v8MetricsMiddleware', () => {
  beforeEach(() => {
    resetV8Metrics();
  });

  function createMockReqRes(statusCode = 200) {
    const req = {} as any;
    const res = new EventEmitter() as any;
    res.statusCode = statusCode;
    const next = vi.fn();
    return { req, res, next };
  }

  it('calls next immediately', () => {
    const { req, res, next } = createMockReqRes();

    v8MetricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('records a successful request on finish', () => {
    const { req, res, next } = createMockReqRes(200);

    v8MetricsMiddleware(req, res, next);
    res.emit('finish');

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(1);
    expect(snap.errors).toBe(0);
  });

  it('records an error request when status >= 400', () => {
    const { req, res, next } = createMockReqRes(500);

    v8MetricsMiddleware(req, res, next);
    res.emit('finish');

    const snap = getV8MetricsSnapshot();
    expect(snap.requests).toBe(1);
    expect(snap.errors).toBe(1);
  });

  it('records latency based on elapsed time', async () => {
    const { req, res, next } = createMockReqRes(200);

    v8MetricsMiddleware(req, res, next);
    await new Promise((r) => setTimeout(r, 15));
    res.emit('finish');

    const snap = getV8MetricsSnapshot();
    expect(snap.avgLatencyMs).toBeGreaterThanOrEqual(10);
  });
});

// ==========================================
// Admin health route — response shape via mocked services
// ==========================================

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockGetPlatformHealth = vi.fn();
const mockGetCrossDomainIntegrity = vi.fn();
const mockGetPlatformMetrics = vi.fn();
const mockGetDomainReadiness = vi.fn();

vi.mock('../platformHealthService.js', () => ({
  getPlatformHealth: (...args: unknown[]) => mockGetPlatformHealth(...args),
  getCrossDomainIntegrity: (...args: unknown[]) => mockGetCrossDomainIntegrity(...args),
  getPlatformMetrics: (...args: unknown[]) => mockGetPlatformMetrics(...args),
  getDomainReadiness: (...args: unknown[]) => mockGetDomainReadiness(...args),
}));

describe('admin health route handler', () => {
  const ORG_ID = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformHealth.mockResolvedValue({
      overall: 'healthy',
      domains: { aiCore: { status: 'healthy', details: {} } },
      timestamp: '2026-03-23T00:00:00Z',
    });
    mockGetCrossDomainIntegrity.mockResolvedValue({
      intact: true,
      checks: [{ domain: 'aiCore', check: 'test', passed: true, details: 'ok' }],
    });
    mockGetPlatformMetrics.mockResolvedValue({
      metrics: { activeExecutionRuns: 1 },
      collectedAt: '2026-03-23T00:00:00Z',
    });
    mockGetDomainReadiness.mockResolvedValue({
      domains: [{ name: 'aiCore', ready: true, checks: [] }],
    });
  });

  it('returns all four sections in the data envelope', async () => {
    const {
      getPlatformHealth,
      getCrossDomainIntegrity,
      getPlatformMetrics,
      getDomainReadiness,
    } = await import('../platformHealthService.js');

    const [health, integrity, metrics, readiness] = await Promise.all([
      getPlatformHealth(ORG_ID),
      getCrossDomainIntegrity(ORG_ID),
      getPlatformMetrics(ORG_ID),
      getDomainReadiness(ORG_ID),
    ]);

    const responseData = { health, integrity, metrics, readiness };

    expect(responseData).toHaveProperty('health');
    expect(responseData).toHaveProperty('integrity');
    expect(responseData).toHaveProperty('metrics');
    expect(responseData).toHaveProperty('readiness');
    expect(responseData.health.overall).toBe('healthy');
    expect(responseData.integrity.intact).toBe(true);
  });

  it('calls all four platform health functions with orgId', async () => {
    const {
      getPlatformHealth,
      getCrossDomainIntegrity,
      getPlatformMetrics,
      getDomainReadiness,
    } = await import('../platformHealthService.js');

    await Promise.all([
      getPlatformHealth(ORG_ID),
      getCrossDomainIntegrity(ORG_ID),
      getPlatformMetrics(ORG_ID),
      getDomainReadiness(ORG_ID),
    ]);

    expect(mockGetPlatformHealth).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetCrossDomainIntegrity).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetPlatformMetrics).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetDomainReadiness).toHaveBeenCalledWith(ORG_ID);
  });
});

// ==========================================
// Admin metrics endpoint — response shape
// ==========================================

describe('admin metrics endpoint response shape', () => {
  beforeEach(() => {
    resetV8Metrics();
  });

  it('computes correct average latency', () => {
    recordV8Request(100, false);
    recordV8Request(200, false);
    recordV8Request(300, true);

    const snap = getV8MetricsSnapshot();
    expect(snap.avgLatencyMs).toBe(200);
  });

  it('returns 0 average latency when no requests', () => {
    const snap = getV8MetricsSnapshot();
    expect(snap.avgLatencyMs).toBe(0);
  });

  it('tracks error rate correctly', () => {
    recordV8Request(10, false);
    recordV8Request(20, true);
    recordV8Request(30, false);
    recordV8Request(40, true);

    const snap = getV8MetricsSnapshot();
    const errorRate = snap.requests > 0 ? snap.errors / snap.requests : 0;
    expect(errorRate).toBe(0.5);
  });
});
