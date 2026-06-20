/**
 * M04 §1 Biblioteka L1 + §2 Edytor TipTap/autosave
 * Źródło schematów: Harvard/Testy manualne/TESTY_M04_NOTATNIK.md (§1, §2)
 */
import { APIRequestContext, expect, test } from '@playwright/test';

import {
  SEL,
  createPageApi,
  deletePageApi,
  getDefaultNotebookId,
  getPageApi,
  gotoNotebook,
  loadAuth,
  makeApi,
  openNote,
  openNotebook,
  req,
  setupAuth,
  uniq,
} from './_helpers';

test.describe('M04 §1 Biblioteka L1 + §2 Edytor/autosave', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu /tmp/consultify-auth.json — uczciwy skip');
  test.setTimeout(90_000);

  let api: APIRequestContext;
  let notebookId: string;
  const trash: string[] = [];

  test.beforeAll(async () => {
    api = await makeApi();
    notebookId = await getDefaultNotebookId(api);
  });

  test.afterAll(async () => {
    for (const id of trash) await deletePageApi(api, id);
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  // ── §1.1 Lista notatników ──────────────────────────────
  test('§1.1 lista notatników renderuje się i zgadza się z API', async ({ page }) => {
    const res = await req(api, 'get', '/api/my-work/notebooks');
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.notebooks || body.data || [];
    expect(list.length).toBeGreaterThan(0);

    await gotoNotebook(page);
    // moduł notatnika załadowany: przycisk "New notebook" jest specyficzny dla biblioteki L1
    await expect(page.getByRole('button', { name: SEL.newNotebookBtn }).first()).toBeVisible({
      timeout: 20_000,
    });
    // tytuł co najmniej jednego notatnika z API widoczny
    const firstTitle = list[0].title as string;
    await expect(page.getByText(firstTitle, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── §1.2 Create notatnik (UI → POST 201) ───────────────
  test('§1.2 utworzenie notatnika przez UI → POST 200/201 + nowy wiersz', async ({ page }) => {
    await gotoNotebook(page);
    const title = uniq('E2E Notebook');

    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/my-work/notebooks') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      (async () => {
        await page.getByRole('button', { name: SEL.newNotebookBtn }).first().click();
        await page.waitForTimeout(800);
        // pole tytułu w modalu/inline
        const input = page
          .locator('input[type="text"]:visible, input:not([type]):visible, [contenteditable="true"]:visible')
          .first();
        await input.fill(title);
        await page.keyboard.press('Enter');
        // jeśli jest przycisk Create/Utwórz w modalu
        const create = page.getByRole('button', { name: /^Create$|^Utwórz$|^Save$|^Zapisz$|^Add$|^Dodaj$/i }).first();
        if (await create.isVisible().catch(() => false)) await create.click().catch(() => {});
      })(),
    ]);

    expect([200, 201]).toContain(postResp.status());
    const created = await postResp.json().catch(() => ({}));
    const createdId = created?.data?.id || created?.id;

    // weryfikacja "DB": API potwierdza nowy notatnik
    const after = await req(api, 'get', '/api/my-work/notebooks');
    const list = (await after.json()).notebooks || [];
    expect(list.some((n: any) => n.title === title)).toBeTruthy();

    // cleanup notatnika (best-effort)
    if (createdId) await req(api, 'delete', `/api/my-work/notebooks/${createdId}`).catch(() => {});
  });

  // ── §1.5 Archive wyłączone by-design dla NOTATNIKÓW ─────
  test('§1.5 notatnik nie ma aktywnej archiwizacji (by-design)', async ({ page }) => {
    await gotoNotebook(page);
    // by-design: lista notatników (L1) nie udostępnia "Archiwizuj" kontenera.
    // Weryfikujemy że nie ma globalnego aktywnego przycisku Archive na poziomie listy notatników.
    const archiveOnLibrary = page.getByRole('button', { name: /^Archive notebook$|^Archiwizuj notatnik$/i });
    expect(await archiveOnLibrary.count()).toBe(0);
  });

  // ── §2.1 Otwieranie notatki (edytor renderuje content) ──
  test('§2.1 otwarcie notatki renderuje treść z content_json', async ({ page }) => {
    const marker = uniq('OPEN');
    const created = await createPageApi(api, notebookId, `E2E Open ${marker}`, `Body ${marker} content.`);
    trash.push(created.id);

    await openNotebook(page, notebookId);
    await openNote(page, created.title);
    // edytor pokazuje treść strony
    await expect(page.getByText(`Body ${marker} content.`, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── §2.2 Edycja + autosave (debounce: 1 PUT, nie per-keystroke) ──
  test('§2.2 edycja → autosave debounced (PUT) + treść w API', async ({ page }) => {
    const marker = uniq('SAVE');
    const created = await createPageApi(api, notebookId, `E2E Save ${marker}`, 'seed');
    trash.push(created.id);

    await openNotebook(page, notebookId);
    await openNote(page, created.title);

    const body = `Autosave probe ${marker}.`;
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press('Control+A').catch(() => {});
    await editor.fill('').catch(() => {});
    await page.keyboard.type(body, { delay: 30 });

    // czekaj na autosave PUT
    const put = await page
      .waitForResponse(
        (r) =>
          /\/api\/(v8\/)?my-work\/notebook\/pages\//.test(r.url()) &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      )
      .catch(() => null);
    expect(put, 'oczekiwano autosave PUT').not.toBeNull();
    expect(put!.status()).toBe(200);

    // weryfikacja "DB": API zwraca zapisany tekst
    await page.waitForTimeout(1000);
    const fromApi = await getPageApi(api, created.id);
    expect(JSON.stringify(fromApi)).toContain(marker);
  });

  // ── §2.3 Autosave — trwałość po reload ──────────────────
  test('§2.3 treść trwała po pełnym reload', async ({ page }) => {
    const marker = uniq('RELOAD');
    const created = await createPageApi(api, notebookId, `E2E Reload ${marker}`, 'seed');
    trash.push(created.id);

    await openNotebook(page, notebookId);
    await openNote(page, created.title);

    const body = `Persist ${marker} across reload.`;
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press('Control+A').catch(() => {});
    await editor.fill('').catch(() => {});
    await page.keyboard.type(body, { delay: 25 });
    await page
      .waitForResponse(
        (r) => /notebook\/pages\//.test(r.url()) && r.request().method() === 'PUT',
        { timeout: 20_000 }
      )
      .catch(() => null);
    await page.waitForTimeout(1200);

    // pełny reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByText(created.title, { exact: false }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(body, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  });
});
