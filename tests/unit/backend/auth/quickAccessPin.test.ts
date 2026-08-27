/**
 * Day-39 FIX-1 — quick access PIN without a password anywhere.
 *
 * Proves the endpoint in both directions, which is the point: a guard that only
 * ever sees the happy path is how the previous shortcut shipped dead.
 *   - a configured PIN mints a session through the ordinary login path;
 *   - an unconfigured PIN is refused and never reaches login;
 *   - on a production runtime the endpoint is refused for EVERY pin, including
 *     the correct one, and the refusal is decided server side.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.fn();
const auditLogMock = vi.fn(async () => 'ae-test');

vi.mock('../../../../server/src/controllers/AuthController.js', () => ({
  login: (...args: unknown[]) => loginMock(...args),
}));

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: (...args: unknown[]) => auditLogMock(...(args as [])) },
}));

import authRouter from '../../../../server/src/routes/auth.routes.ts';
import {
  assertQuickAccessRuntimeEnabled,
  isProductionRuntimeForQuickAccess,
  isQuickAccessEndpointEnabled,
  readQuickAccessPinMap,
  resolveQuickAccessAccountEmail,
} from '../../../../server/src/services/auth/quickAccessPinService.ts';

const PIN = '4271';
const ACCOUNT = 'quick-access-fixture@example.test';
const CONFIGURED_MAP = JSON.stringify({ [PIN]: ACCOUNT });

const TOUCHED_ENV = [
  'QUICK_ACCESS_PIN_MAP',
  'APP_ENV',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_SERVICE_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'FRONTEND_URL',
  'DATABASE_URL',
  'PRODUCTION_DB_HOST_DENYLIST_EXTRA',
] as const;

const originalEnv: Record<string, string | undefined> = {};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { cookies: Record<string, string> }).cookies = {};
    next();
  });
  app.use('/api/auth', authRouter);
  return app;
}

beforeEach(() => {
  for (const key of TOUCHED_ENV) originalEnv[key] = process.env[key];
  // A clean non-production baseline. Every production signal is explicitly off
  // so a case that wants one has to turn it on.
  delete process.env.APP_ENV;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.RAILWAY_SERVICE_ID;
  delete process.env.RAILWAY_ENVIRONMENT_ID;
  delete process.env.PRODUCTION_DB_HOST_DENYLIST_EXTRA;
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';
  process.env.QUICK_ACCESS_PIN_MAP = CONFIGURED_MAP;

  loginMock.mockReset();
  auditLogMock.mockClear();
  loginMock.mockImplementation(async (_req: any, res: any) => {
    res.status(200).send({ user: { id: 'u-1', email: ACCOUNT }, token: 'access-token' });
  });
});

afterEach(() => {
  for (const key of TOUCHED_ENV) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key] as string;
  }
});

describe('quick access PIN map (server side only)', () => {
  it('reads a configured map and resolves the account email', () => {
    expect(readQuickAccessPinMap()).toEqual({ [PIN]: ACCOUNT });
    expect(resolveQuickAccessAccountEmail(PIN)).toBe(ACCOUNT);
  });

  it('is empty and disabled when unset or malformed', () => {
    for (const raw of ['', '   ', 'not-json', '[]', '"str"']) {
      process.env.QUICK_ACCESS_PIN_MAP = raw;
      expect(readQuickAccessPinMap()).toEqual({});
      expect(isQuickAccessEndpointEnabled()).toBe(false);
    }
    delete process.env.QUICK_ACCESS_PIN_MAP;
    expect(readQuickAccessPinMap()).toEqual({});
    expect(isQuickAccessEndpointEnabled()).toBe(false);
  });

  it('refuses the WHOLE map when any entry carries a credential-shaped key', () => {
    process.env.QUICK_ACCESS_PIN_MAP = JSON.stringify({
      [PIN]: ACCOUNT,
      '1000': { email: 'other@example.test', password: 'anything-at-all' },
    });
    expect(readQuickAccessPinMap()).toEqual({});
    expect(resolveQuickAccessAccountEmail(PIN)).toBeNull();
  });

  it('drops entries that are not a 4-digit PIN mapped to an address', () => {
    process.env.QUICK_ACCESS_PIN_MAP = JSON.stringify({
      '999': ACCOUNT,
      '12345': ACCOUNT,
      '1111': '',
      '2222': 'not-an-address',
      '3333': 42,
      [PIN]: ACCOUNT,
    });
    expect(readQuickAccessPinMap()).toEqual({ [PIN]: ACCOUNT });
  });
});

describe('quick access production kill switch (server side, not browser hostname)', () => {
  it.each([
    ['APP_ENV', () => (process.env.APP_ENV = 'production')],
    ['RAILWAY_ENVIRONMENT_NAME', () => (process.env.RAILWAY_ENVIRONMENT_NAME = 'production')],
    ['FRONTEND_URL', () => (process.env.FRONTEND_URL = 'https://consultify.ai')],
    ['FRONTEND_URL www', () => (process.env.FRONTEND_URL = 'https://www.consultify.ai')],
    [
      'production database host',
      () => (process.env.DATABASE_URL = 'postgresql://u:p@centerbeam.proxy.test:5432/app'),
    ],
    [
      'verified Railway production runtime',
      () => {
        process.env.RAILWAY_SERVICE_ID = 'svc-1';
        process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
      },
    ],
  ])('%s alone disables the endpoint even with a configured map', (_label, apply) => {
    apply();
    expect(isProductionRuntimeForQuickAccess()).toBe(true);
    expect(isQuickAccessEndpointEnabled()).toBe(false);
    expect(resolveQuickAccessAccountEmail(PIN)).toBeNull();
    expect(() => assertQuickAccessRuntimeEnabled()).toThrow(/refused/i);
  });

  it('does not treat a plain NODE_ENV=production demo/staging box as production', () => {
    // demo and staging run with NODE_ENV=production; that flag must not be the
    // gate or the shortcut would be dead exactly where it is wanted.
    expect(process.env.NODE_ENV).toBe('test');
    expect(isProductionRuntimeForQuickAccess({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(
      false
    );
  });
});

describe('POST /api/auth/quick-access', () => {
  it('mints a session through the ordinary login path for a configured PIN', async () => {
    const res = await request(makeApp()).post('/api/auth/quick-access').send({ pin: PIN });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('access-token');
    expect(loginMock).toHaveBeenCalledTimes(1);

    const [forwardedRequest, , options] = loginMock.mock.calls[0];
    // The principal reaches login as an email and NOTHING else. No password
    // field exists on this path, so none can be logged, echoed or bundled.
    expect(forwardedRequest.body).toEqual({ email: ACCOUNT });
    expect(Object.keys(forwardedRequest.body)).not.toContain('password');
    expect(options).toEqual({ pinVerifiedPrincipal: true });
  });

  it('never echoes the PIN into the audit trail', async () => {
    await request(makeApp()).post('/api/auth/quick-access').send({ pin: PIN });

    expect(auditLogMock).toHaveBeenCalled();
    const serialized = JSON.stringify(auditLogMock.mock.calls);
    expect(serialized).not.toContain(PIN);
    expect(serialized).toContain('auth.quick_access.attempt');
    expect(serialized).toContain('auth.quick_access.result');
  });

  it('refuses an unconfigured PIN with 401 and never reaches login', async () => {
    for (const pin of ['0000', '999', 'abcd', '', undefined]) {
      loginMock.mockClear();
      const res = await request(makeApp())
        .post('/api/auth/quick-access')
        .send(pin === undefined ? {} : { pin });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('QUICK_ACCESS_INVALID_PIN');
      expect(res.body.token).toBeUndefined();
      expect(loginMock).not.toHaveBeenCalled();
    }
  });

  it('refuses every PIN on a production runtime, correct one included', async () => {
    process.env.APP_ENV = 'production';

    for (const pin of [PIN, '0000']) {
      loginMock.mockClear();
      const res = await request(makeApp()).post('/api/auth/quick-access').send({ pin });

      // 404, not 403: production should not confirm the endpoint exists.
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('QUICK_ACCESS_DISABLED');
      expect(res.body.token).toBeUndefined();
      expect(loginMock).not.toHaveBeenCalled();
    }
  });

  it('is disabled when the map is unset, even off production', async () => {
    delete process.env.QUICK_ACCESS_PIN_MAP;
    const res = await request(makeApp()).post('/api/auth/quick-access').send({ pin: PIN });

    expect(res.status).toBe(404);
    expect(loginMock).not.toHaveBeenCalled();
  });
});
