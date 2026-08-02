/**
 * L4 Smoke — route render checks (UI)
 *
 * Goal: ensure core routes mount without route-level error boundary.
 * Assertions are intentionally minimal (render + no error boundary).
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

async function expectRouteMounted(page: Page) {
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

test.describe('L4 Smoke — routes render [@module:routing]', () => {
  test.setTimeout(90000);

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

  test('redirects legacy Benefits and renders canonical Results', async ({ page }) => {
    await page.goto('/benefits');
    await expect(page).toHaveURL(/\/results/);
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
