/**
 * Odkrywczy pass: dla below-KPI modułów wypisz kandydatów na pod-zakładki/funkcje
 * (role=tab, top-level buttony w <main>), żeby uzupełnić MANIFEST w capture-screens.mjs.
 * Run: node docs/qa/discover-tabs.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const MODULES = ['Finance', 'Audits', 'Documents', 'Document Studio', 'Presentation Studio', 'Table Studio', 'Meeting'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((ls) => { for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); }, AUTH);
const page = await ctx.newPage();

async function settle(ms = 4000) {
  try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
  await page.waitForTimeout(ms);
}

for (const m of MODULES) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.locator(`nav button[title="${m}"], nav button[aria-label="${m}"]`).first().click({ timeout: 9000 });
    await settle();
    const data = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const tabs = [...main.querySelectorAll('[role="tab"]')].map(e => e.textContent.trim()).filter(Boolean);
      // top-level pill/segment buttons: krótkie etykiety, w górnej części main
      const btns = [...main.querySelectorAll('button')]
        .map(e => ({ t: e.textContent.trim(), y: e.getBoundingClientRect().top }))
        .filter(b => b.t && b.t.length < 30 && b.y < 260)
        .map(b => b.t);
      return { tabs, btns: [...new Set(btns)] };
    });
    console.log(`\n### ${m}`);
    console.log('  role=tab :', JSON.stringify(data.tabs));
    console.log('  top btns :', JSON.stringify(data.btns));
  } catch (e) {
    console.log(`\n### ${m}\n  FAIL :: ${String(e.message).slice(0, 80)}`);
  }
}
await browser.close();
