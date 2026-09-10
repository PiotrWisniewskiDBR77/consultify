/**
 * P6 — przewodnik "Jak zacząć": zrzuty dowodowe (Etap C).
 *
 * Odpala REALNY ekran `<AppIntroView>` przez dev-render harness
 * (`?screen=p6-przewodnik-jak-zaczac`) pod 4 kombinacjami język×motyw i
 * zapisuje pełnostronicowe PNG do `evidence/p6-przewodnik-20260910/`.
 *
 * Wymaga uruchomionego harnessu:
 *   npx vite --config dev-render/vite.config.ts --port 3115 --strictPort
 *
 * Użycie: node scripts/dev/p6-przewodnik-zrzuty.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const base = process.env.P6_BASE_URL || 'http://127.0.0.1:3115';
const outputDir = path.resolve('evidence/p6-przewodnik-20260910');
fs.mkdirSync(outputDir, { recursive: true });

const combos = [
  { lang: 'pl', theme: 'light', file: '01-pl-light.png' },
  { lang: 'pl', theme: 'dark', file: '02-pl-dark.png' },
  { lang: 'en', theme: 'light', file: '03-en-light.png' },
  { lang: 'en', theme: 'dark', file: '04-en-dark.png' },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  for (const c of combos) {
    const url = `${base}/?screen=p6-przewodnik-jak-zaczac&lang=${c.lang}&theme=${c.theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const outPath = path.join(outputDir, c.file);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('saved', outPath);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
