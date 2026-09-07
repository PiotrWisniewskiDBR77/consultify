#!/usr/bin/env node
/** Dokonczenie scenariusza A: zrzut odrzuconej w zakresie "Wszystkie" + para negatywna Anna. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const AUTH_MEMBER = `${SCRATCH}/auth-anna-odbior.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
const ORG_ID = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const ADMIN_USER_ID = '76015d70-9117-444f-97a6-4f5eda9d7ad5';
const NAZWA = 'ODBIOR NOC 07.09 — automatyzacja raportowania';
const INI_ROLA = 'odbior-noc-0907-bez-uprawnien';
const NAZWA_ROLA = 'ODBIOR NOC 07.09 — bez uprawnien';
const DB = 'consultify_odbior';
function sqlExec(query) {
  const escaped = query.replace(/'/g, "'\\''");
  execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -v ON_ERROR_STOP=1 -c '${escaped}'`, { encoding: 'utf8' });
}
function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  return execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -Atc '${escaped}'`, { encoding: 'utf8' }).trim();
}
sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);
sqlExec(
  `INSERT INTO initiatives (id, organization_id, name, title, status, created_by, owner_business_id, description) VALUES (` +
    `'${INI_ROLA}', '${ORG_ID}', '${NAZWA_ROLA}', '${NAZWA_ROLA}', 'PENDING_APPROVAL', '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', 'Audyt koncowy — para negatywna roli')`
);

const konsola = [];
let page;
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka}`);
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

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });

  await ustawMotywJasny();
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const wszystkie = page.getByRole('radio', { name: 'Wszystkie' });
  const mamRadio = await wszystkie.count();
  console.log('radio Wszystkie count:', mamRadio);
  if (mamRadio) { await wszystkie.first().click(); await page.waitForTimeout(2500); }
  const wiersz = page.locator('table tbody tr', { hasText: NAZWA }).first();
  let znaleziono = false;
  try { await wiersz.waitFor({ timeout: 15000 }); znaleziono = true; } catch { znaleziono = false; }
  console.log('wiersz znaleziony w Wszystkie?', znaleziono);
  if (znaleziono) {
    await wiersz.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await wiersz.click();
    await page.waitForTimeout(2000);
    await zrzut('06-odrzucona-wszystkie', 'Zakres "Wszystkie" -> wiersz -> status "Odrzucona"');
  } else {
    await zrzut('06-odrzucona-brak-na-liscie', 'Zakres "Wszystkie" NIE pokazuje odrzuconej inicjatywy na liscie', { pomijStatusWBazie: true });
  }
  await context.close();

  const contextMember = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_MEMBER, locale: 'pl-PL' });
  page = await contextMember.newPage();
  konsola.length = 0;
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  await ustawMotywJasny();
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const wiersz2 = page.locator('table tbody tr', { hasText: NAZWA_ROLA }).first();
  await wiersz2.waitFor({ timeout: 20000 });
  await wiersz2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await wiersz2.click();
  await page.waitForTimeout(2000);
  await zrzut('07-rola-brak-przycisku', 'Konto MEMBER (Anna) bez roli w inicjatywach — sekcja "Nie masz uprawnień...", zero przyciskow przejsc', { pomijStatusWBazie: true });
  await contextMember.close();

  sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);
  await browser.close();
  console.log('GOTOWE dokonczenie A.');
}
main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-dokonczenie-A', String(err?.message || err).slice(0,300), { pomijStatusWBazie: true }); } catch {}
  process.exitCode = 1;
});
