import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isV8ShadowModeMock, recordShadowComparisonMock } = vi.hoisted(() => ({
  isV8ShadowModeMock: vi.fn(),
  recordShadowComparisonMock: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/featureFlagService.js', () => ({
  isV8ShadowMode: isV8ShadowModeMock,
}));

vi.mock('../../../../server/src/services/v8/shadowModeService.js', () => ({
  recordShadowComparison: recordShadowComparisonMock,
}));

import { v8ShadowModeCheck } from '../../../../server/src/middleware/v8ShadowModeCheck.middleware.ts';
import { v8ShadowInterceptor } from '../../../../server/src/middleware/v8ShadowInterceptor.middleware.ts';

describe('v8 shadow middlewares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isV8ShadowModeMock.mockResolvedValue(false);
    recordShadowComparisonMock.mockResolvedValue(undefined);
  });

  it('v8ShadowModeCheck resolves org from legacy organization_id', async () => {
    const req: any = { user: { organization_id: 'org-legacy' } };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).toHaveBeenCalledWith('org-legacy');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck continues when headers accessor throws', async () => {
    const req: any = {};
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
    });
    const res: any = {};
    const next = vi.fn();

    await expect(v8ShadowModeCheck(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck skips JWT decode when bearer token exceeds cap', async () => {
    const req: any = {
      headers: {
        authorization: `Bearer ${'x'.repeat(9000)}`,
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck trims bearer token before decode and resolves org', async () => {
    const token = [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0',
      'eyJvcmdhbml6YXRpb25JZCI6Im9yZy10cmltIn0',
      '',
    ].join('.');
    const req: any = {
      headers: {
        authorization: `Bearer    ${token}   `,
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).toHaveBeenCalledWith('org-trim');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck skips shadow check for oversized resolved org id', async () => {
    const req: any = {
      user: {
        organizationId: 'o'.repeat(257),
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck skips JWT decode when authorization header exceeds safety cap before trim', async () => {
    const req: any = {
      headers: {
        authorization: 'x'.repeat(9000),
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck treats oversized org-id source strings as absent before trim', async () => {
    const req: any = {
      user: {
        organizationId: 'o'.repeat(2000),
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowInterceptor continues when res.json binder throws', () => {
    const req: any = { v8ShadowMode: true, organizationId: 'org-1', method: 'GET', path: '/context' };
    const res: any = {
      statusCode: 200,
    };
    Object.defineProperty(res, 'json', {
      configurable: true,
      get: () => {
        throw new Error('json binder failed');
      },
    });
    const next = vi.fn();

    expect(() => v8ShadowInterceptor(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowInterceptor skips JWT decode when bearer token exceeds cap', () => {
    const req: any = {
      v8ShadowMode: true,
      method: 'GET',
      path: '/context',
      headers: {
        authorization: `Bearer ${'x'.repeat(9000)}`,
      },
    };
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();

    expect(() => v8ShadowInterceptor(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowInterceptor skips instrumentation when resolved org id is oversized', () => {
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'o'.repeat(257),
      method: 'GET',
      path: '/context',
      headers: { authorization: 'Bearer ok-token' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('v8ShadowInterceptor skips instrumentation when authorization header is oversized', () => {
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'org-1',
      method: 'GET',
      path: '/context',
      headers: { authorization: `Bearer ${'x'.repeat(9000)}` },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('v8ShadowInterceptor skips when raw authorization exceeds cap before trim', () => {
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'org-1',
      method: 'GET',
      path: '/context',
      headers: { authorization: `${' '.repeat(9000)}Bearer ok-token` },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('v8ShadowInterceptor skips instrumentation when headers already sent', () => {
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'org-1',
      method: 'GET',
      path: '/context',
      headers: { authorization: 'Bearer ok-token' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson, headersSent: true };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('v8ShadowInterceptor restores original res.json after wrapped send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ ok: true }),
      })
    );
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'org-1',
      method: 'GET',
      path: '/context',
      headers: { authorization: 'Bearer ok-token' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    const wrappedJson = res.json;
    wrappedJson({ ok: true });
    res.json({ second: true });
    await vi.waitFor(() => expect(recordShadowComparisonMock).toHaveBeenCalledTimes(1));

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toBe(wrappedJson);
    expect(recordShadowComparisonMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('v8ShadowInterceptor clamps oversized V8 response body before recording comparison', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ value: 'x'.repeat(300_000) }),
      })
    );
    const req: any = {
      v8ShadowMode: true,
      organizationId: 'org-1',
      method: 'GET',
      path: '/context',
      headers: { authorization: 'Bearer ok-token' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);
    res.json({ ok: true });

    await vi.waitFor(() => expect(recordShadowComparisonMock).toHaveBeenCalledTimes(1));
    const payload = recordShadowComparisonMock.mock.calls[0]?.[0];
    expect(payload.v8ResponseBody).toEqual(
      expect.objectContaining({
        __shadowOversizedResponse: true,
      })
    );

    vi.unstubAllGlobals();
  });
});
