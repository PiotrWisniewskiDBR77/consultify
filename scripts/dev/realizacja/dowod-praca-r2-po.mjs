#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE (faza PO) — Realizacja → Praca, edycja w wierszu (P16-R2).
 *
 * Przejscie PMO z paczki P16 §6: lista → zadanie po terminie → zmien osobe
 * w wierszu → reload → trwale → zmien termin → reload → zamknij zadanie →
 * reload → „Dni po terminie" = „—" → „Nowe zadanie" z inicjatywa → na liscie.
 *
 * Uzycie:
 *   node scripts/dev/realizacja/dowod-praca-r2-po.mjs <BASE> <AUTH> [OUT] [TYTUL]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [
  ,
  ,
  BASE = 'http://127.0.0.1:3175',
  AUTH = '',
  OUTDIR = '/private/tmp/wt-p16-r2/evidence/p16-r2/po',
  TYTUL = 'PROBA R2 zadanie po terminie',
] = process.argv;
fs.mkdirSync(OUTDIR, { recursive: true });

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
page.on('console', (m) => {
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/tasks/i.test(u)) return;
  const met = r.request().method();
  if (met === 'GET') {
    apiLog.push(`${met} ${r.status()} ${u.replace(BASE, '')}`);
    return;
  }
  let body = '';
  try {
    body = (await r.text()).slice(0, 160);
  } catch {
    body = '(brak ciala)';
  }
  apiLog.push(
    `${met} ${r.status()} ${u.replace(BASE, '')}\n    zadanie=${r.request().postData()?.slice(0, 160) ?? ''}\n    odpowiedz=${body}`
  );
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUTDIR}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: nazwa.startsWith('10-') });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
        faza: 'po',
        url: page.url(),
        szerokosc: 1440,
        motyw: 'jasny',
        bledyKonsoli: [...konsola],
        czas: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

async function otworz() {
  await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr', { timeout: 40000 });
  await page.waitForTimeout(3000);
}

/** Wiersz proby — zawsze przez preset „Po terminie", zeby byl na pierwszym ekranie. */
async function wierszProby() {
  const w = page.locator('table tbody tr', { hasText: TYTUL }).first();
  await w.waitFor({ timeout: 30000 });
  await w.scrollIntoViewIfNeeded();
  return w;
}

async function tekstWiersza() {
  return ((await (await wierszProby()).textContent()) || '').replace(/\s+/g, ' ').trim();
}

await otworz();
await zrzut('01-lista-nowy-kanon', 'Lista: „Dni po terminie", „Bez inicjatywy" na koncu, CTA „Nowe zadanie"');

// Preset „Po terminie" — zadanie proby jest 6 dni po terminie.
const chip = page.getByRole('button', { name: /Po terminie/i }).first();
if (await chip.count()) {
  await chip.click();
  await page.waitForTimeout(2500);
}
await zrzut('02-po-terminie', 'Preset „Po terminie" z zadaniem proby');
console.log('WIERSZ PRZED:', await tekstWiersza());

// ── 1. ZMIANA OSOBY W WIERSZU ────────────────────────────────────────────
let komorki = (await wierszProby()).locator('td [data-editable]');
await komorki.nth(0).dblclick();
await page.waitForTimeout(600);
await zrzut('03-edytor-osoby', 'Edytor osoby otwarty podwojnym klikiem w komorce');
await page.getByLabel('Zmień osobę').selectOption({ label: 'Anna Kowalska' });
await page.waitForTimeout(2500);
await zrzut('04-po-zmianie-osoby', 'Po zapisie osoby (toast + wiersz odswiezony)');

await otworz();
await chip.click().catch(() => undefined);
await page.waitForTimeout(2500);
console.log('WIERSZ PO RELOADZIE (osoba):', await tekstWiersza());
await zrzut('05-reload-osoba-trwala', 'Po przeladowaniu strony — nowa osoba zostala');

// ── 2. ZMIANA TERMINU ────────────────────────────────────────────────────
komorki = (await wierszProby()).locator('td [data-editable]');
await komorki.nth(1).dblclick();
await page.waitForTimeout(600);
await page.getByLabel('Zmień termin').fill('2026-09-25');
await page.getByLabel('Zmień termin').press('Enter');
await page.waitForTimeout(2500);
await zrzut('06-po-zmianie-terminu', 'Po zapisie terminu');

await otworz();
console.log('WIERSZ PO RELOADZIE (termin):', await tekstWiersza());
await zrzut('07-reload-termin-trwaly', 'Po przeladowaniu — nowy termin zostal, „Dni po terminie" znikly');

// ── 3. ZAMKNIECIE ZADANIA (status → Wykonane) ────────────────────────────
komorki = (await wierszProby()).locator('td [data-editable]');
await komorki.nth(2).dblclick();
await page.waitForTimeout(600);
await zrzut('08-edytor-statusu', 'Edytor statusu — lista ze slownika serwera');
await page.getByLabel('Zmień status').selectOption('done');
await page.waitForTimeout(2500);

await otworz();
console.log('WIERSZ PO RELOADZIE (status):', await tekstWiersza());
await zrzut('09-reload-status-wykonane', 'Po przeladowaniu — status „Wykonane", „Dni po terminie" = „—"');

// ── 4. PODGLAD Z AKCJAMI ─────────────────────────────────────────────────
// Klik w kolumne ZADANIE (nieedytowalna) — tak otwiera sie podglad.
await (await wierszProby()).locator('td').first().click();
await page.waitForTimeout(2000);
await zrzut('10-podglad-gora', 'Podglad — naglowek, meta, szczegoly (Dni po terminie)');
// Pasek akcji jest na dole panelu, ponizej 900 px. Szerokosc zostaje 1440
// (kanon odbioru), wysokosc podniesiona TYLKO do tego jednego zrzutu.
await page.setViewportSize({ width: 1440, height: 1400 });
await page.waitForTimeout(1200);
await zrzut('10b-podglad-akcje', 'Podglad, blok akcji: Zmien osobe · Zmien termin · Zamknij zadanie (1440x1400)');
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(800);

// ── 5. NOWE ZADANIE Z INICJATYWA ─────────────────────────────────────────
const nowe = page.getByTestId('execution-work-new-task');
await nowe.waitFor({ timeout: 20000 });
await nowe.click();
await page.waitForTimeout(1200);
// Etykiety zawezone DO OKNA — nazwy kolumn tabeli (sort/resizer) maja te same slowa.
const okno = page.getByTestId('execution-work-create-dialog');
await okno.getByLabel('Tytuł').fill('PROBA R2 nowe zadanie z formularza');
const inicjatywa = okno.getByLabel('Inicjatywa');
const opcje = await inicjatywa.locator('option').allTextContents();
const pierwsza = opcje.find((o) => o && !/Bez inicjatywy/i.test(o));
if (pierwsza) await inicjatywa.selectOption({ label: pierwsza });
await okno.getByLabel('Osoba').selectOption({ label: 'Anna Kowalska' }).catch(() => undefined);
await okno.getByLabel('Termin').fill('2026-11-10');
await zrzut('11-formularz-nowego', 'Formularz „Nowe zadanie" — tytul, inicjatywa, osoba, termin, status');
await page.getByTestId('execution-work-create-submit').click();
await page.waitForTimeout(3000);
await zrzut('12-nowe-na-liscie', 'Nowe zadanie na liscie zaraz po utworzeniu');

await otworz();
const jest = await page.locator('table tbody tr', { hasText: 'PROBA R2 nowe zadanie' }).count();
console.log('NOWE ZADANIE PO RELOADZIE:', jest > 0 ? 'JEST' : 'BRAK');
await zrzut('13-reload-nowe-zadanie', 'Po przeladowaniu — nowe zadanie zostalo na serwerze');

fs.writeFileSync(`${OUTDIR}/api-log.txt`, apiLog.join('\n'));
fs.writeFileSync(`${OUTDIR}/konsola.txt`, konsola.join('\n'));
console.log(`API log: ${apiLog.length} wpisow, bledy konsoli: ${konsola.length}`);
await browser.close();
