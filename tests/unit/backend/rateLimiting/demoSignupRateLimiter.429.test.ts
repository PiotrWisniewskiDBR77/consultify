/**
 * OPS-DEMO-002 — abuse protection on the public demo signup.
 *
 * `POST /api/auth/register-demo` is unauthenticated, CSRF-exempt, and provisions
 * a seeded tenant on every success. It had no limiter at all: the global
 * `apiLimiter` explicitly skips everything under `/api/auth/`, and the per-route
 * `authLimiter` is mounted on `/api/auth/login` and `/api/auth/register` only —
 * which under Express 5 does not match `/api/auth/register-demo`.
 *
 * These cases drive the middleware directly, following the house pattern in this
 * directory: flip NODE_ENV to production BEFORE the dynamic import, because the
 * limiter both short-circuits on `NODE_ENV === 'test'` and resolves its ceiling
 * from a module-level `isProd`. `vi.resetModules()` also gives each case a fresh
 * in-memory bucket.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type FakeRes = {
  statusCode: number;
  headers: Record<string, unknown>;
  jsonBody: unknown;
  setHeader: (k: string, v: unknown) => void;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
};

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    setHeader: (k, v) => {
      res.headers[k] = v;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (body) => {
      res.jsonBody = body;
      return res;
    },
  };
  return res;
}

async function loadLimiters() {
  vi.resetModules();
  return import('../../../../server/src/middleware/rateLimiting.middleware.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('demo signup rate limiting (production behaviour)', () => {
  it('refuses a flood from one IP with 429 and a retry hint', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIpRateLimiter } = await loadLimiters();

    const req: any = { method: 'POST', ip: '198.51.100.11', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();

    // Prod ceiling is 5/hour; the 6th must be refused.
    for (let i = 0; i < 6; i += 1) demoSignupIpRateLimiter(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.statusCode).toBe(429);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        error: expect.any(String),
        retryAfter: expect.any(Number),
      })
    );
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('refuses a flood against ONE address even when the IP keeps changing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIdentityRateLimiter } = await loadLimiters();

    const email = 'ops-demo-002+quota@fixture.invalid';
    const res = makeRes();
    const next = vi.fn();

    // A proxy pool: every request from a different network, same target address.
    for (let i = 0; i < 4; i += 1) {
      const req: any = {
        method: 'POST',
        ip: `203.0.113.${i + 1}`,
        headers: {},
        body: { email },
      };
      demoSignupIdentityRateLimiter(req as any, res as any, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(429);
    expect((res.jsonBody as { code?: string })?.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('treats address casing as one identity, so the quota cannot be sidestepped', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIdentityRateLimiter } = await loadLimiters();

    const res = makeRes();
    const next = vi.fn();
    const variants = [
      'ops-demo-002+case@fixture.invalid',
      'OPS-Demo-002+Case@Fixture.invalid',
      'ops-demo-002+CASE@FIXTURE.INVALID',
      ' ops-demo-002+case@fixture.invalid ',
    ];
    variants.forEach((email, i) => {
      const req: any = { method: 'POST', ip: `192.0.2.${i + 1}`, headers: {}, body: { email } };
      demoSignupIdentityRateLimiter(req as any, res as any, next);
    });

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(429);
  });

  it('keeps separate addresses in separate buckets', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIdentityRateLimiter } = await loadLimiters();

    const next = vi.fn();
    for (let i = 0; i < 3; i += 1) {
      const req: any = {
        method: 'POST',
        ip: '198.51.100.60',
        headers: {},
        body: { email: `ops-demo-002+bucket-${i}@fixture.invalid` },
      };
      demoSignupIdentityRateLimiter(req as any, makeRes() as any, next);
    }
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('never puts a raw address in the rate-limit key space', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await loadLimiters();
    const { demoSignupIdentityRateLimiter, hashRateLimitIdentity } = mod;

    const email = 'ops-demo-002+privacy@fixture.invalid';
    const req: any = { method: 'POST', ip: '198.51.100.90', headers: {}, body: { email } };
    demoSignupIdentityRateLimiter(req as any, makeRes() as any, vi.fn());

    // The store is module-private; assert on the identity function that produces
    // the key segment, plus its properties: opaque, stable, and not reversible by
    // inspection.
    const identity = hashRateLimitIdentity('demo-signup', email);
    expect(identity).not.toContain('@');
    expect(identity).not.toContain('fixture');
    expect(identity).not.toContain('ops-demo-002');
    expect(identity).toMatch(/^[0-9a-f]{32}$/);
    expect(identity).toBe(hashRateLimitIdentity('demo-signup', email));
    expect(identity).not.toBe(hashRateLimitIdentity('other-namespace', email));
  });

  it('falls back to the IP identity when the body carries no address', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIdentityRateLimiter } = await loadLimiters();

    const next = vi.fn();
    const res = makeRes();
    for (let i = 0; i < 4; i += 1) {
      const req: any = { method: 'POST', ip: '198.51.100.99', headers: {}, body: {} };
      demoSignupIdentityRateLimiter(req as any, res as any, next);
    }
    // Same IP, no address: still bounded rather than unlimited.
    expect(next).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(429);
  });

  it('is bypassed under NODE_ENV=test so the suite is not throttled', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { demoSignupIpRateLimiter } = await loadLimiters();

    const next = vi.fn();
    const res = makeRes();
    for (let i = 0; i < 50; i += 1) {
      demoSignupIpRateLimiter(
        { method: 'POST', ip: '198.51.100.200', headers: {}, body: {} } as any,
        res as any,
        next
      );
    }
    expect(next).toHaveBeenCalledTimes(50);
    expect(res.statusCode).toBe(200);
  });
});

describe('demo signup quota cannot be chosen by the caller', () => {
  /**
   * The default key resolver prefers a user id read out of the bearer token with
   * `jwt.decode` — unverified. On `register-demo`, which is unauthenticated and
   * provisions a tenant per success, that let an attacker attach any junk bearer,
   * rotate the `id` claim, and land every request in a fresh bucket.
   */
  const junkBearer = (id: string) => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id })}.`;
  };

  it('ignores an unverified token and keeps counting per network', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIpRateLimiter } = await loadLimiters();

    const res = makeRes();
    const next = vi.fn();
    // Same IP, a different forged identity every time.
    for (let i = 0; i < 6; i += 1) {
      demoSignupIpRateLimiter(
        {
          method: 'POST',
          ip: '198.51.100.240',
          headers: { authorization: `Bearer ${junkBearer(`forged-${i}`)}` },
          body: {},
        } as any,
        res as any,
        next
      );
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.statusCode).toBe(429);
  });

  it('the identity limiter falls back to the network, not to a token-derived key', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { demoSignupIdentityRateLimiter } = await loadLimiters();

    const res = makeRes();
    const next = vi.fn();
    // No address in the body, forged identity rotating: must still be bounded.
    for (let i = 0; i < 4; i += 1) {
      demoSignupIdentityRateLimiter(
        {
          method: 'POST',
          ip: '198.51.100.241',
          headers: { authorization: `Bearer ${junkBearer(`forged-${i}`)}` },
          body: {},
        } as any,
        res as any,
        next
      );
    }

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(429);
  });
});
