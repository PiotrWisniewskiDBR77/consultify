/**
 * L4 Smoke — route render checks (UI)
 *
 * Goal: ensure core routes mount without route-level error boundary.
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

test.describe('L4 Smoke — routes render', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await demoLogin(page);
  });

  test('renders Reports builder', async ({ page }) => {
    await page.goto('/reports/builder');
    await expectRouteMounted(page);
  });

  test('renders Initiatives list', async ({ page }) => {
    await page.goto('/initiatives');
    await expectRouteMounted(page);
  });

  test('renders Portfolio (roadmap hub)', async ({ page }) => {
    await page.goto('/portfolio');
    await expectRouteMounted(page);
  });

  test('renders Roadmap', async ({ page }) => {
    await page.goto('/roadmap');
    await expectRouteMounted(page);
  });

  test('renders ROI', async ({ page }) => {
    await page.goto('/roi');
    await expectRouteMounted(page);
  });

  test('renders Execution (implementation)', async ({ page }) => {
    await page.goto('/implementation');
    await expectRouteMounted(page);
  });

  test('renders Benefits', async ({ page }) => {
    await page.goto('/benefits');
    await expectRouteMounted(page);
  });

  test('renders Economics', async ({ page }) => {
    await page.goto('/economics');
    await expectRouteMounted(page);
  });

  test('renders Settings root', async ({ page }) => {
    await page.goto('/settings');
    await expectRouteMounted(page);
  });

  test('renders Settings > Security', async ({ page }) => {
    await page.goto('/settings/security');
    await expectRouteMounted(page);
  });
});

