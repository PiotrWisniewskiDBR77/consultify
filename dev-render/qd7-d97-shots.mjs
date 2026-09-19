/* eslint-disable */
/**
 * QD7 / D-97 — zrzuty dowodowe: etykieta okresu planu z klucza i18n.
 *
 * Harness: `dev-render/screens/qd7-d97-period-labels.tsx` — REALNY
 * `createPeriods` (generator z `PlanScenarioSurface.tsx`, cel naprawy D-97)
 * zasila REALNY `CapacityScenarioSurface`, który jako jedyny ekran wyświetla
 * `periodId` dosłownie (`CapacityScenarioSurface.tsx:334` — `title`).
 *
 * Serwer: `npx vite --config dev-render/vite.config.ts --port 5431 --strictPort`
 * Bieg:   `node dev-render/qd7-d97-shots.mjs [outDir]`
 *
 * Warianty: en/light + en/dark (bramka: jasny i ciemny, UI angielski) oraz
 * pl/light (dowód pary: to samo ogniwo po polsku → „Tydzień n").
 * Asert na ŻYWEJ stronie: en → jest „Week 1" i „Week 4", NIE MA „Tydzień";
 * pl → jest „Tydzień 1". Do tego `bledyKonsoli` per wariant (bramka: 0).
 */
import { chromium } from 'playwright';
import fs from 'fs';

const PORT = 5431;
const outDir = process.argv[2] || 'evidence/qd7-d97-20260918';
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const variants = [
  ['en', 'light'],
  ['en', 'dark'],
  ['pl', 'light'],
];

const browser = await chromium.launch();
const results = [];
for (const [lang, theme] of variants) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
  // Bez sieci zewnętrznej (fonty CDN blokują `document.fonts.ready`).
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (
      u.startsWith('http://localhost') ||
      u.startsWith('http://127.0.0.1') ||
      u.startsWith('data:') ||
      u.startsWith('blob:')
    )
      return route.continue();
    return route.abort();
  });
  await page
    .goto(`http://localhost:${PORT}/?screen=qd7-d97-period-labels&lang=${lang}&theme=${theme}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    .catch(() => {});
  await sleep(3500);
  // Rejestr → arkusz: dwuklik wiersza scenariusza (onRowDoubleClick → open).
  const opened = await page.evaluate(() => {
    if (document.body.innerText.includes('Week 1') || document.body.innerText.includes('Tydzień 1'))
      return 'auto';
    const row = Array.from(document.querySelectorAll('tr')).find((r) =>
      (r.textContent || '').includes('Transformation programme load')
    );
    if (row) {
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return 'dblclick';
    }
    return 'none';
  });
  await sleep(2500);
  // Arkusz (wiersze z periodId) jest OSOBNĄ sekcją powłoki — klik w nawigację.
  const section = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('button')).find((b) =>
      /Load worksheet|Arkusz obciążenia/i.test((b.textContent || '').trim())
    );
    if (nav) {
      nav.click();
      return (nav.textContent || '').trim();
    }
    return null;
  });
  await sleep(1500);
  const state = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      week1: body.includes('Week 1'),
      week4: body.includes('Week 4'),
      tydzien1: body.includes('Tydzień 1'),
      tydzienJakikolwiek: /Tydzień/.test(body),
    };
  });
  const file = `${outDir}/arkusz-${lang}-${theme}.png`;
  await page.screenshot({ path: file });
  const expect =
    lang === 'en'
      ? state.week1 && state.week4 && !state.tydzienJakikolwiek
      : state.tydzien1;
  results.push({ lang, theme, opened, section, ...state, expectSpelnione: expect, bledyKonsoli: errors.length, errors: errors.slice(0, 8), plik: file });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
const ok = results.every((r) => r.expectSpelnione && r.bledyKonsoli === 0);
console.log(ok ? 'WERDYKT: OK (etykiety z i18n, 0 błędów konsoli)' : 'WERDYKT: NIE');
process.exit(ok ? 0 : 1);
