import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const count = await page.locator('button[aria-label="Zamknij Canvas"]').count();
console.log('count:', count);
for (let i = 0; i < count; i++) {
  const html = await page.locator('button[aria-label="Zamknij Canvas"]').nth(i).evaluate(n => n.outerHTML);
  console.log('---', i, '---');
  console.log(html);
  const box = await page.locator('button[aria-label="Zamknij Canvas"]').nth(i).boundingBox();
  console.log('box', box);
}
await browser.close();
