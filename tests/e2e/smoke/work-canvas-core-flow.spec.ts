import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas core flow smoke', () => {
  test('proposal-first conversion, artifact save, and research renderer stay safe', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token);

    await page.goto(
      `/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      }
    );

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText(draft.title).first()).toBeVisible();
    await expect(page.getByText('Governance preview')).toBeVisible();
    await testInfo.attach('work-canvas-core-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: /^Idea$/ }).click();
    await expect(page.getByText(/Idea:/)).toBeVisible();
    await expect(page.getByText('Status: proposed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve proposal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();

    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Status: rejected')).toBeVisible();
    await expect(page.getByText(/targetObjectId/i)).toHaveCount(0);
    await testInfo.attach('work-canvas-core-rejected', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Dismiss proposal' }).click();
    await page.getByRole('button', { name: /^Idea$/ }).click();
    await expect(page.getByText('Status: proposed')).toBeVisible();
    await page.getByRole('button', { name: 'Approve proposal' }).click();

    await expect(
      page.getByText(/Status: approved|Capability required|not authorized|Nie można zatwierdzić/i)
    ).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-approved-or-denied', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Save artifact' }).click();
    await expect(
      page.getByText(
        /Artifact read-back|Artifact could not be saved|Capability required|V8 artifact runtime/i
      )
    ).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-save-artifact', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: /^research$/ }).click();
    await expect(page.getByText('Deep research mission')).toBeVisible();
    await expect(page.getByText('Research questions')).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-research', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
