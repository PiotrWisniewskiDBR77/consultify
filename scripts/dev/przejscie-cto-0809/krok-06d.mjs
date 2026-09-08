#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://127.0.0.1:3190';
const AUTH_ADMIN = `${SCRATCH}/auth-admin-przejscie.json`;
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
      try { body = (await r.text()).slice(0, 400); } catch {}
      apiLog.push(`${new Date().toISOString()} ${r.request().method()} ${status} ${u.replace(BASE, '')}\n    ${body}`);
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

  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboarding();
  const planRow = page.locator('table tbody tr', { hasText: 'Przejscie CTO 08.09' }).first();
  await planRow.waitFor({ timeout: 10000 });
  await planRow.dblclick();
  await page.waitForTimeout(2500);
  await zamknijOnboarding();

  await page.getByText('Obciążenie ról', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const nowaAnaliza = page.getByRole('button', { name: 'Nowa analiza z tego planu' });
  const cnt = await nowaAnaliza.count();
  console.log('przycisk Nowa analiza:', cnt);
  if (cnt) {
    await nowaAnaliza.click();
    await page.waitForTimeout(2000);
    await zrzut('06m-formularz-nowa-analiza', 'Formularz "Nowa analiza z tego planu" z wybranym planem');

    const utworzAnaliza = page.getByRole('button', { name: /Utwórz analizę/i });
    const cntUtworz = await utworzAnaliza.count();
    console.log('przycisk Utworz analize:', cntUtworz);
    if (cntUtworz) {
      const wlaczony = await utworzAnaliza.isEnabled().catch(() => false);
      console.log('Utworz analize wlaczony:', wlaczony);
      if (wlaczony) {
        await utworzAnaliza.click();
        await page.waitForTimeout(3500);
        await zrzut('06n-po-utworzeniu-analizy', 'Po utworzeniu analizy obciazenia — Arkusz/Luki/Propozycje');
      } else {
        await zrzut('06n-utworz-wylaczony', 'Przycisk "Utworz analize" wylaczony');
      }
    } else {
      await zrzut('06n-brak-przycisku-utworz-analize', 'Brak przycisku "Utworz analize" w formularzu');
    }
  } else {
    await zrzut('06m-brak-nowa-analiza', 'Brak przycisku "Nowa analiza z tego planu"');
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-06d.txt`, apiLog.join('\n\n') + '\n');
  console.log('GOTOWE 06d.');
}

main().catch(async (err) => {
  console.error('AWARIA:', err);
  try { if (page) await zrzut('99-awaria-06d', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`); } catch {}
  try { if (browser) await browser.close(); } catch {}
  fs.writeFileSync(`${OUT}/api-log-06d.txt`, apiLog.join('\n\n') + '\n');
  process.exitCode = 1;
});
