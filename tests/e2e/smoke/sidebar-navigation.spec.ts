/**
 * L4 Smoke — sidebar navigation (UI)
 *
 * Goal: catch broken routing / navigation regressions that would block public deploy.
 * Keep assertions intentionally light to avoid brittle selectors.
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

async function expectNoRouteError(page: Page) {
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

test.describe('L4 Smoke — sidebar navigation', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await dismissTourModal(page);
    await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
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
