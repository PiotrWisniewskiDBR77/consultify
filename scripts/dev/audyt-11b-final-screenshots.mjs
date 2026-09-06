import { chromium } from 'playwright';
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
await composer.fill('finalny test PO');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);

// Strefa 1: pasek dokumentu
await page.screenshot({ path: `${OUT_DIR}/PO-strefa1-pasek-dokumentu.png`, clip: { x: 60, y: 40, width: 900, height: 60 } });
// Strefa 2: pasek formatowania
await page.screenshot({ path: `${OUT_DIR}/PO-strefa2-pasek-formatowania.png`, clip: { x: 60, y: 95, width: 620, height: 55 } });
// Strefa 3a+3b: akcje wiadomości (Teresa expanded + user hover)
await page.getByText('finalny test PO').first().hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT_DIR}/PO-strefa3-akcje-wiadomosci.png`, clip: { x: 670, y: 150, width: 770, height: 350 } });
// Strefa 4: kompozytor (hover to reveal)
await composer.hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT_DIR}/PO-strefa4-kompozytor.png`, clip: { x: 670, y: 750, width: 770, height: 150 } });

await browser.close();
console.log('done');
