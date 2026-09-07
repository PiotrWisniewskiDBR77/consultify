#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3185';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt-3185.json';
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/realizacja';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH, locale: 'pl-PL' });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[konsola-error]', m.text().slice(0,200)); });

async function zrzut(nazwa) {
  await page.screenshot({ path: `${OUT}/${nazwa}.png` });
  console.log('ZRZUT', nazwa);
}

// Praca: znajdz "VM sizing for prod environment", zmien termin z przeszlego na przyszly
await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const wiersz = page.locator('tr, [role="row"]').filter({ hasText: 'VM sizing for prod environment' }).first();
console.log('Wiersz znaleziony:', await wiersz.count());
await zrzut('21-praca-przed-zmiana-vm');

// Kolumna Termin - 5ta kolumna widoczna (Zadanie/Inicjatywa/Osoba/Termin/Status/DniPoTerminie) - znajdz komorke edytowalna w tym wierszu z klasa data-editable
const komorkaTermin = wiersz.locator('[data-editable="tak"]').nth(1); // 0=Osoba,1=Termin
await komorkaTermin.dblclick();
await page.waitForTimeout(400);
const dateInput = page.locator('input[type="date"][aria-label="Zmień termin"]').first();
const maDateInput = await dateInput.count();
console.log('Input daty widoczny:', maDateInput);
if (maDateInput) {
  await dateInput.fill('2026-09-21');
  await dateInput.press('Enter');
  await page.waitForTimeout(1500);
}
await zrzut('22-praca-po-zmianie-vm');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await zrzut('23-praca-po-reload-vm');

await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('24-zasoby-po-zmianie-vm-marek');

await browser.close();
