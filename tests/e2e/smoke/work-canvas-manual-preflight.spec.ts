import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas manual preflight', () => {
  test('manual acceptance matrix is clickable without blocking errors', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Manual preflight canvas',
      content:
        '# Manual preflight canvas\n\nThis automated preflight replaces the slow blocker-finding part of manual dogfood.',
    });

    await page.goto(`/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await ensureWorkCanvasVisible(page, 'Manual preflight canvas');

    await expect(page.locator('textarea[data-testid="chat-input"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Canvas diagnostics' })).toBeVisible();

    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Markdown' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Canvas document' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Markdown' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Send to idea' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save as note' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create initiative' })).toBeVisible();

    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-matrix', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('negative routes fail safely before manual dogfood', async ({ browser, page }, testInfo) => {
    const signals = collectPageSignals(page);
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();

    await anonymousPage.goto('/ai/work-canvas?kind=document', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(anonymousPage).toHaveURL(/\/(login|auth)/);
    await anonymousContext.close();

    await loginAsOwner(page);
    await page.goto('/ai/work-canvas?draftId=missing-draft-id&conversationId=manual-preflight', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await ensureWorkCanvasVisible(page);
    await expect(page.getByRole('button', { name: 'Save Canvas document' })).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-negative', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('tablet viewport keeps canvas usable for manual tester', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    await loginAsOwner(page);
    await page.setViewportSize({ width: 820, height: 1180 });

    await page.goto('/ai/work-canvas?kind=document', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await ensureWorkCanvasVisible(page);

    await expect(page.getByRole('button', { name: 'Markdown view' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Canvas' }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]')).toBeVisible();
    await expectNoRawInternals(page);

    await testInfo.attach('work-canvas-manual-preflight-tablet', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });
});
