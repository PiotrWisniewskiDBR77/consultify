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
await composer.fill('test3');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);

for (const label of ['Kontynuuj', 'Wygeneruj ponownie']) {
  const el = page.locator(`[aria-label="${label}"]`).first();
  const info = await el.evaluate(n => ({ disabled: n.disabled, outerHTML: n.outerHTML.slice(0,300) }));
  console.log(label, JSON.stringify(info));
}
await page.screenshot({ path: `${OUT_DIR}/14-continue-check.png` });
await browser.close();
