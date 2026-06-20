/**
 * M04 — generator zdjęć do odbioru graficznego (→UI): kluczowe ekrany/zakładki w LIGHT i DARK.
 * NIE jest to test asercyjny modułu — to deterministyczny capture do `docs/qa/screens/`.
 * Pełne pliki PNG (page.screenshot{path}) — niezależne od rozszerzenia Chrome.
 *
 * Run:
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m04-notebook/zz-capture-screens.spec.ts --project=chromium --workers=1
 */
import fs from 'node:fs';
import path from 'node:path';

import { APIRequestContext, Page, expect, test } from '@playwright/test';

import {
  AUTH_FILE,
  createPageApi,
  deletePageApi,
  getDefaultNotebookId,
  loadAuth,
  makeApi,
} from './_helpers';

const NB =
  'nb_default_a3e05d4a-5397-419d-b486-8e44366c0063_d2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const NOTE_TITLE = 'Q2 Strategy'; // istniejąca notatka z bogatą treścią (edytor/rail)
const DIR = path.resolve('docs/qa/screens/m04-notebook-2026-06-20');

let api: APIRequestContext;
let demoTitle = '';
const trash: string[] = [];

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

// Cold-load SPA bywa wolny (~8s). Czekaj aż pojawi się realny UI notatnika.
async function waitNotebookReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page
    .locator(
      'button:has-text("New notebook"), button:has-text("Nowy notatnik"), button:has-text("New note"), button:has-text("Nowa notatka"), .ProseMirror'
    )
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
}

async function openNote(page: Page, title: string): Promise<boolean> {
  const note = page.getByText(title, { exact: false }).first();
  const ok = await note.isVisible({ timeout: 20_000 }).catch(() => false);
  if (!ok) return false;
  await note.click();
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return true;
}

const shot = (page: Page, theme: string, name: string) =>
  page.screenshot({ path: path.join(DIR, `${theme}-${name}.png`) });

test.describe('M04 capture screens [→UI]', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu — capture pominięty');
  test.setTimeout(150_000);

  test.beforeAll(async () => {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
    api = await makeApi();
    const nb = await getDefaultNotebookId(api);
    const demo = await createPageApi(
      api,
      nb,
      `M04 Demo screeny ${Math.random().toString(36).slice(2, 7)}`,
      'Treść demonstracyjna do zrzutów ekranu modułu Notatnik. Drugi akapit dla kontekstu.'
    );
    demoTitle = demo.title;
    trash.push(demo.id);
  });

  test.afterAll(async () => {
    for (const id of trash) await deletePageApi(api, id);
    await api.dispose();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} — tabela L1 + edytor L2/L3`, async ({ page }) => {
      // 01) Tabela L1 — lista notesów (filtry All/Personal/Team)
      await boot(page, theme, false, 'work');
      await page.goto('/my-work/notebook');
      await waitNotebookReady(page);
      await shot(page, theme, '01-tabela-lista-notesow');

      // 02) Wnętrze notesu — edytor L2/L3 (rail zamknięty)
      await page.goto(`/my-work/notebook?notebook=${NB}`);
      await waitNotebookReady(page);
      const opened = await openNote(page, NOTE_TITLE);
      expect(opened, 'notatka nie otworzyła się').toBeTruthy();
      await shot(page, theme, '02-edytor');
    });

    test(`${theme} — zakładki prawego raila (Praca + Kontekst)`, async ({ page }) => {
      // 03) Zakładka "Praca" (Insert + AI + Convert×7 + Transform)
      await boot(page, theme, true, 'work');
      await page.goto(`/my-work/notebook?notebook=${NB}`);
      await waitNotebookReady(page);
      expect(await openNote(page, NOTE_TITLE), 'notatka nie otworzyła się (rail)').toBeTruthy();
      await page
        .getByRole('button', { name: /^Work$|^Praca$/i })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, theme, '03-zakladka-praca');

      // 04) Zakładka "Kontekst" (backlinks / linked outputs)
      const ctx = page.getByRole('button', { name: /^Context$|^Kontekst$/i }).first();
      if (await ctx.isVisible().catch(() => false)) {
        await ctx.click();
        await page.waitForTimeout(1500);
      }
      await shot(page, theme, '04-zakladka-kontekst');
    });

    test(`${theme} — slash menu + modal nowej notatki`, async ({ page }) => {
      await boot(page, theme, false, 'work');
      await page.goto(`/my-work/notebook?notebook=${NB}`);
      await waitNotebookReady(page);
      // używamy notatki DEMO (do edycji), nie realnej Q2
      const opened = await openNote(page, demoTitle);
      expect(opened, 'notatka demo nie otworzyła się').toBeTruthy();

      // 05) Slash menu — wstawianie bloków
      const editor = page.locator('.ProseMirror').first();
      await editor.click();
      await page.keyboard.press('End').catch(() => {});
      await page.keyboard.press('Enter');
      await page.keyboard.type('/', { delay: 60 });
      await page.waitForTimeout(1000);
      await shot(page, theme, '05-slash-menu');
      // posprzątaj znak '/' żeby nie zaśmiecać demo
      await page.keyboard.press('Backspace').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});

      // 06) Modal nowej notatki (picker szablonów + upload)
      const newBtn = page.getByRole('button', { name: /^New note$|^Nowa notatka$/i }).first();
      if (await newBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await newBtn.click();
        await page.waitForTimeout(1200);
        await shot(page, theme, '06-modal-nowa-notatka');
        await page.keyboard.press('Escape').catch(() => {});
      }
    });
  }
});
