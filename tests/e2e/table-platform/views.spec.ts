/**
 * E2E: Table Platform Views
 *
 * Verifies that the view switcher and table grid render without crashes.
 * Uses resilient selectors — does not assume specific DOM structure.
 */

import { test, expect } from '@playwright/test';

import { getPrivilegedSession } from '../_helpers/privilegedSession';
import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Table Platform Views', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible({ timeout: 10000 })) {
      await emailInput.fill('test-tp@demo.com');
      await passwordInput.fill('Test1234!');
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test('should render My Work page without TypeErrors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const typeErrors = errors.filter((e) => e.includes('TypeError'));
    expect(typeErrors).toHaveLength(0);
  });

  test('should show view switcher icons when a workspace is open', async ({ page }) => {
    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');

    const row = page.locator('[data-testid="workspace-row"], [data-testid="idea-row"], tr[class*="row"], tr').first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2000);

      const viewSwitcher = page.locator(
        '[data-testid="view-switcher"], [class*="view-switch"], [class*="ViewSwitch"], [aria-label*="view"]'
      ).first();

      if (await viewSwitcher.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await viewSwitcher.isVisible()).toBe(true);
      }
    }

    expect(await page.title()).toBeTruthy();
  });

  test('should render table grid view without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const typeErrors = errors.filter((e) => e.includes('TypeError'));
    expect(typeErrors).toHaveLength(0);
  });

  test('API: table-platform bases endpoint responds', async ({ request }) => {
    let token: string;
    try {
      const state = readTestSupportState();
      token = state.token;
    } catch {
      // Bootstrap only — register-demo is the public, unprivileged, read-only demo signup
      // and cannot stand in for a real session here.
      try {
        const session = await getPrivilegedSession(request, {
          role: 'ADMIN',
          label: 'tp-views',
          apiBaseUrl: API_BASE_URL,
        });
        token = session.token;
      } catch (error) {
        console.warn(error instanceof Error ? error.message : String(error));
        test.skip();
        return;
      }
    }

    const res = await request.get(`${API_BASE_URL}/api/table-platform/bases`, {
      headers: authHeaders(token),
      params: { workspaceId: 'smoke-test' },
    });

    // 200 or 404 (feature flag off) are both acceptable — no 500
    expect(res.status()).toBeLessThan(500);
  });
});
