/**
 * Knowledge Base E2E Tests
 *
 * Canonical customer documentation surface lives under `/docs`.
 * Legacy `/knowledge` remains a redirect shim only.
 */

import { expect, test } from '@playwright/test';

test.describe('Knowledge Base', () => {
  test('redirects legacy knowledge entry to canonical docs', async ({ page }) => {
    await page.goto('/knowledge');

    await expect(page).toHaveURL(/\/docs$/);
  });

  test('supports canonical docs search route', async ({ page }) => {
    await page.goto('/docs/search?q=test');

    await expect(page).toHaveURL(/\/docs\/search\?q=test$/);
  });

  test('shows the honest api reference placeholder on canonical docs route', async ({ page }) => {
    await page.goto('/docs/api');

    await expect(page).toHaveURL(/\/docs\/api$/);
    await expect(page.getByText(/Interactive API reference is not published yet/i)).toBeVisible();
  });
});
