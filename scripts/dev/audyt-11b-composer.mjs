import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

await page.locator('[aria-label="Dodaj pliki"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/30-dodaj-pliki.png`, clip: {x:670,y:600,width:400,height:260} });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.locator('[aria-label="Narzędzia AI"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/31-narzedzia-ai.png`, clip: {x:670,y:550,width:500,height:310} });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.locator('[aria-label="Współmyśliciel"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/32-wspolmysliciel.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.locator('[aria-label="Objaśnienie trybów głosowych"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/33-objasnienie-glosowe.png`, clip: {x:1000,y:600,width:440,height:280} });
await page.keyboard.press('Escape');

await browser.close();
