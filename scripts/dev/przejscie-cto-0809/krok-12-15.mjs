#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const AUTH_MEMBER = `${SCRATCH}/auth-member-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';

const konsola = [];
const apiLog = [];
function wireLogging(page) {
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
  page.on('response', async (r) => {
    const u = r.url();
    if (!/\/api\//.test(u)) return;
    const status = r.status();
    if (status >= 400) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch {}
      apiLog.push(`${new Date().toISOString()} ${status} ${u.replace(BASE, '')}\n    ${body}`);
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

  // === KROK 12 kontynuacja: RAID + Sygnały ===
  console.log('=== KROK 12 (RAID/Sygnaly) ===');
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await zamknijOnboarding();

  // Nowa decyzja - wypelnij i zapisz
  await page.getByRole('button', { name: 'Nowa decyzja' }).click();
  await page.waitForTimeout(1000);
  const tytulInput = page.locator('input:visible').first();
  await tytulInput.click();
  await tytulInput.fill('Przejscie CTO 08.09 - decyzja testowa');
  const initSelect = page.locator('select').first();
  const opcjeInit = await initSelect.locator('option').evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  if (opcjeInit.length) await initSelect.selectOption(opcjeInit[0]);
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.fill('2026-12-01');
  await page.waitForTimeout(500);
  const zapiszDecyzje = page.getByRole('button', { name: 'Zapisz decyzję' });
  const zapiszWlaczony = await zapiszDecyzje.isEnabled().catch(() => false);
  console.log('Zapisz decyzje wlaczony:', zapiszWlaczony);
  if (zapiszWlaczony) {
    await zapiszDecyzje.click();
    await page.waitForTimeout(2500);
    await zrzut('14a-decyzja-zapisana', 'Po zapisaniu nowej decyzji');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await zamknijOnboarding();
    await zrzut('14b-decyzja-po-reload', 'Lista decyzji po reload — nowa pozycja widoczna');
  } else {
    await zrzut('14a-zapisz-decyzje-wylaczony', 'Przycisk "Zapisz decyzje" wylaczony');
  }

  // Chip Ryzyka -> Nowa pozycja RAID
  const chipRyzyka = page.getByText('Ryzyka', { exact: true }).first();
  await chipRyzyka.click();
  await page.waitForTimeout(2000);
  await zamknijOnboarding();
  await zrzut('14c-chip-ryzyka', 'Chip Ryzyka wybrany');
  const nowaRaid = page.getByRole('button', { name: /Nowa pozycja RAID|Nowe ryzyko|Dodaj ryzyko/i });
  if (await nowaRaid.count()) {
    await nowaRaid.first().click();
    await page.waitForTimeout(1500);
    await zrzut('14d-formularz-nowe-raid', 'Formularz nowej pozycji RAID');
  } else {
    await zrzut('14d-brak-nowa-raid', 'Brak przycisku "Nowa pozycja RAID"');
  }

  // kebab "Eskaluj do problemu" na pierwszym wierszu ryzyka (jesli widoczny)
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  const kebabRyzyko = page.locator('table tbody tr').first().locator('button').last();
  if (await kebabRyzyko.count()) {
    await kebabRyzyko.click().catch(() => {});
    await page.waitForTimeout(800);
    await zrzut('14e-kebab-ryzyko-menu', 'Menu kebab wiersza ryzyka otwarte');
    const eskaluj = page.getByText('Eskaluj do problemu', { exact: false });
    console.log('opcja Eskaluj do problemu widoczna:', await eskaluj.count());
  }
  await page.keyboard.press('Escape').catch(() => {});

  // chip Sygnaly
  const chipSygnaly = page.getByText('Sygnały', { exact: true }).first();
  if (await chipSygnaly.count()) {
    await chipSygnaly.click();
    await page.waitForTimeout(2000);
    await zamknijOnboarding();
    await zrzut('14f-chip-sygnaly', 'Chip Sygnaly wybrany');
    const wierszSygnal = page.locator('table tbody tr').first();
    if (await wierszSygnal.count()) {
      await wierszSygnal.click();
      await page.waitForTimeout(1500);
      await zrzut('14g-sygnal-podglad', 'Podglad sygnalu wybranego');
      const przygotujInterwencje = page.getByRole('button', { name: /Przygotuj interwencję/i });
      if (await przygotujInterwencje.count()) {
        await przygotujInterwencje.first().click();
        await page.waitForTimeout(2000);
        await zrzut('14h-interwencja-przygotowana', 'Po "Przygotuj interwencje" — decyzja w rejestrze?');
      } else {
        await zrzut('14h-brak-przygotuj-interwencje', 'Brak przycisku "Przygotuj interwencje"');
      }
    }
  } else {
    await zrzut('14f-brak-chip-sygnaly', 'Brak chipa "Sygnaly"');
  }

  // === KROK 13: Raporty ===
  console.log('=== KROK 13 ===');
  await page.goto(`${BASE}/execution?tab=reports`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await zamknijOnboarding();
  await zrzut('15a-raporty-lista', 'Zakladka Raporty — lista');
  const nowyRaport = page.getByRole('button', { name: /Nowy raport/i });
  if (await nowyRaport.count()) {
    await nowyRaport.first().click();
    await page.waitForTimeout(2000);
    await zrzut('15b-nowy-raport-kreator', 'Kreator "Nowy raport" otwarty (bez generowania AI)');
  } else {
    await zrzut('15b-brak-nowy-raport', 'Brak przycisku "Nowy raport"');
  }

  await context.close();
  fs.writeFileSync(`${OUT}/api-log-12-13.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE kroki 12-13.');

  // === KROK 14: MEMBER ===
  console.log('=== KROK 14 (MEMBER) ===');
  konsola.length = 0; apiLog.length = 0;
  const memberContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_MEMBER, locale: 'pl-PL' });
  page = await memberContext.newPage();
  wireLogging(page);

  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboarding();
  await zrzut('16a-member-lista-inicjatyw', 'MEMBER — lista Inicjatyw');
  // podglad cudzego szkicu (API Gateway v2 jest bez autora, MEMBER go nie autor)
  const search = page.locator('#modulehub-command-search');
  const searchToggle = page.locator('button[aria-label="Szukaj"]');
  if (await searchToggle.count()) {
    const expanded = await searchToggle.first().getAttribute('aria-expanded');
    if (expanded !== 'true') { await searchToggle.first().click(); await page.waitForTimeout(500); }
  }
  if (await search.count()) { await search.fill('API Gateway v2'); await page.waitForTimeout(1500); }
  const wiersz = page.locator('table tbody tr', { hasText: 'API Gateway v2' }).first();
  if (await wiersz.count()) {
    await wiersz.click();
    await page.waitForTimeout(2000);
    await zrzut('16b-member-podglad-cudzy-szkic', 'MEMBER — podglad cudzego szkicu (API Gateway v2)');
  }

  await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await zamknijOnboarding();
  await zrzut('16c-member-praca', 'MEMBER — zakladka Praca');

  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await zamknijOnboarding();
  await zrzut('16d-member-decyzje', 'MEMBER — Decyzje i ryzyka (sprawdz brak "Nowa decyzja")');
  const memberNowaDecyzja = page.getByRole('button', { name: 'Nowa decyzja' });
  console.log('MEMBER widzi przycisk Nowa decyzja:', await memberNowaDecyzja.count());

  await memberContext.close();
  fs.writeFileSync(`${OUT}/api-log-14-member.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE krok 14.');

  // === KROK 15: SESJA WYGASLA ===
  console.log('=== KROK 15 ===');
  konsola.length = 0;
  const sesjaContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await sesjaContext.newPage();
  wireLogging(page);
  await page.goto(`${BASE}/execution`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await sesjaContext.clearCookies();
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(`${BASE}/execution`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zrzut('17a-sesja-wygasla', 'Po skasowaniu ciasteczek — oczekiwany ekran logowania z komunikatem "Sesja wygasla"');
  await sesjaContext.close();

  await browser.close();
  console.log('GOTOWE WSZYSTKO.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-12-15', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-12-15-awaria.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
