import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5410';
const URL = `${BASE}/?screen=assessment-list&lang=pl&theme=light&uwagi=0`;
const CHIP_MARKER = 'AI Triage';

const browser = await chromium.launch();

async function testIndex(i) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  const wiersz = page.locator('table[data-min-table-width] tbody tr').first();
  if ((await wiersz.count()) > 0) {
    await wiersz.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const kontrolki = page.locator('[aria-expanded="false"]');
  const kontrolka = kontrolki.nth(i);
  const label = await kontrolka.getAttribute('aria-label').catch(() => null);
  let clickOk = true;
  await kontrolka.click({ timeout: 3000 }).catch(() => { clickOk = false; });
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(2, 2).catch(() => {});
  await page.waitForTimeout(200);
  const tekst = await page.evaluate(() => document.body.innerText);
  const ma = tekst.includes(CHIP_MARKER);
  console.log(`i=${i} label="${label}" clickOk=${clickOk} -> chip obecny: ${ma}`);
  await context.close();
}

for (let i = 0; i < 10; i++) {
  await testIndex(i);
}
await browser.close();
