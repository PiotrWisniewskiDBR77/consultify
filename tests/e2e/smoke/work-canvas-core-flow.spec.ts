import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
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

test.describe('V10 Work Canvas core flow smoke', () => {
  // Work Canvas hydration can be slower on shared staging-like runtimes.
  test.describe.configure({ timeout: 120000 });

  test('owner saves canvas and keeps read-back after re-open', async ({ page }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token);
    const editedTitle = `QA A2 persistence ${Date.now()}`;
    const editedContent = `QA TEST DRAFT A2 PERSISTENCE CHECK ${Date.now()}`;

    await openWorkCanvasDraft(page, draft);
    const titleInput = page.getByLabel('Canvas document title');

    // Edit through the Markdown view (deterministic textarea, unlike the rich editor).
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    const markdownEditor = page.getByTestId('canvas-md-view');
    await expect(markdownEditor).toBeVisible();
    await titleInput.fill(editedTitle);
    await markdownEditor.fill(`# ${editedTitle}\n\n${editedContent}`);

    await testInfo.attach('work-canvas-core-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Persist via the save file-action (icon button, accessible name "Save Canvas document").
    await page.getByRole('button', { name: 'Save Canvas document' }).first().click();
    await page.waitForTimeout(1500);

    const persistedDraftResponse = await page.request.get(
      `${API_BASE_URL}/api/work-canvas/drafts/${draft.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(persistedDraftResponse.ok()).toBe(true);
    const persistedDraftJson = await persistedDraftResponse.json();
    const persistedDraft = persistedDraftJson?.data?.draft || persistedDraftJson?.data;
    expect(String(persistedDraft?.contentMd || '')).toContain(editedContent);

    // Re-open by deep-link → content rehydrates from the DB.
    await openWorkCanvasDraft(page, { ...draft, title: editedTitle });
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    await expect(page.getByTestId('canvas-md-view')).toHaveValue(new RegExp(editedContent));
    await expectNoRawInternals(page);

    await testInfo.attach('work-canvas-core-save-readback', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });

  test('demo user sees promote/output conversion actions gated with a reason', async ({
    page,
  }, testInfo) => {
    // Register-demo users (the only credential available without owner secrets) get an
    // ADMIN role but NO canvas.* capabilities, so the promote (workspace) + output
    // actions must surface as gated rather than firing a conversion request.
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Capability gating check',
      content: '# Capability gating check\n\nPromote + output actions should be gated.',
    });

    await openWorkCanvasDraft(page, draft);

    let outboundConversionRequests = 0;
    page.on('request', (r) => {
      if (
        /\/api\/work-canvas\/.*\/(create-output|save-to-workspace|share|create-presentation)/.test(
          r.url()
        )
      ) {
        outboundConversionRequests += 1;
      }
    });

    let gatedSeen = 0;
    for (const sel of [
      '[data-testid="canvas-output-actions"]',
      '[data-testid="canvas-workspace-actions"]',
    ]) {
      const group = page.locator(sel).first();
      if (!(await group.isVisible().catch(() => false))) continue;
      const buttons = group.locator('button');
      const n = await buttons.count();
      for (let i = 0; i < n; i += 1) {
        const btn = buttons.nth(i);
        const status = await btn.getAttribute('data-action-status');
        if (status && status !== 'enabled') {
          gatedSeen += 1;
          const title = (await btn.getAttribute('title')) || '';
          expect(title.length, `gated button ${sel}#${i} carries a reason`).toBeGreaterThan(0);
          await btn.click({ force: true }).catch(() => {});
        }
      }
    }

    expect(gatedSeen, 'at least one gated promote/output action for demo user').toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    expect(outboundConversionRequests, 'gated clicks fire no conversion request').toBe(0);
    await expectNoRawInternals(page);

    await testInfo.attach('work-canvas-core-gating', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    signals.assertClean();
  });
});
