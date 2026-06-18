/**
 * Visual QA — admin-tier moduły (Organization/Admin/Internal Tools/Settings/Partner).
 * Capture default + sekcje lewego sub-navu, light+dark. Fresh nav per moduł.
 * Run: node docs/qa/capture-admin.mjs
 * Output: docs/qa/screens/{slug}/{section}-{theme}.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const ROOT = 'docs/qa/screens';
const MODULES = ['Organization', 'Admin Panel', 'Internal Tools', 'Settings', 'Partner Portal'];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((ls) => { for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); }, AUTH);
const page = await ctx.newPage();
const results = [];

async function setTheme(theme) {
  await page.evaluate((t) => {
    try {
      const k = 'consultify-storage';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      if (s.state) { s.state.theme = t; localStorage.setItem(k, JSON.stringify(s)); }
      document.documentElement.classList.toggle('dark', t === 'dark');
    } catch {}
  }, theme);
}
async function settle(ms = 4000) { try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {} await page.waitForTimeout(ms); }

// Sekcje lewego sub-navu (poza railem ikon x<70, w lewej kolumnie x<280, klikalne teksty)
async function listSections() {
  return await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('button, a[href], [role="tab"], [role="menuitem"]')) {
      const r = e.getBoundingClientRect();
      const t = e.textContent.trim();
      if (r.left >= 70 && r.left < 300 && r.width > 0 && t && t.length < 28 && r.top > 120 && r.top < 900) {
        if (!out.includes(t)) out.push(t);
      }
    }
    return out;
  });
}

for (const theme of ['light', 'dark']) {
  for (const m of MODULES) {
    const dir = `${ROOT}/${slug(m)}`;
    fs.mkdirSync(dir, { recursive: true });
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await setTheme(theme);
      await page.waitForTimeout(1800);
      await page.locator(`button[title="${m}"], button[aria-label="${m}"]`).first().click({ timeout: 9000 });
      await settle();
      await setTheme(theme);
      await page.mouse.move(800, 500); await page.waitForTimeout(300);
      await page.screenshot({ path: `${dir}/default-${theme}.png` });
      results.push(`OK   ${dir}/default-${theme}.png`);

      // sekcje (tylko light, by nie dublować — struktura ta sama)
      if (theme === 'light') {
        const sections = await listSections();
        results.push(`     sections[${m}] = ${JSON.stringify(sections)}`);
        for (const sec of sections) {
          const file = `${dir}/${slug(sec)}-${theme}.png`;
          if (fs.existsSync(file)) continue;
          try {
            await page.locator(`button, a[href], [role="tab"], [role="menuitem"]`).filter({ hasText: new RegExp('^' + sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click({ timeout: 4000 });
            await settle(2500);
            await setTheme(theme);
            await page.mouse.move(800, 500); await page.waitForTimeout(300);
            await page.screenshot({ path: file });
            results.push(`OK   ${file}`);
          } catch (e) { results.push(`SKIP ${file} :: ${String(e.message).slice(0, 50)}`); }
        }
      }
    } catch (e) {
      results.push(`FAIL ${dir}/default-${theme}.png :: ${String(e.message).slice(0, 60)}`);
    }
  }
}
await browser.close();
const ok = results.filter((r) => r.startsWith('OK')).length;
console.log(results.join('\n'));
console.log(`\nDONE (${ok} OK)`);
