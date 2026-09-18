/**
 * D-28 (DLUG-PO-MVP, DEC-596) — dowód wzrokowy z harnessu `dev-render`.
 *
 * Ekran `d28-relation-fallback` renderuje REALNY <PreviewRelations> z relacją bez
 * własnego kindu (label = surowy UUID). Przed naprawą generyczny fallback
 * `relationFallbackLabel(undefined)` oddawał twardy literał PL „Powiązany rekord"
 * niezależnie od języka — w EN UI chip czytał się po polsku. Po naprawie generyk
 * idzie przez parę i18n `sharedComponents.relationKind.record`.
 *
 * Mierzone warianty: EN light + EN dark (chip = „Linked record") oraz PL light
 * (chip = „Powiązany rekord" — bez regresji, spójne z e2e harness PL). Motyw przez
 * store aplikacji (`&theme=`), NIE `emulateMedia`. `bledyKonsoli` liczone od
 * listenerów podpiętych PRZED navigacją. `&uwagi=0` zdejmuje pływający panel harnessu.
 *
 * Uruchomienie (z korzenia repo, harness na porcie 5412):
 *   node evidence/qoder-d28-20260918/shot.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const PORT = 5412;

const WARIANTY = [
  { plik: 'en-light', lang: 'en', theme: 'light', oczekiwany: 'Linked record' },
  { plik: 'en-dark', lang: 'en', theme: 'dark', oczekiwany: 'Linked record' },
  { plik: 'pl-light', lang: 'pl', theme: 'light', oczekiwany: 'Powiązany rekord' },
];

const wyniki = [];

for (const w of WARIANTY) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bledyKonsoli = [];
  const bledyStrony = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') bledyKonsoli.push(msg.text());
  });
  page.on('pageerror', (err) => bledyStrony.push(String(err)));

  const url = `http://127.0.0.1:${PORT}/?screen=d28-relation-fallback&lang=${w.lang}&theme=${w.theme}&uwagi=0`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  // Daj i18n dociągnąć locale (HttpBackend) i chipowi się wyrenderować.
  await page.waitForSelector('[data-preview-block="relations"]', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const blok = page.locator('[data-preview-block="relations"]');
  const tekstBloku = (await blok.innerText()).trim();
  const chipy = await page.locator('[data-preview-block="relations"] span[title], [data-preview-block="relations"] button[title]').evaluateAll((els) =>
    els.map((e) => ({ text: e.textContent?.trim() ?? '', title: e.getAttribute('title') ?? '' }))
  );

  const maOczekiwany = tekstBloku.includes(w.oczekiwany);
  const maPolskiWEn = w.lang === 'en' ? tekstBloku.includes('Powiązany rekord') : false;

  await page.screenshot({ path: resolve(KATALOG, `d28-${w.plik}.png`), fullPage: true });

  wyniki.push({
    wariant: w.plik,
    lang: w.lang,
    theme: w.theme,
    oczekiwany: w.oczekiwany,
    maOczekiwany,
    maPolskiWEn,
    bledyKonsoli: bledyKonsoli.length,
    bledyStrony: bledyStrony.length,
    chipy,
    tekstBloku,
  });

  await browser.close();
}

writeFileSync(resolve(KATALOG, 'wyniki.json'), JSON.stringify(wyniki, null, 2));

const wszystkieOk = wyniki.every(
  (w) => w.maOczekiwany && !w.maPolskiWEn && w.bledyKonsoli === 0 && w.bledyStrony === 0
);

for (const w of wyniki) {
  console.log(
    `${w.wariant}: oczekiwany="${w.oczekiwany}" maOczekiwany=${w.maOczekiwany} maPolskiWEn=${w.maPolskiWEn} bledyKonsoli=${w.bledyKonsoli} bledyStrony=${w.bledyStrony}`
  );
  console.log(`   chipy: ${JSON.stringify(w.chipy)}`);
}
console.log(`\nWERDYKT: ${wszystkieOk ? 'OK — wszystkie warianty zielone' : 'CZERWONY — patrz szczegóły'}`);
process.exit(wszystkieOk ? 0 : 1);
