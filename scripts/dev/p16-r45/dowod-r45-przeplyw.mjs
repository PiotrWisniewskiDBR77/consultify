#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — P16/R4+R5, PELNY PRZEPLYW (§KROK 3).
 *
 * Uzycie: node scripts/dev/p16-r45/dowod-r45-przeplyw.mjs [BASE] [AUTH]
 *
 * Klika to, co klika czlowiek:
 *   Ryzyka -> "Nowa pozycja RAID" (termin, p=Wysokie 4, w=Krytyczny 5)
 *   -> ekspozycja 20 -> RELOAD -> pozycja trwala
 *   -> "Zmien termin" -> RELOAD -> nowy termin
 *   -> kebab "Eskaluj do problemu" -> nowy Problem z linkiem do zrodla
 *   -> Sygnaly -> powody PL -> "Przygotuj interwencje"
 *   -> Decyzje: wniosek o przesuniecie z terminem -> RELOAD -> sygnal "Interwencja".
 *
 * Zrzuty 1440x900, motyw JASNY, `.png.json` z url + bledami konsoli, log API.
 * Rekordy probne (`proba-r45-*`) sprzata `scripts/dev/p16-r45/sprzataj.mjs`.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , BASE = 'http://localhost:3181', AUTH = '/private/tmp/wt-p16-r45/.local/auth-admin-3181.json'] =
  process.argv;
const OUT = '/private/tmp/wt-p16-r45/evidence/p16-r45/po';
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
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/(raid|decisions|execution-control|initiatives\/runtime-v1)/i.test(u)) return;
  let body = '';
  try {
    body = (await r.text()).slice(0, 240);
  } catch {
    body = '(brak ciala)';
  }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

let krok = 0;
async function zrzut(nazwa, opis) {
  krok += 1;
  const sciezka = `${OUT}/${String(krok).padStart(2, '0')}-${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
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
  console.log(`ZRZUT ${sciezka}  (bledyKonsoli=${konsola.length})`);
}

const TYTUL = `proba-r45-ryzyko-${Date.now().toString().slice(-6)}`;

async function otworz() {
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
}

async function chip(nazwa) {
  const b = page.locator('button').filter({ hasText: new RegExp(`^${nazwa}\\s*\\d*$`) }).first();
  await b.waitFor({ timeout: 20000 });
  await b.click();
  await page.waitForTimeout(2500);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

// ── 1. RYZYKA: nowy zestaw kolumn ───────────────────────────────────────────
await otworz();
await chip('Ryzyka');
await zrzut('ryzyka-kolumny', 'Zestaw kolumn RAID: Prawdopodobienstwo, Wplyw, Ekspozycja, Status');

// ── 2. NOWA POZYCJA RAID ────────────────────────────────────────────────────
await page.getByTestId('execution-new-raid-open').click();
await page.waitForTimeout(1200);
// Formularz stoi NAD tabela — zawezamy do niego, bo naglowki kolumn maja te
// same etykiety dostepnosciowe (sortowanie / zmiana szerokosci).
const formularz = page.locator('div').filter({ has: page.getByTestId('execution-new-raid-save') }).last();
await formularz.getByLabel('Tytuł (wymagany)').fill(TYTUL);
const terminNowy = '2026-09-01'; // przeszlosc → wiersz wpadnie do „Po terminie"
await formularz.getByRole('textbox', { name: 'Termin', exact: true }).fill(terminNowy);
await formularz.getByLabel('Prawdopodobieństwo').selectOption('HIGH');
await formularz.getByLabel('Wpływ', { exact: true }).selectOption('CRITICAL');
await page.waitForTimeout(400);
const ekspozycjaFormularz = (
  await page.getByTestId('execution-new-raid-exposure').textContent()
)?.trim();
console.log(`EKSPOZYCJA w formularzu (p=4 × w=5): ${ekspozycjaFormularz}`);
await zrzut('nowa-pozycja-raid', `Formularz: p=Wysokie(4), w=Krytyczny(5) → ekspozycja ${ekspozycjaFormularz}`);
await page.getByTestId('execution-new-raid-save').click();
await page.waitForTimeout(4000);

// ── 3. RELOAD — trwalosc ────────────────────────────────────────────────────
await otworz();
await chip('Ryzyka');
const wiersz = page.locator('table tbody tr', { hasText: TYTUL }).first();
await wiersz.waitFor({ timeout: 20000 });
console.log(`PO RELOAD wiersz: ${(await wiersz.textContent())?.replace(/\s+/g, ' ').trim()}`);
await zrzut('po-reload-trwale', 'Pozycja RAID po odswiezeniu — ekspozycja 20, termin, status');
// Szerokosc tabeli przy 1440: kontener vs tabela (P2_TABELA_NIE_UCINA).
const miara = await page.evaluate(() => {
  const t = document.querySelector('table');
  const wrap = t?.closest('[class*="overflow"]') || t?.parentElement;
  return { kontener: Math.round(wrap.getBoundingClientRect().width), tabela: t.scrollWidth };
});
console.log(`SZEROKOSC 1440: kontener ${miara.kontener} px, tabela ${miara.tabela} px, nadmiar ${miara.tabela - miara.kontener} px`);

// ── 4. ZMIEN TERMIN z podgladu ──────────────────────────────────────────────
await wiersz.click();
await page.waitForTimeout(2000);
await zrzut('podglad-raid', 'Podglad pozycji RAID: inicjatywa, p, w, ekspozycja, status + akcje');
await page.getByRole('button', { name: /Zmień termin/ }).click();
await page.waitForTimeout(800);
await page.getByTestId('execution-raid-edit-input').fill('2026-12-15');
await page.getByTestId('execution-raid-edit-save').click();
await page.waitForTimeout(3500);

await otworz();
await chip('Ryzyka');
const wiersz2 = page.locator('table tbody tr', { hasText: TYTUL }).first();
await wiersz2.waitFor({ timeout: 20000 });
console.log(`PO ZMIANIE TERMINU: ${(await wiersz2.textContent())?.replace(/\s+/g, ' ').trim()}`);
await zrzut('termin-zmieniony', 'Termin zmieniony i trwaly po odswiezeniu (15 gru 2026)');

// ── 5. ESKALUJ DO PROBLEMU (kebab) ──────────────────────────────────────────
const kebab = wiersz2.locator('button').last();
await kebab.click();
await page.waitForTimeout(900);
await zrzut('kebab-raid', 'Kebab wiersza RAID: Otworz podglad + Eskaluj do problemu');
await page.getByText('Eskaluj do problemu').first().click();
await page.waitForTimeout(4500);

await otworz();
await chip('Ryzyka');
const problem = page.locator('table tbody tr', { hasText: TYTUL });
console.log(`WIERSZE Z TYTULEM po eskalacji: ${await problem.count()} (oczekiwane 2: Problem + zamkniete Ryzyko)`);
await zrzut('po-eskalacji', 'Po eskalacji: nowy Problem + zrodlowe Ryzyko ze statusem Zamknieta');
const problemRow = page.locator('table tbody tr', { hasText: TYTUL }).filter({ hasText: 'Problem' }).first();
if (await problemRow.count()) {
  await problemRow.click();
  await page.waitForTimeout(2000);
  await zrzut('podglad-problemu', 'Podglad Problemu — wiersz „Powstalo z pozycji" z ID zrodla');
}

// ── 6. SYGNALY ──────────────────────────────────────────────────────────────
await otworz();
await chip('Sygnały');
await zrzut('sygnaly-lista', 'Preset Sygnaly: rodzaj i powod PO POLSKU, odchylenie, stan');
const sygnal = page.locator('table tbody tr').first();
await sygnal.click();
await page.waitForTimeout(2000);
const nazwaSygnalu = (await sygnal.locator('td').first().textContent())?.trim();
console.log(`SYGNAL: ${nazwaSygnalu}`);
await zrzut('sygnal-podglad', 'Podglad sygnalu z akcja „Przygotuj interwencje"');
await page.getByRole('button', { name: /Przygotuj interwencję/ }).click();
await page.waitForTimeout(4500);
await zrzut('sygnal-po-interwencji', 'Po utworzeniu wniosku — stan „Interwencja"');

// ── 7. DECYZJA W REJESTRZE + RELOAD ─────────────────────────────────────────
await otworz();
await chip('Decyzje');
const decyzja = page.locator('table tbody tr', { hasText: 'Przesunięcie terminu:' }).first();
await decyzja.waitFor({ timeout: 20000 });
console.log(`DECYZJA: ${(await decyzja.textContent())?.replace(/\s+/g, ' ').trim()}`);
await zrzut('decyzja-rebaseline', 'Wniosek o przesuniecie w rejestrze Decyzji, z terminem');

await otworz();
await chip('Sygnały');
const sygnalPoReload = page.locator('table tbody tr', { hasText: 'Interwencja' }).first();
await sygnalPoReload.waitFor({ timeout: 20000 });
console.log(`SYGNAL PO RELOAD: ${(await sygnalPoReload.textContent())?.replace(/\s+/g, ' ').trim()}`);
await zrzut('sygnal-interwencja-po-reload', 'Po odswiezeniu sygnal nadal ma stan „Interwencja"');

// ── 8. MENU 2: filtr terminu, brak martwych przyciskow ──────────────────────
await chip('Ryzyka');
await page.getByTestId('execution-governance-due-filter').locator('button').first().click();
await page.waitForTimeout(700);
await zrzut('filtr-terminu', 'Menu 2: filtr Termin (Wszystkie / Po terminie) zamiast czwartego chipa');

fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
fs.writeFileSync(`${OUT}/tytul-probny.txt`, TYTUL + '\n');
console.log(`\nAPI wywolan: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
console.log(`Tytul probny: ${TYTUL}`);
await browser.close();
