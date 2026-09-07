#!/usr/bin/env node
/** Dokonczenie C: otworz ISTNIEJACA opublikowana analize (seed) i pokaz
 * sekcje Arkusz/Luki/Propozycje dzialajace na prawdziwych danych. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';

const konsola = [];
let page;
async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
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

  console.log('=== otworz istniejaca analize (Controls Engineer, seed) ===');
  await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const wiersz = page.locator('table tbody tr', { hasText: 'Analiza obciążenia' }).first();
  await wiersz.waitFor({ timeout: 15000 });
  await wiersz.dblclick();
  await page.waitForTimeout(3000);
  await zrzut('C06-analiza-otwarta-workspace', 'Karta analizy obciazenia (seed, Opublikowany) otwarta w warsztacie (workspaceOpen=true)');

  const arkuszBtn = page.getByRole('button', { name: /Arkusz obciążenia|Arkusz/ }).or(page.getByRole('menuitem', { name: /Arkusz obciążenia/ }));
  const sekcjeBtn = page.getByRole('button', { name: /^Sekcje/ });
  if (await sekcjeBtn.count()) {
    await sekcjeBtn.click(); await page.waitForTimeout(400);
    const arkuszItem = page.getByRole('menuitem', { name: /Arkusz obciążenia/ });
    if (await arkuszItem.count()) { await arkuszItem.click(); await page.waitForTimeout(1200); }
  }
  await zrzut('C07-arkusz-obciazenia-seed', 'Sekcja "Arkusz obciążenia" — dane seed (okres x rola, popyt/podaz)');

  if (await sekcjeBtn.count()) {
    await sekcjeBtn.click(); await page.waitForTimeout(400);
    const lukiItem = page.getByRole('menuitem', { name: /Luki i presja/ });
    if (await lukiItem.count()) { await lukiItem.click(); await page.waitForTimeout(1200); }
  }
  await zrzut('C08-luki-i-presja-seed', 'Sekcja "Luki i presja" — dane seed');

  if (await sekcjeBtn.count()) {
    await sekcjeBtn.click(); await page.waitForTimeout(400);
    const propItem = page.getByRole('menuitem', { name: /Propozycje zmian/ });
    if (await propItem.count()) { await propItem.click(); await page.waitForTimeout(1200); }
  }
  await zrzut('C09-propozycje-zmian-seed', 'Sekcja "Propozycje zmian" (CapacityOptionsPanel) — dane seed');

  await browser.close();
  console.log('GOTOWE C dokonczenie (seed).');
}
main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-C2', String(err?.message || err).slice(0, 300)); } catch {}
  process.exitCode = 1;
});
