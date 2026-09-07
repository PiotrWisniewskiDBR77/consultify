#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — P16/R4+R5 (RAID w zakladce "Decyzje i ryzyka" + Sygnaly).
 *
 * Uzycie: node scripts/dev/p16-r45/dowod-r45.mjs <przed|po> [BASE] [AUTH]
 *
 * Klika to, co klika czlowiek: Realizacja -> Decyzje i ryzyka -> chipy Menu 3.
 * Zrzuty 1440x900, motyw JASNY, `.png.json` z url + bledami konsoli, log API.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po',
  BASE = 'http://127.0.0.1:3181',
  AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json',
] = process.argv;
const OUT = `/private/tmp/wt-p16-r45/evidence/p16-r45/${faza}`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/(raid|decisions|execution-control|initiatives\/runtime-v1)/i.test(u)) return;
  let body = '';
  try { body = (await r.text()).slice(0, 300); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({
    nazwa, opis, faza, url: page.url(), szerokosc: 1440, motyw: 'jasny',
    bledyKonsoli: [...konsola], czas: new Date().toISOString(),
  }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

async function otworzZakladke() {
  await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
}

async function chip(nazwa) {
  const b = page.locator('button').filter({ hasText: new RegExp(`^${nazwa}\\s*\\d*$`) }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(2500); return true; }
  console.log(`chip "${nazwa}" NIE ZNALEZIONY`);
  return false;
}

await otworzZakladke();
await zrzut('01-decyzje', 'Zakladka Decyzje i ryzyka, preset Decyzje');
await chip('Ryzyka');
await zrzut('02-ryzyka', 'Preset Ryzyka — zestaw kolumn RAID');
if (await chip('Sygnały')) await zrzut('03-sygnaly', 'Preset Sygnaly — delay-signals');
else { await chip('Po terminie'); await zrzut('03-po-terminie', 'Preset Po terminie (stan przed R5)'); }

fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
console.log(`API wywolan: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
await browser.close();
