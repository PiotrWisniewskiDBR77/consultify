import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const netLog = [];
page.on('requestfinished', async (req) => {
  if (req.url().includes('/api/') && ['POST','PUT','PATCH'].includes(req.method())) netLog.push(req.url());
});
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test5');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);
try {
  await page.locator('[data-testid="message-action-regenerate"]').first().click({ timeout: 8000 });
  console.log('regen click OK');
} catch (e) {
  console.log('regen click FAILED:', String(e).slice(0,500));
}
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT_DIR}/16-after-regen.png` });
console.log(JSON.stringify(netLog));
await browser.close();
