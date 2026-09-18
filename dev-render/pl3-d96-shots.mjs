/* eslint-disable */
/**
 * D-96 (Wpis 102) — zrzuty dowodowe: szkic planu OTWIERA SIĘ NA OSI CZASU.
 *
 * 4 zrzuty 1440×900 EN: {light,dark} × {landing (szkic z oknami — centrum = oś
 * bez klikania w sekcję), windowless (szkic BEZ okien, stan po „New plan" — oś
 * ma paski z terminów inicjatyw zamiast pustego toru)}.
 *
 * Harness: `dev-render/screens/z3x-inicjatywy-plan.tsx` (REALNY <InitiativesHub/>),
 * flaga `VITE_PLAN_TIMELINE_V2=true` po stronie serwera, motyw przez `?theme=`,
 * wariant bez okien przez `&windows=0`.
 *
 * Serwer: `VITE_PLAN_TIMELINE_V2=true npx vite --config dev-render/vite.config.ts --port 5421 --strictPort`
 * Bieg:   `node dev-render/pl3-d96-shots.mjs <outDir> [light|dark|all] [landing|windowless|all]`
 *
 * Kluczowa różnica wobec `pl3-etap2-shots.mjs`: ten przyrząd NIE klika w sekcję
 * „Dependencies and conflicts" — mierzy, co jest centrum karty ZARAZ po jej
 * otwarciu, bo to był objaw D-96 („oś się nie renderuje" = karta lądowała na
 * horyzoncie/formularzu dat).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = 5421;
const outDir = process.argv[2] || 'evidence/qoder-gantt-pl3-etap2-20260918';
const themes = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['light', 'dark'];
const cases =
  process.argv[4] && process.argv[4] !== 'all' ? [process.argv[4]] : ['landing', 'windowless'];
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stan osi w kadrze: nagłówek, liczba pasków, aktywna sekcja, liczba pól dat. */
function axisState() {
  const barEls = Array.from(document.querySelectorAll('[title]')).filter((el) => {
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    return cls.includes('bg-c-') && !cls.includes('border-dashed');
  });
  const heading = Array.from(document.querySelectorAll('h4')).find((h) =>
    /Plan timeline/i.test((h.textContent || '').trim())
  );
  const active = Array.from(document.querySelectorAll('button[aria-pressed="true"], [data-section-nav]'))
    .map((b) => (b.textContent || '').trim())
    .filter(Boolean);
  const nameColumn = document.querySelector('.w-\\[208px\\]');
  const rows = nameColumn ? Array.from(nameColumn.children).slice(1) : [];
  return {
    heading: heading ? (heading.textContent || '').trim() : null,
    headingVisible: heading ? heading.getBoundingClientRect().height > 0 : false,
    bars: barEls.length,
    barsEnergy: Array.from(document.querySelectorAll('[title^="Energy Monitoring"]')).filter((el) => {
      const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
      return cls.includes('bg-c-') && !cls.includes('border-dashed');
    }).length,
    // Szkic bez okien jest TYLKO DO ODCZYTU (brak okna do zapisania) → 0 uchwytów.
    handles: barEls.reduce((sum, el) => sum + el.querySelectorAll('i.rounded-full').length, 0),
    rows: rows.length,
    // Okna niosą rolę w drugiej linii („Planned · Energy lead"), paski zastępcze nie.
    firstMeta: rows[0] ? (rows[0].textContent || '').trim().slice(0, 90) : null,
    dateInputs: document.querySelectorAll('input[type="date"]').length,
    active,
  };
}

async function openPlanCard(page, theme, windowless) {
  const url =
    `http://localhost:${PORT}/?screen=z3x-inicjatywy-plan&lang=en&theme=${theme}` +
    `&plan=draft&uwagi=0${windowless ? '&windows=0' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await sleep(3500);
  await page.locator('button', { hasText: /^Plan$/ }).first().click();
  await sleep(2000);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) =>
      /^Open$/i.test((x.textContent || '').trim())
    );
    if (b) b.click();
  });
  await sleep(3000);
  // Czysty kadr: chowaj kontrolki przyrządu (jak `--bez-chrome` w shot.mjs).
  await page.evaluate(() => {
    document.querySelectorAll('[data-dev-render-chrome]').forEach((e) => (e.style.display = 'none'));
  });
  await sleep(300);
}

async function shoot(browser, theme, kase) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (
      /^http:\/\/(localhost|127\.0\.0\.1)/.test(u) ||
      u.startsWith('data:') ||
      u.startsWith('blob:')
    )
      return route.continue();
    return route.abort();
  });

  await openPlanCard(page, theme, kase === 'windowless');
  const state = await page.evaluate(axisState);
  const out = path.join(outDir, `d96-${theme}-${kase}.png`);
  await page.screenshot({ path: out });
  console.log(`[${theme}/${kase}]`, JSON.stringify(state), 'ERRORS', errors.length ? errors.join(' | ') : 'none');
  await page.close();
  return errors;
}

// `PW_CHANNEL=chrome` — na maszynie pomiarowej nie ma pobranego chromium
// Playwrighta, jest za to systemowy Google Chrome (ten sam silnik Blink).
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let totalErrors = 0;
for (const theme of themes) {
  for (const kase of cases) {
    const errs = await shoot(browser, theme, kase);
    totalErrors += errs.length;
  }
}
await browser.close();
console.log('DONE. bledyKonsoli(lacznie):', totalErrors, '->', outDir);
