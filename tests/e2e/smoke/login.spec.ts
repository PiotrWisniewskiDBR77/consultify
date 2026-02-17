/**
 * L4 Smoke — app bootstraps with demo auth
 *
 * Notes:
 * - The login UI can vary (SSO vs email/password). This smoke test avoids brittle selectors.
 * - We validate the app renders after setting demo tokens in storage.
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
}

test.describe('L4 Smoke', () => {
  test.setTimeout(60000);

  test('app renders dashboard after demo login', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/dashboard');
    await dismissTourModal(page);

    // Minimal "did the app render?" checks
    await expect(page).toHaveTitle(/Consultinity/i);
    // Some presentation modes temporarily hide `#root` during boot; avoid brittle visibility checks.
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  });
});
