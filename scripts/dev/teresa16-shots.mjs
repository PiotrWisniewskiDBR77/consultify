// Jednorazowy skrypt dowodowy: powtarza kroki teresa-16-modulow.spec.ts, ale
// przed zrzutem przewija panel Teresy do widocznego "Źródła: N" (albo do końca
// odpowiedzi, gdy modul jest pusty). Nie zmienia produktu — tylko poprawia
// jakość dowodu (poprzedni przebieg łapał zrzut w trakcie przewijania).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3115';
const authPath = process.env.ODBIOR_AUTH_STATE || '/private/tmp/stanowisko-noc/auth-teresa16.json';
const outDir = process.env.TERESA16_OUT || '/private/tmp/wt-teresa16/evidence/teresa-16';
const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const source = (storageState.origins || []).find((o) => (o.localStorage || []).some((e) => e.name === 'token' && e.value));
storageState.origins = [{ ...source, origin: baseURL }];

const modules = [
  { n: 1, module: 'Czat', route: '/chat', entry: null, slug: 'czat' },
  { n: 2, module: 'Moja Praca', route: '/my-work', entry: /^Teresa$/, slug: 'moja-praca' },
  { n: 3, module: 'Wywiad', route: '/interview', entry: /^Teresa$/, slug: 'wywiad' },
  { n: 4, module: 'Narzędzia', route: '/discovery-tools', entry: /^(Teresa|Zapytaj Teresę)/, slug: 'narzedzia' },
  { n: 5, module: 'Ocena', route: '/assessment', entry: /^(Teresa|Zapytaj Teresę)/, slug: 'ocena' },
  { n: 6, module: 'Inicjatywy', route: '/initiatives', entry: /^(Teresa|Zapytaj Teresę)/, slug: 'inicjatywy' },
  { n: 7, module: 'Realizacja', route: '/execution', entry: /^(Teresa|Zapytaj Teresę)/, slug: 'realizacja' },
  { n: 8, module: 'Wyniki', route: '/results/kpi/ed531550-a7bc-54bb-bbfc-71f2daa14d7f', entry: /^Zapytaj Teresę o ten miernik$/, slug: 'wyniki' },
  { n: 9, module: 'Finanse', route: '/finance', entry: /^Teresa$/, slug: 'finanse' },
  { n: 10, module: 'Materiały', route: '/presentations', entry: /^Teresa$/, slug: 'materia-y' },
  { n: 11, module: 'Audyty', route: '/audit-programs', entry: /^Teresa$/, slug: 'audyty' },
  { n: 12, module: 'Spotkania', route: '/meetings', entry: /^Teresa$/, slug: 'spotkania' },
  { n: 15, module: 'Organizacja', route: '/organization', entry: /^Zapytaj Teresę o kontekst organizacji$/, slug: 'organizacja' },
];

const results = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.context().addCookies([]).catch(() => {});
  await page.close();
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage();

  for (const item of modules) {
    const rec = { n: item.n, module: item.module };
    try {
      await p.goto(baseURL + item.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await p.waitForTimeout(6_000);
      if (item.entry) {
        const entry = p.getByRole('button', { name: item.entry }).first();
        await entry.waitFor({ state: 'visible', timeout: 15_000 });
        await entry.click();
      }
      const input = p.locator('textarea[data-testid="chat-input"]:visible').first();
      await input.waitFor({ state: 'visible', timeout: 15_000 });
      await input.fill('Podsumuj, co tu widzisz.');
      const responsePromise = p.waitForResponse((r) => r.url().includes('/api/ai/chat/stream') && r.request().method() === 'POST', { timeout: 60_000 });
      await p.locator('[data-testid="chat-send-btn"]:visible').click();
      const response = await responsePromise;
      await response.finished();
      await p.waitForTimeout(1500);

      // Przewiń do widocznego dowodu: "Źródła: N" gdy są cytowania, inaczej
      // do końca komunikatu "Brak danych w module.".
      const zrodla = p.getByText(/Źródła:\s*\d+/i).last();
      const brakDanych = p.getByText(/Brak danych w module/i).last();
      let scrolled = false;
      if (await zrodla.isVisible().catch(() => false)) {
        await zrodla.scrollIntoViewIfNeeded().catch(() => {});
        scrolled = true;
      } else if (await zrodla.count().then((c) => c > 0).catch(() => false)) {
        await zrodla.scrollIntoViewIfNeeded().catch(() => {});
        scrolled = true;
      } else if (await brakDanych.isVisible().catch(() => false)) {
        await brakDanych.scrollIntoViewIfNeeded().catch(() => {});
        scrolled = true;
      }
      await p.waitForTimeout(800);
      rec.zrodlaVisible = await zrodla.isVisible().catch(() => false);
      rec.brakDanychVisible = await brakDanych.isVisible().catch(() => false);
      rec.scrolled = scrolled;
    } catch (error) {
      rec.error = String(error?.message || error).split('\n')[0];
    }
    await p.screenshot({ path: path.join(outDir, `${String(item.n).padStart(2, '0')}-${item.slug}.png`) }).catch((e) => { rec.screenshotError = String(e); });
    results.push(rec);
    console.log(JSON.stringify(rec));
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'teresa16-shots-log.json'), JSON.stringify(results, null, 2));
})();
