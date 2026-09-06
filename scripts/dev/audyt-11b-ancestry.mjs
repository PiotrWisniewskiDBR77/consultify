import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('testanc');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
const info = await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Menu Canvas"]');
  const path = [];
  let el = btn;
  while (el && path.length < 8) {
    path.push({ tag: el.tagName, testid: el.getAttribute && el.getAttribute('data-testid'), cls: (typeof el.className==='string'?el.className:'').slice(0,80) });
    el = el.parentElement;
  }
  return path;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
