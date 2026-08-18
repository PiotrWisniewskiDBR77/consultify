import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('OAuth routes status (admin UI contract)', () => {
  const basePath = '/api/auth';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    router = (await import('../../../server/src/routes/oauthRoutes.routes.ts')).default;
  });

  it('GET /api/auth/oauth/status returns configured flags + loginUrl', async () => {
    const res = await request(makeApp()).get(`${basePath}/oauth/status`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('microsoft');
    expect(res.body).toHaveProperty('linkedin');
    expect(typeof res.body.google.configured).toBe('boolean');
    expect(typeof res.body.google.loginUrl).toBe('string');
  });
});

// SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002 — external OAuth is
// excluded from MVP until a provider is explicitly approved through
// OAUTH_APPROVED_PROVIDER_REGISTRY (see server/src/services/oauthService.ts
// getApprovedOAuthProviderDecision, consumed by getGoogleConfig/getLinkedInConfig
// at server/src/services/oauthService.ts:133-160, which back both
// oauthService.getProviderStatus() — GET /api/auth/oauth/status — and
// oauthService.generateAuthUrl() — GET /api/auth/google, GET /api/auth/linkedin,
// server/src/routes/oauthRoutes.routes.ts:41-72/198-222). Each test below
// re-imports the router after mutating env because Config.ts (server/src/config/Config.ts)
// snapshots process.env once at module load — a stale cached router would not
// observe the env change and would silently pass on the wrong config.
describe('OAuth routes fail closed without registry approval (SET-MVP-OAUTH-001)', () => {
  const basePath = '/api/auth';
  const savedEnv = { ...process.env };

  // A value distinctive enough that its presence in a JSON body can only mean
  // the secret itself leaked — not a coincidental substring of some other field.
  const PLANTED_GOOGLE_SECRET = 'PLANTED-GOOGLE-SECRET-9f3a1c7d';
  const PLANTED_LINKEDIN_SECRET = 'PLANTED-LINKEDIN-SECRET-2b77e045';
  const PLANTED_GOOGLE_CLIENT_ID = 'planted-google-client-id-4e21';
  const PLANTED_LINKEDIN_CLIENT_ID = 'planted-linkedin-client-id-90aa';

  const importFreshRouter = async () => {
    vi.resetModules();
    return (await import('../../../server/src/routes/oauthRoutes.routes.ts')).default;
  };

  const makeApp = (router: any) =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    // Credentials ARE present so a failure here can only be attributed to the
    // missing registry decision, not to missing client id/secret — proving
    // "credentials alone do not activate OAuth" per the AMD, on the route
    // surface rather than the service unit tested in integration-oauth-approval.test.ts.
    process.env.GOOGLE_CLIENT_ID = PLANTED_GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = PLANTED_GOOGLE_SECRET;
    process.env.LINKEDIN_CLIENT_ID = PLANTED_LINKEDIN_CLIENT_ID;
    process.env.LINKEDIN_CLIENT_SECRET = PLANTED_LINKEDIN_SECRET;
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  });

  afterEach(() => {
    // Restores the exact snapshot taken before this describe block ran, so a
    // leaked env mutation here can never leak approval state into another
    // file's tests (the registry env var is process-global).
    process.env = { ...savedEnv };
  });

  it('keeps GET /api/auth/oauth/status working and reports every provider as unavailable/not-approved', async () => {
    const router = await importFreshRouter();
    const res = await request(makeApp(router)).get(`${basePath}/oauth/status`);

    // The read path itself must not break just because nothing is approved —
    // this is what distinguishes "fail closed" from "fail broken".
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      google: { configured: false, approved: false, loginUrl: '' },
      microsoft: { configured: false, approved: false, loginUrl: '' },
      linkedin: { configured: false, approved: false, loginUrl: '' },
    });
  });

  it('never echoes a planted client secret in the status response, with the registry unset', async () => {
    const router = await importFreshRouter();
    const res = await request(makeApp(router)).get(`${basePath}/oauth/status`);
    expect(res.status).toBe(200);

    const serialized = JSON.stringify(res.body);
    // Assert against an actual planted value, not a regex hope: if
    // getProviderStatus() ever regresses to spread cfg.clientSecret into the
    // response, this fails on the real secret string, not on a pattern guess.
    expect(serialized).not.toContain(PLANTED_GOOGLE_SECRET);
    expect(serialized).not.toContain(PLANTED_LINKEDIN_SECRET);
    expect(serialized).not.toContain(PLANTED_GOOGLE_CLIENT_ID);
    expect(serialized).not.toContain(PLANTED_LINKEDIN_CLIENT_ID);
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
  });

  it('still withholds secrets from the status response once one provider is approved', async () => {
    // The no-leak guarantee must hold in the APPROVED branch too, not only
    // the trivially-empty unapproved branch — getGoogleConfig() (Config.ts-backed)
    // starts returning a real config object once approved (oauthService.ts:133-143),
    // so this is the first point where a careless `...cfg` spread could leak clientSecret.
    const RESIDENCY_MARKER = 'EU-PLANTED-RESIDENCY-7c2f';
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      google: { approved: true, scopes: ['openid', 'email', 'profile'], residency: RESIDENCY_MARKER },
    });
    const router = await importFreshRouter();
    const res = await request(makeApp(router)).get(`${basePath}/oauth/status`);
    expect(res.status).toBe(200);
    expect(res.body.google).toEqual(
      expect.objectContaining({ configured: true, approved: true, residency: RESIDENCY_MARKER })
    );

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(PLANTED_GOOGLE_SECRET);
    expect(serialized).not.toContain(PLANTED_LINKEDIN_SECRET);
    expect(serialized).not.toContain(process.env.GOOGLE_CLIENT_ID as string);
  });

  it('GET /api/auth/google does not emit a Google consent URL with the registry unset', async () => {
    const router = await importFreshRouter();
    const res = await request(makeApp(router)).get(`${basePath}/google`);

    // oauthRoutes.routes.ts:52-72: no result from generateAuthUrl() ->
    // redirect to *_not_configured, never res.redirect(result.url).
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.location).toContain('auth_error=google_not_configured');
    expect(res.headers.location).not.toContain('accounts.google.com');
  });

  it('GET /api/auth/linkedin does not emit a LinkedIn consent URL with the registry unset', async () => {
    const router = await importFreshRouter();
    const res = await request(makeApp(router)).get(`${basePath}/linkedin`);

    // oauthRoutes.routes.ts:197-217: same not-configured redirect contract as Google.
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.location).toContain('auth_error=linkedin_not_configured');
    expect(res.headers.location).not.toContain('www.linkedin.com');
  });
});

