import { describe, expect, it, vi } from 'vitest';

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
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('apiVersion.middleware (L1)', () => {
  it('defaults to CURRENT_VERSION when no version specified', () => {
    const req: any = { path: '/api/x', headers: {}, query: {} };
    const res = makeRes();
    const next = vi.fn();

    apiVersionMiddleware(req, res as any, next as any);
    expect(req.apiVersion).toEqual(API_VERSIONS['1']);
    expect(res.setHeader).toHaveBeenCalledWith('x-api-version', API_VERSIONS['1'].full);
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

  it('falls back to header when URL has no version', () => {
    const req: any = { path: '/api/x', headers: { 'x-api-version': '1.0.0' }, query: {} };
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
    expect(next).not.toHaveBeenCalled();
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

  describe('requireVersion', () => {
    it('returns 400 when req.apiVersion missing', () => {
      const req: any = {};
      const res = makeRes();
      const next = vi.fn();
      requireVersion('1')(req, res as any, next as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when minVersion is not recognized (no-op)', () => {
      const req: any = { apiVersion: API_VERSIONS['1'] };
      const res = makeRes();
      const next = vi.fn();
      requireVersion('999')(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('trims spaced minVersion input before lookup', () => {
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
        expect(res.body).toEqual(
          expect.objectContaining({
            message: 'This endpoint requires API version v2.0.0 or higher.',
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

    it('calls next when version satisfies minVersion', () => {
      const req: any = { apiVersion: API_VERSIONS['1'] };
      const res = makeRes();
      const next = vi.fn();
      requireVersion('1.0.0')(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
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
