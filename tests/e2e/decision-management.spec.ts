/**
 * E2E Tests for Decision Management
 *
 * Validates decision inbox access in My Work view.
 */

import { expect, Page, test } from '@playwright/test';

async function login(page: Page) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const health = await page.request
      .get('http://localhost:3005/api/health', { timeout: 5000 })
      .catch(() => null);
    if (health && health.ok()) break;
    await page.waitForTimeout(2000);
  }

  const response = await page.request.post('http://localhost:3005/api/auth/login', {
    data: {
      email: process.env.TEST_USER_EMAIL || 'test@localhost',
      password: process.env.TEST_USER_PASSWORD || 'testpassword123',
    },
    timeout: 30000,
  });
  const data = await response.json();
  await page.addInitScript(
    ([token, refreshToken]) => {
      localStorage.setItem('token', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    },
    [data.token, data.refreshToken]
  );
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
