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
});
