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

const buttons = await page.$$('button, [role="button"]');
const results = [];
for (let i = 0; i < buttons.length; i++) {
  const el = buttons[i];
  const box = await el.boundingBox();
  if (!box) continue;
  const info = await el.evaluate((node) => ({
    ariaLabel: node.getAttribute('aria-label'),
    title: node.getAttribute('title'),
    text: (node.textContent || '').trim().slice(0, 40),
    disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
    dataActionStatus: node.getAttribute('data-action-status'),
    dataTestId: node.getAttribute('data-testid'),
    outerHTMLHead: node.outerHTML.slice(0, 200),
  }));
  results.push({ idx: i, box, ...info });
}
fs.writeFileSync(`${OUT_DIR}/dump-precise.json`, JSON.stringify(results, null, 2));

// crop each button in the top doc toolbar zone (y 40-90) individually
let n = 0;
for (const r of results) {
  if (r.box.y >= 40 && r.box.y <= 95 && r.box.x < 900) {
    n++;
    const safeName = (r.ariaLabel || r.title || 'unnamed_' + r.idx).replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    await page.screenshot({
      path: `${OUT_DIR}/btn-${String(n).padStart(2,'0')}-${safeName}.png`,
      clip: { x: Math.max(0, r.box.x - 4), y: Math.max(0, r.box.y - 4), width: r.box.width + 8, height: r.box.height + 8 },
    });
  }
}
console.log('done, total buttons:', results.length, 'cropped:', n);
await browser.close();
