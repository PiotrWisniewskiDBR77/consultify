#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';

const konsola = [];
function wireLogging(page) { page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); }); }
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

  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  await page.getByText('Wszystkie', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  for (const mode of ['kanban', 'timeline', 'grid']) {
    konsola.length = 0;
    const btn = page.locator(`[data-testid="view-mode-${mode}"]`);
    const cnt = await btn.count();
    console.log(`widok ${mode}: przycisk znaleziony=${cnt}`);
    if (cnt) {
      await btn.first().click();
      await page.waitForTimeout(2500);
      await zamknijOnboarding();
      await zrzut(`08-widok-${mode}`, `Widok "${mode}" listy Inicjatyw`);
    } else {
      await zrzut(`08-brak-widoku-${mode}`, `Brak przycisku widoku ${mode}`);
    }
  }

  await browser.close();
  console.log('GOTOWE widoki.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-widoki', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  process.exitCode = 1;
});
