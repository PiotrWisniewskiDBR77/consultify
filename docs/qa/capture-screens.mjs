/**
 * Visual QA — archiwizujący capture wszystkich screenów (light + dark).
 * Przejmuje sesję z żywego dev (storageState z /tmp/consultify-auth.json — NIE commitować).
 * Nawigacja przez rail-click po `title` (moduły nie są adresowalne URL-em).
 *
 * Run: node docs/qa/capture-screens.mjs
 * Output: docs/qa/screens/{module}-{theme}.png
 *
 * Scope: sidebar do poziomu KPI (decyzja Piotra). Reszta nie gotowa.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const OUT = 'docs/qa/screens';
const MODULES = ['Chat', 'My Work', 'Interview', 'Tools', 'Initiatives', 'Execution', 'Results'];

fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
// inject auth localStorage before any app script runs
await ctx.addInitScript((ls) => {
  for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]);
}, AUTH);

const page = await ctx.newPage();
const results = [];

async function setTheme(theme) {
  await page.evaluate((t) => {
    try {
      const k = 'consultify-storage';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      if (s.state) { s.state.theme = t; localStorage.setItem(k, JSON.stringify(s)); }
      document.documentElement.classList.toggle('dark', t === 'dark');
    } catch (e) {}
  }, theme);
}

async function clickModule(name) {
  // rail button identified by title / aria-label (icon-only collapsed rail)
  const loc = page.locator(`nav button[title="${name}"], nav button[aria-label="${name}"]`).first();
  await loc.click({ timeout: 9000 });
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500); // initial app boot

for (const theme of ['light', 'dark']) {
  await setTheme(theme);
  await page.waitForTimeout(400);
  for (const m of MODULES) {
    const file = `${OUT}/${slug(m)}-${theme}.png`;
    try {
      await clickModule(m);
      try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
      await page.waitForTimeout(4500); // data load + render (env ma flaky backend)
      await setTheme(theme); // re-assert (some views re-init theme)
      await page.mouse.move(800, 500); // odsuń kursor (znika tooltip railu)
      await page.waitForTimeout(300);
      await page.screenshot({ path: file, fullPage: false });
      results.push(`OK   ${file}`);
    } catch (e) {
      results.push(`FAIL ${file} :: ${String(e.message).slice(0, 80)}`);
      try { await page.screenshot({ path: file.replace('.png', '-ERR.png') }); } catch {}
    }
  }
}

await browser.close();
console.log(results.join('\n'));
console.log(`\nDONE → ${OUT} (${results.filter(r => r.startsWith('OK')).length}/${results.length})`);
