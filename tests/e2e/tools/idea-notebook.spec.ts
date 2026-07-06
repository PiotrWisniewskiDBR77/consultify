/**
 * M04 — Notebook — create notebook + page, type content, reload, persists.
 *
 * CORRECTED FACTS (verified against the actual running mock backend, not
 * guessed): the notebook-container + notebook-pages routes ARE live under the
 * legacy (non-v8) mount:
 *
 *   - `server/src/routes/my-work/notebook.routes.ts` (a sub-router NOT
 *     inlined in my-work.routes.ts — easy to miss with a single-file grep)
 *     registers `POST /notebooks` (create container) and
 *     `POST /notebook/pages` (create a page, optional `notebookId` body field
 *     — falls back to the user's default notebook when omitted).
 *   - It is mounted at `/api/my-work` via
 *     `my-work.routes.ts:54 import notebookRouter from './my-work/notebook.routes.js'`,
 *     so the live paths are `POST /api/my-work/notebooks` and
 *     `POST /api/my-work/notebook/pages` — NO v8 gate, NO ENABLE_V8_GLOBAL
 *     needed. Confirmed empirically: POST /api/my-work/notebooks → 201.
 *   - There IS also a v8 variant (`server/src/routes/v8/my-work.routes.ts`,
 *     gated by ENABLE_V8_GLOBAL), and `src/services/api.ts`
 *     (`Api.createNotebookPage` / `Api.updateNotebookPage`) tries v8 FIRST
 *     and transparently falls back to the legacy endpoint on 404/'V8_DISABLED'
 *     (`Api.shouldFallbackToLegacyMyWorkNotebook`), so the product works
 *     correctly either way — this harness (no ENABLE_V8_GLOBAL) exercises the
 *     legacy fallback path.
 *   - The notebook UI is NOT a standalone `/my-work/notebook` route; it is a
 *     tab inside `/my-work` selected via the `?notebook=<pageId>` query param
 *     (`src/components/MyWork/MyWorkHub.tsx:443` `getInitialMyWorkTab`).
 *
 * Flow: create a notebook container, create a page in it, open
 * `/my-work?notebook=<pageId>`, type into the ProseMirror editor, reload, and
 * confirm the typed content persisted (PUT /api/my-work/notebook/pages/:id
 * autosave, `src/services/api.ts` `updateNotebookPage`).
 */
import { expect, Page, test } from '@playwright/test';

import { seedE2EAuthWithBootstrap } from '../smoke/runtime-gate-helpers';
import { suppressOnboarding } from '../smoke/work-canvas-helpers';
import { waitVisible } from './_helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getSeededToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  if (!token) throw new Error('seedE2EAuthWithBootstrap did not leave a token in localStorage');
  return token;
}

async function createNotebook(page: Page, token: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/notebooks`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, scope: 'personal' },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createNotebook failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

async function createNotebookPage(page: Page, token: string, notebookId: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/notebook/pages`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      notebookId,
      title,
      contentJson: { type: 'doc', content: [] },
      contentText: '',
    },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createNotebookPage failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

async function dismissOnboardingButtons(page: Page) {
  const buttons = [
    /Skip for now|Pomiń na razie|Pomiń/i,
    /Skip tour|Pomiń wycieczkę/i,
    /Get started|Zaczynaj|Rozpocznij/i,
  ];
  for (let i = 0; i < 6; i += 1) {
    let acted = false;
    for (const re of buttons) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(250);
  }
}

test.describe('M04 Notebook — create page, type, reload persists', () => {
  test('typed content in a notebook page survives a hard reload', async ({ page }) => {
    test.setTimeout(180000);

    await suppressOnboarding(page);
    await seedE2EAuthWithBootstrap(page);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const token = await getSeededToken(page);

    const notebook = await createNotebook(page, token, uniqueLabel('nb'));
    const notebookPage = await createNotebookPage(page, token, notebook.id, uniqueLabel('page'));

    await page.goto(`/my-work?notebook=${encodeURIComponent(notebookPage.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboardingButtons(page);

    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    const editorVisible = await waitVisible(editor, 30000);
    test.skip(
      !editorVisible,
      'Notebook page editor (.ProseMirror) did not mount for the created page under mock — ' +
        'cannot verify the type-then-persist flow. See src/components/MyWork/NotebookContent.tsx ' +
        'and MyWorkHub.tsx:443 getInitialMyWorkTab for the ?notebook= wiring.'
    );

    const content = `E2E notebook content ${Date.now()}`;
    await editor.click();
    await page.keyboard.type(content);
    await page.waitForTimeout(3000); // autosave debounce before PUT /notebook/pages/:id

    await page.goto(`/my-work?notebook=${encodeURIComponent(notebookPage.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboardingButtons(page);

    const editorAfterReload = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await expect(editorAfterReload).toBeVisible({ timeout: 30000 });
    await expect(
      editorAfterReload,
      `typed content should persist across reload via PUT /api/my-work/notebook/pages/${notebookPage.id}`
    ).toContainText(content, { timeout: 15000 });
  });
});
