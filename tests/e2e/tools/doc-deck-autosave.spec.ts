/**
 * Deck Builder — create/open + edit persistence.
 *
 * Route: /presentations/builder/:deckId (DeckBuilder.tsx).
 * Deck creation: POST /api/presentations/decks (title required).
 * Autosave: PUT /api/presentations/decks/:deckId/autosave (DeckBuilder.tsx
 * autosaveTimerRef, debounced) -- P3.1 optimistic-lock + conflict banner
 * (data-testid="deck-conflict-banner").
 *
 * NOTE: unlike Document Studio, this codebase's DeckBuilder does not expose a
 * direct WYSIWYG contentEditable slide-text surface in CardCanvas.tsx (the
 * per-slide "rewrite" box is an AI-instruction input, and the Speaker Notes
 * textarea is `readOnly`). The one directly user-editable, autosave-triggering
 * field reachable without an AI round-trip is the deck TITLE
 * (DeckBuilderTopBar.tsx: click title -> <input> -> onTitleChange). We use
 * that as the persistence probe.
 */
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function bootstrapToken(page: import('@playwright/test').Page): Promise<string> {
  const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
  const runId = `deck-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await page.request
    .post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId },
    })
    .catch(() => null);
  if (res && res.ok()) {
    const payload = (await res.json()) as { token?: string };
    if (payload?.token) return String(payload.token);
  }
  const reg = await page.request
    .post(`${API_BASE_URL}/api/auth/register-demo`, {
      data: { email: `e2e+${runId}@local.test`, password: 'Playwright#123', firstName: 'E2E' },
    })
    .catch(() => null);
  if (reg && reg.ok()) {
    const payload = (await reg.json()) as any;
    return String(payload?.token || payload?.accessToken || '');
  }
  return '';
}

async function seedAuth(page: import('@playwright/test').Page, token: string) {
  await page.addInitScript((t: string) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refreshToken', 'e2e-refresh');
    const user = {
      id: 'e2e-deck-user',
      email: 'e2e-deck@local.test',
      role: 'ADMIN',
      organizationId: 'e2e-org-id',
      organizationName: 'E2E Organization',
      firstName: 'E2E',
      lastName: 'Deck',
      isAuthenticated: true,
      accessLevel: 'full',
    };
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem(
      'consultinity-storage',
      JSON.stringify({
        state: {
          sessionMode: 'FULL',
          currentUser: user,
          currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
        },
        version: 0,
      })
    );
  }, token);
}

async function createDeck(
  page: import('@playwright/test').Page,
  token: string,
  title: string,
  slides: Array<{ type: string; content: { title: string; bullets: string[] } }> = [
    { type: 'content', content: { title: 'Slide 1', bullets: ['E2E seed bullet'] } },
  ]
): Promise<string | null> {
  const res = await page.request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      title,
      theme: 'modern',
      slides,
      source: 'e2e-tools-suite',
    },
  });
  if (!res.ok()) return null;
  const json = await res.json().catch(() => ({}) as any);
  return String(json?.data?.id || '');
}

test.describe('Deck Builder — create + edit persistence [@module:presentations]', () => {
  test.setTimeout(120000);

  test('deck title edit survives a hard reload (autosave)', async ({ page }) => {
    const token = await bootstrapToken(page);
    test.skip(!token, 'Could not acquire an auth token from test-support/register-demo endpoints.');
    await seedAuth(page, token);
    await suppressOnboarding(page);

    const title = `E2E Deck ${Date.now()}`;
    const deckId = await createDeck(page, token, title);
    test.skip(
      !deckId,
      'POST /api/presentations/decks did not return a deck id under the mock-DB harness ' +
        '(deck creation writes raw SQL against presentation_decks/presentation_cards; if the ' +
        'mock DB does not support this schema the create call 500s). Documented, not faked.'
    );

    await page.goto(`/presentations/builder/${deckId}`, { waitUntil: 'domcontentloaded' });
    await dismissOverlayIfPresent(page);

    // The application performs authentication and organization bootstrap before
    // mounting the route. `locator.isVisible()` is an immediate getter (its
    // `timeout` option does not wait), so using it here races that bootstrap and
    // can report an empty body even though the deck chunk has loaded correctly.
    // Wait for the real editor shell; a timeout remains a hard failure and the
    // diagnostic below records the resulting route/body.
    const melsRoot = page.locator('[data-testid="deck-builder-mels-root"]');
    const shellReady = await melsRoot
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    const shellDiagnostic = shellReady
      ? ''
      : ` URL=${page.url()} BODY=${(await page.locator('body').innerText().catch(() => 'unavailable'))
          .replace(/\s+/g, ' ')
          .slice(0, 500)}`;
    expect(
      shellReady,
      'Deck Builder rendered without data-testid="deck-builder-mels-root" after direct deck ' +
        'creation. The create/open contract must persist deck_json in the initial write so the ' +
        `full editor can hydrate under the mock-DB harness.${shellDiagnostic}`
    ).toBe(true);

    // Click the breadcrumb title to enter edit mode, then rename. NOTE: a Teresa
    // chat-panel widget also renders a same-named button ("AI sees: Presentation:
    // <title>" chip) elsewhere on the page, confirmed live via error-context
    // snapshot -- an unscoped getByRole('button', {name: title}).first() can
    // grab THAT one instead of the deck-builder breadcrumb button. Scope strictly
    // to the mels root.
    const titleButton = melsRoot.getByRole('button', { name: title }).first();
    await expect(titleButton).toBeVisible({ timeout: 15000 });
    await titleButton.click();

    const newTitle = `${title} (edited)`;
    // The breadcrumb <input> has no distinguishing testid; scope by proximity to
    // the mels root. A hidden file-upload <input type="file"> also lives under
    // the same root (confirmed live), so filter to the visible one.
    const scopedInput = melsRoot.locator('input:visible').first();
    await expect(scopedInput).toBeVisible({ timeout: 10000 });
    await scopedInput.fill(newTitle);
    await scopedInput.blur();

    // Give the debounced autosave time to PUT before reloading.
    await page.waitForTimeout(2500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissOverlayIfPresent(page);
    await expect(page.locator('[data-testid="deck-builder-mels-root"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(newTitle, { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });

    // Exercise the mounted-runtime -> realDB -> export pipeline as one chain.
    // A successful HTTP status is insufficient: inspect the returned OOXML and
    // prove that it is a real PPTX generated from the current persisted deck.
    const download = await page.request.get(
      `${API_BASE_URL}/api/presentations/decks/${deckId}/download?mode=draft`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // The first download materializes PPTX from the persisted deck. Keep the
        // normal 15s interaction budget elsewhere, but allow this export job to
        // complete on a busy staging-realDB runtime.
        timeout: 60000,
      }
    );
    const downloadFailure = download.ok() ? '' : await download.text().catch(() => '');
    expect(
      download.status(),
      `Mounted realDB PPTX export failed for deck ${deckId}: ${downloadFailure}`
    ).toBe(200);
    expect(download.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(download.headers()['x-artifact-export-mode']).toBe('draft');
    expect(download.headers()['x-artifact-draft']).toBe('true');

    // Read the persisted head after export. The mounted editor may flush one
    // last debounced autosave between reload and download, so a pre-export
    // version read can legitimately become stale. The export must identify the
    // exact immutable content revision that is current after materialization.
    const approvalStateResponse = await page.request.get(
      `${API_BASE_URL}/api/presentations/decks/${deckId}/approval-state`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(approvalStateResponse.status()).toBe(200);
    const approvalState = (await approvalStateResponse.json()) as {
      data?: { versionId?: string };
    };
    const persistedVersionId = String(approvalState.data?.versionId || '');
    expect(persistedVersionId).not.toBe('');
    expect(download.headers()['x-artifact-version-id']).toBe(
      `${deckId}@${persistedVersionId}`
    );
    expect(download.headers()['content-disposition']).toContain('-DRAFT.pptx');
    const pptx = await download.body();
    expect(pptx.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    const zip = await JSZip.loadAsync(pptx);
    const semanticXmlFiles = Object.keys(zip.files).filter(
      (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name) || name === 'docProps/core.xml'
    );
    expect(semanticXmlFiles.length).toBeGreaterThan(0);
    const semanticXml = (
      await Promise.all(semanticXmlFiles.map((name) => zip.files[name].async('string')))
    ).join('\n');
    expect(semanticXml).toContain('E2E seed bullet');
  });

  test('present starts from current slide and presenter view restores the editor with Escape', async ({
    page,
  }) => {
    const token = await bootstrapToken(page);
    test.skip(!token, 'Could not acquire an auth token.');
    await seedAuth(page, token);
    await suppressOnboarding(page);

    const deckId = await createDeck(page, token, `E2E Present ${Date.now()}`, [
      { type: 'content', content: { title: 'Opening slide', bullets: ['Opening'] } },
      { type: 'content', content: { title: 'Current slide', bullets: ['Current'] } },
      { type: 'content', content: { title: 'Next slide', bullets: ['Next'] } },
    ]);
    test.skip(!deckId, 'Could not create presentation fixture.');

    await page.goto(`/presentations/builder/${deckId}`, { waitUntil: 'domcontentloaded' });
    await dismissOverlayIfPresent(page);
    const root = page.locator('[data-testid="deck-builder-mels-root"]');
    await expect(root).toBeVisible({ timeout: 30000 });

    await root.locator('[data-testid="deck-slide-1"]').click();
    await root.getByRole('button', { name: 'Present', exact: true }).click();
    const audience = page.getByTestId('audience-present-view');
    await expect(audience).toBeVisible();
    await expect(audience.getByText('Current slide', { exact: false }).first()).toBeVisible();
    await expect(audience.getByText('2 / 3')).toBeVisible();
    await expect(audience.getByText('Private notes', { exact: false })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(root).toBeVisible();
    await expect(root.locator('[data-testid="deck-slide-1"]')).toBeVisible();

    const more = root.getByRole('button', { name: /more|więcej/i }).first();
    await more.click();
    await page.getByRole('menuitem', { name: 'Presenter view' }).click();
    const presenter = page.getByTestId('presenter-view');
    await expect(presenter).toBeVisible();
    await expect(presenter.getByText('Current slide', { exact: false }).first()).toBeVisible();
    await expect(presenter.getByText('Next slide', { exact: false }).first()).toBeVisible();
    await expect(presenter.getByText('Speaker Notes', { exact: false })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(root).toBeVisible();
    await expect(root.locator('[data-testid="deck-slide-1"]')).toBeVisible();
  });
});
