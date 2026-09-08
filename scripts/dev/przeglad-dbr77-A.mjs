#!/usr/bin/env node
/**
 * Przegląd Inicjatyw na danych DBR77 (kopia stagingu) — SCENARIUSZ A.
 * Lista + 6 podglądów statusowych + dropdown "Cykl życia" (liczniki) + widoki.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3188';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt-state.json`;
const OUT = '/private/tmp/wt-rev-ini/evidence/przeglad-dbr77/inicjatywy';
fs.mkdirSync(OUT, { recursive: true });

const DB = 'consultify_kopia_ini';
function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const out = execSync(`docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc '${escaped}'`, { encoding: 'utf8' });
  return out.trim();
}

const konsola = [];
const apiLogLines = [];
function logApi(response) {
  const u = response.url();
  if (!/\/api\//.test(u)) return;
  const start = response.request().timing?.() || null;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    const status = response.status();
    const isSlow = false; // czas mierzymy osobno przez request/response event pary
    if (status >= 400) {
      apiLogLines.push(`${new Date().toISOString()} ${response.request().method()} ${status} ${u.replace(BASE, '')}\n    ${body.slice(0, 400)}`);
    }
  });
}

let page, context, browser;
const timings = [];

async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const dane = { nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

async function ustawMotywJasny() {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = 'consultify-storage';
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'light' };
    localStorage.setItem(KEY, JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await zamknijOnboardingJesliJest();
}
async function zamknijOnboardingJesliJest() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}

async function otworzListe() {
  const t0 = Date.now();
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijOnboardingJesliJest();
  const t1 = Date.now();
  timings.push({ krok: 'otworz-liste-initiatives', ms: t1 - t0 });
}

async function ustawZakresWszystkie() {
  await zamknijOnboardingJesliJest();
  const radio = page.getByRole('radio', { name: 'Wszystkie' });
  if (await radio.count()) { await radio.first().click(); await page.waitForTimeout(1500); }
  await zamknijOnboardingJesliJest();
}

async function wybierzStatusWDropdownzie(labelStatusu) {
  await zamknijOnboardingJesliJest();
  const dropdown = page.locator('[data-testid="initiatives-lifecycle-dropdown"]');
  await dropdown.waitFor({ timeout: 10000 });
  await dropdown.click();
  await page.waitForTimeout(400);
  const opcja = page.locator('[role="option"]', { hasText: labelStatusu }).first();
  await opcja.waitFor({ timeout: 10000 });
  await opcja.click();
  await page.waitForTimeout(2000);
}

async function otworzWedlugStatusuINazwy(labelStatusu, pelnaNazwa) {
  await otworzListe();
  await ustawZakresWszystkie();
  await wybierzStatusWDropdownzie(labelStatusu);
  await zamknijOnboardingJesliJest();
  const searchToggle = page.locator('button[aria-label="Szukaj"]');
  if (await searchToggle.count()) {
    const expanded = await searchToggle.first().getAttribute('aria-expanded');
    if (expanded !== 'true') { await searchToggle.first().click(); await page.waitForTimeout(500); }
  }
  const search = page.locator('#modulehub-command-search');
  await search.waitFor({ timeout: 10000 });
  await search.fill(pelnaNazwa);
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
  const wiersz = page.locator('table tbody tr, [role="row"]', { hasText: pelnaNazwa }).first();
  await wiersz.waitFor({ timeout: 15000 });
  await wiersz.click();
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  await ustawMotywJasny();

  console.log('=== 00: liczby w bazie per status ===');
  const liczby = sql(`SELECT status, count(*) FROM initiatives WHERE organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' GROUP BY status ORDER BY status`);
  console.log(liczby);
  fs.writeFileSync(`${OUT}/00-liczby-w-bazie.txt`, liczby + '\n');

  console.log('=== 01: lista domyslna (scope Aktywne) ===');
  konsola.length = 0;
  await otworzListe();
  await zrzut('01-lista-domyslna', 'Lista Inicjatyw — scope domyslny po zalogowaniu');

  console.log('=== 02: scope Wszystkie ===');
  await ustawZakresWszystkie();
  await zrzut('02-lista-wszystkie', 'Lista Inicjatyw — scope "Wszystkie" (powinno pokazac 104 wg bazy)');

  console.log('=== 03: dropdown Cykl zycia otwarty (liczniki per status) ===');
  const dropdown = page.locator('[data-testid="initiatives-lifecycle-dropdown"]');
  await dropdown.click();
  await page.waitForTimeout(600);
  await zrzut('03-dropdown-cykl-zycia', 'Dropdown "Cykl zycia" otwarty — liczniki per status widoczne do porownania z baza');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  console.log('=== 04-09: podglady 6 statusow ===');
  const statusy = [
    { label: 'Szkic', nazwa: 'Automatyzacja optymalizacji przezbrojeń', plik: '04-podglad-draft' },
    { label: 'Do zatwierdzenia', nazwa: 'Program wzmocnienia cyberbezpieczeństwa', plik: '05-podglad-pending-approval' },
    { label: 'Zatwierdzona', nazwa: 'Wdrożenie RPA', plik: '06-podglad-approved' },
    { label: 'W realizacji', nazwa: 'System zarządzania jakością 4.0', plik: '07-podglad-in-execution' },
    { label: 'Zamknięta', nazwa: 'Wdrożenie predykcyjnego utrzymania ruchu (PdM) w DBR77', plik: '08-podglad-closed' },
    { label: 'Odrzucona', nazwa: 'P1', plik: '09-podglad-rejected' },
  ];
  for (const s of statusy) {
    konsola.length = 0;
    await otworzWedlugStatusuINazwy(s.label, s.nazwa);
    await zrzut(s.plik, `Podglad — status "${s.label}", inicjatywa "${s.nazwa}" — sekcja "Etap inicjatywy"`);
  }

  console.log('=== 10-13: widoki (table/kanban/timeline/grid) ===');
  await otworzListe();
  await ustawZakresWszystkie();
  for (const mode of ['table', 'kanban', 'timeline', 'grid']) {
    konsola.length = 0;
    await zamknijOnboardingJesliJest();
    const btn = page.locator(`[data-testid="view-mode-${mode}"]`);
    const count = await btn.count();
    if (!count) { console.log(`  widok ${mode}: BRAK PRZYCISKU`); continue; }
    await btn.first().click();
    await page.waitForTimeout(2500);
    await zrzut(`1${['table','kanban','timeline','grid'].indexOf(mode)}-widok-${mode}`, `Widok "${mode}" na scope Wszystkie`, { bledyKonsoli: [...konsola] });
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-A.txt`, apiLogLines.join('\n\n') + '\n');
  fs.writeFileSync(`${OUT}/timings-A.json`, JSON.stringify(timings, null, 2));
  console.log('GOTOWE scenariusz A.');
}

main().catch(async (err) => {
  console.error('AWARIA GLOWNA A:', err);
  try { if (browser) await browser.close(); } catch (e4) {}
  try {
    if (page) await zrzut('99-awaria-glowna-A', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`);
  } catch (e2) { console.error('zrzut awarii nie powiodl sie:', e2); }
  fs.writeFileSync(`${OUT}/api-log-A.txt`, apiLogLines.join('\n\n') + '\n');
  process.exitCode = 1;
});
