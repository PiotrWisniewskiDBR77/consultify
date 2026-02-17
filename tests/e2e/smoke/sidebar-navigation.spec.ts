/**
 * L4 Smoke — sidebar navigation (UI)
 *
 * Goal: catch broken routing / navigation regressions that would block public deploy.
 * Keep assertions intentionally light to avoid brittle selectors.
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

      // Make demo deterministic: suppress welcome tour / overlays (DemoSessionManager).
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

  await page.goto('/chat');
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
}

async function expectNoRouteError(page: Page) {
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

test.describe('L4 Smoke — sidebar navigation', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await demoLogin(page);
  });

  test('sidebar shows key items', async ({ page }) => {
    const items = [
      /Chat/i,
      /My Work/i,
      /Interview/i,
      /Tools/i,
      /Assessment/i,
      /Initiatives/i,
      /Execution/i,
      /Benefits/i,
      /Economics/i,
      /Reports/i,
      /Settings/i,
    ];

    for (const re of items) {
      await expect(page.getByRole('button', { name: re }).first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('navigates to Chat', async ({ page }) => {
    await page.getByRole('button', { name: /Chat/i }).first().click();
    await expect(page).toHaveURL(/\/chat/);
    await expectNoRouteError(page);
  });

  test('navigates to My Work', async ({ page }) => {
    await page.getByRole('button', { name: /My Work/i }).first().click();
    await expect(page).toHaveURL(/\/my-work/);
    await expectNoRouteError(page);
  });

  test('navigates to Interview (/discovery)', async ({ page }) => {
    await page.getByRole('button', { name: /Interview/i }).first().click();
    await expect(page).toHaveURL(/\/discovery/);
    await expectNoRouteError(page);
  });

  test('navigates to Tools', async ({ page }) => {
    await page.getByRole('button', { name: /Tools/i }).first().click();
    await expect(page).toHaveURL(/\/discovery-tools/);
    await expectNoRouteError(page);
  });

  test('navigates to Assessment (overview)', async ({ page }) => {
    await page.getByRole('button', { name: /Assessment/i }).first().click();
    await expect(page).toHaveURL(/\/assessment\/overview/);
    await expectNoRouteError(page);
  });

  test('navigates to Initiatives (portfolio)', async ({ page }) => {
    await page.getByRole('button', { name: /Initiatives/i }).first().click();
    await expect(page).toHaveURL(/\/portfolio/);
    await expectNoRouteError(page);
  });

  test('navigates to Execution (implementation)', async ({ page }) => {
    await page.getByRole('button', { name: /Execution/i }).first().click();
    await expect(page).toHaveURL(/\/implementation/);
    await expectNoRouteError(page);
  });

  test('navigates to Benefits', async ({ page }) => {
    await page.getByRole('button', { name: /Benefits/i }).first().click();
    await expect(page).toHaveURL(/\/benefits/);
    await expectNoRouteError(page);
  });

  test('navigates to Economics', async ({ page }) => {
    await page.getByRole('button', { name: /Economics/i }).first().click();
    await expect(page).toHaveURL(/\/economics/);
    await expectNoRouteError(page);
  });
});

