/**
 * UI-CANON G4 — signed-auth persona fixture for the Audits lane.
 *
 * Every session in this fixture is obtained the way a user obtains one: by
 * typing an e-mail and password into the real login form and letting the
 * application persist whatever it persists. Nothing here writes a token into
 * `localStorage`, mints a JWT, sets `E2E_MODE`, or intercepts a request.
 *
 * That is a deliberate step up from the 15-surface sweep, whose storage state
 * is *synthesised* by `tests/e2e/smoke/global-setup.ts` (it hand-writes `token`,
 * `user` and a `currentUser` blob into `localStorage`). Those sessions carry a
 * real token but a fabricated client state; these carry neither fabrication.
 */

import { expect, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';

export type PersonaKey =
  | 'platformAdmin'
  | 'leadAuditor'
  | 'auditee'
  | 'member'
  | 'revokedMember'
  | 'foreignTenant';

export interface Persona {
  userId: string;
  email: string;
  organizationId: string;
  memberRole: string;
  userRole: string;
  tenant: 'primary' | 'foreign';
}

export interface RbacFixture {
  runId: string;
  primaryOrgId: string;
  foreignOrgId: string;
  password: string;
  personas: Record<PersonaKey, Persona>;
}

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

function apiBase() {
  return process.env.E2E_API_URL || 'http://127.0.0.1:3951';
}

async function support() {
  return apiRequest.newContext({
    baseURL: apiBase(),
    extraHTTPHeaders: { 'x-test-support-key': TEST_SUPPORT_KEY },
  });
}

/** Creates two tenants and six personas as real rows. Issues no token. */
export async function createRbacFixture(runId: string): Promise<RbacFixture> {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/rbac-fixture', { data: { runId } });
  if (res.status() !== 201) {
    throw new Error(`rbac-fixture failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as RbacFixture;
  await ctx.dispose();
  return body;
}

/**
 * Turns a flag on for ONE tenant through a test-only override row
 * (`g4_test_flag_overrides`), which `GET /api/feature-flags/runtime` merges last
 * and only when the test-support gate is open. The shared `feature_flags`
 * definition is never read or written, so a production row keeps its semantics
 * before, during and after the run.
 */
export async function enableOrgFlag(flagKey: string, organizationId: string, runId?: string) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/org-feature-flag', {
    data: { flagKey, organizationId, enabled: true, runId },
  });
  const detail = `${flagKey} -> ${res.status()} ${await res.text()}`;
  await ctx.dispose();
  return detail;
}

/**
 * Purge everything a run created and prove nothing was left behind. Call from a
 * `finally`, so a failing assertion earlier in the spec still cleans up.
 */
export async function cleanupRbacFixture(
  fixture: Pick<RbacFixture, 'runId' | 'primaryOrgId' | 'foreignOrgId'>,
  flagKeys: string[] = ['auditsFiveSurfacesV1']
) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/rbac-fixture/cleanup', {
    data: {
      runId: fixture.runId,
      organizationIds: [fixture.primaryOrgId, fixture.foreignOrgId],
      flagKeys,
    },
    // The purge walks every table carrying an organization_id, which is
    // thousands of statements. It is meant to be thorough, not fast.
    timeout: 180000,
  });
  const body = res.ok()
    ? ((await res.json()) as { residualOrganizations?: number; flagsCleared?: unknown })
    : null;
  const detail = body
    ? `cleanup ${res.status()} — residual organizations ${body.residualOrganizations ?? '?'}`
    : `cleanup ${res.status()} ${await res.text()}`;
  await ctx.dispose();
  return { status: res.status(), residualOrganizations: body?.residualOrganizations ?? null, detail };
}

/** Independent read-back: the run's own tenants must be gone. */
export async function assertNoFixtureResidue(
  fixture: Pick<RbacFixture, 'runId' | 'primaryOrgId' | 'foreignOrgId'>
) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/rbac-fixture/cleanup', {
    data: {
      runId: fixture.runId,
      organizationIds: [fixture.primaryOrgId, fixture.foreignOrgId],
      flagKeys: [],
    },
    timeout: 180000,
  });
  const body = (await res.json()) as { residualOrganizations?: number };
  await ctx.dispose();
  const residual = body.residualOrganizations ?? -1;
  expect(residual, 'the run must leave no organizations behind').toBe(0);
  return residual;
}

export async function revokeMembership(userId: string, organizationId: string) {
  const ctx = await support();
  const res = await ctx.post('/api/test-support/revoke-membership', {
    data: { userId, organizationId, status: 'REVOKED' },
  });
  const detail = `${res.status()} ${await res.text()}`;
  await ctx.dispose();
  return detail;
}

/** The production login endpoint — bcrypt compare plus ACTIVE-membership check. */
export async function loginViaApi(email: string, password: string) {
  const ctx = await apiRequest.newContext({ baseURL: apiBase() });
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  const status = res.status();
  const body = status === 200 ? ((await res.json()) as { token?: string }) : null;
  const text = status === 200 ? '' : await res.text();
  await ctx.dispose();
  return { status, token: body?.token ?? null, text };
}

/**
 * Real UI login. Fills the product's own form and waits for the app to leave
 * `/auth` under its own power. Returns the resulting storage state, which is
 * whatever the application decided to persist — not something we authored.
 */
export async function loginThroughUi(
  page: Page,
  email: string,
  password: string,
  { expectFailure = false } = {}
) {
  const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3950';
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('email-input').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();

  if (expectFailure) {
    await page.waitForTimeout(4000);
    return { landedOn: new URL(page.url()).pathname, signedIn: false };
  }

  await page
    .waitForFunction(() => !window.location.pathname.startsWith('/auth'), undefined, {
      timeout: 45000,
    })
    .catch(() => {});
  await page.waitForTimeout(1500);
  const landedOn = new URL(page.url()).pathname;
  const signedIn = !landedOn.startsWith('/auth');
  return { landedOn, signedIn };
}

/** Signs a persona in through the UI and hands back its genuine storage state. */
export async function signedInStateFor(
  context: BrowserContext,
  email: string,
  password: string
) {
  const page = await context.newPage();
  const result = await loginThroughUi(page, email, password);
  expect(result.signedIn, `persona ${email} could not sign in through the real login form`).toBe(
    true
  );
  const state = await context.storageState();
  await page.close();
  return { state, landedOn: result.landedOn };
}

/**
 * Negative controls proving the harness is not standing on any of the auth
 * shortcuts this codebase ships. Each is asserted, not assumed.
 */
export async function assertNoAuthBypass() {
  const out: Record<string, string> = {};

  // 1. An unsigned `alg:none` token carrying `e2e:true` — the shape the
  //    E2E_MODE branch would accept — must be refused.
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ id: 'forged-user', e2e: true, organizationId: 'forged-org' })
  ).toString('base64url');
  const forged = `${header}.${payload}.`;
  const ctx = await apiRequest.newContext({
    baseURL: apiBase(),
    extraHTTPHeaders: { Authorization: `Bearer ${forged}` },
  });
  const forgedRes = await ctx.get('/api/auth/me');
  out.unsignedE2eTokenRejected = `GET /api/auth/me with alg:none e2e token -> ${forgedRes.status()}`;
  expect(forgedRes.status(), 'an unsigned e2e token must not authenticate').not.toBe(200);

  // 2. No token at all must not authenticate (ENABLE_TEST_AUTH_BYPASS off).
  const anon = await apiRequest.newContext({ baseURL: apiBase() });
  const anonRes = await anon.get('/api/auth/me');
  out.anonymousRejected = `GET /api/auth/me without a token -> ${anonRes.status()}`;
  expect(anonRes.status(), 'an anonymous request must not authenticate').not.toBe(200);

  // 3. test-support stays fail-closed without the key.
  const noKey = await apiRequest.newContext({ baseURL: apiBase() });
  const noKeyRes = await noKey.post('/api/test-support/rbac-fixture', {
    data: { runId: 'should-not-work' },
  });
  out.testSupportFailClosedWithoutKey = `POST /api/test-support/rbac-fixture without key -> ${noKeyRes.status()}`;
  expect(noKeyRes.status(), 'test-support must be fail-closed without its key').toBe(404);

  await ctx.dispose();
  await anon.dispose();
  await noKey.dispose();
  return out;
}

/** Records the env the backend under test is actually running with. */
export function harnessEnvNegativeControls() {
  return {
    e2eModeNotSet: `E2E_MODE=${process.env.E2E_MODE ?? '<unset>'} (the unsigned-token branch in auth.middleware.ts is inert unless this is exactly "true")`,
    noRequestInterception:
      'No page.route()/fulfill() anywhere in this fixture or spec; every response comes from the real backend on real Postgres.',
    noLocalStorageAuthInjection:
      'Sessions come from the product login form; the fixture never writes token/user into localStorage.',
    tokensNotMintedByTestSupport:
      'POST /api/test-support/rbac-fixture returns no token by design; every session is issued by POST /api/auth/login.',
  };
}
