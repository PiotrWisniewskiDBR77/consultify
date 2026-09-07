#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — P16-R6 (Raporty: kafle pustego stanu D6, chipy D7,
 * kebab deweloperski admin-only).
 *
 * Uzycie:
 *   node scripts/dev/p16-r6/dowod-raporty.mjs <przed|admin-po|anna-po> <BASE> <AUTH>
 *
 * Wzorzec: scripts/dev/zapisy-inicjatyw/dowod-raid.mjs.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'admin-po', BASE = 'http://localhost:3177', AUTH = ''] = process.argv;
const OUT = `/private/tmp/wt-p16-r6/evidence/p16-r6/${faza === 'przed' ? 'przed' : 'po'}`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/.*(execution-reports|report-runs|report-definitions)/i.test(u)) return;
  let body = '';
  try { body = (await r.text()).slice(0, 300); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({
    nazwa, opis, faza,
    url: page.url(),
    szerokosc: 1440, motyw: 'jasny',
    bledyKonsoli: [...konsola],
    czas: new Date().toISOString(),
  }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka}  (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

// Motyw jasny w store aplikacji.
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

async function otworzRaporty() {
  await page.goto(`${BASE}/execution?tab=reports`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
}

if (faza === 'przed') {
  await otworzRaporty();
  await zrzut('01-lista-pusta-przed', 'ADMIN, przed R6: pusta lista migawek — tekst "Brak raportów" bez kafli');
  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
  fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
  await browser.close();
  process.exit(0);
}

if (faza === 'admin-po') {
  await otworzRaporty();
  await zrzut('01-pusty-stan-4-kafle', 'ADMIN, po R6: pusty stan z czterema kaflami MVP + chipy Menu 3 (Wszystkie/Do przeglądu/Opublikowane/Definicje)');

  // Kliknij kafel "Tygodniowy pakiet realizacji" -> Wygeneruj raport.
  const kafelTygodniowy = page.locator('[data-testid^="standard-table-empty-action-"]', { hasText: 'Tygodniowy pakiet realizacji' });
  await kafelTygodniowy.waitFor({ timeout: 15000 });
  const przyciskWygeneruj = kafelTygodniowy.locator('button', { hasText: 'Wygeneruj raport' });
  await przyciskWygeneruj.click();
  await page.waitForTimeout(1500);
  await zrzut('02-kreator-otwarty-z-definicja', 'Kreator otwarty z wybraną definicją "Tygodniowy pakiet realizacji" i domyślnym okresem 7 dni');

  const przyciskGeneruj = page.getByRole('button', { name: /Generuj migawkę/ });
  await przyciskGeneruj.click();
  await page.waitForTimeout(4000);
  await zrzut('03-migawka-wygenerowana', 'Migawka wygenerowana z realnych danych, dokument otwarty');

  // Wróć do rejestru.
  const wrocBtn = page.getByRole('button', { name: /Wróć do rejestru raportów/ });
  if (await wrocBtn.count()) {
    await wrocBtn.click();
    await page.waitForTimeout(2000);
  }
  await zrzut('04-rejestr-po-wygenerowaniu', 'Rejestr po wygenerowaniu — migawka widoczna, chip "Wszystkie 1"');

  // Otwórz migawkę i opublikuj.
  const wierszMigawki = page.locator('tbody tr').first();
  await wierszMigawki.dblclick();
  await page.waitForTimeout(2000);
  const publikujBtn = page.getByRole('button', { name: /Opublikuj/ });
  if (await publikujBtn.count()) {
    await publikujBtn.first().click();
    await page.waitForTimeout(3000);
  }
  await zrzut('05-migawka-opublikowana', 'Migawka opublikowana — status zamrożony');

  const pdfBtn = page.getByRole('button', { name: /PDF/ });
  if (await pdfBtn.count()) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
      pdfBtn.first().click(),
    ]);
    console.log('PDF download:', download ? await download.path() : 'BRAK');
  }
  await page.waitForTimeout(1500);
  await zrzut('06-po-pobraniu-pdf', 'Po kliknięciu pobierania PDF');

  // Odswiezenie strony — dowod trwalosci.
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await zrzut('07-po-odswiezeniu', 'Po odświeżeniu — migawka opublikowana i chipy zgodne (1/0/1... w zależności od statusu)');

  // Otworz kebab Menu 3 (admin) — dowod widocznosci przyciskow deweloperskich.
  // UWAGA: locale pl-PL tlumaczy aria-label na "Akcje wiersza" (nie "Row
  // actions" — angielski fallback tylko w testach jednostkowych z mockiem
  // t()). Ten SAM komponent (RowActionsMenu) jest tez kebabem KAZDEGO wiersza
  // tabeli, wiec bierzemy TOPMOST wystapienie (najmniejsze y) — to jest kebab
  // Menu 3, nie kebab wiersza migawki.
  const kebabButtons = page.locator('button[aria-label="Akcje wiersza"]');
  const kebabCount = await kebabButtons.count();
  let kebabTrigger = null;
  let minY = Infinity;
  for (let i = 0; i < kebabCount; i += 1) {
    const candidate = kebabButtons.nth(i);
    const box = await candidate.boundingBox();
    if (box && box.y < minY) {
      minY = box.y;
      kebabTrigger = candidate;
    }
  }
  if (kebabTrigger) {
    await kebabTrigger.click();
    await page.waitForTimeout(500);
    await zrzut('08-kebab-menu3-admin-otwarty', 'ADMIN: kebab Menu 3 otwarty — "Nowa definicja"/"Kontrakt raportu (zaawansowane)" widoczne');
    await page.keyboard.press('Escape');
  } else {
    console.log('UWAGA: kebab Menu 3 nie znaleziony (zero przyciskow "Akcje wiersza")');
  }

  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
  fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
  await browser.close();
  process.exit(0);
}

if (faza === 'anna-po') {
  await otworzRaporty();
  await zrzut('09-anna-member-brak-dev-buttons', 'MEMBER (Anna): kafle widoczne, ZERO przycisków deweloperskich w Menu 3');
  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
  fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
  await browser.close();
  process.exit(0);
}

console.error('Nieznana faza:', faza);
await browser.close();
process.exit(2);
