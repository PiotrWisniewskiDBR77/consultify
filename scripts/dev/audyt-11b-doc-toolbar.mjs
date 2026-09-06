import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const results = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const netLog = [];
page.on('requestfinished', async (req) => {
  if (req.url().includes('/api/') && ['POST','PUT','PATCH'].includes(req.method())) netLog.push(req.url());
});
function drain() { const c=[...netLog]; netLog.length=0; return c; }

await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// Mode tabs
for (const tab of ['Dok', 'MD', 'Edytor']) {
  await page.getByText(tab, { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/mode-${tab}.png`, clip: { x: 60, y: 45, width: 620, height: 500 } });
}

// Kopiuj Markdown
drain();
await page.locator('[aria-label="Kopiuj Markdown"]').click();
await page.waitForTimeout(500);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'ERR'));
results['kopiuj-markdown'] = { clipboardPreview: String(clip).slice(0, 80), apiCalls: drain() };

// Zapisz dokument Canvas
await page.locator('[aria-label="Zapisz dokument Canvas"]').click();
await page.waitForTimeout(800);
results['zapisz-dokument'] = { apiCalls: drain() };

// Udostępnij
await page.locator('[aria-label="Udostępnij dokument Canvas"]').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT_DIR}/20-udostepnij.png` });
results['udostepnij'] = { apiCalls: drain() };

// Nowy Canvas (+) -> open menu, screenshot, escape
await page.locator('[aria-label="Nowy Canvas"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/21-nowy-canvas-menu.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Menu Canvas (...) -> open, screenshot, escape
await page.locator('[aria-label="Menu Canvas"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/22-menu-canvas.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Zapisz jako notatkę (canvas toolbar)
await page.locator('[aria-label="Zapisz jako notatkę"]').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/23-canvas-save-note.png` });
results['canvas-zapisz-notatke'] = { apiCalls: drain() };

fs.writeFileSync(`${OUT_DIR}/click-results-doctoolbar.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
