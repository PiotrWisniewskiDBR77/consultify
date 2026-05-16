import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createConversationWithMessage,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

const kindLabels = [
  { kind: 'document' },
  { kind: 'sheet' },
  { kind: 'deck' },
] as const;

test.describe('V10 Work Canvas split-screen smoke', () => {
  for (const { kind } of kindLabels) {
    test(`${kind} canvas keeps chat left and canvas right`, async ({ page }, testInfo) => {
      const signals = collectPageSignals(page);
      await loginAsOwner(page);

      const response = await page.goto(`/ai/work-canvas?kind=${kind}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      expect(response?.status()).toBeLessThan(500);
      await ensureWorkCanvasVisible(page);

      const chat = page.getByText(/AI sees: Work Canvas|Teresa/).first();
      const canvas = page.locator('[data-testid="canvas-document-view"]');
      const titleInput = page.getByLabel('Canvas document title');

      await expect(chat).toBeVisible();
      await expect(titleInput).toBeVisible();
      await expect(canvas).toBeVisible();
      await expect(page.getByRole('button', { name: 'Canvas diagnostics' })).toBeVisible();
      await expect(page.getByText(/KIMI lane uses its own generation chat/i)).toHaveCount(0);
      await expectNoRawInternals(page);

      const chatBox = await chat.boundingBox();
      const canvasBox = await canvas.boundingBox();
      expect(chatBox, 'chat title bounding box').not.toBeNull();
      expect(canvasBox, `${kind} canvas bounding box`).not.toBeNull();
      expect(Math.abs((chatBox?.y || 0) - (canvasBox?.y || 0))).toBeLessThan(220);

      await testInfo.attach(`work-canvas-${kind}-split`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      signals.assertClean();
    });
  }

  test('deep-linked canvas uses the existing conversation in the left chat pane', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const conversation = await createConversationWithMessage(page.request, token, {
      title: 'Existing chat for Work Canvas',
      content: 'Existing chat message visible in the Work Canvas left pane.',
    });
    const draft = await createWorkCanvasDraft(page.request, token, {
      conversationId: conversation.id,
      kind: 'document',
      title: 'Canvas linked to existing chat',
      content:
        '# Canvas linked to existing chat\n\nThe right canvas must stay connected to the existing chat.',
    });

    await page.goto(`/ai/work-canvas?draftId=${draft.id}&conversationId=${conversation.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await ensureWorkCanvasVisible(page, 'Canvas linked to existing chat');

    await expect(page.getByText('Canvas linked to existing chat').first()).toBeVisible();
    await expect(page.getByText(conversation.content)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Canvas diagnostics' })).toBeVisible();
    expect(page.url()).toContain(conversation.id);

    await testInfo.attach('work-canvas-existing-chat-link', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await expectNoRawInternals(page);
    signals.assertClean();
  });

  test('mobile can open chat overlay without losing canvas', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    await loginAsOwner(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/ai/work-canvas?kind=document', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await ensureWorkCanvasVisible(page);

    await expect(page.getByLabel('Canvas document title')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-document-view"]')).toBeVisible();
    await page.getByRole('button', { name: 'Close Canvas' }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open work panel/i })).toBeVisible();

    await testInfo.attach('work-canvas-mobile-chat-overlay', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
