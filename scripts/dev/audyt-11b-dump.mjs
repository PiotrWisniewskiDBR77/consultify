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

const data = await page.evaluate(() => {
  function describe(el) {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim().slice(0, 40),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      classes: el.className && typeof el.className === 'string' ? el.className.slice(0, 160) : '',
      x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height),
      dataTestId: el.getAttribute('data-testid'),
    };
  }
  const all = Array.from(document.querySelectorAll('button, [role="button"]'));
  return all.map((el, i) => ({ idx: i, ...describe(el) }));
});
fs.writeFileSync(`${OUT_DIR}/dump-buttons.json`, JSON.stringify(data, null, 2));
console.log('total buttons found:', data.length);
await browser.close();
