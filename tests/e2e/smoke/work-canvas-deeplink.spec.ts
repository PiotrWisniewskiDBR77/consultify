import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsOwner,
  openWorkCanvasDraft,
  suppressOnboarding,
} from './work-canvas-helpers';

test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

test.describe('V10 Work Canvas deep-link and persistence smoke', () => {
  test('draft reloads by draftId/conversationId and renderer actions stay available', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Deep linked Playwright draft',
      content:
        '# Deep linked Playwright draft\n\nThis draft must survive a re-open and support preview, source, copy and download.',
    });

    await openWorkCanvasDraft(page, draft);
    await expect(page.getByLabel('Canvas document title')).toHaveValue(
      /Deep linked Playwright draft/
    );

    // Re-open via the deep-link (chat shell consumes the workCanvas query, so a raw
    // page.reload would drop the panel) → the draft must rehydrate from the DB.
    await openWorkCanvasDraft(page, draft);
    await expect(page.getByLabel('Canvas document title')).toHaveValue(
      /Deep linked Playwright draft/
    );

    const menu = page.locator('[data-testid="canvas-diagnostics-menu"]').first();
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await expect(menu).toBeVisible();

    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toBeVisible();
    await page.getByRole('button', { name: 'Dock view' }).click();
    await expect(page.getByTestId('canvas-document-view')).toBeVisible();

    // Copy + Download Markdown live in the Canvas menu; scope to it to avoid the
    // icon-only file-action button that shares the "Copy Markdown" accessible name.
    await menu.getByRole('button', { name: 'Copy Markdown' }).click();
    const downloadPromise = page.waitForEvent('download');
    await menu.getByRole('button', { name: 'Download Markdown' }).click();
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
