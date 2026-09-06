import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);
const box = await page.locator('[aria-label="Dodaj pliki"]').boundingBox();
console.log('box after 4s', box);
try {
  await page.locator('[aria-label="Dodaj pliki"]').click({ timeout: 4000 });
  console.log('click OK (no force)');
} catch (e) {
  console.log('click FAILED after 4s wait:', String(e).slice(0,200));
}
await browser.close();
