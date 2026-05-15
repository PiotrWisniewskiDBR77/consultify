import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shadowModeService.js', () => ({
  recordShadowComparison: vi.fn().mockResolvedValue({
    comparisonId: 'test-id',
    responsesMatch: true,
  }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { v8ShadowInterceptor } from '../../../middleware/v8ShadowInterceptor.middleware.js';

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    path: '/test',
    method: 'GET',
    organizationId: 'org-123',
    headers: { authorization: 'Bearer test-token' },
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('v8ShadowInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through when shadow mode is not active', () => {
    const req = createMockReq({ v8ShadowMode: false });
    const res = createMockRes();
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when no org context', () => {
    const req = createMockReq({ v8ShadowMode: true, organizationId: undefined });
    const res = createMockRes();
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when no route mapping matches', () => {
    const req = createMockReq({ v8ShadowMode: true, path: '/unknown-route' });
    const res = createMockRes();
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('always calls next (never blocks)', () => {
    const req = createMockReq({ v8ShadowMode: true });
    const res = createMockRes();
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next when assigning res.json throws', () => {
    const req = createMockReq({ v8ShadowMode: true, path: '/context', method: 'GET' });
    const res: any = {
      statusCode: 200,
      _jsonImpl: vi.fn().mockReturnThis(),
      get json() {
        return this._jsonImpl;
      },
      set json(_value: unknown) {
        throw new Error('json setter blocked');
      },
    };
    const next = vi.fn();

    expect(() => v8ShadowInterceptor(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes AbortSignal timeout to internal V8 fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const req = createMockReq({ v8ShadowMode: true, path: '/context', method: 'GET' });
    const res = createMockRes();
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.json({ legacy: true });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeDefined();
    expect((init.signal as AbortSignal).aborted).toBe(false);

    vi.unstubAllGlobals();
  });
});
