// P1 · RP1b (14.09) — zrzuty DOWODOWE przejazdu kanonu „Raportu z pracy"
// w powłoce modułu Inicjatywy (Menu 1/2/3), jasny + ciemny.
//
// CLAUDE.md §7: właściciel nigdy nie jest pierwszym testerem wizualnym — ten
// skrypt renderuje realny ekran z mock-danymi (harness
// `z29-inicjatywy-raport-pracy`, bez logowania i bez bazy) i zapisuje zrzuty,
// które oglądam SAM przed pokazaniem ich komukolwiek.
//
// Użycie (flagi są ODCZYTYWANE W BUDOWIE, więc ON i OFF to dwa serwery vite):
//   VITE_INITIATIVES_WORK_REPORT=true npx vite --config dev-render/vite.config.ts --port 4391 --strictPort
//   node scripts/dev/p1-kanon-zrzuty.mjs --port 4391 --case on
//   npx vite --config dev-render/vite.config.ts --port 4392 --strictPort
//   node scripts/dev/p1-kanon-zrzuty.mjs --port 4392 --case off
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '4391');
const CASE = arg('case', 'on');
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(
  arg('out', path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-p1-kanon-20260914'))
);
fs.mkdirSync(OUT, { recursive: true });

const url = (theme) =>
  `${BASE}/?screen=z29-inicjatywy-raport-pracy&tab=workReport&lang=pl&theme=${theme}`;

const browser = await chromium.launch();

async function zrzut(nazwa, theme, akcja) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  await page.goto(url(theme), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1400);
  if (akcja) await akcja(page);
  const plik = path.join(OUT, `${nazwa}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), case: CASE, theme, bledyKonsoli }, null, 2)
  );
  console.log(nazwa, '→', plik, '· błędy konsoli:', bledyKonsoli.length);
  await page.close();
}

/**
 * Podgląd w trybie `embedded` rośnie naturalnie, a przewija go RODZIC
 * (`TableWithPreviewLayout`) — dlatego szukamy najbliższego przodka, który
 * faktycznie ma pasek przewijania, zamiast wołać `scrollIntoView` na bloku
 * (to przewijało tylko do połowy i gubiło stopkę z akcjami-pill).
 */
const przewinPodgladNaDol = async (page) => {
  await page.evaluate(() => {
    let el = document.querySelector('[data-testid="work-report-preview-deliveries"]');
    while (el) {
      if (el.scrollHeight > el.clientHeight + 8) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      el = el.parentElement;
    }
  });
  await page.waitForTimeout(700);
};

const otworzPodglad = async (page) => {
  await page.getByText('Cotygodniowa aktualizacja zespołu — 8–14 wrz').first().click();
  await page.waitForTimeout(900);
};

if (CASE === 'off') {
  for (const theme of ['light', 'dark']) {
    await zrzut(`05-flaga-off-${theme}`, theme);
  }
} else {
  for (const theme of ['light', 'dark']) {
    // 01 — lista z kreatorem ZWINIĘTYM (stan domyślny, skaza 6).
    await zrzut(`01-lista-kreator-zwiniety-${theme}`, theme);
    // 02 — podgląd przebiegu otwarty single-clickiem (skaza 1).
    await zrzut(`02-podglad-przebiegu-${theme}`, theme, otworzPodglad);
    // 02b — podgląd przewinięty do doręczeń + akcji-pill (skaza 1, dolna część).
    await zrzut(`02b-podglad-doreczenia-${theme}`, theme, async (page) => {
      await otworzPodglad(page);
      await przewinPodgladNaDol(page);
    });
    // 02c — przebieg z BŁĘDEM doręczenia (linia „Ponów wysyłkę do 1 adresata").
    await zrzut(`02c-podglad-blad-doreczenia-${theme}`, theme, async (page) => {
      await page.getByText('Zaległe decyzje — przegląd wrzesień').first().click();
      await page.waitForTimeout(900);
      await przewinPodgladNaDol(page);
    });
    // 03 — kebab wiersza otwarty (skaza 3).
    await zrzut(`03-kebab-wiersza-${theme}`, theme, async (page) => {
      const kebab = page
        .locator('table button[aria-haspopup="menu"], table [data-testid="row-actions-trigger"]')
        .first();
      await kebab.click();
      await page.waitForTimeout(600);
    });
    // 04 — kreator rozwinięty z kanonicznymi dropdownami (skazy 4 i 6).
    await zrzut(`04-kreator-rozwiniety-${theme}`, theme, async (page) => {
      await page.getByTestId('work-report-creator-toggle').click();
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="initiatives-work-report"]');
        if (el) el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(400);
    });
  }
}

await browser.close();
