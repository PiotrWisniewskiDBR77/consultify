import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsMember,
  loginAsOwner,
  openWorkCanvasDraft,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas core flow smoke', () => {
  test('owner saves canvas and keeps read-back after refresh', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token);

    await openWorkCanvasDraft(page, draft);
    await expect(page.getByRole('button', { name: 'Save Canvas document' })).toBeVisible();
    await testInfo.attach('work-canvas-core-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Save Canvas document' }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureWorkCanvasVisible(page, draft.title);
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-save-readback', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });

  test('member sees restricted conversion actions disabled', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsMember(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Member capability check',
    });

    await openWorkCanvasDraft(page, draft);

    await expect(page.getByRole('button', { name: 'Send to idea' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save as note' })).toBeDisabled();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-member-denied', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
