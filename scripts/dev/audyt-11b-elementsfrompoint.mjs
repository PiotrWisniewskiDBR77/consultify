import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const els = document.elementsFromPoint(733, 68);
  return els.map(e => ({
    tag: e.tagName,
    cls: typeof e.className === 'string' ? e.className.slice(0,120) : '',
    id: e.id,
    ariaLabel: e.getAttribute && e.getAttribute('aria-label'),
  }));
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
