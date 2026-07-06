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
  title: string
): Promise<string | null> {
  const res = await page.request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      title,
      theme: 'modern',
      slides: [{ type: 'content', content: { title: 'Slide 1', bullets: ['E2E seed bullet'] } }],
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

    const title = `E2E Deck ${Date.now()}`;
    const deckId = await createDeck(page, token, title);
    test.skip(
      !deckId,
      'POST /api/presentations/decks did not return a deck id under the mock-DB harness ' +
        '(deck creation writes raw SQL against presentation_decks/presentation_cards; if the ' +
        'mock DB does not support this schema the create call 500s). Documented, not faked.'
    );

    await page.goto(`/presentations/builder/${deckId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="deck-builder-mels-root"]')).toBeVisible({
      timeout: 30000,
    });

    // Click the breadcrumb title to enter edit mode, then rename.
    const titleButton = page.getByRole('button', { name: title }).first();
    await expect(titleButton).toBeVisible({ timeout: 15000 });
    await titleButton.click();

    const newTitle = `${title} (edited)`;
    const titleInput = page.locator('input[value], input').filter({ hasText: '' }).first();
    // The breadcrumb <input> has no distinguishing testid; scope by proximity to
    // the mels root and by it being the only visible text input at this point.
    const scopedInput = page
      .locator('[data-testid="deck-builder-mels-root"] input')
      .first();
    await expect(scopedInput).toBeVisible({ timeout: 10000 });
    await scopedInput.fill(newTitle);
    await scopedInput.blur();

    // Give the debounced autosave time to PUT before reloading.
    await page.waitForTimeout(2500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="deck-builder-mels-root"]')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(newTitle, { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
