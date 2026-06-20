/**
 * M04 — generator zdjęć do odbioru graficznego (→UI): kluczowe ekrany w LIGHT i DARK.
 * NIE jest to test asercyjny modułu — to deterministyczny capture do `docs/qa/screens/`.
 * Pełne pliki PNG (page.screenshot{path}) — niezależne od rozszerzenia Chrome.
 *
 * Run:
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m04-notebook/zz-capture-screens.spec.ts --project=chromium --workers=1
 */
import fs from 'node:fs';
import path from 'node:path';

import { Page, expect, test } from '@playwright/test';

import { AUTH_FILE, loadAuth } from './_helpers';

const NB =
  'nb_default_a3e05d4a-5397-419d-b486-8e44366c0063_d2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const NOTE_TITLE = 'Q2 Strategy'; // istniejąca notatka z bogatą treścią
const DIR = path.resolve('docs/qa/screens/m04-notebook-2026-06-20');

function injectAuth(theme: 'light' | 'dark', railOpen: boolean, tab: 'work' | 'context') {
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Record<string, string>;
  const storage = JSON.parse(raw['consultify-storage'] || '{"state":{},"version":2}');
  storage.state = storage.state || {};
  storage.state.theme = theme;
  storage.state.notebookRailOpen = railOpen;
  storage.state.notebookRailTab = tab;
  storage.state.isSidebarCollapsed = true;
  return {
    token: raw.token,
    user: raw.user || '',
    storage: JSON.stringify(storage),
    dark: theme === 'dark',
  };
}

async function boot(
  page: Page,
  theme: 'light' | 'dark',
  railOpen: boolean,
  tab: 'work' | 'context'
) {
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.addInitScript((d: ReturnType<typeof injectAuth>) => {
    localStorage.setItem('token', d.token);
    localStorage.setItem('authToken', d.token);
    if (d.user) localStorage.setItem('user', d.user);
    localStorage.setItem('consultify-storage', d.storage);
    if (d.dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, injectAuth(theme, railOpen, tab));
}

// Cold-load SPA bywa wolny (~8s). Czekaj aż zniknie spinner i pojawi się realny UI notatnika.
async function waitNotebookReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // którykolwiek stabilny element modułu (biblioteka lub workspace)
  await page
    .locator(
      'button:has-text("New notebook"), button:has-text("Nowy notatnik"), button:has-text("New note"), button:has-text("Nowa notatka"), .ProseMirror'
    )
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
}

async function openNoteForShot(page: Page): Promise<boolean> {
  const note = page.getByText(NOTE_TITLE, { exact: false }).first();
  const ok = await note.isVisible({ timeout: 20_000 }).catch(() => false);
  if (!ok) return false;
  await note.click();
  // poczekaj aż edytor wyrenderuje treść
  await page
    .locator('.ProseMirror')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  return true;
}

test.describe('M04 capture screens [→UI]', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu — capture pominięty');
  test.setTimeout(120_000);

  test.beforeAll(() => {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} — biblioteka L1 + edytor L2/L3`, async ({ page }) => {
      // 1) Biblioteka L1
      await boot(page, theme, false, 'work');
      await page.goto('/my-work/notebook');
      await waitNotebookReady(page);
      await page.screenshot({ path: path.join(DIR, `${theme}-01-biblioteka.png`) });

      // 2) Workspace + edytor (rail zamknięty — czysty edytor)
      await page.goto(`/my-work/notebook?notebook=${NB}`);
      await waitNotebookReady(page);
      const opened = await openNoteForShot(page);
      expect(opened, 'notatka demo nie otworzyła się').toBeTruthy();
      await page.screenshot({ path: path.join(DIR, `${theme}-02-edytor.png`) });
    });

    test(`${theme} — prawy rail (Praca + Kontekst)`, async ({ page }) => {
      // 3) Edytor + rail "Praca" (railOpen=true, tab=work z localStorage)
      await boot(page, theme, true, 'work');
      await page.goto(`/my-work/notebook?notebook=${NB}`);
      await waitNotebookReady(page);
      const opened = await openNoteForShot(page);
      expect(opened, 'notatka demo nie otworzyła się (rail)').toBeTruthy();
      // upewnij się że rail jest widoczny
      await page
        .getByRole('button', { name: /^Work$|^Praca$/i })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(DIR, `${theme}-03-rail-praca.png`) });

      // 4) Rail "Kontekst" — przełącz zakładkę (bez reloadu)
      const ctx = page.getByRole('button', { name: /^Context$|^Kontekst$/i }).first();
      if (await ctx.isVisible().catch(() => false)) {
        await ctx.click();
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: path.join(DIR, `${theme}-04-rail-kontekst.png`) });
      expect(fs.existsSync(path.join(DIR, `${theme}-04-rail-kontekst.png`))).toBeTruthy();
    });
  }
});
