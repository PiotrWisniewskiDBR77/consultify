/**
 * Runtime Gate — chat refresh persistence.
 *
 * Guards the final AI OS P1 blocker: hard refresh on /chat/:conversationId
 * must keep both the URL and the visible conversation history.
 */
import { expect, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  gotoRuntimeGateRoute,
  seedE2EAuthWithBootstrap,
} from './runtime-gate-helpers';

test.describe('Runtime Gate — Chat refresh persistence [@module:ai-chat]', () => {
  test.setTimeout(120000);

  test('preserves conversation messages after hard refresh', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);
    const prompt = `runtime gate refresh persistence ${Date.now()}`;
    await seedE2EAuthWithBootstrap(page);

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
    // Local/staging backends may not run deterministic E2E_MODE response prefixes.
    // Conversation URL + user message persistence is the business gate here.

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectAppMounted(page);

    await expect(page).toHaveURL(conversationUrl);
    await expect(page.getByText(prompt, { exact: true })).toBeVisible({ timeout: 30000 });

    expectNoRuntimeGateIssues(issues);
  });
});
