import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas deep-link and persistence smoke', () => {
  test('draft reloads by draftId/conversationId and renderer actions stay available', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Deep linked Playwright draft',
      content:
        '# Deep linked Playwright draft\n\nThis draft must survive refresh and support preview, source, copy and download.',
    });

    const deepLink = `/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`;
    await page.goto(deepLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureWorkCanvasVisible(page);

    await expect(page.getByLabel('Canvas document title')).toHaveValue(/Deep linked Playwright draft/);
    await expect(page.getByRole('button', { name: 'Save Canvas document' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureWorkCanvasVisible(page);
    await expect(page.getByLabel('Canvas document title')).toHaveValue(/Deep linked Playwright draft/);

    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toBeVisible();
    await page.getByRole('button', { name: 'Dock view' }).click();
    await expect(page.getByTestId('canvas-document-view')).toBeVisible();

    await page.getByRole('button', { name: 'Copy Markdown' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Markdown' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toContain('deep-linked-playwright-draft');

    await testInfo.attach('work-canvas-deeplink-persistence', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await expectNoRawInternals(page);
    signals.assertClean();
  });
});
