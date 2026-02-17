/**
 * L4 Smoke — settings & module routes render (UI)
 *
 * Goal: ensure key routes mount without route-level error boundary.
 * Assertions are intentionally minimal (render + no error boundary).
 */

import { expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function dismissTourModal(page: Page) {
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

async function demoLogin(page: Page): Promise<void> {
  const response = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`);
  if (!response.ok()) {
    const bodyText = await response.text().catch(() => '<unreadable>');
    throw new Error(`Demo login failed: ${response.status()} ${response.statusText()} ${bodyText}`);
  }
  const data = await response.json();

  await page.addInitScript(
    ({ token, refreshToken }) => {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('isDemo', 'true');

      try {
        localStorage.setItem(
          'consultinity_demo_session',
          JSON.stringify({
            sessionId: 'e2e',
            startTime: new Date().toISOString(),
            hasCompletedTour: true,
            hasSeenWelcome: true,
            hasInteractedWithAI: false,
            aiInteractionsUsed: 0,
            featuresExplored: [],
            upgradePromptsShown: 0,
            exitIntentTriggered: false,
            milestones: [],
          })
        );
      } catch {
        // ignore
      }
    },
    { token: data.token, refreshToken: data.refreshToken }
  );
}

async function expectRouteMounted(page: Page) {
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

const ROUTE_CASES: Array<{ name: string; path: string }> = [
  { name: 'Settings > Profile', path: '/settings/profile' },
  { name: 'Settings > Billing', path: '/settings/billing' },
  { name: 'Settings > AI', path: '/settings/ai' },
  { name: 'Settings > Notifications', path: '/settings/notifications' },
  { name: 'Settings > Integrations', path: '/settings/integrations' },
  { name: 'Settings > Organization', path: '/settings/organization' },

  { name: 'Organization > Profile', path: '/organization/profile' },
  { name: 'Organization > Goals', path: '/organization/goals' },
  { name: 'Organization > Challenges', path: '/organization/challenges' },
  { name: 'Organization > Megatrends', path: '/organization/megatrends' },
  { name: 'Organization > Strategy', path: '/organization/strategy' },

  { name: 'Context > Profile', path: '/context/profile' },
  { name: 'Context > Goals', path: '/context/goals' },
  { name: 'Context > Challenges', path: '/context/challenges' },
  { name: 'Context > Megatrends', path: '/context/megatrends' },
  { name: 'Context > Strategy', path: '/context/strategy' },

  { name: 'Status', path: '/status' },
  { name: 'Changelog', path: '/changelog' },
  { name: 'Legal > Privacy', path: '/privacy' },
  { name: 'Legal > Terms', path: '/terms' },
];

test.describe('L4 Smoke — settings & modules render', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await demoLogin(page);
  });

  for (const { name, path } of ROUTE_CASES) {
    test(`renders ${name}`, async ({ page }) => {
      await page.goto(path);
      await expectRouteMounted(page);
    });
  }
});

