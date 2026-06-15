/**
 * Visual QA — PEŁNE archiwum wszystkich screenów (light + dark, bez odstępstw).
 * Wszystkie moduły railu × wszystkie pod-zakładki × 2 motywy.
 * Przejmuje sesję z /tmp/consultify-auth.json (NIE commitować — token tylko w /tmp).
 *
 * Run: node docs/qa/capture-screens.mjs
 * Output: docs/qa/screens/{module}/{tab}-{theme}.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const BASE = 'http://localhost:3000';
const ROOT = 'docs/qa/screens';

// Manifest: moduł railu (title) → pod-zakładki (puste = tylko widok domyślny)
const MANIFEST = [
  { m: 'Chat', tabs: [] },
  { m: 'My Work', tabs: ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Manager'] },
  { m: 'Interview', tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'] },
  { m: 'Tools', tabs: ['Library', 'Sessions', 'Reports & Presentations', 'Initiatives'] },
  { m: 'Initiatives', tabs: ['Portfolio', 'Analysis'] },
  { m: 'Execution', tabs: ['Summary', 'Rollout', 'Reporting', 'Management'] },
  { m: 'Results', tabs: ['Initiatives', 'KPI', 'KPI Reports', 'ROI', 'ROI Analysis'] },
  { m: 'Finance', tabs: [] },
  { m: 'Audits', tabs: [] },
  { m: 'Documents', tabs: [] },
  { m: 'Document Studio', tabs: [] },
  { m: 'Presentation Studio', tabs: [] },
  { m: 'Table Studio', tabs: [] },
  { m: 'Meeting', tabs: [] },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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
  // pod-zakładki żyją w <main>, NIE w railu — scope do main
  const main = page.locator('main');
  const tries = [
    main.getByRole('button', { name: label, exact: true }),
    main.getByRole('tab', { name: label, exact: true }),
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
    const list = tabs.length ? tabs : ['default'];
    let onModule = false;
    for (const tab of list) {
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
        if (tab !== 'default') { await clickTab(tab); await settle(3500); }
        await setTheme(theme);
        await page.mouse.move(800, 500);
        await page.waitForTimeout(300);
        await page.screenshot({ path: file, fullPage: false });
        results.push(`OK   ${file}`);
      } catch (e) {
        results.push(`FAIL ${file} :: ${String(e.message).slice(0, 70)}`);
        try { await page.screenshot({ path: file.replace('.png', '-ERR.png') }); } catch {}
        onModule = false; // wymuś re-nav po błędzie
      }
    }
  }
}

await browser.close();
const ok = results.filter((r) => r.startsWith('OK')).length;
console.log(results.join('\n'));
console.log(`\nDONE → ${ROOT} (${ok}/${results.length})`);
