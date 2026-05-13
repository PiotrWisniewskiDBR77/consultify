import { describe, expect, it, vi } from 'vitest';

const { loggerWarnMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

import {
  API_VERSIONS,
  apiVersionMiddleware,
  deprecatedEndpoint,
  getVersionInfo,
  requireVersion,
  versionedPath,
} from '../../../../server/src/middleware/apiVersion.middleware.ts';

function makeRes() {
  const res: any = {};
  res.headers = {};
  res.setHeader = vi.fn((k: string, v: string) => {
    res.headers[String(k).toLowerCase()] = String(v);
  });
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.append = vi.fn((k: string, v: string) => {
    const headerKey = String(k).toLowerCase();
    const incoming = String(v);
    const current = res.headers[headerKey];
    if (!current) {
      res.headers[headerKey] = incoming;
      return res;
    }
    const existingParts = String(current)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (!existingParts.some((part) => part.toLowerCase() === incoming.toLowerCase())) {
      existingParts.push(incoming);
    }
    res.headers[headerKey] = existingParts.join(', ');
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('apiVersion.middleware (L1)', () => {
  it('truncates deprecated-version log path payload to bounded length', () => {
    const original = API_VERSIONS['0.9.2'];
    API_VERSIONS['0.9.2'] = {
      major: 0,
      minor: 9,
      patch: 2,
      full: '0.9.2',
      deprecated: true,
      sunsetDate: new Date('2030-01-01T00:00:00.000Z'),
    };
    try {
      const req: any = {
        path: `/api/${'x'.repeat(1200)}`,
        headers: { 'x-api-version': '0.9.2' },
        query: {},
      };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);

      const deprecatedLogCall = loggerWarnMock.mock.calls.find(
        (call) => call[0] === '[APIVersion] Deprecated version used'
      );
      const pathLogged = deprecatedLogCall?.[1]?.path as string;
      expect(typeof pathLogged).toBe('string');
      expect(pathLogged.length).toBeLessThanOrEqual(515);
      expect(pathLogged.endsWith('...')).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      if (original) API_VERSIONS['0.9.2'] = original;
      else delete (API_VERSIONS as any)['0.9.2'];
    }
  });

  it('defaults to CURRENT_VERSION when no version specified', () => {
    const req: any = { path: '/api/x', headers: {}, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion).toEqual(API_VERSIONS['1']);
    expect(res.setHeader).toHaveBeenCalledWith('x-api-version', API_VERSIONS['1'].full);
    expect(res.append).toHaveBeenCalledWith('Vary', 'X-API-Version');
    expect(String(res.headers.vary || '')).toContain('X-API-Version');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches a detached apiVersion object instead of mutating API_VERSIONS map entries', () => {
    const req: any = { path: '/api/x', headers: {}, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    req.apiVersion.full = '9.9.9';
    req.apiVersion.major = 9;

    expect(API_VERSIONS['1'].full).toBe('1.0.0');
    expect(API_VERSIONS['1'].major).toBe(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prioritizes version from URL (/api/v1/...)', () => {
    const req: any = { path: '/api/v1/projects', headers: { 'x-api-version': '1.0.0' }, query: { version: '1.0.0' } };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('extracts URL version when marker appears within bounded parse prefix', () => {
    const req: any = { path: `/api/v1/${'x'.repeat(200)}`, headers: {}, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);

    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not extract URL version when marker appears only beyond bounded parse prefix', () => {
    const req: any = {
      path: `${'x'.repeat(9000)}/api/v9/projects`,
      headers: {},
      query: {},
    };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);

    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to header when URL has no version', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '1.0.0' }, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses first non-empty value when x-api-version header is a string array', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': [' ', '1.0.0', '1'] }, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('strips embedded control chars from x-api-version before normalization', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '1\u0000.0.0' }, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);

    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to query param when URL+header missing', () => {
    const req: any = { path: '/api/x', headers: {}, query: { version: '1.0' } };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses first non-empty query.version when query value is an array', () => {
    const req: any = { path: '/api/x', headers: {}, query: { version: [' ', '1.0'] } };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion?.full).toBe('1.0.0');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported versions with 400 + supportedVersions', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '999' }, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Invalid API version',
        supportedVersions: expect.any(Array),
      })
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.append).toHaveBeenCalledWith('Vary', 'X-API-Version');
    expect(String(res.headers.vary || '')).toContain('X-API-Version');
    expect(next).not.toHaveBeenCalled();
  });

  it('caps supportedVersions list length in invalid-version 400 payload', () => {
    const syntheticKeys: string[] = [];
    for (let i = 10; i <= 60; i += 1) {
      const key = String(i);
      syntheticKeys.push(key);
      (API_VERSIONS as Record<string, any>)[key] = {
        major: i,
        minor: 0,
        patch: 0,
        full: `${i}.0.0`,
        deprecated: false,
        sunsetDate: null,
      };
    }
    try {
      const req: any = { path: '/api/x', headers: { 'x-api-version': '999' }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Array.isArray(res.body.supportedVersions)).toBe(true);
      expect(res.body.supportedVersions.length).toBe(32);
      expect(next).not.toHaveBeenCalled();
    } finally {
      for (const key of syntheticKeys) {
        delete (API_VERSIONS as Record<string, any>)[key];
      }
    }
  });

  it('sanitizes response api-version header value when version metadata is polluted', () => {
    const previousFull = API_VERSIONS['1'].full;
    API_VERSIONS['1'].full = '1.0.0\r\nx-injected: yes';
    try {
      const req: any = { path: '/api/x', headers: {}, query: {} };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.headers['x-api-version']).toBe('1.0.0x-injected: yes');
      expect(res.headers['x-api-version']).not.toMatch(/[\r\n\0]/);
    } finally {
      API_VERSIONS['1'].full = previousFull;
    }
  });

  it('truncates oversized invalid version in response message', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': `v${'9'.repeat(300)}` }, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(String(res.body.message)).toContain('Unsupported API version: ');
    expect(String(res.body.message).length).toBeLessThan(120);
    expect(String(res.body.message)).toContain('...');
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next when invalid-version response json writer throws', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '999' }, query: {} };
    const res = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();

    expect(() => apiVersionMiddleware(req, res as any, next as any)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores prototype-polluted API_VERSIONS keys and still rejects unknown versions', () => {
    const pollutedKey = '77';
    const originalPolluted = (Object.prototype as Record<string, unknown>)[pollutedKey];
    Object.defineProperty(Object.prototype, pollutedKey, {
      configurable: true,
      writable: true,
      value: {
        major: 77,
        minor: 0,
        patch: 0,
        full: '77.0.0',
        deprecated: false,
        sunsetDate: null,
      },
    });
    try {
      const req: any = { path: '/api/x', headers: { 'x-api-version': '77' }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: 'Invalid API version',
        })
      );
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (originalPolluted === undefined) {
        delete (Object.prototype as Record<string, unknown>)[pollutedKey];
      } else {
        (Object.prototype as Record<string, unknown>)[pollutedKey] = originalPolluted;
      }
    }
  });

  it('continues with next when invalid version is detected after headers are already sent', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '999' }, query: {} };
    const res = makeRes();
    res.headersSent = true;
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when version extraction throws (calls next)', () => {
    const req: any = {};
    Object.defineProperty(req, 'path', {
      get: () => {
        throw new Error('path getter boom');
      },
    });
    req.headers = {};
    req.query = {};
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sanitizes version tokens in requireVersion error payload', () => {
    const original = API_VERSIONS['2'];
    API_VERSIONS['2'] = {
      major: 2,
      minor: 0,
      patch: 0,
      full: '2.0.0\r\nx-required: injected',
      deprecated: false,
      sunsetDate: null,
    };
    try {
      const req: any = {
        apiVersion: {
          major: 1,
          minor: 0,
          patch: 0,
          full: '1.0.0\r\nyour-version: injected',
          deprecated: false,
          sunsetDate: null,
        },
      };
      const res = makeRes();
      const next = vi.fn();
      requireVersion('2')(req, res as any, next as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(String(res.body.yourVersion)).toBe('1.0.0your-version: injected');
      expect(String(res.body.requiredVersion)).toBe('2.0.0x-required: injected');
      expect(String(res.body.yourVersion)).not.toMatch(/[\r\n\0]/);
      expect(String(res.body.requiredVersion)).not.toMatch(/[\r\n\0]/);
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (original) API_VERSIONS['2'] = original;
      else delete (API_VERSIONS as any)['2'];
    }
  });

  it('keeps middleware non-throwing when next throws inside extraction catch', () => {
    const original = API_VERSIONS['0.9.3'];
    API_VERSIONS['0.9.3'] = {
      major: 0,
      minor: 9,
      patch: 3,
      full: '0.9.3',
      deprecated: true,
      sunsetDate: new Date('2030-01-01T00:00:00.000Z'),
    };
    const warnSpy = loggerWarnMock.mockImplementationOnce(() => {
      throw new Error('deprecated log failed');
    });
    try {
      const req: any = {
        path: '/api/x',
        headers: { 'x-api-version': '0.9.3' },
        query: {},
      };
      const res = makeRes();
      const next = vi.fn(() => {
        throw new Error('next boom');
      });

      expect(() => apiVersionMiddleware(req, res as any, next as any)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
      expect(loggerErrorMock).toHaveBeenCalledWith(
        '[APIVersion] Version extraction error',
        expect.objectContaining({
          detail: expect.stringContaining('deprecated log failed'),
        })
      );
      expect(loggerWarnMock).toHaveBeenCalledWith(
        '[APIVersion] Failed to invoke next after extraction error',
        expect.objectContaining({
          detail: expect.stringContaining('deprecated log failed'),
        })
      );
    } finally {
      warnSpy.mockRestore();
      if (original) API_VERSIONS['0.9.3'] = original;
      else delete (API_VERSIONS as any)['0.9.3'];
    }
  });

  it('continues when response setHeader throws', () => {
    const req: any = { path: '/api/x', headers: {}, query: {} };
    const res = makeRes();
    res.setHeader = vi.fn(() => {
      throw new Error('setHeader failed');
    });
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiVersion).toEqual(API_VERSIONS['1']);
  });

  it('sets deprecation headers for deprecated versions', () => {
    const original = API_VERSIONS['0.9.0'];
    API_VERSIONS['0.9.0'] = {
      major: 0,
      minor: 9,
      patch: 0,
      full: '0.9.0',
      deprecated: true,
      sunsetDate: new Date('2030-01-01T00:00:00.000Z'),
    };
    try {
      const req: any = { path: '/api/x', headers: { 'x-api-version': '0.9.0' }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);
      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toBe('2030-01-01T00:00:00.000Z');
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      if (original) API_VERSIONS['0.9.0'] = original;
      else delete (API_VERSIONS as any)['0.9.0'];
    }
  });

  it('skips sunset header when deprecated version sunsetDate is invalid', () => {
    const original = API_VERSIONS['0.9.1'];
    API_VERSIONS['0.9.1'] = {
      major: 0,
      minor: 9,
      patch: 1,
      full: '0.9.1',
      deprecated: true,
      sunsetDate: new Date('invalid'),
    };
    try {
      const req: any = { path: '/api/x', headers: { 'x-api-version': '0.9.1' }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      apiVersionMiddleware(req, res as any, next as any);

      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      if (original) API_VERSIONS['0.9.1'] = original;
      else delete (API_VERSIONS as any)['0.9.1'];
    }
  });

  describe('requireVersion', () => {
    it('returns 400 when req.apiVersion missing', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      requireVersion('1')(req, res as any, next as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['pragma']).toBe('no-cache');
      expect(next).not.toHaveBeenCalled();
    });

    it('does not call next when missing-version response json writer throws', () => {
      const req: any = {};
      const res = makeRes();
      res.json = vi.fn(() => {
        throw new Error('json failed');
      });
      const next = vi.fn();

      expect(() => requireVersion('1')(req, res as any, next as any)).not.toThrow();
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when req.apiVersion is missing but headers already sent', () => {
      const req: any = {};
      const res = makeRes();
      res.headersSent = true;
      const next = vi.fn();
      requireVersion('1')(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next when minVersion is not recognized (no-op)', () => {
      const req: any = { apiVersion: API_VERSIONS['1'] };
      const res = makeRes();
      const next = vi.fn();
      requireVersion('999')(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('trims spaced minVersion input in requireVersion before lookup', () => {
      const original = API_VERSIONS['2'];
      API_VERSIONS['2'] = {
        major: 2,
        minor: 0,
        patch: 0,
        full: '2.0.0',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const req: any = { apiVersion: API_VERSIONS['1'] };
        const res = makeRes();
        const next = vi.fn();

        requireVersion('  v2.0.0  ')(req, res as any, next as any);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
      } finally {
        if (original) API_VERSIONS['2'] = original;
        else delete (API_VERSIONS as any)['2'];
      }
    });

    it('strips embedded control chars from minVersion before lookup', () => {
      const original = API_VERSIONS['2'];
      API_VERSIONS['2'] = {
        major: 2,
        minor: 0,
        patch: 0,
        full: '2.0.0',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const req: any = { apiVersion: API_VERSIONS['1'] };
        const res = makeRes();
        const next = vi.fn();

        requireVersion('2\u000D\u000A.0.0')(req, res as any, next as any);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body).toEqual(
          expect.objectContaining({
            requiredVersion: '2.0.0',
          })
        );
        expect(next).not.toHaveBeenCalled();
      } finally {
        if (original) API_VERSIONS['2'] = original;
        else delete (API_VERSIONS as any)['2'];
      }
    });

    it('handles extremely long unknown minVersion input as unrecognized no-op', () => {
      const req: any = { apiVersion: API_VERSIONS['1'] };
      const res = makeRes();
      const next = vi.fn();

      requireVersion(`9${'z'.repeat(10_000)}`)(req, res as any, next as any);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 when version is too old', () => {
      const original = API_VERSIONS['2'];
      API_VERSIONS['2'] = {
        major: 2,
        minor: 0,
        patch: 0,
        full: '2.0.0',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const req: any = { apiVersion: API_VERSIONS['1'] };
        const res = makeRes();
        const next = vi.fn();
        requireVersion('2')(req, res as any, next as any);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['pragma']).toBe('no-cache');
        expect(res.body).toEqual(
          expect.objectContaining({
            error: 'API version too old',
            requiredVersion: '2.0.0',
          })
        );
        expect(next).not.toHaveBeenCalled();
      } finally {
        if (original) API_VERSIONS['2'] = original;
        else delete (API_VERSIONS as any)['2'];
      }
    });

    it('truncates oversized minVersion in requireVersion 400 message', () => {
      const original = API_VERSIONS['2'];
      API_VERSIONS['2'] = {
        major: 2,
        minor: 0,
        patch: 0,
        full: '2.0.0',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const req: any = { apiVersion: API_VERSIONS['1'] };
        const res = makeRes();
        const next = vi.fn();
        const longMinVersion = `2.0.0${'z'.repeat(300)}`;
        requireVersion(longMinVersion)(req, res as any, next as any);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(String(res.body.message)).toContain('This endpoint requires API version');
        expect(String(res.body.message).length).toBeLessThan(160);
        expect(String(res.body.message)).toContain('...');
        expect(next).not.toHaveBeenCalled();
      } finally {
        if (original) API_VERSIONS['2'] = original;
        else delete (API_VERSIONS as any)['2'];
      }
    });

    it('calls next when version is too old but headers already sent', () => {
      const original = API_VERSIONS['2'];
      API_VERSIONS['2'] = {
        major: 2,
        minor: 0,
        patch: 0,
        full: '2.0.0',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const req: any = { apiVersion: API_VERSIONS['1'] };
        const res = makeRes();
        res.headersSent = true;
        const next = vi.fn();
        requireVersion('2')(req, res as any, next as any);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      } finally {
        if (original) API_VERSIONS['2'] = original;
        else delete (API_VERSIONS as any)['2'];
      }
    });

    it('calls next when version satisfies minVersion', () => {
      const req: any = { apiVersion: API_VERSIONS['1'] };
      const res = makeRes();
      const next = vi.fn();
      requireVersion('1.0.0')(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('stays non-throwing when req.apiVersion accessor throws inside requireVersion', () => {
      const req: any = {};
      Object.defineProperty(req, 'apiVersion', {
        configurable: true,
        get: () => {
          throw new Error('apiVersion getter boom');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      expect(() => requireVersion('1')(req, res as any, next as any)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
      expect(loggerErrorMock).toHaveBeenCalledWith(
        '[APIVersion] requireVersion error',
        expect.objectContaining({
          detail: expect.stringContaining('apiVersion getter boom'),
        })
      );
    });

    it('compares minor/patch versions (covers compareVersions branches)', () => {
      const originals: Record<string, any> = {
        '1.1.0': API_VERSIONS['1.1.0'],
        '1.0.1': API_VERSIONS['1.0.1'],
      };
      API_VERSIONS['1.1.0'] = {
        major: 1,
        minor: 1,
        patch: 0,
        full: '1.1.0',
        deprecated: false,
        sunsetDate: null,
      };
      API_VERSIONS['1.0.1'] = {
        major: 1,
        minor: 0,
        patch: 1,
        full: '1.0.1',
        deprecated: false,
        sunsetDate: null,
      };
      try {
        const res1 = makeRes();
        const next1 = vi.fn();
        requireVersion('1.1.0')({ apiVersion: API_VERSIONS['1'] } as any, res1 as any, next1 as any);
        expect(res1.status).toHaveBeenCalledWith(400);

        const res2 = makeRes();
        const next2 = vi.fn();
        requireVersion('1.0.1')({ apiVersion: API_VERSIONS['1'] } as any, res2 as any, next2 as any);
        expect(res2.status).toHaveBeenCalledWith(400);
      } finally {
        for (const k of Object.keys(originals)) {
          if (originals[k]) API_VERSIONS[k] = originals[k];
          else delete (API_VERSIONS as any)[k];
        }
      }
    });
  });

  describe('deprecatedEndpoint', () => {
    it('adds _deprecation section to JSON object bodies', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), '/new')(req as any, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);

      res.json({ ok: true });
      expect(res.body).toEqual(
        expect.objectContaining({
          ok: true,
          _deprecation: expect.objectContaining({
            deprecated: true,
            alternative: '/new',
          }),
        })
      );
      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toBe('2030-01-01T00:00:00.000Z');
    });

    it('passes through non-object bodies without mutation', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      deprecatedEndpoint()(req as any, res as any, next as any);
      res.json('ok');
      expect(res.body).toBe('ok');
    });

    it('does not throw and omits sunset when deprecatedEndpoint receives invalid date', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();

      expect(() =>
        deprecatedEndpoint(new Date('invalid'), '/new')(req as any, res as any, next as any)
      ).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);

      res.json({ ok: true });
      expect(res.headers.sunset).toBeUndefined();
      expect(res.body?._deprecation?.sunsetDate).toBeUndefined();
    });

    it('passes through array bodies without converting them to objects', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), '/new')(req as any, res as any, next as any);

      res.json([1, 2, 3]);

      expect(res.body).toEqual([1, 2, 3]);
    });

    it('passes through Buffer bodies without object merge', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), '/new')(req as any, res as any, next as any);

      const payload = Buffer.from('abc');
      res.json(payload);

      expect(res.body).toBe(payload);
    });

    it('passes through Date bodies without object merge', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      deprecatedEndpoint()(req as any, res as any, next as any);

      const payload = new Date('2030-01-01T00:00:00.000Z');
      res.json(payload);

      expect(res.body).toBe(payload);
    });

    it('continues when response json binder throws', () => {
      const req: any = {};
      const res = makeRes();
      Object.defineProperty(res, 'json', {
        configurable: true,
        get: () => {
          throw new Error('json getter failed');
        },
      });
      const next = vi.fn();

      expect(() => deprecatedEndpoint()(req as any, res as any, next as any)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sanitizes and trims alternative endpoint metadata in deprecation payload', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      const rawAlternative = `  /new\r\nx:bad${'z'.repeat(300)}  `;

      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), rawAlternative)(
        req as any,
        res as any,
        next as any
      );
      expect(next).toHaveBeenCalledTimes(1);

      res.json({ ok: true });
      const alternative = res.body?._deprecation?.alternative;
      expect(typeof alternative).toBe('string');
      expect(alternative).not.toMatch(/[\r\n\0]/);
      expect(alternative.length).toBeLessThanOrEqual(128);
      expect(alternative.startsWith('/new')).toBe(true);
    });

    it('omits alternative metadata when alternative endpoint is only whitespace', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();

      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), '   \r\n   ')(
        req as any,
        res as any,
        next as any
      );
      expect(next).toHaveBeenCalledTimes(1);

      res.json({ ok: true });
      expect(res.body?._deprecation).toEqual(
        expect.objectContaining({
          deprecated: true,
        })
      );
      expect(Object.prototype.hasOwnProperty.call(res.body?._deprecation ?? {}, 'alternative')).toBe(
        false
      );
    });

    it('falls back to original body when deprecation metadata merge throws', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();

      const baseJson = res.json;
      res.json = vi.fn((payload: any) => {
        if (payload && typeof payload === 'object' && '_deprecation' in payload) {
          throw new Error('serialization boom');
        }
        return baseJson(payload);
      });

      deprecatedEndpoint(new Date('2030-01-01T00:00:00.000Z'), '/new')(
        req as any,
        res as any,
        next as any
      );
      expect(next).toHaveBeenCalledTimes(1);

      res.json({ ok: true });
      expect(res.body).toEqual({ ok: true });
      expect(loggerWarnMock).toHaveBeenCalledWith(
        '[APIVersion] deprecatedEndpoint failed to attach deprecation metadata; sending original body'
      );
    });
  });

  describe('helpers', () => {
    it('versionedPath prefixes /api/v{n}', () => {
      expect(versionedPath(2, '/x')).toBe('/api/v2/x');
    });

    it('getVersionInfo lists supported majors', () => {
      const info = getVersionInfo();
      expect(info.current).toBeTruthy();
      expect(info.latest).toBeTruthy();
      expect(Array.isArray(info.supported)).toBe(true);
    });

    it('getVersionInfo lists deprecated majors', () => {
      const original = API_VERSIONS['0'];
      API_VERSIONS['0'] = {
        major: 0,
        minor: 0,
        patch: 0,
        full: '0.0.0',
        deprecated: true,
        sunsetDate: null,
      };
      try {
        const info = getVersionInfo();
        expect(info.deprecated).toContain('0');
      } finally {
        if (original) API_VERSIONS['0'] = original;
        else delete (API_VERSIONS as any)['0'];
      }
    });
  });
});
