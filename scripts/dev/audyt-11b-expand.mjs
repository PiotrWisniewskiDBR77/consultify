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
await composer.fill('test');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
// click "more actions" toggle on AI response
await page.locator('[aria-label="More actions"], [aria-label="Więcej akcji"]').first().click().catch(async () => {
  await page.locator('[title="More actions"]').first().click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/11-ai-actions-expanded.png`, fullPage: false });
// hover user message to reveal its action bar
await page.locator('text=test').first().hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT_DIR}/12-user-msg-hover.png`, fullPage: false });
// dump buttons now
const data = await page.evaluate(() => {
  function describe(el) {
    const rect = el.getBoundingClientRect();
    return {
      ariaLabel: el.getAttribute('aria-label'), title: el.getAttribute('title'),
      text: (el.textContent||'').trim().slice(0,30), disabled: el.disabled===true||el.getAttribute('aria-disabled')==='true',
      x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height),
    };
  }
  return Array.from(document.querySelectorAll('button,[role="button"]')).map(describe);
});
fs.writeFileSync(`${OUT_DIR}/dump-after-send.json`, JSON.stringify(data, null, 2));
await browser.close();
