import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3124';
const outDir = path.resolve('evidence/p13-eksport-jezyk-20260910/puste-stany');
fs.mkdirSync(outDir, { recursive: true });
const label = process.argv[2];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/?screen=day267-materialy-hub-zrzuty&state=empty&lang=pl&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByText('Arkusze', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `arkusze-${label}.png`), fullPage: true });
  const text = await page.locator('body').innerText().catch(() => '(brak)');
  fs.writeFileSync(path.join(outDir, `arkusze-${label}.txt`), text);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
