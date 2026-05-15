import { describe, expect, it, vi } from 'vitest';

import { deprecationHeader } from '../../../../server/src/middleware/deprecationHeader.middleware.js';

function makeRes() {
  return {
    setHeader: vi.fn(),
    headersSent: false,
  };
}

describe('deprecationHeader.middleware', () => {
  it('sets deprecation headers and calls next', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route' };
    const res = makeRes();
    const next = vi.fn();

    deprecationHeader('/api/v8/new')(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('Link', '</api/v8/new>; rel="successor-version"');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips setHeader calls when headersSent is truthy', () => {
    const req: any = { method: 'GET', baseUrl: '/api/old', path: '/route-committed' };
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

    deprecationHeader(longReplacement, { logFirstCall: false })(req, res as any, next as any);

    const linkCall = res.setHeader.mock.calls.find((call) => call[0] === 'Link');
    const linkValue = String(linkCall?.[1] ?? '');
    expect(linkValue.length).toBeLessThanOrEqual(4096);
    expect(linkValue.endsWith('>; rel="successor-version"')).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
