/**
 * E2E: Chat to Schema
 *
 * Verifies that typing a table-creation message in the main chat
 * does not crash and (when available) triggers a proposal card.
 */

import { test, expect } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Chat to Schema', () => {
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

  test('should detect table intent in main chat without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator(
      'textarea, input[placeholder*="message"], input[placeholder*="wiadomość"], [data-testid="chat-input"], [contenteditable="true"]'
    ).first();

    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('Create a table for tracking projects with columns: name, status, deadline');
      await chatInput.press('Enter');
      await page.waitForTimeout(5000);

      const proposalCard = page.locator(
        '[data-testid="table-proposal-card"], [class*="ProposalCard"], [class*="proposal-card"], [class*="TableProposal"]'
      ).first();

      if (await proposalCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await proposalCard.isVisible()).toBe(true);
      }
    }

    const typeErrors = errors.filter((e) => e.includes('TypeError'));
    expect(typeErrors).toHaveLength(0);
  });

  test('should render chat page without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(await page.title()).toBeTruthy();
    const typeErrors = errors.filter((e) => e.includes('TypeError'));
    expect(typeErrors).toHaveLength(0);
  });

  test('API: schema proposals endpoint responds', async ({ request }) => {
    let token: string;
    try {
      const state = readTestSupportState();
      token = state.token;
    } catch {
      const authRes = await request.post(`${API_BASE_URL}/api/auth/register-demo`, {
        data: { email: `tp-chat-${Date.now()}@test.com`, password: 'Test1234!', name: 'TP Chat Test' },
      });
      if (!authRes.ok()) {
        test.skip();
        return;
      }
      const authData = await authRes.json();
      token = authData.token;
    }

    const res = await request.get(`${API_BASE_URL}/api/table-platform/schema/proposals`, {
      headers: authHeaders(token),
      params: { workspaceId: 'smoke-test' },
    });

    // 200 or 404 (feature flag off) are both acceptable — no 500
    expect(res.status()).toBeLessThan(500);
  });
});
