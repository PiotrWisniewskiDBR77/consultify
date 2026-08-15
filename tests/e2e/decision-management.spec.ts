/**
 * E2E Tests for Decision Management
 *
 * Validates decision inbox access in My Work view.
 */

import { expect, Page, test } from '@playwright/test';

import { seedE2EAuthWithBootstrap } from './smoke/runtime-gate-helpers';

// SAFETY (2026-07-13): This spec used to log in with a hard-coded REAL account
// (piotr.wisniewski@dbr77.com / 123456) and open My Work in the real DBR77 org.
// It now seeds the isolated E2E test-support tenant (seedE2EAuthWithBootstrap),
// so it never authenticates as a real account. Without the gated harness the
// bootstrap fails and the strict path throws instead of hitting a real login.
async function login(page: Page) {
  // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
  await seedE2EAuthWithBootstrap(page);
  await page.goto('/my-work', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="mywork-view"]', { timeout: 60000 });
}

test.describe('Decision Management', () => {
  test('should open Decisions tab in My Work', async ({ page }) => {
    await login(page);

    await expect(page.locator('[data-testid="mywork-view"]')).toBeVisible();

    const decisionsTab = page.locator('[data-testid="mywork-tab-decisions"]');
    await expect(decisionsTab).toBeVisible();
    let listVisible = false;
    for (let i = 0; i < 5; i += 1) {
      await decisionsTab.click({ force: true });
      await page.waitForTimeout(300);
      listVisible = (await page.locator('[data-testid="decisions-list"]').count()) > 0;
      if (listVisible) break;
    }

    await expect(page.locator('[data-testid="decisions-list"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="mywork-create-button"]')).toBeVisible();
  });
});
