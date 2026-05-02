import { expect, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsOwner,
} from './work-canvas-helpers';

const canvasKinds = [
  'markdown',
  'table',
  'checklist',
  'research',
  'decision',
  'document',
  'sheet',
  'deck',
] as const;

const proposalTargets = [
  'Idea',
  'Initiative',
  'Task',
  'Brief',
  'Decision',
  'Research Report',
  'Client Deliverable',
] as const;

test.describe('V10 Work Canvas manual preflight', () => {
  test('manual acceptance matrix is clickable without blocking errors', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Manual preflight canvas',
      content:
        '# Manual preflight canvas\n\nThis automated preflight replaces the slow blocker-finding part of manual dogfood.',
    });

    await page.goto(`/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText(/AI sees: Work Canvas|Teresa/).first()).toBeVisible();
    await expect(page.getByText('Governance preview')).toBeVisible();

    for (const kind of canvasKinds) {
      await page.getByRole('button', { name: new RegExp(`^${kind}$`) }).click();
      await expect(page.getByRole('button', { name: new RegExp(`^${kind}$`) })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

      if (kind === 'research') {
        await expect(page.getByText('Deep research mission')).toBeVisible();
        await expect(page.getByText('Research questions')).toBeVisible();
      }
      if (kind === 'document') await expect(page.getByText('Document canvas')).toBeVisible();
      if (kind === 'sheet') await expect(page.getByText('Sheet canvas')).toBeVisible();
      if (kind === 'deck') await expect(page.getByText('Deck canvas')).toBeVisible();
    }

    for (const target of proposalTargets) {
      await page.getByRole('button', { name: target, exact: true }).click();
      await expect(page.getByText('Status: proposed')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve proposal' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
      await page.getByRole('button', { name: 'Dismiss proposal' }).click();
      await expect(page.getByText('Status: proposed')).toHaveCount(0);
    }

    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-matrix', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('negative routes fail safely before manual dogfood', async ({ browser, page }, testInfo) => {
    const signals = collectPageSignals(page);
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();

    await anonymousPage.goto('/ai/work-canvas?kind=document', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(anonymousPage).toHaveURL(/\/login/);
    await anonymousContext.close();

    await loginAsOwner(page);
    await page.goto('/ai/work-canvas?draftId=missing-draft-id&conversationId=manual-preflight', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText(/Canvas draft not found/i)).toBeVisible();
    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-manual-preflight-negative', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });

  test('tablet viewport keeps canvas usable for manual tester', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    await loginAsOwner(page);
    await page.setViewportSize({ width: 820, height: 1180 });

    await page.goto('/ai/work-canvas?kind=document', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await expect(page.getByText('Consultify Work Canvas')).toBeVisible();
    await expect(page.getByText('Document canvas')).toBeVisible();
    const chatToggle = page.locator('main').getByRole('button', { name: 'Chat' });
    await expect(chatToggle).toBeVisible();
    await chatToggle.click();
    await expect(page.getByText(/AI sees: Work Canvas|Teresa/).first()).toBeVisible();
    await expectNoRawInternals(page);

    await testInfo.attach('work-canvas-manual-preflight-tablet', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });
});
