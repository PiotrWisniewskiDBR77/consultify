/**
 * Fala J1 — zrzuty kwestionariusza DRD (jednostka "Sales Processes", pytanie +
 * "Why do we ask" + poziomy) w EN light, EN dark, PL light.
 * Wymaga: npx vite --config dev-render/vite.config.ts --port 3020
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.env.HOME + '/Developer/cto-codex/zrzuty-j1-drd-en-20260914';
fs.mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3020';
const browser = await chromium.launch();

const warianty = [
  { name: 'en-light', lang: 'en', theme: 'light' },
  { name: 'en-dark', lang: 'en', theme: 'dark' },
  { name: 'pl-light', lang: 'pl', theme: 'light' },
];

for (const w of warianty) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const url = `${base}/?screen=drd-http-workspace&lang=${w.lang}&theme=${w.theme}&stage=inprogress&view=interview`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const path = `${OUT}/drd-kwestionariusz-${w.name}.png`;
  await page.screenshot({ path, fullPage: false });
  const txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  fs.writeFileSync(`${OUT}/drd-kwestionariusz-${w.name}.txt`, txt);
  // Bezpiecznik jasności (memory: „duplikat zamiast motywu"): light musi być jasny.
  const luma = await page.evaluate(() => {
    const c = getComputedStyle(document.body).backgroundColor;
    return c;
  });
  console.log(`${w.name}: ${path} | bg=${luma} | dark-class=${await page.evaluate(() => document.documentElement.classList.contains('dark'))} | len=${txt.length}`);
  await page.close();
}
await browser.close();
