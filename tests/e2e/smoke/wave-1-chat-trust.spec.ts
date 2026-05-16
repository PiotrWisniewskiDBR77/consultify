/**
 * Wave 1 retro coverage — Chat, Unified Shell and Trust.
 */
import { expect, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  gotoRuntimeGateRoute,
} from './runtime-gate-helpers';

test.describe('Wave 1 — Chat and trust retro Playwright gate [@wave:1]', () => {
  test.setTimeout(120000);

  test('chat send, refresh persistence and trust details remain visible', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);
    const prompt = `wave 1 retro trust ${Date.now()}`;

    await gotoRuntimeGateRoute(page, '/chat');
    await expectAppMounted(page);

    const input = page.locator('textarea[data-testid="chat-input"]:visible').first();
    await expect(input).toBeVisible({ timeout: 30000 });
    await input.fill(prompt);

    await page
      .locator('button[title="Send"], button[title="Wyślij"], button[title="Wyslij"]')
      .first()
      .click()
      .catch(async () => {
        await input.press('Enter');
      });

    await expect(page).toHaveURL(/\/chat\/[^/?#]+/, { timeout: 30000 });
    const conversationUrl = page.url();

    await expect(page.getByText(prompt, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('p:visible', { hasText: 'E2E_OK:' }).first()).toBeVisible({
      timeout: 30000,
    });

    const trustPanel = page.getByTestId('trust-panel').first();
    await expect(trustPanel).toBeVisible({ timeout: 30000 });
    await expect(trustPanel).toContainText(/Why this answer\? Trust details/i);
    await expect(trustPanel).toContainText(/Model:/i);
    await expect(trustPanel).toContainText(/Provider:/i);
    await expect(page.locator('#root')).not.toContainText(/rag_1|\{\"/i);
    await expect(page.locator('#root')).not.toContainText(/No cited sources/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectAppMounted(page);

    await expect(page).toHaveURL(conversationUrl);
    await expect(page.getByText(prompt, { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('p:visible', { hasText: 'E2E_OK:' }).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId('trust-panel').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#root')).not.toContainText(/No cited sources/i);

    expectNoRuntimeGateIssues(issues);
  });
});
