#!/usr/bin/env node
/**
 * AUDYT KONCOWY — Inicjatywy, scenariusz A (lancuch statusow, wg instrukcji audytora).
 * Sciezka: szkic -> Przeslij do zatwierdzenia -> Do zatwierdzenia -> Zatwierdz
 * (jesli zablokowane brakiem decyzji GO - zrzut z powodem, BEZ seedowania SQL) ->
 * Zwroc do szkicu (powod) -> Szkic -> ponownie Przeslij -> Odrzuc (powod) -> Odrzucona.
 * Para negatywna: Anna (MEMBER) bez uprawnien.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const AUTH_MEMBER = `${SCRATCH}/auth-anna-odbior.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
fs.mkdirSync(OUT, { recursive: true });

const ORG_ID = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const ADMIN_USER_ID = '76015d70-9117-444f-97a6-4f5eda9d7ad5';
const INI_GLOWNA = 'odbior-noc-0907-automatyzacja-raportowania';
const INI_ROLA = 'odbior-noc-0907-bez-uprawnien';
const NAZWA = 'ODBIOR NOC 07.09 — automatyzacja raportowania';
const NAZWA_ROLA = 'ODBIOR NOC 07.09 — bez uprawnien';

const DB = 'consultify_odbior';
function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const out = execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -Atc '${escaped}'`, { encoding: 'utf8' });
  return out.trim();
}
function sqlExec(query) {
  const escaped = query.replace(/'/g, "'\\''");
  execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -v ON_ERROR_STOP=1 -c '${escaped}'`, { encoding: 'utf8' });
}
function statusWBazie(id) {
  const row = sql(`SELECT status FROM initiatives WHERE id='${id}'`);
  return { status: row || '(brak)' };
}
function resetInicjatywaGlowna() {
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_GLOWNA}'`);
  sqlExec(
    `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, owner_business_id, scope_in, description, created_at, updated_at) VALUES (` +
      `'${INI_GLOWNA}', '${ORG_ID}', '11111111-2222-4333-8444-555555555555', '${NAZWA}', ` +
      `'${NAZWA}', 'DRAFT', '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', '["Raportowanie miesięczne"]', ` +
      `'Inicjatywa audytu koncowego lancucha statusow (DEC audyt 07.09).', now(), now())`
  );
}
function wstawInicjatyweRola() {
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);
  sqlExec(
    `INSERT INTO initiatives (id, organization_id, name, title, status, created_by, owner_business_id, description) VALUES (` +
      `'${INI_ROLA}', '${ORG_ID}', '${NAZWA_ROLA}', '${NAZWA_ROLA}', 'PENDING_APPROVAL', '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', 'Audyt koncowy — para negatywna roli')`
  );
}

const konsola = [];
const apiLogLines = [];
function logApi(response) {
  const u = response.url();
  if (!/\/api\/initiatives\/.*(status|lifecycle-flag|transition-preflight)/i.test(u)) return;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    apiLogLines.push(`${new Date().toISOString()} ${response.request().method()} ${response.status()} ${u.replace(BASE, '')}\n    ${body.slice(0, 300)}`);
  });
}

let page, context;

async function przewinSekcjeEtapu() {
  try {
    const sekcja = page.getByTestId('initiative-lifecycle-actions').or(page.getByTestId('initiative-lifecycle-empty')).or(page.getByTestId('initiative-lifecycle-terminal')).first();
    const widoczna = await sekcja.isVisible({ timeout: 1000 }).catch(() => false);
    if (widoczna) { await sekcja.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
  } catch {}
}
async function zrzut(nazwa, opis, extra = {}) {
  await przewinSekcjeEtapu();
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const stanBazy = extra.pomijStatusWBazie ? null : statusWBazie(INI_GLOWNA);
  const dane = { nazwa, opis, url: page.url(), statusWBazie: stanBazy, bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (url=${page.url()}, bledyKonsoli=${konsola.length}, statusWBazie=${JSON.stringify(stanBazy)})`);
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
  await page.waitForTimeout(1000);
  await zamknijOnboardingJesliJest();
}
async function zamknijOnboardingJesliJest() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}
async function otworzWierszInicjatyw(nazwaSzukana, zakresWszystkie = false) {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboardingJesliJest();
  if (zakresWszystkie) {
    const chip = page.locator('[data-testid="initiatives-menu3-chip-all"]');
    if (await chip.count()) { await chip.first().click(); await page.waitForTimeout(2000); }
  }
  const wiersz = page.locator('table tbody tr', { hasText: nazwaSzukana }).first();
  await wiersz.waitFor({ timeout: 20000 });
  await wiersz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await wiersz.click();
  await page.waitForTimeout(2500);
}
async function kliknijAkcje(testId) {
  const przycisk = page.locator(`[data-testid="${testId}"]`);
  await przycisk.waitFor({ timeout: 15000 });
  await przycisk.scrollIntoViewIfNeeded();
  const disabled = await przycisk.isDisabled().catch(() => null);
  await przycisk.click({ force: true });
  return disabled;
}
async function kliknijAkcjeZPowodem(testId, powod) {
  await kliknijAkcje(testId);
  await page.waitForTimeout(800);
  const poleP = page.locator('[data-testid="initiative-reason-input"]');
  await poleP.waitFor({ timeout: 10000 });
  await poleP.fill(powod);
  await page.waitForTimeout(400);
  const potwierdzBtn = page.locator('[data-testid="initiative-reason-confirm"]');
  await potwierdzBtn.click({ force: true });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  console.log('=== KROK 0: seed inicjatywy DRAFT (SQL, wg instrukcji audytora) ===');
  resetInicjatywaGlowna();

  await ustawMotywJasny();

  console.log('=== 01: podglad szkicu ===');
  konsola.length = 0;
  await otworzWierszInicjatyw(NAZWA);
  await zrzut('01-szkic-podglad', 'Inicjatywy -> wiersz (SQL-seed DRAFT, wlasciciel+zakres uzupelnione) -> podglad');

  console.log('=== 02: Przeslij do zatwierdzenia ===');
  const disabledPrzeslij = await kliknijAkcje('initiative-lifecycle-transition:PENDING_APPROVAL');
  console.log('  disabled przed klikiem:', disabledPrzeslij);
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await otworzWierszInicjatyw(NAZWA);
  await zrzut('02-do-zatwierdzenia', 'Po "Prześlij do zatwierdzenia" i odswiezeniu — status "Do zatwierdzenia"');

  console.log('=== 03: Zatwierdz inicjatywe — oczekiwane zablokowane (brak decyzji GO) ===');
  const zatwBtn = page.locator('[data-testid="initiative-lifecycle-transition:APPROVED"]');
  const zatwCount = await zatwBtn.count();
  let zatwDisabled = null;
  let zatwPowod = '(przycisk nie istnieje w ogole)';
  if (zatwCount) {
    zatwDisabled = await zatwBtn.isDisabled().catch(() => null);
    if (zatwDisabled) {
      zatwPowod = await page.locator('[data-testid="initiative-lifecycle-reason-transition:APPROVED"]').textContent().catch(() => '(brak powodu na ekranie)');
    }
  }
  console.log('  "Zatwierdź inicjatywę" — disabled:', zatwDisabled, 'powod:', zatwPowod);
  await zrzut('03-zatwierdz-zablokowany', `"Zatwierdź inicjatywę" — disabled=${zatwDisabled}. Powod: ${zatwPowod}`);

  console.log('=== 04: Zwroc do szkicu (z powodem) ===');
  await kliknijAkcjeZPowodem('initiative-lifecycle-transition:DRAFT', 'Audyt koncowy — potrzebna korekta zakresu przed ponowna probą.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await otworzWierszInicjatyw(NAZWA);
  await zrzut('04-znow-szkic', 'Po "Zwróć do szkicu" (z powodem) i odswiezeniu — status "Szkic" ponownie');

  console.log('=== 05: ponownie Przeslij do zatwierdzenia ===');
  await kliknijAkcje('initiative-lifecycle-transition:PENDING_APPROVAL');
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await otworzWierszInicjatyw(NAZWA);
  await zrzut('05-znow-do-zatwierdzenia', 'Ponownie "Do zatwierdzenia" po drugim przeslaniu');

  console.log('=== 06: Odrzuc (z powodem) ===');
  await kliknijAkcjeZPowodem('initiative-lifecycle-transition:REJECTED', 'Audyt koncowy — odrzucenie testowe do dowodu lancucha statusow.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  console.log('=== 07: Odrzucona — widoczna w "Wszystkie" ===');
  await otworzWierszInicjatyw(NAZWA, true);
  await zrzut('06-odrzucona-wszystkie', 'Zakres "Wszystkie" -> wiersz -> status "Odrzucona"');

  console.log('=== 08: para negatywna ROLA (Anna, MEMBER) ===');
  wstawInicjatyweRola();
  await context.close();

  const contextMember = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_MEMBER, locale: 'pl-PL' });
  page = await contextMember.newPage();
  konsola.length = 0;
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  await ustawMotywJasny();
  await otworzWierszInicjatyw(NAZWA_ROLA);
  await page.waitForTimeout(1500);
  await zrzut('07-rola-brak-przycisku', 'Konto MEMBER (Anna) bez roli w inicjatywach — sekcja "Nie masz uprawnień...", zero przyciskow przejsc', { pomijStatusWBazie: true });

  await contextMember.close();

  console.log('=== 09: sprzatanie inicjatywy roli (odrzucona zostaje do dalszych zrzutow) ===');
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log.txt`, apiLogLines.join('\n\n') + '\n');
  console.log(`\nZapisano log API: ${OUT}/api-log.txt`);
  console.log('GOTOWE scenariusz A.');
}

main().catch(async (err) => {
  console.error('AWARIA GLOWNA:', err);
  try {
    if (page) await zrzut('99-awaria-glowna-A', `Nieprzechwycony blad skryptu: ${String(err?.message || err).slice(0, 300)}`, { pomijStatusWBazie: true });
  } catch (e2) { console.error('nie udalo sie zrobic zrzutu awarii:', e2); }
  fs.writeFileSync(`${OUT}/api-log.txt`, apiLogLines.join('\n\n') + '\n');
  process.exitCode = 1;
});
