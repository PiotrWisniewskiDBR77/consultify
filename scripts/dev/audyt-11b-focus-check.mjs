import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
// Focus via keyboard (no mouse move) using .focus() on the textarea
await page.getByPlaceholder(/Zapytaj Teres/i).focus();
await page.waitForTimeout(300);
const visible = await page.locator('[aria-label="Dodaj pliki"]').isVisible();
const box = await page.locator('[aria-label="Dodaj pliki"]').boundingBox();
console.log('visible after keyboard focus (no hover):', visible, box);
try {
  await page.locator('[aria-label="Dodaj pliki"]').click({ timeout: 3000 });
  console.log('click after focus-only: OK');
} catch (e) { console.log('click after focus-only FAILED:', String(e).slice(0,150)); }
await browser.close();
