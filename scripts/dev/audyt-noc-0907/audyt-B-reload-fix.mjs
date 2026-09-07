#!/usr/bin/env node
/** Dokonczenie B: po reloadzie trzeba PONOWNIE otworzyc kartę planu (dblclick wiersza) —
 * workspaceOpen to stan w pamieci Reacta, reload zawsze wraca na liste planow. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
const PLAN_NAZWA = 'ODBIÓR NOC 07.09 — plan audytu v3';

const konsola = [];
let page;
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka}`);
}
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });

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

  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const wiersz = page.locator('table tbody tr', { hasText: PLAN_NAZWA }).first();
  await wiersz.waitFor({ timeout: 15000 });
  await wiersz.dblclick();
  await page.waitForTimeout(3000);

  const sekcjeBtn = page.getByRole('button', { name: /^Sekcje/ });
  await sekcjeBtn.waitFor({ timeout: 10000 });
  await sekcjeBtn.click();
  await page.waitForTimeout(500);
  const obciazenieItem = page.getByRole('menuitem', { name: /Obciążenie ról/ });
  await obciazenieItem.waitFor({ timeout: 5000 });
  await obciazenieItem.click();
  await page.waitForTimeout(1500);

  const ariaLabel = 'FTE AI Governance & Ethics Framework Analityk';
  const input = page.locator(`input[aria-label="${ariaLabel}"]`);
  const mam = await input.count();
  let wartosc = null;
  if (mam) wartosc = await input.inputValue();
  console.log('input znaleziony:', mam, 'wartosc:', wartosc);
  await zrzut('B12-po-reloadzie-otwarte-ponownie', `Po reloadzie: wiersz otwarty ponownie (dblclick) -> sekcja Obciążenie ról -> FTE odczytane="${wartosc}" (oczekiwane "2.5")`, { wartosc, oczekiwane: '2.5' });

  await browser.close();
  console.log('GOTOWE fix reload B.');
}
main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-B-reload-fix', String(err?.message || err).slice(0, 300)); } catch {}
  process.exitCode = 1;
});
