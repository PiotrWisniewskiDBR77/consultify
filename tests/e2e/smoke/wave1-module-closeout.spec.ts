import { expect, Page, test } from '@playwright/test';

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

async function seedAuth(page: Page): Promise<void> {
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

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń|Pomín/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 10; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1000, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;

    await page.waitForTimeout(200);
  }
}

async function expectRouteMounted(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
}

test.describe('Wave 1 module closeout smoke', () => {
  test.setTimeout(120000);

  test('public Anna preserves external identity and CTA authority', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const openButton = page
      .getByRole('button', { name: /Ask Anna first|Zapytaj Anne najpierw|Zapytaj Annę najpierw/i })
      .first();
    await expect(openButton).toBeVisible({ timeout: 30000 });
    await openButton.click();

    await expect(
      page.getByText(/Guided product entry assistant|Asystentka wejścia produktowego/i)
    ).toBeVisible();
    await expect(
      page.getByText(/do not have access to client or project data|Nie mam dostepu do danych klienta/i)
    ).toBeVisible();

    const widgetTrial = page.getByRole('button', { name: /Start trial|Rozpocznij trial/i }).last();
    const widgetDemo = page.getByRole('button', { name: /Watch demo|Zobacz demo/i }).last();
    const widgetContact = page.getByRole('button', { name: /Contact|Kontakt/i }).last();

    await expect(widgetTrial).toBeVisible();
    await expect(widgetDemo).toBeVisible();
    await expect(widgetContact).toBeVisible();
  });

  test('internal Teresa stays the in-app assistant contract', async ({ page }) => {
    await seedAuth(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/^Teresa$/)).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('textarea[placeholder*="Teresa"], textarea[data-testid="chat-input"]').first()
    ).toBeVisible();
    await expect(page.getByText(/^Anna$/)).toHaveCount(0);
  });

  const protectedRoutes: Array<{ path: string; expectedUrl?: string }> = [
    { path: '/my-work' },
    { path: '/interview' },
    { path: '/assessment/overview' },
    { path: '/initiatives' },
    { path: '/execution' },
    { path: '/kpi-okr', expectedUrl: '/results' },
    { path: '/benefits', expectedUrl: '/results' },
    { path: '/finance' },
    { path: '/settings/integrations', expectedUrl: '/settings/connected-apps' },
    { path: '/docs' },
    { path: '/partner' },
  ];

  for (const { path, expectedUrl } of protectedRoutes) {
    test(`mounts ${path} without route boundary failure`, async ({ page }) => {
      await seedAuth(page);
      await expectRouteMounted(page, path);
      const finalPath = expectedUrl || path;
      await expect(page).toHaveURL(new RegExp(finalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }

  test('legacy Results aliases preserve query and hash on the canonical route', async ({ page }) => {
    await seedAuth(page);
    await page.goto('/benefits?tab=results_kpi&mode=scorecards&initiativeId=i-1#owner', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).toHaveURL(
      /\/results\?tab=results_kpi&mode=scorecards&initiativeId=i-1#owner$/
    );
    await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
  });
});
