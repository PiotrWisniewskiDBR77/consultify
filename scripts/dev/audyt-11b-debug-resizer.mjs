import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
for (const tab of ['Dok', 'MD', 'Edytor']) {
  await page.getByText(tab, { exact: true }).first().click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT_DIR}/debug-after-modes.png` });
const box1 = await page.locator('[aria-label="Udostępnij dokument Canvas"]').boundingBox();
const box2 = await page.locator('[data-testid="chat-work-panel-edge-resizer"]').boundingBox();
console.log('share btn box', box1);
console.log('resizer box', box2);
await browser.close();
