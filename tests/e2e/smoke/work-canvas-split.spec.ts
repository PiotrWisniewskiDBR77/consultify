import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createConversationWithMessage,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

const kindLabels = [
  { kind: 'document', label: 'Document canvas' },
  { kind: 'sheet', label: 'Sheet canvas' },
  { kind: 'deck', label: 'Deck canvas' },
] as const;

test.describe('V10 Work Canvas split-screen smoke', () => {
  for (const { kind, label } of kindLabels) {
    test(`${kind} canvas keeps chat left and canvas right`, async ({ page }, testInfo) => {
      const signals = collectPageSignals(page);
      await loginAsOwner(page);

      const response = await page.goto(`/ai/work-canvas?kind=${kind}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      expect(response?.status()).toBeLessThan(500);

      const chat = page.getByText(/AI sees: Work Canvas|Teresa/).first();
      const shellTitle = page.getByText('Consultify Work Canvas').first();
      const canvas = page.getByText(label).first();

      await expect(chat).toBeVisible();
      await expect(shellTitle).toBeVisible();
      await expect(canvas).toBeVisible();
      await expect(page.getByText(/shared split screen/i)).toBeVisible();
      await expect(page.getByText('Governance preview')).toBeVisible();
      await expect(page.getByText(/KIMI lane uses its own generation chat/i)).toHaveCount(0);
      await expectNoRawInternals(page);

      const chatBox = await chat.boundingBox();
      const canvasBox = await canvas.boundingBox();
      expect(chatBox, 'chat title bounding box').not.toBeNull();
      expect(canvasBox, `${kind} canvas bounding box`).not.toBeNull();
      expect(chatBox!.x).toBeLessThan(canvasBox!.x);

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

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText('Canvas linked to existing chat').first()).toBeVisible();
    await expect(page.getByText(conversation.content)).toBeVisible();
    await expect(page.getByText('Governance preview')).toBeVisible();
    expect(page.url()).toContain(`conversationId=${conversation.id}`);

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

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText('Document canvas')).toBeVisible();
    await page.locator('main').getByRole('button', { name: 'Chat' }).click();
    await expect(page.getByText('Work Canvas chat')).toBeVisible();
    await expect(page.getByRole('button', { name: /AI sees: .*Work Canvas/ })).toBeVisible();

    await testInfo.attach('work-canvas-mobile-chat-overlay', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
