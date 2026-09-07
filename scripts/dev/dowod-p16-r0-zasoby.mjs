#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — P16-R0 (Realizacja > Zasoby): duplikat tygodnia + chipy
 * licza wiersze zamiast osob.
 *
 * Uzycie:
 *   node scripts/dev/dowod-p16-r0-zasoby.mjs <przed|po> <BASE> <AUTH>
 *
 * Zapisuje zrzut 1440x900 w motywie JASNYM oraz `.png.json` (url, bledyKonsoli).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://127.0.0.1:3174', AUTH = '/private/tmp/wt-p16-r0/auth-p16r0.json'] =
  process.argv;
const OUT = `/private/tmp/wt-p16-r0/evidence/p16-r0`;
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];

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

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
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
  console.log(`ZRZUT ${nazwa}: ${sciezka}  (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await zrzut(`${faza}-zasoby`, 'Zakladka Realizacja > Zasoby — chipy + tabela osoba x tydzien');

await browser.close();
