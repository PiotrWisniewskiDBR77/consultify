import { describe, expect, it, vi } from 'vitest';

import { deprecationHeader } from '../../../../server/src/middleware/deprecationHeader.middleware.ts';
import logger from '../../../../server/src/utils/Logger.js';

function makeRes() {
  const res: any = {};
  res.setHeader = vi.fn();
  return res;
}

describe('deprecationHeader.middleware', () => {
  it('sets deprecation headers and calls next', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to default sunset date when provided date is invalid', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const res = makeRes();
    const next = vi.fn();
    const expectedFallbackSunset = new Date('2026-09-01').toUTCString();

    deprecationHeader('/api/v8/new', { sunsetDate: 'not-a-real-date' })(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expectedFallbackSunset);
    expect(res.setHeader).not.toHaveBeenCalledWith('Sunset', 'Invalid Date');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('strips control characters from sunsetDate before parsing and setting Sunset', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-sunset-controls' };
    const res = makeRes();
    const next = vi.fn();
    const expectedFallbackSunset = new Date('2026-09-01').toUTCString();

    deprecationHeader('/api/v8/new', { sunsetDate: '2026-09-01\u0000\u007F' })(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expectedFallbackSunset);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('trims replacement path and normalizes empty replacement to root link', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const resTrimmed = makeRes();
    const nextTrimmed = vi.fn();

    deprecationHeader('  /api/v8/new  ')(req, resTrimmed as any, nextTrimmed as any);
    expect(resTrimmed.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );
    expect(nextTrimmed).toHaveBeenCalledTimes(1);

    const resRoot = makeRes();
    const nextRoot = vi.fn();
    deprecationHeader('   ')(req, resRoot as any, nextRoot as any);
    expect(resRoot.setHeader).toHaveBeenCalledWith('Link', '</>; rel="successor-version"');
    expect(nextRoot).toHaveBeenCalledTimes(1);
  });

  it('continues when request accessors throw', () => {
    const req: any = {};
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method getter failed');
      },
    });
    Object.defineProperty(req, 'baseUrl', {
      configurable: true,
      get: () => {
        throw new Error('baseUrl getter failed');
      },
    });
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });

    const res = makeRes();
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res as any, next as any)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues when response setHeader throws', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const res: any = {
      setHeader: vi.fn(() => {
        throw new Error('setHeader failed');
      }),
    };
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips setHeader calls when headers are already sent', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const res: any = {
      headersSent: true,
      setHeader: vi.fn(() => {
        throw new Error('setHeader should not execute');
      }),
    };
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips setHeader when response is already ended (writableEnded)', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-ended' };
    const res: any = {
      headersSent: false,
      writableEnded: true,
      setHeader: vi.fn(() => {
        throw new Error('setHeader should not execute');
      }),
    };
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips setHeader calls when headersSent is truthy non-boolean', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-truthy-headers-sent' };
    const res: any = {
      headersSent: 'yes',
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('caps full Link header value length to hard limit', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-link-cap' };
    const res = makeRes();
    const next = vi.fn();
    const longReplacement = `/api/v8/${'x'.repeat(10000)}`;

    deprecationHeader(longReplacement)(req, res as any, next as any);

    const linkCall = (res.setHeader as any).mock.calls.find((call: unknown[]) => call[0] === 'Link');
    const linkValue = String(linkCall?.[1] ?? '');
    expect(linkValue.length).toBeLessThanOrEqual(4096);
    expect(linkValue.endsWith('>; rel="successor-version"')).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips setHeader when headersSent accessor throws', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-headers-sent-throw' };
    const res: any = {
      setHeader: vi.fn(() => {
        throw new Error('setHeader should not execute');
      }),
    };
    Object.defineProperty(res, 'headersSent', {
      configurable: true,
      get: () => {
        throw new Error('headersSent getter failed');
      },
    });
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues when logger.info throws on first legacy-route log', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementationOnce(() => {
      throw new Error('logger unavailable');
    });
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-logger-throw' };
    const res = makeRes();
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res as any, next as any)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );

    infoSpy.mockRestore();
  });

  it('still sets headers when writableEnded accessor throws but response is not committed', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-writable-ended-throw' };
    const res: any = {
      headersSent: false,
      setHeader: vi.fn(),
    };
    Object.defineProperty(res, 'writableEnded', {
      configurable: true,
      get: () => {
        throw new Error('writableEnded getter failed');
      },
    });
    const next = vi.fn();

    expect(() => deprecationHeader('/api/v8/new')(req, res, next as any)).not.toThrow();
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('strips control characters from deprecation log key components', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const req: any = {
      method: 'GET',
      baseUrl: '/api/old',
      path: '/ok\u0000\u007Finjected',
    };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res as any, next as any);

    const msg = String(infoSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect(msg).toContain('/api/old/okinjected');
    expect(next).toHaveBeenCalledTimes(1);
    infoSpy.mockRestore();
  });

  it('sanitizes control characters in replacement path before setting Link header', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-control-char' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/new\r\nInjected: 1\u0000')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/newInjected:%201>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('evicts dedupe keys when warn cache reaches cap', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const middleware = deprecationHeader('/api/v8/new');
    const res = makeRes();
    const next = vi.fn();

    for (let i = 0; i < 2050; i += 1) {
      middleware({ method: 'GET', baseUrl: '/api/old', path: `/route-${i}` } as any, res as any, next as any);
    }
    const countAfterFirstWave = infoSpy.mock.calls.length;
    middleware({ method: 'GET', baseUrl: '/api/old', path: '/route-0' } as any, res as any, next as any);
    const countAfterReplay = infoSpy.mock.calls.length;

    expect(countAfterFirstWave).toBeGreaterThan(0);
    expect(countAfterReplay).toBeGreaterThan(countAfterFirstWave);
    infoSpy.mockRestore();
  });

  it('sanitizes Link target delimiters from replacement path', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-delims' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/a<"b>\\c')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/abc>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('encodes spaces in replacement path for Link header', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-space' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/foo bar')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/foo%20bar>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prefixes replacement path with slash when given bare relative segment', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-relative' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('api/v8/new')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('coerces protocol-relative replacement target to root', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-proto-rel' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('//evil.example/api/v8/stolen')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Link', '</>; rel="successor-version"');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('caps dedupe key length to avoid oversized warned entries', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const middleware = deprecationHeader('/api/v8/new');
    const res = makeRes();
    const next = vi.fn();
    const longSuffixA = `/${'a'.repeat(700)}-a`;
    const longSuffixB = `/${'a'.repeat(700)}-b`;

    middleware({ method: 'GET', baseUrl: '/api/old', path: longSuffixA } as any, res as any, next as any);
    const callsAfterA = infoSpy.mock.calls.length;
    middleware({ method: 'GET', baseUrl: '/api/old', path: longSuffixB } as any, res as any, next as any);
    const callsAfterB = infoSpy.mock.calls.length;

    expect(callsAfterA).toBeGreaterThan(0);
    expect(callsAfterB).toBe(callsAfterA);
    infoSpy.mockRestore();
  });

  it('appends successor Link relation when response already has Link header', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-link-append' };
    const res: any = {
      setHeader: vi.fn(),
      getHeader: vi.fn(() => '</api/current>; rel="alternate"'),
      append: vi.fn(),
    };
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res, next as any);

    expect(res.append).toHaveBeenCalledWith('Link', '</api/v8/new>; rel="successor-version"');
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Link',
      '</api/v8/new>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to setHeader merge when append exists but throws', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-link-append-throws' };
    const res: any = {
      setHeader: vi.fn(),
      getHeader: vi.fn(() => '</api/current>; rel="alternate"'),
      append: vi.fn(() => {
        throw new Error('append failed');
      }),
    };
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res, next as any);

    expect(res.append).toHaveBeenCalledWith('Link', '</api/v8/new>; rel="successor-version"');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/current>; rel="alternate", </api/v8/new>; rel="successor-version"'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to successor-only Link when merged Link would exceed max length', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-link-merge-cap' };
    const res: any = {
      setHeader: vi.fn(),
      getHeader: vi.fn(() => `</api/current>; rel="alternate"; title="${'x'.repeat(5000)}"`),
    };
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res, next as any);

    const linkSetCalls = res.setHeader.mock.calls.filter((call: unknown[]) => call[0] === 'Link');
    const finalLinkValue = String(linkSetCalls.at(-1)?.[1] ?? '');
    expect(finalLinkValue.length).toBeLessThanOrEqual(4096);
    expect(finalLinkValue).toBe('</api/v8/new>; rel="successor-version"');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats Buffer Link header value as existing Link and appends successor relation', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-link-buffer' };
    const res: any = {
      setHeader: vi.fn(),
      getHeader: vi.fn(() => Buffer.from('</api/current>; rel="alternate"', 'utf8')),
      append: vi.fn(),
    };
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res, next as any);

    expect(res.append).toHaveBeenCalledWith('Link', '</api/v8/new>; rel="successor-version"');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not log first-hit message when warned.add throws', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const originalAdd = Set.prototype.add;
    const addSpy = vi.spyOn(Set.prototype, 'add').mockImplementation(function (value: string) {
      if (typeof value === 'string' && value.includes('/route-add-throws')) {
        throw new Error('warned add failed');
      }
      return originalAdd.call(this, value);
    });
    const middleware = deprecationHeader('/api/v8/new');
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-add-throws' };
    const res = makeRes();
    const next = vi.fn();

    expect(() => middleware(req, res as any, next as any)).not.toThrow();

    expect(infoSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('does not include query or hash fragments from originalUrl in deprecation log key', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const req: any = {
      method: 'GET',
      baseUrl: '/api/old',
      originalUrl: '/route-sensitive?token=SECRET&foo=1#frag',
    };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res as any, next as any);

    const msg = String(infoSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain('/api/old/route-sensitive');
    expect(msg).not.toContain('SECRET');
    expect(msg).not.toContain('token=');
    expect(msg).not.toContain('#frag');
    expect(next).toHaveBeenCalledTimes(1);
    infoSpy.mockRestore();
  });
});
