import { expect, test } from '@playwright/test';

import {
  CANVAS_RICH_EDITOR,
  collectPageSignals,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsOwner,
  openWorkCanvasDraft,
  suppressOnboarding,
} from './work-canvas-helpers';

test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

test.describe('V10 Work Canvas manual preflight', () => {
  test('manual acceptance matrix is clickable without blocking errors', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Manual preflight canvas',
      content:
        '# Manual preflight canvas\n\nThis automated preflight replaces the slow blocker-finding part of manual dogfood.',
    });

    await openWorkCanvasDraft(page, draft);

    await expect(page.locator('textarea[data-testid="chat-input"]').first()).toBeVisible();
    await expect(page.locator(CANVAS_RICH_EDITOR).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Canvas menu' })).toBeVisible();

    const menu = page.locator('[data-testid="canvas-diagnostics-menu"]').first();
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await expect(menu).toBeVisible();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Copy Markdown' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Canvas document' }).first()).toBeVisible();

    // Promote (workspace) conversion actions are present in the Canvas menu, even when
    // gated for the current capability set.
    await expect(menu.getByRole('button', { name: 'Send to idea' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Save as note' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Create initiative' })).toBeVisible();

    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-matrix', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('negative routes fail safely before manual dogfood', async ({
    browser,
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);

    // Anonymous deep-link must bounce to the auth surface, never render the canvas.
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await suppressOnboarding(anonymousPage);
    await anonymousPage.goto('/chat?workCanvas=1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(anonymousPage).toHaveURL(/\/(login|auth)/, { timeout: 30000 });
    await anonymousContext.close();

    // Authenticated but missing draft id → panel mounts and fails safe (no raw internals).
    await loginAsOwner(page);
    await page.goto('/chat?workCanvas=1&draftId=missing-draft-id&conversationId=manual-preflight', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.locator('[data-testid="chat-work-panel"]').first()).toBeVisible({
      timeout: 30000,
    });
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-negative', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('tablet viewport keeps canvas usable for manual tester', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    await page.setViewportSize({ width: 820, height: 1180 });
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Tablet preflight canvas',
      content: '# Tablet preflight canvas\n\nCanvas must stay usable on tablet widths.',
    });

    await openWorkCanvasDraft(page, draft);
    await ensureWorkCanvasVisible(page);

    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await expect(page.getByRole('button', { name: 'Markdown view' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Canvas' }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]').first()).toBeVisible();
    await expectNoRawInternals(page);

    await testInfo.attach('work-canvas-manual-preflight-tablet', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });
});
