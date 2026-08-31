/**
 * 153-crimson-naprawa — dowody PO dla check-triada.sh --all gate restoration.
 *
 * Jednorazowy capture (nie generyczne narzędzie): plan-scenario-d1 wymaga
 * kliknięcia „Otwórz narzędzia planu" przed zrzutem, żeby ujawnić poprawioną
 * komórkę przypisania w macierzy „Oś czasu" (PlanScenarioSurface.tsx) —
 * scripts/dev/grafika-zrzuty.mjs nie wspiera kroku klik-przed-zrzutem, więc
 * ten mały wrapper dogania go o interakcję. interview-progressbar-153
 * renderuje poprawiony pasek postępu (InterviewWorkspace.tsx) bez interakcji.
 *
 * Wymaga działającego harnessu dev-render na porcie 4991 (patrz
 * .claude/launch.json → triada-153-crimson-naprawa).
 *
 * Wynik: evidence/153-crimson-naprawa/<ekran>__PO__<light|dark>.png
 */
import fs from 'fs';
import path from 'path';

import { chromium } from 'playwright';

const BASE = 'http://localhost:4991';
const OUT = path.resolve(process.cwd(), 'evidence/153-crimson-naprawa');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const wyniki = [];

for (const motyw of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const url = `${BASE}/?screen=plan-scenario-d1&lang=pl&theme=${motyw}&uwagi=0`;
  const plik = path.join(OUT, `plan-scenario-d1__PO__${motyw}.png`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Otwórz narzędzia planu' }).click();
    await page.waitForTimeout(600);
    await page.addStyleTag({
      content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }',
    });
    await page.screenshot({ path: plik, fullPage: true });
    wyniki.push({ plik, status: 'OK' });
  } catch (e) {
    wyniki.push({ plik, status: `BŁĄD: ${e.message.slice(0, 120)}` });
  }
  await context.close();
}

for (const motyw of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const url = `${BASE}/?screen=interview-progressbar-153&lang=pl&theme=${motyw}&uwagi=0`;
  const plik = path.join(OUT, `interview-progressbar-153__PO__${motyw}.png`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.addStyleTag({
      content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }',
    });
    await page.screenshot({ path: plik, fullPage: true });
    wyniki.push({ plik, status: 'OK' });
  } catch (e) {
    wyniki.push({ plik, status: `BŁĄD: ${e.message.slice(0, 120)}` });
  }
  await context.close();
}

await browser.close();

console.log(`\nZrzuty -> ${OUT}\n`);
for (const w of wyniki) console.log(`${w.status.padEnd(10)} ${w.plik}`);
const zle = wyniki.filter((w) => w.status !== 'OK').length;
console.log(`\n${wyniki.length - zle}/${wyniki.length} zrzutow wykonanych.`);
if (zle > 0) process.exitCode = 1;
