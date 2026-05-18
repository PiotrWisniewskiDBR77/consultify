import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  collectPageSignals,
  createWorkCanvasDraft,
  ensureWorkCanvasVisible,
  expectNoRawInternals,
  loginAsMember,
  loginAsOwner,
  openWorkCanvasDraft,
} from './work-canvas-helpers';

test.describe('V10 Work Canvas core flow smoke', () => {
  // Work Canvas hydration can be slower on shared staging-like runtimes.
  test.describe.configure({ timeout: 120000 });

  test('owner saves canvas and keeps read-back after refresh', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token);
    const editedTitle = `QA A2 persistence ${Date.now()}`;
    const editedContent = `QA TEST DRAFT A2 PERSISTENCE CHECK ${Date.now()}`;

    await openWorkCanvasDraft(page, draft);
    const titleInput = page.getByLabel('Canvas document title');
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    const markdownEditor = page.getByTestId('canvas-md-view');
    await expect(page.getByRole('button', { name: 'Save Canvas document' })).toBeVisible();
    await titleInput.fill(editedTitle);
    await markdownEditor.fill(`# ${editedTitle}\n\n${editedContent}`);
    await testInfo.attach('work-canvas-core-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Save Canvas document' }).click();
    await page.waitForTimeout(1500);
    const persistedDraftResponse = await page.request.get(`/api/work-canvas/drafts/${draft.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(persistedDraftResponse.ok()).toBe(true);
    const persistedDraftJson = await persistedDraftResponse.json();
    const persistedDraft = persistedDraftJson?.data?.draft || persistedDraftJson?.data;
    expect(String(persistedDraft?.contentMd || '')).toContain(editedContent);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureWorkCanvasVisible(page);
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toBeVisible();
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
    const profileResponse = await page.request.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let effectiveRole = 'UNKNOWN';
    if (profileResponse.ok()) {
      const profileJson = await profileResponse.json();
      const normalizedRole = String(profileJson?.data?.role || profileJson?.role || '').trim();
      if (normalizedRole) {
        effectiveRole = normalizedRole.toUpperCase();
      }
    }
    test.skip(
      effectiveRole !== 'USER',
      `Member capability gate requires USER role, got ${effectiveRole}.`
    );
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Member capability check',
      conversationId: `member-canvas-${Date.now()}`,
    });

    await openWorkCanvasDraft(page, draft);
    await page.getByRole('button', { name: 'Canvas menu' }).click();

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
