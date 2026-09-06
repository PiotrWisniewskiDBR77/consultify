import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const netLog = [];
page.on('requestfinished', async (req) => {
  if (req.url().includes('/api/') && ['POST','PUT','PATCH'].includes(req.method())) {
    netLog.push({ url: req.url(), method: req.method() });
  }
});
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test4');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);
try {
  await page.locator('[data-testid="message-action-continue"]').first().click({ timeout: 8000, force: false });
  console.log('continue click OK');
} catch (e) {
  console.log('continue click FAILED:', String(e).slice(0,500));
}
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT_DIR}/15-after-continue.png` });
console.log('net after continue', JSON.stringify(netLog));
await browser.close();
