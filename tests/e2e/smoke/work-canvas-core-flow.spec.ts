import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  CANVAS_RICH_EDITOR,
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
    const editedContent = `QA TEST DRAFT A2 PERSISTENCE CHECK ${Date.now()}`;

    await openWorkCanvasDraft(page, draft);

    // Type a unique marker into the rich editor (the default view). Its change handler
    // reliably dirties the draft and triggers autosave; a Playwright fill() on the
    // controlled Markdown textarea is NOT registered as a content change, so the body
    // edit would never persist (read-back returns the original template).
    // Arm the autosave-request watcher BEFORE typing. The draft loads in a 'saved' state,
    // so asserting data-save-state=/saved/ alone races green before the edit's autosave even
    // fires. Waiting for the actual PUT/POST to this draft proves the edit was committed.
    const autosavePromise = page
      .waitForRequest(
        (r) =>
          r.url().includes(`/api/work-canvas/drafts/${draft.id}`) &&
          ['PUT', 'PATCH', 'POST'].includes(r.method()),
        { timeout: 20000 }
      )
      .catch(() => null);

    const richEditor = page.locator(CANVAS_RICH_EDITOR).first();
    await richEditor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(` ${editedContent}`);

    const autosaveReq = await autosavePromise;
    expect(autosaveReq, 'edit triggers an autosave request to the draft').not.toBeNull();
    // Then let the indicator settle to 'saved' so the commit fully landed before read-back.
    const saveStateBtn = page
      .locator('[data-testid="canvas-file-actions"] button[data-save-state]')
      .first();
    await expect(saveStateBtn).toHaveAttribute('data-save-state', /saved/, { timeout: 20000 });

    await testInfo.attach('work-canvas-core-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Persistence is verified authoritatively by RE-OPEN (spec §4.4 reload recovery):
    // autosave commits live edits to the append-only version stream, which the reload
    // renders. The base draft's `contentMd` snapshot field returned by GET /drafts/:id
    // can lag the latest autosave, so it is checked only informationally (soft).
    const persistedDraftResponse = await page.request.get(
      `${API_BASE_URL}/api/work-canvas/drafts/${draft.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(persistedDraftResponse.ok()).toBe(true);
    const persistedDraftJson = await persistedDraftResponse.json();
    const persistedDraft = persistedDraftJson?.data?.draft || persistedDraftJson?.data;
    expect
      .soft(String(persistedDraft?.contentMd || ''), 'GET /drafts/:id contentMd snapshot')
      .toContain(editedContent);

    // Re-open by deep-link → content rehydrates from the DB (authoritative persistence check).
    await openWorkCanvasDraft(page, draft);
    await expect(page.locator(CANVAS_RICH_EDITOR).first()).toContainText(editedContent);
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
