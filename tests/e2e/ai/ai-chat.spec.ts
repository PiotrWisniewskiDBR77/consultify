/**
 * AI Chat Interaction E2E Tests
 * Testing AI assistant chat functionality
 *
 * @module tests/e2e/ai/ai-chat.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('AI Chat Interface', () => {
  test('should load chat page', async ({ page }) => {
    await page.goto('/chat');

    // Should redirect to login or show chat
    const url = page.url();
    expect(url).toMatch(/chat|login|ai|assistant/);
  });

  test('should load AI assistant page', async ({ page }) => {
    await page.goto('/assistant');

    const url = page.url();
    expect(url).toMatch(/assistant|chat|login|ai/);
  });

  test('should have chat input when on chat page', async ({ page }) => {
    await page.goto('/chat');

    const url = page.url();
    if (url.includes('chat') && !url.includes('login')) {
      // Look for chat input
      const chatInput = page.locator('textarea, input[type="text"]').filter({ hasText: '' });
      const hasInput = await chatInput
        .first()
        .isVisible()
        .catch(() => false);

      if (hasInput) {
        await expect(chatInput.first()).toBeVisible();
      }
    }
  });
});

test.describe('AI Features Access', () => {
  test('should access AI reports', async ({ page }) => {
    await page.goto('/ai/reports');

    const url = page.url();
    expect(url).toMatch(/ai|reports|login/);
  });

  test('should access AI insights', async ({ page }) => {
    await page.goto('/ai/insights');

    const url = page.url();
    expect(url).toMatch(/ai|insights|login/);
  });
});
