import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const results = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const netReqs = [];
page.on('request', (req) => { if (req.url().includes('/api/')) netReqs.push({url: req.url(), method: req.method()}); });

await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);

// expand
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);

async function clickAndCapture(label, name, waitMs=800) {
  netReqs.length = 0;
  const beforeHtml = await page.locator('body').innerHTML();
  try {
    await page.locator(`[aria-label="${label}"]`).first().click({ timeout: 4000 });
  } catch (e) {
    results[name] = { error: 'click failed: ' + e.message };
    return;
  }
  await page.waitForTimeout(waitMs);
  const afterHtml = await page.locator('body').innerHTML();
  await page.screenshot({ path: `${OUT_DIR}/click-${name}.png`, fullPage: false });
  results[name] = {
    domChanged: beforeHtml !== afterHtml,
    apiCalls: [...netReqs],
  };
}

await clickAndCapture('Pomocne', '01-pomocne');
// reset by reloading? no, thumbs might lock in "detailed feedback" - screenshot shows it
await page.screenshot({ path: `${OUT_DIR}/13-after-pomocne.png`, fullPage: false });

await browser.close();
fs.writeFileSync(`${OUT_DIR}/click-results-ai1.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
