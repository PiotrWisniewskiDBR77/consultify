import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const input = page.locator('textarea, [contenteditable="true"]').filter({ hasText: '' }).first();
// use the composer input specifically by placeholder
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test');
await page.locator('[data-testid="chat-send-btn"]').first().click();
console.log('sent, waiting for response...');
await page.waitForTimeout(15000);
await page.screenshot({ path: `${OUT_DIR}/10-after-send.png`, fullPage: false });
fs.writeFileSync(`${OUT_DIR}/console-errors-sendmsg.json`, JSON.stringify(consoleErrors, null, 2));
console.log('console errors count:', consoleErrors.length);
await browser.close();
