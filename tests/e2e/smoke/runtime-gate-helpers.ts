import { expect, type Page } from '@playwright/test';

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

export async function seedE2EAuth(page: Page): Promise<void> {
  const token = makeE2EToken();

  await page.addInitScript((t: string) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refreshToken', 'e2e-refresh');

    const e2eUser = {
      id: 'e2e-user-id',
      email: 'e2e@local.test',
      role: 'ADMIN',
      organizationId: 'e2e-org-id',
      organizationName: 'E2E Organization',
      firstName: 'E2E',
      lastName: 'User',
      avatarUrl: null,
      impersonatorId: null,
      companyName: 'E2E Organization',
      isAuthenticated: true,
      accessLevel: 'full',
    };

    const persisted = {
      state: {
        sessionMode: 'FULL',
        currentUser: e2eUser,
        currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
      },
      version: 0,
    };

    localStorage.setItem('consultinity-storage', JSON.stringify(persisted));
    localStorage.setItem('user', JSON.stringify(e2eUser));
  }, token);
}

export async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

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
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
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
    (url.includes('/api/v10/teresa/voice-config') ||
      url.includes('/api/v10/teresa/voice-event')) &&
    normalized === '401'
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

export function expectNoRuntimeGateIssues(issues: {
  pageErrors: string[];
  apiFailures: string[];
}) {
  expect(issues.pageErrors, `Browser page errors:\n${issues.pageErrors.join('\n')}`).toEqual([]);
  expect(issues.apiFailures, `Blocking API failures:\n${issues.apiFailures.join('\n')}`).toEqual(
    []
  );
}
