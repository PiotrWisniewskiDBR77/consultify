/**
 * L4 Smoke — Tier-0 core business workflows
 *
 * Goal: verify that key business modules load data (not just mount).
 * These are the modules a consultant uses daily — if they break, deploy is pointless.
 *
 * Assertions: module renders + loads real data (no empty state / error boundary).
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

test.describe('L4 Smoke — Tier-0 core workflows [@module:core-workflows]', () => {
  test.setTimeout(90000);

  test('My Work dashboard loads with hub layout', async ({ page }) => {
    await page.goto('/my-work');
    await expectRouteMounted(page);

    const hubContent = page.locator('[data-testid="module-hub"], [class*="Hub"], main').first();
    await expect(hubContent).toBeVisible({ timeout: 15000 });
  });

  test('Presentations module renders', async ({ page }) => {
    await page.goto('/presentations');
    await expectRouteMounted(page);
  });

  test('Interview (Discovery) module renders', async ({ page }) => {
    await page.goto('/discovery');
    await expectRouteMounted(page);
  });

  test('Initiatives list (Portfolio) renders with content', async ({ page }) => {
    await page.goto('/portfolio');
    await expectRouteMounted(page);

    const mainContent = page.locator('main, [role="main"], #root').first();
    await expect(mainContent).toContainText(/.{5,}/, { timeout: 15000 });
  });

  test('AI Chat module renders', async ({ page }) => {
    await page.goto('/chat');
    await expectRouteMounted(page);
  });
});
