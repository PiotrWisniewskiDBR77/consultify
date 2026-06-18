/** Odkryj pod-zakładki modułów admin-tier (Organization/Admin/Internal/Settings/Partner). */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const MODULES = ['Organization', 'Admin Panel', 'Internal Tools', 'Settings', 'Partner Portal'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((ls) => { for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); }, AUTH);
const page = await ctx.newPage();
async function settle(ms = 4000) { try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {} await page.waitForTimeout(ms); }
for (const m of MODULES) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.locator(`button[title="${m}"], button[aria-label="${m}"]`).first().click({ timeout: 9000 });
    await settle();
    const data = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const tabs = [...main.querySelectorAll('[role="tab"]')].map(e => e.textContent.trim()).filter(Boolean);
      const btns = [...main.querySelectorAll('button')]
        .map(e => ({ t: e.textContent.trim(), y: e.getBoundingClientRect().top }))
        .filter(b => b.t && b.t.length < 32 && b.y < 320).map(b => b.t);
      const h = (document.querySelector('main h1, main h2')?.textContent || '').trim().slice(0, 50);
      return { url: location.pathname, h, tabs, btns: [...new Set(btns)] };
    });
    console.log(`\n### ${m}  (url=${data.url})  H="${data.h}"`);
    console.log('  role=tab :', JSON.stringify(data.tabs));
    console.log('  top btns :', JSON.stringify(data.btns));
  } catch (e) {
    console.log(`\n### ${m}\n  FAIL :: ${String(e.message).slice(0, 90)}`);
  }
}
await browser.close();
