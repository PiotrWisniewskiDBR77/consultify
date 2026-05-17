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

test.describe('L4 Smoke — V10 runtime workspace [@module:v10]', () => {
  test.setTimeout(90000);

  test('renders the dedicated V10 host route with rollout and 8-block workspace chrome', async ({ page }) => {
    await page.goto('/internal/v10-runtime');
    await dismissTourModal(page);

    await expect(page.locator('[data-testid="v10-runtime-entrypoint"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="v10-runtime-smoke-surface"]')).toBeVisible();
    await expect(page.locator('[data-testid="v10-runtime-rollout-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="v10-runtime-filterbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="v10-runtime-toolbar"]')).toBeVisible();
    await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);

    const blockTitles = [
      'Artifact Pipeline',
      'Agent Runtime',
      'Onboarding Runtime',
      'Reasoning Runtime',
      'Learning Runtime',
      'Learning Loop',
      'Research Runtime',
      'Connectors Runtime',
      'Outcome Runtime',
    ];

    for (const title of blockTitles) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }

    await page.getByRole('button', { name: /Issues \(/i }).click();
    await expect(page).toHaveURL(/v10Filter=issues/);

    await page.getByRole('button', { name: /Show flags/i }).click();
    await expect(page.getByText(/ff\./i).first()).toBeVisible();
  });
});
