#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';

const konsola = [];
const apiLog = [];
function wireLogging(page) {
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
  page.on('response', async (r) => {
    const u = r.url();
    if (!/\/api\//.test(u)) return;
    let t = null; try { t = r.request().timing(); } catch {}
    const status = r.status();
    if (status >= 400 || (t && t.responseEnd > 2000)) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch {}
      apiLog.push(`${new Date().toISOString()} ${status} ${u.replace(BASE, '')} t=${t ? Math.round(t.responseEnd) : '?'}ms\n    ${body}`);
    }
  });
}
let page, context, browser;
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${opis} (bledyKonsoli=${konsola.length})`);
  konsola.length = 0;
}
async function zamknijOnboarding() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  wireLogging(page);

  // === KROK 9: Realizacje lista ===
  console.log('=== KROK 9 ===');
  await page.goto(`${BASE}/execution?tab=list`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboarding();
  await zrzut('10a-realizacje-lista', 'Zakladka Realizacje — lista inicjatyw w realizacji DBR77');

  const brakInicjatyw = page.getByText('Brak inicjatyw', { exact: false });
  const cntBrak = await brakInicjatyw.count();
  console.log('tekst "Brak inicjatyw" widoczny:', cntBrak);

  // otworz podglad pierwszego wiersza
  const pierwszyWiersz = page.locator('table tbody tr').first();
  if (await pierwszyWiersz.count()) {
    await pierwszyWiersz.click();
    await page.waitForTimeout(2000);
    await zrzut('10b-realizacje-podglad', 'Podglad pierwszej realizacji — akcje lancucha widoczne');
  }

  // === KROK 10: Praca -> dwuklik Termin ===
  console.log('=== KROK 10 ===');
  await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboarding();
  await zrzut('11a-praca-tabela-przed', 'Zakladka Praca — tabela zadan PRZED zmiana terminu');

  const edytowalne = page.locator('[data-editable="tak"]');
  const liczbaEdytowalnych = await edytowalne.count();
  console.log('liczba edytowalnych komorek:', liczbaEdytowalnych);
  let terminInfo = null;
  for (let i = 0; i < Math.min(liczbaEdytowalnych, 20); i += 1) {
    const kom = edytowalne.nth(i);
    await kom.dblclick().catch(() => {});
    await page.waitForTimeout(400);
    const inputDate = page.locator('input[type="date"]').first();
    if (await inputDate.count().catch(() => 0)) {
      const staraWartosc = await inputDate.inputValue().catch(() => '');
      terminInfo = { indeks: i, staraWartosc };
      await zrzut('11b-praca-edycja-terminu-otwarta', `Edycja inline terminu otwarta (komorka ${i}), stara wartosc=${staraWartosc}`);
      const nowaData = '2026-12-24';
      await inputDate.fill(nowaData);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      terminInfo.nowaWartosc = nowaData;
      break;
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  console.log('terminInfo:', JSON.stringify(terminInfo));
  fs.writeFileSync(`${OUT}/krok10-termin-info.json`, JSON.stringify(terminInfo, null, 2));
  await zrzut('11c-praca-po-edycji-terminu', 'Po zapisie nowego terminu (PUT)');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  await zrzut('11d-praca-po-reload', 'Po reload — sprawdz czy termin trwaly');

  // === KROK 11: Zasoby ===
  console.log('=== KROK 11 ===');
  await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboarding();
  await zrzut('12a-zasoby-tabela', 'Zakladka Zasoby — tabela bez banera bledu');
  const banerBledu = page.getByText(/Blad|Error|Nie udalo/i);
  console.log('baner bledu widoczny:', await banerBledu.count());
  const pierwszaOsoba = page.locator('table tbody tr').first();
  if (await pierwszaOsoba.count()) {
    await pierwszaOsoba.click();
    await page.waitForTimeout(2000);
    await zrzut('12b-zasoby-podglad-osoby', 'Podglad osoby — Zadania w tym tygodniu / zalegle');
  }

  // === KROK 12: Decyzje i ryzyka ===
  console.log('=== KROK 12 ===');
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboarding();
  await zrzut('13a-decyzje-i-ryzyka', 'Zakladka Decyzje i ryzyka — widok domyslny');

  const chipDecyzje = page.getByText('Decyzje', { exact: true }).first();
  if (await chipDecyzje.count()) {
    await chipDecyzje.click();
    await page.waitForTimeout(1500);
    await zrzut('13b-chip-decyzje', 'Chip "Decyzje" wybrany');
    const nowaDecyzja = page.getByRole('button', { name: /Nowa decyzja/i });
    if (await nowaDecyzja.count()) {
      await nowaDecyzja.click();
      await page.waitForTimeout(1500);
      await zrzut('13c-formularz-nowa-decyzja', 'Formularz "Nowa decyzja"');
    } else {
      await zrzut('13c-brak-nowa-decyzja', 'Brak przycisku "Nowa decyzja"');
    }
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-09-13.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE kroki 9-12(czesc1).');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-09-13', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-09-13.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
