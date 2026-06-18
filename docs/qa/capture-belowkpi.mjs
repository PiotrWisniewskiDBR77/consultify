/**
 * Visual QA — dograj pod-zakładki below-KPI modułów (1 screen / funkcja, light+dark).
 * Above-KPI + Audits/Document Studio (1-fn) już zarchiwizowane — nie ruszamy.
 * Run: node docs/qa/capture-belowkpi.mjs
 * Output: docs/qa/screens/{module}/{tab}-{theme}.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const ROOT = 'docs/qa/screens';

const MANIFEST = [
  { m: 'Finance', tabs: ['Statements', 'Models', 'Analysis', 'Prediction', 'Enterprise valuation', 'Analiza inwestycyjna'] },
  { m: 'Documents', tabs: ['Documents', 'Presentations', 'Sheets', 'Template Library'] },
  { m: 'Presentation Studio', tabs: ['Start new', 'Templates', 'Recent', 'Saved'] },
  { m: 'Table Studio', tabs: ['Start new', 'Templates', 'Recent', 'Saved'] },
  { m: 'Meeting', tabs: ['Meetings', 'Operator brief'] },
];

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
async function settle(ms = 4500) {
  try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
  await page.waitForTimeout(ms);
}
async function clickModule(name) {
  await page.locator(`nav button[title="${name}"], nav button[aria-label="${name}"]`).first().click({ timeout: 9000 });
}
async function clickTab(label) {
  const main = page.locator('main');
  const tries = [
    main.getByRole('tab', { name: label, exact: true }),
    main.getByRole('button', { name: label, exact: true }),
    main.getByRole('button', { name: label }),
  ];
  for (const loc of tries) {
    if (await loc.first().count().catch(() => 0)) { await loc.first().click({ timeout: 5000 }); return; }
  }
  throw new Error('tab not found: ' + label);
}

for (const theme of ['light', 'dark']) {
  for (const { m, tabs } of MANIFEST) {
    const dir = `${ROOT}/${slug(m)}`;
    fs.mkdirSync(dir, { recursive: true });
    let onModule = false;
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const file = `${dir}/${slug(tab)}-${theme}.png`;
      try {
        if (!onModule) {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          await setTheme(theme);
          await page.waitForTimeout(1500);
          await clickModule(m);
          onModule = true;
          await settle();
        }
        if (i > 0) { await clickTab(tab); await settle(3500); }
        await setTheme(theme);
        await page.mouse.move(800, 500);
        await page.waitForTimeout(300);
        await page.screenshot({ path: file, fullPage: false });
        results.push(`OK   ${file}`);
      } catch (e) {
        results.push(`FAIL ${file} :: ${String(e.message).slice(0, 70)}`);
        try { await page.screenshot({ path: file.replace('.png', '-ERR.png') }); } catch {}
        onModule = false;
      }
    }
  }
}

await browser.close();
const ok = results.filter((r) => r.startsWith('OK')).length;
console.log(results.join('\n'));
console.log(`\nDONE → ${ROOT} (${ok}/${results.length})`);
