/**
 * Runtime Smoke: App startup + basic security endpoints
 *
 * This is intentionally deterministic:
 * - Uses Playwright webServer (E2E_USE_WEB_SERVER=true) to start backend+frontend
 * - Avoids relying on seeded users (no login)
 * - Verifies frontend renders login page and backend health/CSRF endpoints respond
 */
import { expect, test } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

test.describe('Runtime Smoke: App startup', () => {
  // The suite-wide storageState (global test-support setup) authenticates every
  // test, so /login would redirect into the authenticated app shell. This test
  // intentionally asserts the UNAUTHENTICATED experience — reset storage state.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('frontend serves login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('backend health + csrf endpoints respond', async ({ request }) => {
    const health = await request.get(`${apiUrl}/api/health`);
    expect(health.ok()).toBe(true);

    const csrf = await request.get(`${apiUrl}/api/csrf-token`);
    expect(csrf.ok()).toBe(true);
    const data = await csrf.json().catch(() => null);
    // Endpoint should either return { token } or at least a JSON object
    expect(data).toBeTruthy();
    if (data && typeof data === 'object') {
      expect('token' in data).toBe(true);
      expect(String((data as any).token).length).toBeGreaterThan(10);
    }
  });
});
