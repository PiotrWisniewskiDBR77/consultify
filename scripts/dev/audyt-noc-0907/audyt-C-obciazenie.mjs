#!/usr/bin/env node
/** Scenariusz C — Obciazenie: arkusz rol (seed), CapacityOptionsPanel reagujacy na plan z B. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
const PLAN_NAZWA = 'ODBIÓR NOC 07.09 — plan audytu v3';

const konsola = [];
const apiLog = [];
let page;
function logApi(response) {
  const u = response.url();
  if (!/\/api\/.*(runtime-v1|resource-plan|capacity-roles|capacity-scenarios)/i.test(u)) return;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    apiLog.push(`${new Date().toISOString()} ${response.request().method()} ${response.status()} ${u.replace(BASE, '')}\n    ${body.slice(0, 400)}`);
  });
}
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
  page.on('response', (r) => { logApi(r); });

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

  console.log('=== 01: zakladka Obciazenie — lista analiz ===');
  await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zrzut('C01-lista-analiz', 'Zakladka Obciazenie — lista analiz obciazenia (jesli istnieja)');

  console.log('=== 02: otworz plan v3 w Plan -> Nowa analiza z tego planu ===');
  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const wiersz = page.locator('table tbody tr', { hasText: PLAN_NAZWA }).first();
  await wiersz.waitFor({ timeout: 15000 });
  await wiersz.dblclick();
  await page.waitForTimeout(3000);
  const sekcjeBtn = page.getByRole('button', { name: /^Sekcje/ });
  await sekcjeBtn.click();
  await page.waitForTimeout(400);
  const obciazenieItem = page.getByRole('menuitem', { name: /Obciążenie ról/ });
  await obciazenieItem.click();
  await page.waitForTimeout(1000);
  const nowaAnaliza = page.getByRole('button', { name: /Nowa analiza z tego planu/ });
  const mamNowaAnaliza = await nowaAnaliza.count();
  console.log('  przycisk "Nowa analiza z tego planu":', mamNowaAnaliza);
  if (mamNowaAnaliza) {
    await nowaAnaliza.click();
    await page.waitForTimeout(4000);
  }
  await zrzut('C02-po-nowej-analizie', 'Po "Nowa analiza z tego planu" — karta analizy obciazenia utworzona z planu v3');

  console.log('=== 03: arkusz Obciazenia — kolumny/wiersze ===');
  const arkuszBtn = page.getByRole('button', { name: /Arkusz obciążenia|Arkusz/ });
  if (await arkuszBtn.count()) { await arkuszBtn.first().click(); await page.waitForTimeout(1200); }
  await zrzut('C03-arkusz-obciazenia', 'Sekcja "Arkusz obciążenia" — okres x rola, podaz z katalogu (seed)');

  console.log('=== 04: Luki i presja ===');
  const lukiBtn = page.getByRole('button', { name: /Luki i presja/ });
  if (await lukiBtn.count()) { await lukiBtn.first().click(); await page.waitForTimeout(1200); }
  await zrzut('C04-luki-i-presja', 'Sekcja "Luki i presja" — porownanie popyt/podaz z planu v3');

  console.log('=== 05: Pracuj z AI -> Analizuj -> Propozycje zmian (CapacityOptionsPanel) ===');
  const pracujZAI = page.locator('[data-testid="pracuj-z-ai"]');
  if (await pracujZAI.count()) {
    await pracujZAI.click();
    await page.waitForTimeout(700);
    const analizuj = page.getByRole('menuitem', { name: /Analizuj/ });
    if (await analizuj.count()) {
      await analizuj.click();
      await page.waitForTimeout(1000);
      const zgoda = page.locator('[data-testid="pracuj-z-ai-zatwierdz"]');
      if (await zgoda.count()) { await zgoda.click(); await page.waitForTimeout(8000); }
    }
  }
  const propozycjeBtn = page.getByRole('button', { name: /Propozycje zmian/ });
  if (await propozycjeBtn.count()) { await propozycjeBtn.first().click(); await page.waitForTimeout(1200); }
  await zrzut('C05-propozycje-zmian-panel', 'Sekcja "Propozycje zmian" — CapacityOptionsPanel z wariantami doradcy (jesli presja > 0)');

  fs.writeFileSync(`${OUT}/api-log-C.txt`, apiLog.join('\n\n') + '\n');
  await browser.close();
  console.log('GOTOWE scenariusz C (rozpoznanie).');
}
main().catch(async (err) => {
  console.error('AWARIA C:', err);
  try { if (page) await zrzut('99-awaria-C', String(err?.message || err).slice(0, 400)); } catch {}
  fs.writeFileSync(`${OUT}/api-log-C.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
