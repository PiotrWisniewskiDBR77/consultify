import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// hover composer first (realistic user behavior), THEN click
await page.getByPlaceholder(/Zapytaj Teres/i).hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT_DIR}/34-composer-on-hover.png`, clip: {x:670,y:750,width:770,height:150} });

await page.locator('[aria-label="Dodaj pliki"]').click({ timeout: 4000 });
console.log('Dodaj pliki: OK (with hover)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/35-dodaj-pliki-menu.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.getByPlaceholder(/Zapytaj Teres/i).hover();
await page.locator('[aria-label="Narzędzia AI"]').click({ timeout: 4000 });
console.log('Narzędzia AI: OK (with hover)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT_DIR}/36-narzedzia-ai-menu.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.getByPlaceholder(/Zapytaj Teres/i).hover();
await page.locator('[aria-label="Współmyśliciel"]').click({ timeout: 4000 });
console.log('Współmyśliciel: OK (with hover)');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/37-wspolmysliciel.png` });

await browser.close();
