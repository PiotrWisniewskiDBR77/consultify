import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
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

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText('Deep linked Playwright draft').first()).toBeVisible();
    await expect(page.getByText('Save:')).toBeVisible();
    await expect(page.getByText('Lifecycle:')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByText('Deep linked Playwright draft').first()).toBeVisible();
    expect(page.url()).toContain(`draftId=${draft.id}`);

    await page.getByRole('button', { name: 'Source' }).click();
    await expect(page.locator('pre').filter({ hasText: 'Deep linked Playwright draft' })).toBeVisible();
    await expect(page.getByText(/^\{/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(
      page.getByRole('heading', { name: 'Deep linked Playwright draft' }).nth(1)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Copy' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
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
