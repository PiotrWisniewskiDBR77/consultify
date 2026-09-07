#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — Realizacja → Decyzje i ryzyka (P16 / R3, DEC-453).
 *
 * Uzycie:
 *   node scripts/dev/realizacja-decyzje/dowod-decyzje.mjs <przed|po> <BASE> <AUTH> [OUT]
 *
 * Klika to, co klika czlowiek: Realizacja → zakladka „Decyzje i ryzyka" →
 * rejestr → „Nowa decyzja" → kebab wiersza → podglad → okno powodu → zapis,
 * z RELOADEM po kazdym zapisie (bez reloadu widzialbym stan React-a, nie stan
 * bazy — to jest cala roznica miedzy „zapisalo sie" a „wyglada, ze sie
 * zapisalo"). Zrzuty 1440x900, motyw JASNY, obok kazdego `.png.json`
 * z url, bledami konsoli i czasem.
 *
 * Faza `anna` robi PARE NEGATYWNA: to samo konto MEMBER na tej samej decyzji.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3176', AUTH = '/private/tmp/wt-p16-r3/.run/auth-r3.json', OUT_ARG] =
  process.argv;
const OUT = OUT_ARG || `/private/tmp/wt-p16-r3/evidence/p16-r3/${faza}`;
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
page.on('console', (m) => {
  if (m.type() === 'error' && !/NetworkBuffer/i.test(m.text())) konsola.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => konsola.push('PAGEERROR: ' + String(e).slice(0, 300)));
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/decisions/i.test(u)) return;
  let body = '';
  try {
    body = (await r.text()).slice(0, 300);
  } catch {
    body = '(brak ciala)';
  }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
        faza,
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

async function ustawJasnyMotyw() {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = 'consultify-storage';
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'light' };
    localStorage.setItem(KEY, JSON.stringify(parsed));
  });
}

async function otworzZakladke() {
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(14000);
  await page.locator('table tbody tr').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
}

/** Wiersz po tytule; zwraca lokator albo rzuca z czytelnym powodem. */
const wiersz = (tytul) => page.locator('table tbody tr', { hasText: tytul }).first();

const statusWWierszu = async (tytul) => {
  const komorki = await wiersz(tytul).locator('td').allInnerTexts();
  return (komorki[3] || '').trim();
};
const eskalacjaWWierszu = async (tytul) => {
  const komorki = await wiersz(tytul).locator('td').allInnerTexts();
  return (komorki[5] || '').trim();
};

await ustawJasnyMotyw();
await otworzZakladke();

// ---------------------------------------------------------------------------
if (faza === 'anna') {
  // PARA NEGATYWNA: MEMBER na CUDZEJ decyzji nie widzi akcji rozstrzygajacych.
  const TYTUL = process.env.DECYZJA_CUDZA || 'Data platform — Databricks vs Snowflake';
  await zrzut('A1-rejestr-member', 'Rejestr decyzji oczami MEMBER (Anna Kowalska)');
  await wiersz(TYTUL).click();
  await page.waitForTimeout(2500);
  const widoczne = [];
  for (const nazwa of ['Rozstrzygnij', 'Odrzuć', 'Nieaktualna']) {
    widoczne.push(`${nazwa}=${await page.getByRole('button', { name: nazwa }).count()}`);
  }
  console.log('MEMBER, przyciski rozstrzygajace w podgladzie:', widoczne.join(' '));
  await zrzut('A2-podglad-member-bez-akcji', `MEMBER na cudzej decyzji „${TYTUL}" — brak akcji`);
  fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n') || '(brak wywolan /api/decisions)');
  fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n') || '(brak bledow konsoli)');
  await browser.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. LISTA
await zrzut('01-rejestr-kolumny', 'Rejestr decyzji: Tytul · Potrzebna do dnia · Decydent · Status · Dni po terminie · Eskalacja');

// 2. NOWA DECYZJA
await page.getByRole('button', { name: 'Nowa decyzja' }).first().click();
await page.waitForTimeout(1200);
await page.getByLabel('Tytuł decyzji').fill('proba-r3 Wybor dostawcy hurtowni danych');
const inicjatywy = page.getByLabel('Inicjatywa (wymagana)');
const opcje = await inicjatywy.locator('option').all();
const pierwszaRealna = await opcje[1].getAttribute('value');
await inicjatywy.selectOption(pierwszaRealna);
await page.getByLabel('Potrzebna do dnia (wymagane)').fill('2026-09-25');
await page.waitForTimeout(500);
await zrzut('02-nowa-decyzja-formularz', 'Formularz: tytul · inicjatywa · potrzebna do dnia · decydent');
await page.getByTestId('execution-new-decision-save').click();
await page.waitForTimeout(3000);

// RELOAD — dopiero po nim wiersz na liscie jest dowodem zapisu, nie stanu React-a.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(14000);
await wiersz('proba-r3 Wybor dostawcy').waitFor({ timeout: 30000 });
await zrzut('03-nowa-decyzja-na-liscie', 'Po zapisie i RELOADZIE: nowy wiersz w rejestrze (201, nie 400)');

// 3. ROZSTRZYGNIECIE decyzji PO TERMINIE
const DO_ROZSTRZYGNIECIA = process.env.DECYZJA_ROZSTRZYGANA || 'DevOps toolchain consolidation';
await wiersz(DO_ROZSTRZYGNIECIA).click();
await page.waitForTimeout(2500);
await zrzut('04-podglad-z-akcjami', `Podglad „${DO_ROZSTRZYGNIECIA}" — blok akcji: Rozstrzygnij · Odrzuc · Nieaktualna`);

await page.getByRole('button', { name: 'Rozstrzygnij' }).first().click();
await page.waitForTimeout(1200);
const potwierdz = page.getByTestId('execution-decision-reason-confirm');
console.log('Okno powodu, puste pole -> przycisk nieaktywny:', await potwierdz.isDisabled());
await zrzut('05-okno-powodu-puste', 'Okno powodu, pole puste — przycisk potwierdzenia NIEAKTYWNY');

await page
  .getByTestId('execution-decision-reason-input')
  .fill('proba-r3: wybieramy jeden lancuch narzedzi, koszt utrzymania spada o polowe.');
await page.waitForTimeout(400);
console.log('Po wpisaniu powodu -> przycisk aktywny:', !(await potwierdz.isDisabled()));
await zrzut('06-okno-powodu-wypelnione', 'Uzasadnienie wpisane — przycisk potwierdzenia AKTYWNY');
await potwierdz.click();
await page.waitForTimeout(3000);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(14000);
console.log(
  `Po reloadzie status „${DO_ROZSTRZYGNIECIA}":`,
  await statusWWierszu(DO_ROZSTRZYGNIECIA)
);
await wiersz(DO_ROZSTRZYGNIECIA).click();
await page.waitForTimeout(2500);
await zrzut(
  '07-po-rozstrzygnieciu',
  'Po RELOADZIE: status „Rozstrzygnieta" + uzasadnienie w podgladzie (wpis nieusuwalny, brak akcji)'
);

// 4. ESKALACJA RECZNA z kebaba innej decyzji
const DO_ESKALACJI = process.env.DECYZJA_ESKALOWANA || 'Data platform — Databricks vs Snowflake';
console.log(`Eskalacja „${DO_ESKALACJI}" PRZED:`, await eskalacjaWWierszu(DO_ESKALACJI));
const w = wiersz(DO_ESKALACJI);
await w.hover();
await page.waitForTimeout(400);
await w.locator('button[aria-label]').last().click({ force: true });
await page.waitForTimeout(900);
await zrzut('08-kebab-wiersza', 'Kebab wiersza: Otworz podglad + Eskaluj (akcje rozstrzygajace sa w podgladzie)');
await page.getByRole('menuitem', { name: 'Eskaluj' }).first().click();
await page.waitForTimeout(1200);
await page
  .getByTestId('execution-decision-reason-input')
  .fill('proba-r3: termin minal o 8 dni, potrzebna decyzja komitetu.');
await page.getByTestId('execution-decision-reason-confirm').click();
await page.waitForTimeout(3000);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(14000);
console.log(`Eskalacja „${DO_ESKALACJI}" PO:`, await eskalacjaWWierszu(DO_ESKALACJI));
await zrzut('09-po-eskalacji', 'Po RELOADZIE: poziom eskalacji podniesiony o jeden');

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n') || '(brak wywolan /api/decisions)');
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n') || '(brak bledow konsoli)');
console.log(`API wywolan: ${apiLog.length}, bledow konsoli: ${konsola.length}`);
await browser.close();
