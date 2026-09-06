import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test7');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
const data = await page.evaluate(() => {
  function d(el) {
    const r = el.getBoundingClientRect();
    return { ariaLabel: el.getAttribute('aria-label'), title: el.getAttribute('title'), text: (el.textContent||'').trim().slice(0,30), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  }
  return Array.from(document.querySelectorAll('button,[role="button"]')).map(d).filter(b => b.y>=40 && b.y<=95 && b.x<900);
});
fs.writeFileSync(`${OUT_DIR}/final-topbar-dump.json`, JSON.stringify(data,null,2));
console.log(JSON.stringify(data, null, 2));
await page.screenshot({ path: `${OUT_DIR}/25-final-topbar.png`, clip: {x:60,y:40,width:840,height:60} });
await browser.close();
