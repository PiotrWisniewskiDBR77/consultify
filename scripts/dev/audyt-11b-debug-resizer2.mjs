import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const box1 = await page.locator('[aria-label="Udostępnij dokument Canvas"]').boundingBox();
const box2 = await page.locator('[data-testid="chat-work-panel-edge-resizer"]').boundingBox();
console.log('FRESH LOAD (no mode switch)');
console.log('share btn box', box1);
console.log('resizer box', box2);
const elAtPoint = await page.evaluate(() => {
  const els = document.elementsFromPoint(668, 68);
  return els.slice(0,4).map(e => ({tag:e.tagName, aria: e.getAttribute && e.getAttribute('aria-label'), testid: e.getAttribute && e.getAttribute('data-testid')}));
});
console.log('elementsFromPoint(668,68):', JSON.stringify(elAtPoint));
await browser.close();
