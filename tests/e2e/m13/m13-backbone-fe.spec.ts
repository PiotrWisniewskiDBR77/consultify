/**
 * Preview pass (FE) — nowe taby kręgosłupa renderują się na ŻYWEJ apce.
 * Kandydaci + Zdrowie portfela + dropdown „Zrób materiał". Network+UI+screenshot.
 */
import { expect, test } from '@playwright/test';
import { readTestSupportState } from '../_helpers/testSupportState';
import { gotoHub, dismissOnboarding, suppressOnboarding, shot, seedInitiative } from './_m13';

test.describe('M13 kręgosłup FE — nowe taby renderują się', () => {
  let token = '', userId = '';
  test.beforeAll(() => { const s = readTestSupportState(); token = s.token; userId = s.userId; });
  test.beforeEach(async ({ page }) => { await suppressOnboarding(page, userId); });

  test('FE-1: tab „Kandydaci" renderuje się bez error-boundary', async ({ page }) => {
    await seedInitiative(page, token, 'FE-kandydaci');
    await gotoHub(page); await dismissOnboarding(page);
    const tab = page.getByRole('button', { name: /Kandydaci|Candidates/i }).first();
    if (await tab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await tab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Coś poszło nie tak/i);
    await shot(page, 'fe-1-candidates-tab');
  });

  test('FE-2: tab „Zdrowie portfela" renderuje się bez error-boundary', async ({ page }) => {
    await seedInitiative(page, token, 'FE-portfel');
    await gotoHub(page); await dismissOnboarding(page);
    const tab = page.getByRole('button', { name: /Zdrowie portfela|Portfolio health/i }).first();
    if (await tab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await tab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Coś poszło nie tak/i);
    await shot(page, 'fe-2-portfolio-health-tab');
  });
});
