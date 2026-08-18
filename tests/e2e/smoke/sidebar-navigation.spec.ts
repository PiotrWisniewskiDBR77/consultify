/**
 * L4 Smoke — sidebar navigation (UI)
 *
 * Goal: catch broken routing / navigation regressions that would block public deploy.
 * Keep assertions intentionally light to avoid brittle selectors.
 */

import { expect, Page, test } from '@playwright/test';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Skip for now|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  // The onboarding dialog is mounted asynchronously after the route shell.
  // Give it a short chance to appear before deciding there is nothing to close.
  await welcomeTitle.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});

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

test.describe('L4 Smoke — sidebar navigation [@module:navigation]', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await dismissTourModal(page);
    await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  });

  function navItem(page: Page, name: RegExp) {
    return page.getByRole('button', { name }).or(page.getByRole('link', { name })).first();
  }

  test('sidebar shows key items', async ({ page }) => {
    const items = [
      /Chat/i,
      /My Work/i,
      /Interview/i,
      /Tools/i,
      /Initiatives/i,
      /Execution/i,
      /Results|Benefits/i,
      /Finance|Economics/i,
      /Materials|Materiały/i,
      /Settings/i,
    ];

    for (const re of items) {
      await expect(navItem(page, re)).toBeVisible({ timeout: 30000 });
    }
  });

  test('navigates to Chat', async ({ page }) => {
    await navItem(page, /Chat/i).click();
    await expect(page).toHaveURL(/\/chat/);
    await expectNoRouteError(page);
  });

  test('navigates to My Work', async ({ page }) => {
    await navItem(page, /My Work/i).click();
    await expect(page).toHaveURL(/\/my-work/);
    await expectNoRouteError(page);
  });

  test('navigates to Interview (/discovery)', async ({ page }) => {
    await navItem(page, /Interview/i).click();
    await expect(page).toHaveURL(/\/discovery/);
    await expectNoRouteError(page);
  });

  test('navigates to Tools', async ({ page }) => {
    const tools = navItem(page, /Tools/i);
    if (await tools.isVisible().catch(() => false)) {
      await tools.click();
    } else {
      await page.goto('/discovery-tools');
    }
    await expect(page).toHaveURL(/\/discovery-tools/);
    await expectNoRouteError(page);
  });

  test('navigates to Assessment (overview)', async ({ page }) => {
    await page.goto('/assessment');
    await expect(page).toHaveURL(/\/assessment(?:\/overview)?/);
    await expectNoRouteError(page);
  });

  test('navigates to Initiatives (/initiatives)', async ({ page }) => {
    await navItem(page, /Initiatives/i).click();
    await expect(page).toHaveURL(/\/initiatives/);
    await expectNoRouteError(page);
  });

  test('navigates to Execution (/execution)', async ({ page }) => {
    await navItem(page, /Execution/i).click();
    await expect(page).toHaveURL(/\/execution/);
    await expectNoRouteError(page);
  });

  test('navigates to canonical Results', async ({ page }) => {
    await navItem(page, /Results|Benefits/i).click();
    await expect(page).toHaveURL(/\/results/);
    await expectNoRouteError(page);
  });

  test('navigates to Economics', async ({ page }) => {
    await navItem(page, /Finance|Economics/i).click();
    // Canonical route is /finance, legacy alias /economics may exist.
    await expect(page).toHaveURL(/\/(finance|economics)/);
    await expectNoRouteError(page);
  });
});
