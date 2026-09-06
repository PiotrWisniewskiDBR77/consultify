import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const coords = [
  [609,53,'copy'],[645,53,'share'],[681,53,'save'],[717,53,'zamknijcanvas'],[770,53,'menucanvas']
];
for (const [x,y,name] of coords) {
  await page.screenshot({ path: `${OUT_DIR}/icon-${name}.png`, clip: { x: x-6, y: y-6, width: 44, height: 44 } });
}
await browser.close();
