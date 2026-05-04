import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsMember,
  loginAsOwner,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas core flow smoke', () => {
  test('admin approves proposal and records artifact promotion read-back', async ({
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
    await page.getByRole('button', { name: 'Approve proposal' }).click();
    await expect(page.getByText('Status: approved')).toBeVisible();
    await expect(page.getByText(/approved_with_placeholder/i)).toBeVisible();
    await expect(page.getByText(/placeholder_pending_conversion/i)).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-approved', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Record artifact promotion' }).click();
    await expect(page.getByText(/Draft artifact promotion read-back/i)).toBeVisible();
    await expect(page.getByText(/promotion_recorded/i)).toBeVisible();
    await expect(page.getByText(/artifact-/i)).toBeVisible();
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

    signals.assertClean({ allowFailedWorkCanvasPath: /save-as-artifact/ });
  });

  test('member receives capability denial when approving proposal', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsMember(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Member capability check',
    });

    await page.goto(
      `/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      }
    );

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await page.getByRole('button', { name: /^Idea$/ }).click();
    await expect(page.getByText('Status: proposed')).toBeVisible();
    await page.getByRole('button', { name: 'Approve proposal' }).click();
    await expect(page.getByText(/Capability required|not authorized|Nie można zatwierdzić/i)).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-core-member-denied', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
