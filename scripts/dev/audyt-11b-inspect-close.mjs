import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const el = await page.locator('button[aria-label="Zamknij Canvas"]').first();
const html = await el.evaluate(n => n.outerHTML);
fs.writeFileSync(`${OUT_DIR}/zamknij-canvas-outerhtml.txt`, html);
// screenshot at 3x scale
await el.screenshot({ path: `${OUT_DIR}/zamknij-canvas-el.png`, scale: 'device' });
await browser.close();
