#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — Realizacja > Zasoby: oblozenie tygodnia i ZALEGLOSC (P16-R1).
 *
 * Uzycie:
 *   node scripts/dev/realizacja-zasoby/dowod-zaleglosc.mjs <przed|po> <BASE> <AUTH> <OUT>
 *
 * Faza `przed`: sam ekran Zasobow (jak wyglada popyt z zaleglosciami w tygodniu 1).
 * Faza `po`: ekran + panel zaleglosci + dwie akcje (przenies na tydzien, uznaj za
 * zamkniete) z RELOADEM po kazdym zapisie — zeby bylo widac, ze liczba zmienila sie
 * na serwerze, a nie w stanie komponentu.
 *
 * Zrzuty 1440x900, motyw JASNY, obok kazdego `.png.json` z url i bledami konsoli.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  faza = 'po',
  BASE = 'http://localhost:3178',
  AUTH = '/private/tmp/wt-p16-r1/.run/auth-p16r1.json',
  OUT_BASE = '/private/tmp/wt-p16-r1/evidence/p16-r1',
] = process.argv;
const OUT = `${OUT_BASE}/${faza}`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];

const browser = await chromium.launch();
const MOTYW = process.env.MOTYW === 'ciemny' ? 'dark' : 'light';
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: MOTYW,
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/(tasks|execution-control)/i.test(u)) return;
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
        faza,
        url: page.url(),
        szerokosc: 1440,
        motyw: MOTYW === 'dark' ? 'ciemny' : 'jasny',
        bledyKonsoli: [...konsola],
        czas: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

// Motyw jasny w store aplikacji (klasa `dark` sterowana z zustand).
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((motyw) => {
  window.__MOTYW__ = motyw;
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: window.__MOTYW__ || 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
}, MOTYW);

async function otworzZasoby() {
  await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="execution-resources-summary"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
}

await otworzZasoby();
await zrzut('01-zasoby-tabela', 'Zasoby: tabela osoba x tydzien z paskiem podsumowania');

if (faza === 'ciemny') {
  const wejscie = page.locator('[data-testid^="execution-resources-backlog-open-"]').first();
  await wejscie.waitFor({ timeout: 30000 });
  await wejscie.click();
  await page.waitForSelector('[data-testid="execution-resources-backlog-panel"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  await zrzut('02-panel-zaleglosci-ciemny', 'Panel zaleglosci w motywie ciemnym');
  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n'));
  await browser.close();
  process.exit(0);
}

if (faza === 'przed') {
  const wiersz = page.locator('table tbody tr').first();
  await wiersz.click();
  await page.waitForTimeout(1200);
  await zrzut('02-zasoby-podglad', 'Podglad wiersza osoby (stan przed R1)');
  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n'));
  await browser.close();
  process.exit(0);
}

// --- FAZA PO -----------------------------------------------------------------
// 1. Osoba z zaleglascia: klikamy liczbe w kolumnie „Zaleglosc (h)".
const przyciskZaleglosci = page.locator('[data-testid^="execution-resources-backlog-open-"]').first();
await przyciskZaleglosci.waitFor({ timeout: 30000 });
const wierszOsoby = page.locator('table tbody tr').filter({ has: przyciskZaleglosci }).first();
await wierszOsoby.scrollIntoViewIfNeeded();
await zrzut('02-wiersz-z-zaleglascia', 'Wiersz osoby: oblozenie tygodnia obok osobnej kolumny Zaleglosc (h)');

await przyciskZaleglosci.click();
await page.waitForSelector('[data-testid="execution-resources-backlog-panel"]', { timeout: 30000 });
await page.waitForTimeout(800);
await zrzut('03-lista-zaleglosci', 'Lista zadan zaleglych z trzema akcjami');

function liczbaZPaska(tekst) {
  const m = /zaleglosc ([\d.,]+) h|zaległość ([\d.,]+) h/i.exec(tekst || '');
  return m ? Number((m[1] ?? m[2]).replace(',', '.')) : null;
}
const paskiem = async () =>
  (await page.locator('[data-testid="execution-resources-summary"]').textContent()) || '';
const przedAkcja = liczbaZPaska(await paskiem());
console.log('zaleglosc w pasku PRZED akcjami:', przedAkcja);

// 2. „Przenies na tydzien" pierwszego zadania.
const przenies = page.locator('[data-testid^="execution-resources-backlog-move-"]').first();
await przenies.click();
await page.waitForTimeout(500);
await zrzut('04-przenies-formularz', 'Formularz przeniesienia zadania na wskazany tydzien');
const pole = page.locator('[data-testid="execution-resources-backlog-move-date"]');
await pole.fill(process.env.DATA_PRZENIESIENIA || '2026-09-10');
await page.locator('[data-testid="execution-resources-backlog-move-confirm"]').click();
await page.waitForTimeout(2500);

// RELOAD — dowod, ze zapis poszedl na serwer.
await otworzZasoby();
await zrzut('05-po-przeniesieniu', 'Po reloadzie: popyt biezacego tygodnia wzrosl, zaleglosc zmalala');
const poPrzeniesieniu = liczbaZPaska(await paskiem());
console.log('zaleglosc w pasku PO przeniesieniu:', poPrzeniesieniu);

// 3. „Uznaj za zamkniete" innego zadania.
const znowuZaleglosc = page.locator('[data-testid^="execution-resources-backlog-open-"]').first();
await znowuZaleglosc.waitFor({ timeout: 30000 });
await znowuZaleglosc.click();
await page.waitForSelector('[data-testid="execution-resources-backlog-panel"]', { timeout: 30000 });
await page.waitForTimeout(600);
const zamknij = page.locator('[data-testid^="execution-resources-backlog-close-"]').first();
await zamknij.click();
await page.waitForTimeout(2500);
await otworzZasoby();
await zrzut('06-po-zamknieciu', 'Po reloadzie: zadanie uznane za zamkniete zniknelo z zaleglosci');
const poZamknieciu = liczbaZPaska(await paskiem());
console.log('zaleglosc w pasku PO zamknieciu:', poZamknieciu);

// 4. Kokpit — kafel Oblozenie z tej samej odpowiedzi.
await page.goto(`${BASE}/execution?tab=summary`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await zrzut('07-kokpit-oblozenie', 'Kokpit: kafel Oblozenie liczony z tej samej odpowiedzi resource-plan');

fs.writeFileSync(
  `${OUT}/api.log`,
  [`zaleglosc: przed=${przedAkcja} poPrzeniesieniu=${poPrzeniesieniu} poZamknieciu=${poZamknieciu}`, ...apiLog].join(
    '\n'
  )
);
await browser.close();
