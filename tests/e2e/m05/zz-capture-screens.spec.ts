/**
 * M05 — generator zdjęć do odbioru graficznego (→UI): kluczowe ekrany w LIGHT i DARK.
 * NIE test asercyjny — deterministyczny capture do docs/qa/screens/. Pełne PNG (page.screenshot).
 *
 * Run:
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m05/zz-capture-screens.spec.ts --project=chromium --workers=1
 */
import fs from 'node:fs';
import path from 'node:path';

import { APIRequestContext, Page, test } from '@playwright/test';

import { AUTH_FILE, MW, createIdeaApi, deleteIdeaApi, loadAuth, makeApi, req, syncMap, uniq } from './_helpers';

const DIR = path.resolve('docs/qa/screens/m05-ideas-2026-06-20');
let api: APIRequestContext;
const trash: string[] = [];
let demoTitle = '';
let demoIdeaId = '';

function injectAuth(theme: 'light' | 'dark') {
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Record<string, string>;
  const storage = JSON.parse(raw['consultify-storage'] || '{"state":{},"version":2}');
  storage.state = storage.state || {};
  storage.state.theme = theme;
  storage.state.isSidebarCollapsed = true;
  return { token: raw.token, user: raw.user || '', storage: JSON.stringify(storage), dark: theme === 'dark' };
}

async function boot(page: Page, theme: 'light' | 'dark') {
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.addInitScript((d: ReturnType<typeof injectAuth>) => {
    localStorage.setItem('token', d.token);
    localStorage.setItem('authToken', d.token);
    if (d.user) localStorage.setItem('user', d.user);
    localStorage.setItem('consultify-storage', d.storage);
    if (d.dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, injectAuth(theme));
}

async function waitIdeasReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page
    .locator('button, [role="button"], h1, h2')
    .filter({ hasText: /New idea|Nowy pomysł|Nowa idea|Dodaj pomysł|New Idea|Pomysły|Ideas/i })
    .first()
    .waitFor({ state: 'visible', timeout: 35_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
}

const shot = (page: Page, theme: string, name: string) =>
  page.screenshot({ path: path.join(DIR, `${theme}-${name}.png`) }).catch(() => {});

async function clickIfVisible(page: Page, rx: RegExp) {
  const b = page.getByRole('button', { name: rx }).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

test.describe('M05 capture screens [→UI]', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu — capture pominięty');
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
    api = await makeApi();
    const idea = await createIdeaApi(api, uniq('M05 Demo screeny'), {
      body: 'Treść demonstracyjna do zrzutów ekranu modułu Ideas — Zarządzanie.',
      tags: ['demo', 'screeny'],
    });
    demoTitle = idea.title;
    demoIdeaId = idea.id;
    trash.push(idea.id);
    // zasiej węzeł mapy (żeby workspace miał co pokazać)
    await syncMap(api, idea.id, 1, [{ id: 'demo1', label: 'Pomysł główny' }, { id: 'demo2', label: 'Wariant A' }], [{ from: 'demo1', to: 'demo2' }]).catch(() => {});
  });

  test.afterAll(async () => {
    for (const id of trash) await deleteIdeaApi(api, id);
    await api.dispose();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} — hub + lista (table/grid/garden) + ulubione`, async ({ page }) => {
      await boot(page, theme);
      // 01) Lista idei (domyślny widok = table) + hub shell
      await page.goto('/my-work/ideas');
      await waitIdeasReady(page);
      await shot(page, theme, '01-lista-table');

      // 04) Ulubione/Recents/foldery — pasek nad listą (widoczny w widoku table)
      await shot(page, theme, '04-ulubione-recents-foldery');

      // 02) Widok Grid — segment radiogroup „Tryb widoku pomyslow" (ikony table|grid; 2. = grid).
      //     UWAGA: MyWorkHub wspiera TYLKO table|grid (NIE „garden" — ten jest nieosiągalny z huba).
      const viewGroup = page
        .locator('[role="radiogroup"][aria-label*="pomysl" i], [role="radiogroup"][aria-label*="Ideas view" i]')
        .first();
      const gridBtn = viewGroup.locator('button').nth(1);
      if (await gridBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await gridBtn.click().catch(() => {});
        await page.waitForTimeout(1200);
        await shot(page, theme, '02-lista-grid');
        // wróć do table dla stabilnego kadru kolejnych ujęć
        await viewGroup.locator('button').nth(0).click().catch(() => {});
        await page.waitForTimeout(600);
      }
    });

    test(`${theme} — workspace mapy + szablony + eksport`, async ({ page }) => {
      await boot(page, theme);
      // deep-link prosto do workspace mapy (MyWorkHub:467 segments[3]==='workspace' → openMap)
      await page.goto(`/my-work/ideas/${encodeURIComponent(demoIdeaId)}/workspace`, {
        waitUntil: 'domcontentloaded',
      });
      const canvas = page
        .locator('.react-flow, [class*="reactflow"], canvas, [data-testid*="workspace"]')
        .first();
      // workspace montuje się lazy (Suspense); nie blokuj na selektorze kanwy — daj czas i zrzuć
      await canvas.waitFor({ state: 'visible', timeout: 12_000 }).catch(() => {});
      await page.waitForTimeout(6000);
      // 07) Workspace mapy (kanwa grafu) — zrzut bezwarunkowy (deep-link openMap)
      await shot(page, theme, '07-workspace-mapa');

      // 10) Menu eksportu (window-event jak w spec 04 — retry aż listener się zarejestruje)
      const exportHeading = page.getByRole('heading', { name: /Eksport mapy|Export map/i }).first();
      for (let i = 0; i < 4; i++) {
        await page.evaluate((id) => {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId: id } })
          );
        }, demoIdeaId);
        if (await exportHeading.isVisible({ timeout: 4000 }).catch(() => false)) break;
        await page.waitForTimeout(1000);
      }
      if (await exportHeading.isVisible().catch(() => false)) {
        await shot(page, theme, '10-menu-eksportu');
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
      }
      // 09) Galeria szablonów (best-effort)
      if (await clickIfVisible(page, /Template|Szablon|Galeria/i)) {
        await shot(page, theme, '09-galeria-szablonow');
        await page.keyboard.press('Escape').catch(() => {});
      }
    });
  }
});
