import { expect, test } from '@playwright/test';

import {
  CANVAS_RICH_EDITOR,
  collectPageSignals,
  createConversationWithMessage,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsOwner,
  openWorkCanvasDraft,
  suppressOnboarding,
} from './work-canvas-helpers';

// Architecture note (2026-06-20): the standalone `/ai/work-canvas` WorkCanvasShell
// was removed. The canvas now mounts as WorkCanvasDocumentPanel inside the `/chat`
// split layout (chat left, canvas right). Open it by deep-linking workCanvas=1 with a
// persisted draft id; ?kind= alone no longer opens the panel.
const kindLabels = [{ kind: 'document' }, { kind: 'sheet' }, { kind: 'deck' }] as const;

test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

test.describe('V10 Work Canvas split-screen smoke', () => {
  for (const { kind } of kindLabels) {
    test(`${kind} canvas keeps chat left and canvas right`, async ({ page }, testInfo) => {
      const signals = collectPageSignals(page);
      const token = await loginAsOwner(page);
      const draft = await createWorkCanvasDraft(page.request, token, {
        kind,
        title: `Split ${kind} canvas`,
        content: `# Split ${kind} canvas\n\nChat stays on the left, canvas on the right.`,
      });

      await openWorkCanvasDraft(page, draft);

      const chat = page.locator('textarea[data-testid="chat-input"]').first();
      const canvas = page.locator(CANVAS_RICH_EDITOR).first();
      const titleInput = page.locator('[data-testid="canvas-active-title"]').first();

      await expect(chat).toBeVisible();
      await expect(titleInput).toBeVisible();
      await expect(canvas).toBeVisible();
      await expect(page.getByRole('button', { name: 'Canvas menu' })).toBeVisible();
      await expect(page.getByText(/KIMI lane uses its own generation chat/i)).toHaveCount(0);
      await expectNoRawInternals(page);

      const chatBox = await chat.boundingBox();
      const canvasBox = await canvas.boundingBox();
      expect(chatBox, 'chat input bounding box').not.toBeNull();
      expect(canvasBox, `${kind} canvas bounding box`).not.toBeNull();
      // Chat composer sits left of (or overlapping the start of) the canvas surface.
      expect(chatBox?.x || 0).toBeLessThan((canvasBox?.x || 0) + 20);

      await testInfo.attach(`work-canvas-${kind}-split`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      signals.assertClean();
    });
  }

  test('deep-linked canvas keeps its source conversation in the chat shell', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const conversation = await createConversationWithMessage(page.request, token, {
      title: 'Existing chat for Work Canvas',
      content: 'Existing chat message linked to the Work Canvas draft.',
    });
    const draft = await createWorkCanvasDraft(page.request, token, {
      conversationId: conversation.id,
      kind: 'document',
      title: 'Canvas linked to existing chat',
      content:
        '# Canvas linked to existing chat\n\nThe right canvas must stay connected to the existing chat.',
    });

    await openWorkCanvasDraft(page, draft);

    // The draft hydrates into the rich editor; its conversation id is preserved on the draft.
    await expect(page.locator(CANVAS_RICH_EDITOR).first()).toContainText(
      'Canvas linked to existing chat'
    );
    await expect(page.getByRole('button', { name: 'Canvas menu' })).toBeVisible();
    expect(draft.conversationId).toBe(conversation.id);

    await testInfo.attach('work-canvas-existing-chat-link', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await expectNoRawInternals(page);
    signals.assertClean();
  });

  test('mobile can close the canvas and recover the chat composer', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      kind: 'document',
      title: 'Mobile canvas overlay',
      content: '# Mobile canvas overlay\n\nClosing the canvas must restore the chat composer.',
    });

    await openWorkCanvasDraft(page, draft);
    await ensureWorkCanvasVisible(page);

    await expect(page.locator('[data-testid="canvas-active-title"]').first()).toBeVisible();
    await expect(page.locator(CANVAS_RICH_EDITOR).first()).toBeVisible();
    await page.getByRole('button', { name: 'Close Canvas' }).click();
    await expect(page.locator('textarea[data-testid="chat-input"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Open work panel/i }).first()).toBeVisible();

    await testInfo.attach('work-canvas-mobile-chat-overlay', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
