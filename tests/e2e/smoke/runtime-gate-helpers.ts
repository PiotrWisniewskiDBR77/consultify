import { expect, type Page } from '@playwright/test';

import {
  decodeJwtPayload,
  getPrivilegedSessionForPage,
  TEST_SUPPORT_SETUP_HINT,
} from '../_helpers/privilegedSession';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    name: 'E2E User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId: 'e2e-org-id',
    isSuperAdmin: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });

  return `${header}.${payload}.e2e`;
}

/**
 * Seed localStorage from the token itself.
 *
 * Identity fields (id / email / role / isSuperAdmin / organizationId) are read out of the
 * SIGNED token payload — they are never hardcoded to `ADMIN` / `isSuperAdmin: true`. Seeding
 * a role the server did not grant is exactly the failure this suite must expose: the client
 * guards would pass while every API call 403'd.
 */
async function seedE2EAuthToken(page: Page, token: string): Promise<void> {
  const claims = decodeJwtPayload(token);
  const e2eUser = {
    id: String(claims.id || claims.userId || claims.sub || 'e2e-user-id'),
    email: String(claims.email || 'e2e@local.test'),
    role: String(claims.role || ''),
    userRole: String(claims.role || ''),
    isSuperAdmin: claims.isSuperAdmin === true,
    organizationId: String(claims.organizationId || claims.orgId || 'e2e-org-id'),
    organizationName: 'E2E Organization',
    firstName: 'E2E',
    lastName: 'User',
    avatarUrl: null,
    impersonatorId: null,
    companyName: 'E2E Organization',
    isAuthenticated: true,
    accessLevel: 'full',
  };

  await page.addInitScript(
    ({ t, user }) => {
      localStorage.setItem('token', String(t));
      localStorage.setItem('refreshToken', 'e2e-refresh');

      const persisted = {
        state: {
          sessionMode: 'FULL',
          currentUser: user,
          currentOrganization: { id: user.organizationId, name: user.organizationName },
        },
        version: 0,
      };

      localStorage.setItem('consultinity-storage', JSON.stringify(persisted));
      localStorage.setItem('user', JSON.stringify(user));
    },
    { t: token, user: e2eUser }
  );
}

export function isStrictCanvasGate(): boolean {
  return process.env.E2E_STRICT_CANVAS === 'true' || Boolean(process.env.CI);
}

export async function seedE2EAuth(page: Page): Promise<void> {
  await seedE2EAuthToken(page, makeE2EToken());
}

/**
 * Real-session bootstrap for the runtime gate.
 *
 * Tier 1 — test-support bootstrap (the only privileged path).
 * Tier 2 — gateway-only `/api/auth/demo-login` (a real seeded account).
 * Tier 3 — the synthetic E2E_MODE unsigned token, and ONLY outside the strict gate.
 *
 * `register-demo` is deliberately absent: it is the public demo signup — unprivileged
 * (TEAM_MEMBER in the shared demo org) and read-only (403 DEMO_READ_ONLY on writes).
 * Falling back to it produced a session that looked like ADMIN on the client and was
 * refused by the server.
 */
export async function seedE2EAuthWithBootstrap(page: Page): Promise<void> {
  const errors: string[] = [];

  try {
    const session = await getPrivilegedSessionForPage(page, {
      role: 'ADMIN',
      label: 'canvas-ui',
      apiBaseUrl: API_BASE_URL,
    });
    await seedE2EAuthToken(page, session.token);
    return;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const demoLogin = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`, { data: {} });
    if (demoLogin.ok()) {
      const payload = (await demoLogin.json()) as Record<string, unknown>;
      if (typeof payload.token === 'string' && payload.token.trim()) {
        await seedE2EAuthToken(page, payload.token);
        return;
      }
    } else {
      errors.push(
        `auth/demo-login ${demoLogin.status()}: ${await demoLogin.text().catch(() => '<no-body>')}`
      );
    }
  } catch (error) {
    errors.push(
      `auth/demo-login request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // NOTE: the former `register-demo` tier is gone on purpose — see the doc comment above.

  if (isStrictCanvasGate()) {
    throw new Error(
      [
        'Strict Canvas gate: real auth bootstrap is required.',
        TEST_SUPPORT_SETUP_HINT,
        'Alternatively enable the test gateway demo login (`ENABLE_TEST_GATEWAY=true`).',
        ...errors.map((item) => `- ${item}`),
      ].join('\n')
    );
  }

  await seedE2EAuthToken(page, makeE2EToken());
}

export async function dismissTourModal(page: Page) {
  const skipTour = page
    .getByRole('button', { name: /Skip tour|Skip for now|Pomiń/i })
    .first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  // The first-run modal mounts after the route shell on slower production builds.
  // Give it a short bounded window before concluding that there is nothing to dismiss.
  await skipTour.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

  for (let i = 0; i < 12; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1500, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
  }
}

export async function expectAppMounted(page: Page) {
  await dismissTourModal(page);
  await page.waitForFunction(
    () => {
      const root = document.querySelector('#root');
      return Boolean(root && (root.childElementCount > 0 || root.textContent?.trim()));
    },
    null,
    { timeout: 30000 }
  );
  await expect(page.getByRole('status', { name: /Loading|Ładowanie/i })).toHaveCount(0);
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

export async function gotoRuntimeGateRoute(page: Page, path: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }

  throw lastError;
}

function isIgnoredRuntimeGateApiFailure(url: string, statusOrError: string | number): boolean {
  const normalized = String(statusOrError);

  // Teresa voice config is a best-effort peripheral call. It may return 401 in
  // E2E/mock mode without blocking route rendering or chat persistence.
  if (
    (url.includes('/api/v10/teresa/voice-config') || url.includes('/api/v10/teresa/voice-event')) &&
    normalized === '401'
  ) {
    return true;
  }

  // Public Anna shell can run without KB v8/public funnel telemetry in local stacks.
  if (
    url.includes('/api/public/kb-v8/') ||
    url.includes('/api/v8/kb/') ||
    url.includes('/api/kb/') ||
    url.includes('/api/public/anna/funnel-event') ||
    url.endsWith('/api/health')
  ) {
    return true;
  }

  // Browser cancels in-flight API requests during route transitions and reloads.
  // These are not backend failures and should not fail a route/persistence gate.
  return normalized.includes('net::ERR_ABORTED');
}

export function collectRuntimeGateIssues(page: Page) {
  const pageErrors: string[] = [];
  const apiFailures: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    const isApi = url.includes('/api/');
    const isBlockingStatus = status === 401 || status === 403 || status >= 500;
    if (isApi && isBlockingStatus && !isIgnoredRuntimeGateApiFailure(url, status)) {
      apiFailures.push(`${status} ${url}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || '';
    if (url.includes('/api/') && !isIgnoredRuntimeGateApiFailure(url, errorText)) {
      apiFailures.push(`REQUEST_FAILED ${url} ${errorText}`.trim());
    }
  });

  return { pageErrors, apiFailures };
}

export function expectNoRuntimeGateIssues(issues: { pageErrors: string[]; apiFailures: string[] }) {
  expect(issues.pageErrors, `Browser page errors:\n${issues.pageErrors.join('\n')}`).toEqual([]);
  expect(issues.apiFailures, `Blocking API failures:\n${issues.apiFailures.join('\n')}`).toEqual(
    []
  );
}
