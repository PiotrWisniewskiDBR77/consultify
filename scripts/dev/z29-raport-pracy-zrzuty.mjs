// Z-29 (14.09) — zrzuty przycisku/zakładki „Raport pracy" W POWŁOCE modułu
// Inicjatywy (Menu 1/2/3), jasny + ciemny, do pokazania właścicielowi
// (CLAUDE.md §7).
//
// Renderuje dev-render harness (ekran `z29-inicjatywy-raport-pracy`),
// montujący REALNY <InitiativesHub>. Motyw sterowany przez `&theme=` w URL —
// harness (dev-render/main.tsx) sam ustawia `.dark` na <html> ORAZ zapisuje
// motyw do zustand store, więc nie trzeba emulować `prefers-color-scheme`.
//
// Użycie:
//   node scripts/dev/z29-raport-pracy-zrzuty.mjs --port 4291 --case on
//   node scripts/dev/z29-raport-pracy-zrzuty.mjs --port 4292 --case off
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '4291');
const CASE = arg('case', 'on'); // on = flaga ON, off = flaga OFF (parytet)
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.HOME, 'Developer/cto-codex/zrzuty-z29-raport-pracy-20260914');
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
  await page.waitForTimeout(1200);
  if (akcja) await akcja(page);
  const plik = path.join(OUT, `${nazwa}.png`);
  if (nazwa.startsWith('03-')) {
    // Brak osobnego panelu podglądu w kodzie — kadrujemy samą tabelę (wiersz
    // PUBLISHED + wiersz APPROVED), nie całą stronę identyczną z zrzutem 01.
    const table = page.locator('table').first();
    await table.screenshot({ path: plik }).catch(() => page.screenshot({ path: plik, fullPage: false }));
  } else {
    await page.screenshot({ path: plik, fullPage: false });
  }
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify({ url: page.url(), case: CASE, theme, bledyKonsoli }, null, 2)
  );
  console.log(nazwa, '→', plik, 'błędy konsoli:', bledyKonsoli.length);
  await page.close();
}

if (CASE === 'off') {
  for (const theme of ['light', 'dark']) {
    await zrzut(`04-raport-pracy-flaga-off-${theme}`, theme);
  }
} else {
  for (const theme of ['light', 'dark']) {
    await zrzut(`01-raport-pracy-lista-${theme}`, theme);
    await zrzut(`02-raport-pracy-kreator-${theme}`, theme, async (page) => {
      await page.fill(
        'label:has-text("Title") input, label:has-text("Tytuł") input',
        'Cotygodniowa aktualizacja zespołu — 15–21 wrz'
      ).catch(() => {});
      const titleInput = page.locator('input').first();
      await titleInput.fill('Cotygodniowa aktualizacja zespołu — 15–21 wrz').catch(() => {});
      const recipientsInput = page.locator('input').nth(1);
      await recipientsInput
        .fill('anna.kowalska@dbr77.com, marek.zielinski@dbr77.com')
        .catch(() => {});
      const selects = page.locator('select');
      const count = await selects.count();
      if (count >= 2) {
        // Kolejność w DOM: 0=Szablon, 1=Częstotliwość, 2=Definicja, 3=Zakres, 4=Zatwierdzający.
        await selects.nth(0).selectOption({ label: 'Tygodniowa aktualizacja zespołu' }).catch(() => {});
        await selects.nth(1).selectOption({ value: 'WEEKLY' }).catch(() => {});
      }
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    });
    // UWAGA: InitiativeWorkReportView.tsx NIE ma osobnego panelu podglądu
    // przebiegu (kliknięcie wiersza nic nie otwiera) — jedyny "podgląd"
    // realnie istniejący w kodzie to sam wiersz StandardTable ze statusem i
    // przyciskami PDF/Wyślij. Ten zrzut kadruje więc CAŁĄ tabelę (nie całą
    // stronę) — patrz README w katalogu zrzutów.
    await zrzut(`03-raport-pracy-przebieg-published-${theme}`, theme, async (page) => {
      const table = page.locator('table').first();
      await table.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
    });
  }
}

await browser.close();
