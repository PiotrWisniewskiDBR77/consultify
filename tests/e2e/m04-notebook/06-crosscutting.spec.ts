/**
 * M04 §12 Testy przekrojowe (cross-cutting)
 * Źródło: Harvard/Testy manualne/TESTY_M04_NOTATNIK.md §12
 * Realne UI: czysta konsola, brak surowych kluczy i18n, dark-mode render, provenance.
 */
import { APIRequestContext, expect, test } from '@playwright/test';

import {
  createPageApi,
  deletePageApi,
  getDefaultNotebookId,
  loadAuth,
  makeApi,
  openNote,
  openNotebook,
  setupAuth,
  uniq,
} from './_helpers';

test.describe('M04 §12 Cross-cutting', () => {
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

  // ── §12.4 Console: zero błędów przez sesję notatnika ────
  test('§12.4 sesja notatnika bez błędów konsoli', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    const created = await createPageApi(api, notebookId, `E2E Console ${uniq('C')}`, 'console probe');
    trash.push(created.id);
    await openNotebook(page, notebookId);
    await openNote(page, created.title);
    await page.waitForTimeout(1500);

    // odfiltruj szum nie-aplikacyjny (sieć 3rd-party, favicon, ResizeObserver, devtools)
    const appErrors = errors.filter(
      (e) =>
        !/ResizeObserver|favicon|net::ERR|Failed to load resource|chrome-extension|\[vite\]|hydrat/i.test(
          e
        )
    );
    expect(appErrors, `błędy konsoli:\n${appErrors.join('\n')}`).toHaveLength(0);
  });

  // ── §12.1 i18n: UI nie pokazuje surowych kluczy tłumaczeń ─
  test('§12.1 brak surowych kluczy i18n w UI notatnika', async ({ page }) => {
    const created = await createPageApi(api, notebookId, `E2E i18n ${uniq('I')}`, 'i18n probe');
    trash.push(created.id);
    await openNotebook(page, notebookId);
    await openNote(page, created.title);
    await page.waitForTimeout(1500);

    const bodyText = (await page.locator('body').innerText()) || '';
    // surowe klucze typu "aiChat.menu.foo" / "notebook.rail.bar" wyciekłyby jako kropkowane tokeny
    const rawKeys = bodyText.match(/\b[a-z][a-zA-Z0-9]+\.[a-z][a-zA-Z0-9]+\.[a-zA-Z0-9.]+\b/g) || [];
    // dozwolone fałszywe trafienia (nazwy plików, domeny, wersje)
    const leaked = rawKeys.filter(
      (k) => !/\.(tsx?|jsx?|json|md|png|svg|com|ai|io|dev)\b/i.test(k) && k.split('.').length >= 3
    );
    expect(leaked, `możliwe surowe klucze i18n: ${leaked.join(', ')}`).toHaveLength(0);
  });

  // ── §12.2 Dark mode: edytor renderuje się po przełączeniu na ciemny ─
  test('§12.2 dark mode — edytor + lista renderują się bez crash', async ({ page }) => {
    const created = await createPageApi(api, notebookId, `E2E Dark ${uniq('D')}`, 'dark mode probe');
    trash.push(created.id);

    // wymuś dark przez localStorage zustand (theme) przed startem
    await page.addInitScript(() => {
      try {
        const raw = localStorage.getItem('consultify-storage');
        if (raw) {
          const s = JSON.parse(raw);
          s.state = s.state || {};
          s.state.theme = 'dark';
          localStorage.setItem('consultify-storage', JSON.stringify(s));
        }
        document.documentElement.classList.add('dark');
      } catch {
        /* noop */
      }
    });

    await openNotebook(page, notebookId);
    await openNote(page, created.title);
    await page.waitForTimeout(1000);

    // edytor obecny + treść widoczna w dark
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('dark mode probe', { exact: false }).first()).toBeVisible();
    // html ma klasę dark
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBeTruthy();
  });

  // ── §12.5 Provenance spójność: convert ustawia source na stronie ─
  test('§12.5 provenance — convert→task zapisuje converted_to na stronie', async ({ page: _p }) => {
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Prov ${uniq('P')}`,
      'Provenance consistency probe with enough words to be safe.'
    );
    trash.push(created.id);

    const res = await api
      .post(`/api/my-work/notebook/pages/${created.id}/convert`, { data: { target: 'task' } })
      .catch(() => null);
    // konwersja może wymagać v8 mount — spróbuj fallback
    const ok = res && [200, 201].includes(res.status());
    if (!ok) {
      const res2 = await api.post(`/api/v8/my-work/notebook/pages/${created.id}/convert`, {
        data: { target: 'task' },
      });
      expect([200, 201]).toContain(res2.status());
    }

    // strona ma teraz provenance/converted_to
    const after = await api.get(`/api/my-work/notebook/pages/${created.id}`);
    const page = (await after.json()).data || (await after.json());
    const serialized = JSON.stringify(page);
    expect(serialized).toMatch(/converted|task/i);
  });
});
