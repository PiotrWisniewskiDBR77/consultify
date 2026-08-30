/**
 * TOR GRAFIKA — narzędzie zrzutowe (2026-08-30).
 *
 * Po co: reguła nr 1 toru grafiki mówi, że ŻADEN ekran nie wchodzi do budowy
 * bez zrzutu stanu zastanego, a reguła nr 3 (CLAUDE.md #7), że właściciel nigdy
 * nie jest pierwszym testerem wizualnym. To narzędzie produkuje dowody dla obu.
 *
 * Zamiast skryptu per ekran (w scripts/dev/ jest ich kilkadziesiąt, każdy
 * z zaszytą ścieżką wyjścia) — jedno narzędzie z parametrami.
 *
 * Wymaga działającego harnessu dev-render:
 *   npx vite --config dev-render/vite.config.ts --port 3020 --strictPort
 *
 * Użycie:
 *   node scripts/dev/grafika-zrzuty.mjs \
 *     --ekrany=karta-initiative,karta-insight \
 *     --katalog=06-inicjatywy \
 *     --faza=PRZED
 *
 * Wynik: evidence/grafika/<katalog>/<ekran>__<FAZA>__<light|dark>.png
 * Konwencja z docs/program/grafika/00_ZASADY_PRACY.md.
 */
import fs from 'fs';
import path from 'path';

import { chromium } from 'playwright';

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};

const BASE = arg('base', 'http://127.0.0.1:3020');
const EKRANY = arg('ekrany', '').split(',').map((s) => s.trim()).filter(Boolean);
const KATALOG = arg('katalog', 'nieprzypisane');
const FAZA = arg('faza', 'PRZED').toUpperCase();
const MOTYWY = arg('motywy', 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const SZEROKOSC = Number(arg('szerokosc', '1440'));
const WYSOKOSC = Number(arg('wysokosc', '900'));
const OSIAD = Number(arg('osiad', '2500')); // ile ms po networkidle — ekrany dociągają dane po kolei
const JEZYK = arg('jezyk', 'pl');
/**
 * Dodatkowe parametry adresu, np. flagi funkcji: --parametry=ff_org_redesign_v1=1&sub=all
 *
 * POWÓD ISTNIENIA (odbiór grafiki 2026-08-30): ekran „Tożsamość i model działania"
 * bez `ff_org_redesign_v1=1` renderuje STARĄ powierzchnię, nie docelową. Robotnik
 * zmierzył wariant, którego nie oceniał, i o mało nie zgłosił defektu z ekranu,
 * który nie jest tym ekranem. Bez tego przełącznika narzędzie po cichu mierzy
 * niewłaściwą rzecz — a to jest gorsze niż brak pomiaru.
 */
const PARAMETRY = arg('parametry', '').replace(/^[?&]/, '');

if (EKRANY.length === 0) {
  console.error('BŁĄD: podaj --ekrany=a,b,c');
  process.exit(1);
}
if (!['PRZED', 'PO'].includes(FAZA)) {
  console.error('BŁĄD: --faza musi być PRZED albo PO');
  process.exit(1);
}

const OUT = path.resolve(process.cwd(), 'evidence/grafika', KATALOG);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const wyniki = [];

for (const ekran of EKRANY) {
  for (const motyw of MOTYWY) {
    // Świeży kontekst na każdy zrzut — localStorage z poprzedniej nawigacji
    // potrafi przenieść stan flag między ekranami (udokumentowana pułapka
    // harnessu, patrz scripts/dev/ap-client-screenshots.mjs).
    const context = await browser.newContext({
      viewport: { width: SZEROKOSC, height: WYSOKOSC },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const bledy = [];
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(m.text().slice(0, 200));
    });
    const url = `${BASE}/?screen=${ekran}&lang=${JEZYK}&theme=${motyw}${PARAMETRY ? `&${PARAMETRY}` : ''}`;
    const plik = path.join(OUT, `${ekran}__${FAZA}__${motyw}.png`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(OSIAD);
      // Panel uwag i przycisk „Lista" to elementy harnessu, nie produktu —
      // chowamy je, żeby nie zaśmiecały dowodu odbiorowego.
      await page.addStyleTag({
        content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }',
      });
      await page.screenshot({ path: plik, fullPage: true });
      const { szer, wys } = await page.evaluate(() => ({
        szer: document.documentElement.scrollWidth,
        wys: document.documentElement.scrollHeight,
      }));
      wyniki.push({ ekran, motyw, plik, szer, wys, bledy: bledy.length, status: 'OK' });
    } catch (e) {
      wyniki.push({ ekran, motyw, plik: '—', szer: 0, wys: 0, bledy: bledy.length, status: `BŁĄD: ${e.message.slice(0, 80)}` });
    }
    await context.close();
  }
}

await browser.close();

console.log(`\nZrzuty → ${OUT}\n`);
console.log('ekran                          motyw   status      wys.strony  błędy konsoli');
console.log('─'.repeat(82));
for (const w of wyniki) {
  console.log(
    `${w.ekran.padEnd(30)} ${w.motyw.padEnd(7)} ${w.status.padEnd(11)} ${String(w.wys).padStart(9)}  ${w.bledy > 0 ? `★ ${w.bledy}` : '0'}`
  );
}
const zle = wyniki.filter((w) => w.status !== 'OK').length;
console.log(`\n${wyniki.length - zle}/${wyniki.length} zrzutów wykonanych.`);
if (zle > 0) process.exitCode = 1;
