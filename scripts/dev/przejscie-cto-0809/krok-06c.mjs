#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/przejscie-cto-0809';

const konsola = [];
function wireLogging(page) {
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
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

  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  const planRow = page.locator('table tbody tr', { hasText: 'Przejscie CTO 08.09' }).first();
  await planRow.waitFor({ timeout: 10000 });
  await planRow.dblclick();
  await page.waitForTimeout(2500);
  await zamknijOnboarding();

  const modal = page.getByRole('dialog', { name: 'Generator planu' });
  const modalOtwarty = await modal.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('modal generatora otwarty po powrocie:', modalOtwarty);
  if (modalOtwarty) {
    await zrzut('06j-modal-po-powrocie', 'Modal generatora nadal otwarty po powrocie na strone (reload/nawigacja)');
    const zatwierdzWModalu = modal.getByRole('button', { name: 'Zatwierdź' });
    const cnt = await zatwierdzWModalu.count();
    console.log('przycisk Zatwierdz w modalu:', cnt);
    if (cnt) {
      await zatwierdzWModalu.click();
      await page.waitForTimeout(2500);
      await zrzut('06k-po-zatwierdzeniu-w-modalu', 'Po kliknieciu Zatwierdz wewnatrz modalu generatora');
    }
    // zamknij modal jesli nadal otwarty
    const xBtn = page.locator('[role="dialog"] button').filter({ hasText: '' }).first();
    const modalDalejOtwarty = await modal.isVisible({ timeout: 1500 }).catch(() => false);
    if (modalDalejOtwarty) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
  }

  await zrzut('06l-stan-po-modalu', 'Stan strony po obsludze modalu generatora');

  const obciazenieTab = page.getByText('Obciążenie ról', { exact: true }).first();
  await obciazenieTab.click({ timeout: 10000 });
  await page.waitForTimeout(2500);
  await zrzut('07a-obciazenie-rol', 'Sekcja Obciazenie rol po propozycji planu');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await zamknijOnboarding();
  await zrzut('07b-obciazenie-rol-po-reload', 'Obciazenie rol po reload');

  await browser.close();
  console.log('GOTOWE 06c/07.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-06c', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  process.exitCode = 1;
});
