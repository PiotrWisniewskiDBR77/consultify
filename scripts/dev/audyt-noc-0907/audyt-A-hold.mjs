#!/usr/bin/env node
/**
 * Dokonczenie scenariusza A: flaga "Wstrzymana" (HOLD) na inicjatywie IN_EXECUTION,
 * potem zdjecie flagi (RESUME). Weryfikacja: DB on_hold + wyglad listy/podgladu po reload.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
const ORG_ID = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const ADMIN_USER_ID = '76015d70-9117-444f-97a6-4f5eda9d7ad5';
const INI_HOLD = 'odbior-noc-0907-flaga-wstrzymania';
const NAZWA = 'ODBIOR NOC 07.09 — flaga wstrzymania';
const DB = 'consultify_odbior';

function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  return execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -Atc '${escaped}'`, { encoding: 'utf8' }).trim();
}
function sqlExec(query) {
  const escaped = query.replace(/'/g, "'\\''");
  execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -v ON_ERROR_STOP=1 -c '${escaped}'`, { encoding: 'utf8' });
}
function stanBazy() {
  const row = sql(`SELECT status, on_hold FROM initiatives WHERE id='${INI_HOLD}'`);
  return row || '(brak)';
}
function resetInicjatywa() {
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_HOLD}'`);
  sqlExec(
    `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, on_hold, created_by, owner_business_id, description, created_at, updated_at) VALUES (` +
      `'${INI_HOLD}', '${ORG_ID}', '11111111-2222-4333-8444-555555555555', '${NAZWA}', '${NAZWA}', ` +
      `'IN_EXECUTION', false, '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', ` +
      `'Audyt koncowy — flaga wstrzymania (DEC-424).', now(), now())`
  );
}

const konsola = [];
const apiLogLines = [];
function logApi(response) {
  const u = response.url();
  if (!/\/api\/initiatives\/.*(lifecycle-flag|transition-preflight)/i.test(u)) return;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    apiLogLines.push(`${new Date().toISOString()} ${response.request().method()} ${response.status()} ${u.replace(BASE, '')}\n    ${body.slice(0, 400)}`);
  });
}

let page, context;
async function przewinSekcjeEtapu() {
  try {
    const sekcja = page.getByTestId('initiative-lifecycle-actions').or(page.getByTestId('initiative-lifecycle-empty')).or(page.getByTestId('initiative-lifecycle-terminal')).first();
    if (await sekcja.isVisible({ timeout: 1000 }).catch(() => false)) { await sekcja.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
  } catch {}
}
async function zrzut(nazwa, opis, extra = {}) {
  await przewinSekcjeEtapu();
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const dane = { nazwa, opis, url: page.url(), statusWBazie: extra.pomijStatusWBazie ? null : stanBazy(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (statusWBazie=${dane.statusWBazie})`);
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
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  if (await pomin.first().isVisible({ timeout: 2000 }).catch(() => false)) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}
async function otworzWiersz(nazwaSzukana) {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const chip = page.locator('[data-testid="initiatives-menu3-chip-all"]');
  if (await chip.count()) { await chip.first().click(); await page.waitForTimeout(2000); }
  const wiersz = page.locator('table tbody tr', { hasText: nazwaSzukana }).first();
  await wiersz.waitFor({ timeout: 20000 });
  await wiersz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return wiersz;
}
async function kliknijAkcje(testId) {
  const przycisk = page.locator(`[data-testid="${testId}"]`);
  await przycisk.waitFor({ timeout: 15000 });
  await przycisk.scrollIntoViewIfNeeded();
  await przycisk.click({ force: true });
}
async function kliknijAkcjeZPowodem(testId, powod) {
  await kliknijAkcje(testId);
  await page.waitForTimeout(800);
  const poleP = page.locator('[data-testid="initiative-reason-input"]');
  await poleP.waitFor({ timeout: 10000 });
  await poleP.fill(powod);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="initiative-reason-confirm"]').click({ force: true });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  console.log('=== KROK 0: seed IN_EXECUTION, on_hold=false ===');
  resetInicjatywa();
  await ustawMotywJasny();

  console.log('=== 08a: przed HOLD (W realizacji, bez flagi) ===');
  const wiersz1 = await otworzWiersz(NAZWA);
  await wiersz1.click();
  await page.waitForTimeout(2000);
  await zrzut('08a-przed-hold', 'IN_EXECUTION, on_hold=false — stan wyjsciowy przed flaga');

  console.log('=== 08b: HOLD (z powodem) ===');
  await kliknijAkcjeZPowodem('initiative-lifecycle-flag:HOLD', 'Audyt koncowy — wstrzymanie testowe flagi (DEC-424).');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const wiersz2 = await otworzWiersz(NAZWA);
  await wiersz2.click();
  await page.waitForTimeout(2000);
  await zrzut('08b-po-hold-lista', 'Po HOLD i reloadzie — wiersz listy (oczekiwane: kropka/pigulka warning=Wstrzymana)');

  console.log('=== 08c: RESUME (zdjecie flagi) ===');
  await kliknijAkcje('initiative-lifecycle-flag:RESUME');
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const wiersz3 = await otworzWiersz(NAZWA);
  await wiersz3.click();
  await page.waitForTimeout(2000);
  await zrzut('08c-po-resume', 'Po RESUME i reloadzie — flaga zdjeta, on_hold powinno wrocic do false');

  await context.close();
  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-hold.txt`, apiLogLines.join('\n\n') + '\n');
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_HOLD}'`);
  console.log('GOTOWE flaga HOLD/RESUME. Posprzatane.');
}
main().catch(async (err) => {
  console.error('AWARIA HOLD:', err);
  try { if (page) await zrzut('99-awaria-hold', String(err?.message || err).slice(0, 300), { pomijStatusWBazie: true }); } catch {}
  fs.writeFileSync(`${OUT}/api-log-hold.txt`, apiLogLines.join('\n\n') + '\n');
  process.exitCode = 1;
});
