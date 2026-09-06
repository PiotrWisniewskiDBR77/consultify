import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Dodaj pliki"]');
  const rect = btn.getBoundingClientRect();
  const topEl = document.elementFromPoint(rect.x+rect.width/2, rect.y+rect.height/2);
  const path = [];
  let el = btn;
  while (el) {
    const cs = getComputedStyle(el);
    path.push({ tag: el.tagName, cls: el.className, z: cs.zIndex, pos: cs.position, pe: cs.pointerEvents, overflow: cs.overflow });
    el = el.parentElement;
    if (path.length > 6) break;
  }
  return { topElTag: topEl.tagName, topElClass: topEl.className, path, btnRect: rect.toJSON ? rect.toJSON() : {x:rect.x,y:rect.y,w:rect.width,h:rect.height} };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
