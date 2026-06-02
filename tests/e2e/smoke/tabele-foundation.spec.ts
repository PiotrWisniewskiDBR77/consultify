/**
 * L5 Smoke — Tabele foundation lane.
 *
 * These checks stay intentionally light: they verify route mounting and the
 * visible split-screen entry points without relying on backend table data.
 */
import { expect, Page, test } from '@playwright/test';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 12; i += 1) {
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

async function expectMounted(page: Page) {
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
}

async function gotoTabele(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

test.describe('L5 Smoke — Tabele foundation lane', () => {
  test.setTimeout(90000);

  test('renders Tabele module home', async ({ page }) => {
    await gotoTabele(page, '/tabele');
    await expectMounted(page);
    await expect(page.getByRole('heading', { name: /Table Studio|Tabele Studio/i })).toBeVisible();
  });

  test('renders Tabele split-screen entry', async ({ page }) => {
    await gotoTabele(page, '/tabele?view=new');
    await expectMounted(page);
    await expect(page.getByText(/Table Studio|Tabele/i).first()).toBeVisible();
  });

  test('accepts a template prompt deep link', async ({ page }) => {
    await gotoTabele(page, '/tabele?view=new&templatePrompt=Create%20vendor%20master');
    await expectMounted(page);
    await expect(page.locator('#root')).toContainText(/Create vendor master|Table Studio|Tabele/i);
  });
});
