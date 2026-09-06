import { chromium } from 'playwright';
import fs from 'node:fs';
const auth = process.env.ODBIOR_AUTH_STATE;
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
const originy = sesja.origins || [];
const zrodlo = originy.find((o) => o.origin === 'http://localhost:3000') || originy[0];
if (zrodlo) { sesja.origins = [...originy.filter((o) => o.origin !== 'http://localhost:3090'), { ...zrodlo, origin: 'http://localhost:3090' }]; }
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3090/meetings', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'evidence/audyt-mvp-20260906/B2/_debug1.png' });
console.log('url:', page.url());
const btns = await page.locator('button').allInnerTexts();
console.log('buttons:', JSON.stringify(btns.slice(0,30)));
await browser.close();
