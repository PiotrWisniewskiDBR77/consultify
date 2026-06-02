import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

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
const loggerWarnMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: loggerWarnMock,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
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

  it('v8ShadowModeCheck skips JWT decode for malformed non-compact bearer token', async () => {
    const req: any = {
      headers: {
        authorization: 'Bearer a.b',
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowModeCheck skips decode when any JWT segment exceeds per-segment cap', async () => {
    const decodeSpy = vi.spyOn(jwt, 'decode');
    const oversizedSegment = 'x'.repeat(2049);
    const req: any = {
      headers: {
        authorization: `Bearer a.${oversizedSegment}.c`,
      },
    };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(decodeSpy).not.toHaveBeenCalled();
    expect(isV8ShadowModeMock).not.toHaveBeenCalled();
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
    decodeSpy.mockRestore();
  });

  it('v8ShadowModeCheck trims bearer token before decode and resolves org', async () => {
    const token = [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0',
      'eyJvcmdhbml6YXRpb25JZCI6Im9yZy10cmltIn0',
      'sig',
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

  it('v8ShadowModeCheck ignores jwt.decode string payload return type', async () => {
    const decodeSpy = vi.spyOn(jwt, 'decode').mockReturnValueOnce('decoded-string' as any);
    const req: any = {
      headers: {
        authorization: 'Bearer a.b.c',
      },
    };
    const res: any = {};
    const next = vi.fn();
    try {
      await v8ShadowModeCheck(req, res, next);

      expect(isV8ShadowModeMock).not.toHaveBeenCalled();
      expect(req.v8ShadowMode).toBe(false);
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it('v8ShadowModeCheck continues when jwt.decode throws', async () => {
    const decodeSpy = vi.spyOn(jwt, 'decode').mockImplementationOnce(() => {
      throw new Error('decode boom');
    });
    const req: any = {
      headers: {
        authorization: 'Bearer a.b.c',
      },
    };
    const res: any = {};
    const next = vi.fn();
    try {
      await v8ShadowModeCheck(req, res, next);

      expect(isV8ShadowModeMock).not.toHaveBeenCalled();
      expect(req.v8ShadowMode).toBe(false);
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it('v8ShadowModeCheck logs single-line sanitized warning when shadow lookup fails', async () => {
    isV8ShadowModeMock.mockRejectedValueOnce(new Error('evil\nsecond-line'));
    const req: any = { organizationId: 'org-1' };
    const res: any = {};
    const next = vi.fn();

    await v8ShadowModeCheck(req, res, next);

    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    const logMessage = loggerWarnMock.mock.calls[0]?.[0];
    expect(typeof logMessage).toBe('string');
    expect(String(logMessage)).not.toContain('\n');
    expect(String(logMessage)).toContain('orgId=org-1');
    expect(String(logMessage)).toContain('err=evil second-line');
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('v8ShadowInterceptor skips JWT decode for malformed non-compact bearer token', () => {
    const req: any = {
      v8ShadowMode: true,
      method: 'GET',
      path: '/context',
      headers: {
        authorization: 'Bearer a.b',
      },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    v8ShadowInterceptor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('v8ShadowInterceptor ignores jwt.decode string payload when resolving org fallback', () => {
    const decodeSpy = vi.spyOn(jwt, 'decode').mockReturnValueOnce('decoded-string' as any);
    const req: any = {
      v8ShadowMode: true,
      method: 'GET',
      path: '/context',
      headers: { authorization: 'Bearer a.b.c' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();
    try {
      v8ShadowInterceptor(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.json).toBe(originalJson);
    } finally {
      decodeSpy.mockRestore();
    }
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

  it('v8ShadowInterceptor reads V8 response via text() and truncates oversized payload safely', async () => {
    const textSpy = vi.fn(async () => 'x'.repeat(600_000));
    const jsonSpy = vi.fn(async () => ({ shouldNot: 'run' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: textSpy,
        json: jsonSpy,
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
    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(payload.v8ResponseBody).toEqual(
      expect.objectContaining({
        __shadowTruncatedResponse: true,
      })
    );
    vi.unstubAllGlobals();
  });

  it('v8ShadowInterceptor clamps oversized V8 response body before recording comparison', async () => {
    const textSpy = vi.fn(async () => JSON.stringify({ value: 'x'.repeat(300_000) }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: textSpy,
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
    expect(textSpy).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('v8ShadowInterceptor omits content-type header for GET shadow calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
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
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const fetchOptions = fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    expect(fetchOptions?.headers).toBeDefined();
    expect(fetchOptions?.headers?.Authorization).toBe('Bearer ok-token');
    expect(fetchOptions?.headers?.['Content-Type']).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
