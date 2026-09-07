#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — Realizacja → Praca (P16 R2, edycja w wierszu).
 *
 * Uzycie:
 *   node scripts/dev/realizacja/dowod-praca-r2.mjs <przed|po> <BASE> <AUTH> [OUT]
 *
 * Faza `przed`: sam stan zakladki (read-only) — dowod, ze edycji nie ma.
 * Faza `po`: przejscie PMO — zadanie po terminie → zmien osobe w wierszu →
 * reload → trwale → zmien termin → reload → zamknij zadanie → reload →
 * „Dni po terminie" = „—" → „Nowe zadanie" z inicjatywa → na liscie.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://127.0.0.1:3175', AUTH = '', OUTDIR = ''] = process.argv;
const OUT = OUTDIR || `/private/tmp/wt-p16-r2/evidence/p16-r2/${faza}`;
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
page.on('console', (m) => {
  if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
});
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\/(tasks|initiatives)/i.test(u)) return;
  const met = r.request().method();
  if (met === 'GET') {
    apiLog.push(`${met} ${r.status()} ${u.replace(BASE, '')}`);
    return;
  }
  let body = '';
  try {
    body = (await r.text()).slice(0, 200);
  } catch {
    body = '(brak ciala)';
  }
  apiLog.push(
    `${met} ${r.status()} ${u.replace(BASE, '')}\n    zadanie=${r.request().postData()?.slice(0, 200) ?? ''}\n    odpowiedz=${body}`
  );
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(
    `${sciezka}.json`,
    JSON.stringify(
      {
        nazwa,
        opis,
        faza,
        url: page.url(),
        szerokosc: 1440,
        motyw: 'jasny',
        bledyKonsoli: [...konsola],
        czas: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`ZRZUT ${nazwa}: ${sciezka} (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

async function otworzPrace() {
  await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
}

await otworzPrace();
await zrzut('01-praca-lista', 'Zakladka Praca — lista zadan');

const chip = page.getByRole('button', { name: /Po terminie/i }).first();
if (await chip.count()) {
  await chip.click();
  await page.waitForTimeout(2500);
}
await zrzut('02-praca-po-terminie', 'Preset „Po terminie"');

if (faza === 'przed') {
  const wiersz = page.locator('table tbody tr').first();
  if (await wiersz.count()) {
    await wiersz.click();
    await page.waitForTimeout(1500);
    await zrzut('03-podglad', 'Podglad wiersza (stan PRZED — brak akcji zapisu)');
  }
}

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n'));
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n'));
console.log(`API log: ${apiLog.length} wpisow, bledy konsoli: ${konsola.length}`);
await browser.close();
