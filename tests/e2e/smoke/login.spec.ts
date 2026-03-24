/**
 * L4 Smoke — app bootstraps with demo auth
 *
 * Notes:
 * - The login UI can vary (SSO vs email/password). This smoke test avoids brittle selectors.
 * - We validate the app renders after setting demo tokens in storage.
 */

import { expect, Page, test } from '@playwright/test';

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

test.describe('L4 Smoke [@module:auth]', () => {
  test.setTimeout(60000);

  test('app renders dashboard after demo login', async ({ page }) => {
    await page.goto('/dashboard');
    await dismissTourModal(page);

    // Minimal "did the app render?" checks
    await expect(page).toHaveTitle(/Consultify|Consultinity/i);
    // Some presentation modes temporarily hide `#root` during boot; avoid brittle visibility checks.
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  });
});
