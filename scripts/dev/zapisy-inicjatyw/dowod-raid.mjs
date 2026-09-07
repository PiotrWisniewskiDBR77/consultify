#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — zarzadzanie RAID inicjatywy (PRZED/PO).
 *
 * Uzycie:
 *   node scripts/dev/zapisy-inicjatyw/dowod-raid.mjs <przed|po> <BASE> <AUTH> <INICJATYWA_ID>
 *
 * Skrypt klika to, co klika czlowiek: Inicjatywy -> dokument -> Ryzyko i RAID ->
 * Edycja -> dodaj ryzyko -> zmien tytul -> odswiez strone -> usun.
 * Zapisuje zrzuty 1440x900 w motywie JASNYM oraz `.png.json` z url i bledami
 * konsoli, a takze pelny log odpowiedzi API dla tras RAID.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3150', AUTH = '/private/tmp/wt-zapisy/.auth-zapisy.json', INI = 'fa87dc75-d838-4fa0-8263-590969aa8621'] = process.argv;
const OUT = `/private/tmp/wt-zapisy/evidence/zapisy-inicjatyw/${faza}`;
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
  if (!/\/api\/.*(raid|runtime-v1)/i.test(u)) return;
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

// Motyw jasny w store aplikacji (klasa `dark` sterowana z zustand).
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

const NAZWA = process.env.INI_NAZWA || 'Supply Chain Optimization';

async function otworzDokument() {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const wiersz = page.locator('table tbody tr', { hasText: NAZWA }).first();
  await wiersz.waitFor({ timeout: 20000 });
  await wiersz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await wiersz.dblclick();
  await page.waitForTimeout(7000);
  const raidBtn = page.getByRole('button', { name: /^Ryzyko i RAID/ });
  await raidBtn.waitFor({ timeout: 25000 });
  await raidBtn.click();
  await page.waitForTimeout(2500);
}

await otworzDokument();

// Tryb edycji — w Podgladzie akcje sa niedostepne Z ZALOZENIA (to nie defekt).
async function trybEdycji() {
  const edycja = page.locator('button').filter({ hasText: /^Edycja$/ });
  const ile = await edycja.count();
  console.log('przelacznik Edycja: znaleziono', ile);
  if (ile) {
    await edycja.first().click();
    await page.waitForTimeout(3500);
  }
}
await trybEdycji();
await zrzut('01-raid-stan-poczatkowy', 'Sekcja Ryzyko i RAID w trybie edycji, przed dodaniem pozycji');

// DODAJ
const dodaj = page.getByRole('button', { name: /Dodaj ryzyko|Dodaj pozycj|Nowe ryzyko|Dodaj/i });
const ile = await dodaj.count();
console.log('kandydaci na przycisk dodania:', ile);
for (let i = 0; i < ile; i += 1) {
  console.log('  -', (await dodaj.nth(i).textContent())?.trim());
}
if (ile > 0) {
  await dodaj.first().click();
  await page.waitForTimeout(3000);
}
await zrzut('02-raid-po-dodaniu', 'Po klinieciu dodania pozycji RAID');

// ODSWIEZENIE — dowod, ze rekord jest na serwerze, a nie w stanie komponentu.
const urlDokumentu = page.url();
await page.goto(urlDokumentu, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const raidPoOdswiezeniu = page.getByRole('button', { name: /^Ryzyko i RAID/ });
await raidPoOdswiezeniu.waitFor({ timeout: 25000 });
await raidPoOdswiezeniu.click();
await page.waitForTimeout(3000);
await trybEdycji();
await zrzut('03-raid-po-odswiezeniu', 'Po odswiezeniu strony — pozycja przetrwala (serwer, nie stan komponentu)');

if (faza === 'przed') {
  // W fazie PRZED zapis jest odrzucany przez bramke (409), wiec NIC nie powstaje
  // i nie ma czego edytowac ani kasowac. Zatrzymujemy sie, zeby nie ruszyc
  // realnych danych na cudzym stanowisku.
  fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
  fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
  console.log('\n=== API ===\n' + apiLog.join('\n'));
  await browser.close();
  process.exit(0);
}

// EDYCJA — wpisujemy tytul w nowo dodany wiersz.
const nowyTytul = `Ryzyko z dowodu ${new Date().toISOString().slice(11, 19)}`;
// Tytul pozycji RAID to zwykly <input> w RaidCanvas — bierzemy uchwyt do tego,
// ktory ma wartosc roboczego tytulu nowej pozycji.
const uchwyt = await page.evaluateHandle(() => {
  const el = Array.from(document.querySelectorAll('input')).find((i) => i.value === 'Nowa pozycja');
  if (el) el.scrollIntoView({ block: 'center' });
  return el || null;
});
const poleTytulu = uchwyt.asElement();
console.log('pole tytulu nowej pozycji znalezione:', Boolean(poleTytulu), '| nowy tytul:', nowyTytul);
if (poleTytulu) {
  await poleTytulu.click();
  await page.waitForTimeout(600);
  await poleTytulu.evaluate((el) => el.select());
  await page.keyboard.type(nowyTytul, { delay: 30 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(3500);
  console.log('wartosc pola po wpisaniu:', await poleTytulu.evaluate((el) => el.value));
}
await zrzut('04-raid-po-edycji', `Po edycji tytulu na "${nowyTytul}"`);

await page.goto(urlDokumentu, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.getByRole('button', { name: /^Ryzyko i RAID/ }).click();
await page.waitForTimeout(3000);
await trybEdycji();
await zrzut('05-raid-edycja-po-odswiezeniu', 'Po odswiezeniu — czy edycja tytulu przetrwala');

// USUNIECIE — kasujemy KAZDA pozycje zalozona przez ten dowod (rowniez sprzatanie).
async function usunPozycje(tytul) {
  const uchwytPrzycisku = await page.evaluateHandle((szukany) => {
    const inputy = Array.from(document.querySelectorAll('input'));
    const pole = inputy.find((i) => i.value === szukany);
    if (!pole) return null;
    const wiersz = pole.closest('.group') || pole.parentElement?.parentElement?.parentElement;
    if (!wiersz) return null;
    const przyciski = Array.from(wiersz.querySelectorAll('button'));
    const kosz = przyciski.find((b) => (b.getAttribute('aria-label') || '').startsWith('Usu') ||
      (b.getAttribute('aria-label') || '').startsWith('Delete'));
    if (kosz) kosz.scrollIntoView({ block: 'center' });
    return kosz || null;
  }, tytul);
  const przycisk = uchwytPrzycisku.asElement();
  if (!przycisk) return false;
  await przycisk.click({ force: true });
  await page.waitForTimeout(1200);
  const potwierdz = page.getByRole('button', { name: /^(Usuń|Delete)$/ });
  if (await potwierdz.count()) {
    await potwierdz.last().click();
    await page.waitForTimeout(3000);
  }
  return true;
}

const usuniete = [];
for (const tytul of [nowyTytul, 'Nowa pozycja', 'Nowa pozycja', 'Nowa pozycja', 'Nowa pozycja']) {
  const ok = await usunPozycje(tytul);
  if (ok) usuniete.push(tytul);
  else break;
}
console.log('usuniete przez UI:', usuniete.length);
await zrzut('06-raid-po-usunieciu', `Po usunieciu ${usuniete.length} pozycji przez interfejs`);

await page.goto(urlDokumentu, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.getByRole('button', { name: /^Ryzyko i RAID/ }).click();
await page.waitForTimeout(3000);
await trybEdycji();
await zrzut('07-raid-usuniecie-po-odswiezeniu', 'Po odswiezeniu — usuniete pozycje nie wracaja');

fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
console.log('\n=== API ===\n' + apiLog.join('\n'));
console.log('\n=== KONSOLA (bledy) ===\n' + (konsola.join('\n') || '(brak)'));
await browser.close();
