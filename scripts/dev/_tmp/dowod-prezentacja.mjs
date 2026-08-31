/* eslint-disable */
/**
 * Dowód interaktywny edycji slajdu + werdykt o zapisie (tor grafika, 2026-08-30).
 * node scripts/dev/_tmp/dowod-prezentacja.mjs <katalog-evidence> <prefiks> [url]
 */
import fs from 'fs';
import path from 'path';

import { chromium } from 'playwright';

const KATALOG = process.argv[2] || '119-prezentacja';
const PREFIKS = process.argv[3] || 'DOWOD';
const URL = process.argv[4] || 'http://127.0.0.1:3020/?screen=deck-artifact&lang=pl&theme=light';
const OUT = path.resolve(process.cwd(), 'evidence/grafika', KATALOG);
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const writes = [];
p.on('request', (r) => {
  if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${r.url()}`);
});
await p.route('**/*', (r) => {
  const u = r.request().url();
  return u.startsWith('http://127.0.0.1') ||
    u.startsWith('http://localhost') ||
    u.startsWith('data:') ||
    u.startsWith('blob:')
    ? r.continue()
    : r.abort();
});
await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await p.waitForTimeout(3500);

const shot = async (name) => {
  await p.screenshot({ path: path.join(OUT, `${PREFIKS}-${name}.png`) });
  console.log('zrzut:', `${PREFIKS}-${name}.png`);
};
const status = () =>
  p.evaluate(
    () =>
      document.querySelector('[data-testid="presentation-artifact-status"]')?.textContent?.trim() ??
      '(brak znacznika zapisu)'
  );
const menu3 = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('[data-testid="artifact-menu3"] button')]
      .map((e) => e.textContent.trim())
      .filter(Boolean)
  );
const slajdy = () =>
  p.evaluate(() => document.querySelectorAll('[data-testid^="deck-slide-thumbnail-"]').length);
// Harness podmienia `window.fetch` na atrapę zwracającą lokalną `Response`, więc
// Playwright NIE widzi zapisów jako ruchu sieciowego. Nakładamy własny rejestrator
// PO załadowaniu strony, żeby zobaczyć wywołania, które faktycznie wychodzą z kodu.
const zainstalujRejestrator = () =>
  p.evaluate(() => {
    const prev = window.fetch;
    window.__ZAPISY__ = [];
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url ?? String(input);
      const method = (init && init.method) || 'GET';
      if (method !== 'GET') window.__ZAPISY__.push(`${method} ${url}`);
      return prev(input, init);
    };
  });
const odczytajZapisy = () => p.evaluate(() => window.__ZAPISY__ ?? []);

const BLOK = '[data-block-frame="block-slide-cover-0"]';
const cel = p.locator(`${BLOK}`).nth(1); // 0 = miniatura w sorterze, 1 = płótno

console.log('STATUS start:', await status());
console.log('MENU3 start:', await menu3());
console.log('SLAJDÓW start:', await slajdy());
await zainstalujRejestrator();

// ── 1. KLIK w blok slajdu (zaznaczenie) ────────────────────────────────────
await cel.scrollIntoViewIfNeeded().catch(() => {});
await cel.click({ timeout: 8000 }).catch((e) => console.log('klik:', e.message.split('\n')[0]));
await p.waitForTimeout(700);
await shot('1-blok-zaznaczony');
console.log('MENU3 po zaznaczeniu bloku:', await menu3());
console.log(
  'PIERŚCIEŃ ZAZNACZENIA:',
  await p.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel)]
        .map((e) => e.parentElement?.className || '')
        .some((c) => c.includes('ring-c-focus')),
    BLOK
  )
);

// ── 2. DWUKLIK → edycja w miejscu (TipTap) ─────────────────────────────────
await cel.dblclick({ timeout: 8000 }).catch((e) => console.log('dblclick:', e.message.split('\n')[0]));
await p.waitForTimeout(900);
const editorOpen = await p.evaluate(() => !!document.querySelector('.ProseMirror'));
console.log('EDYTOR OTWARTY (ProseMirror):', editorOpen);
await shot('2-edytor-otwarty');

// ── 3. WPISANIE TEKSTU ─────────────────────────────────────────────────────
if (editorOpen) {
  await p.click('.ProseMirror');
  await p.keyboard.press('End');
  await p.keyboard.type(' — DOWOD EDYCJI', { delay: 30 });
  await p.waitForTimeout(600);
  await shot('3-tekst-wpisany');
  await p.keyboard.press('Escape');
  await p.mouse.click(1300, 700);
  await p.waitForTimeout(2500);
}
console.log(
  'TEKST NA SLAJDZIE PO WYJŚCIU Z EDYCJI:',
  await p.evaluate(() => document.body.innerText.includes('DOWOD EDYCJI'))
);
console.log('STATUS po edycji:', await status());
await shot('4-po-edycji');

// ── 4. NOWY SLAJD z paska narzędzi ─────────────────────────────────────────
const nowy = p.locator('[data-testid="artifact-menu3"] button', { hasText: 'Nowy slajd' }).first();
console.log('PRZYCISK „Nowy slajd" na pasku:', (await nowy.count()) > 0);
if ((await nowy.count()) > 0) {
  await nowy.click().catch((e) => console.log('klik nowy slajd:', e.message.split('\n')[0]));
  await p.waitForTimeout(1500);
}
console.log('SLAJDÓW po „Nowy slajd":', await slajdy());
await shot('5-nowy-slajd');

// ── 5. PRZEŁADOWANIE → czy zapis został ────────────────────────────────────
const zapisy = await odczytajZapisy();
console.log('ZAPISY (nie-GET, z wnętrza strony):', zapisy.length ? zapisy : '(ŻADNYCH)');
console.log('ZAPISY (ruch sieciowy Playwright):', writes.length ? writes : '(ŻADNYCH)');
await p.reload({ waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(3500);
console.log(
  'TEKST PO PRZEŁADOWANIU:',
  await p.evaluate(() => document.body.innerText.includes('DOWOD EDYCJI'))
);
console.log('SLAJDÓW po przeładowaniu:', await slajdy());
await shot('6-po-przeladowaniu');

await b.close();
