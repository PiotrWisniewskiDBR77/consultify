import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.locator('button[aria-label="Zamknij Canvas"]').first().evaluate(n => {
  n.style.outline = '3px solid red';
  n.style.background = 'rgba(0,255,0,0.4)';
});
await page.screenshot({ path: `${OUT_DIR}/highlight-area.png`, clip: { x: 580, y: 30, width: 250, height: 60 } });
await browser.close();
