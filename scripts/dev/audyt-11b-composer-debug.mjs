import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const box = await page.locator('[aria-label="Dodaj pliki"]').boundingBox();
console.log('box', box);
const cx = box.x + box.width/2, cy = box.y + box.height/2;
const els = await page.evaluate(([x,y]) => {
  return document.elementsFromPoint(x,y).slice(0,6).map(e => ({
    tag: e.tagName, cls: (typeof e.className==='string'?e.className:'').slice(0,100),
    testid: e.getAttribute && e.getAttribute('data-testid'), aria: e.getAttribute && e.getAttribute('aria-label'),
    pe: getComputedStyle(e).pointerEvents, z: getComputedStyle(e).zIndex, pos: getComputedStyle(e).position,
  }));
}, [cx, cy]);
console.log(JSON.stringify(els, null, 2));
await browser.close();
