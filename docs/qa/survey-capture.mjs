/**
 * Survey capture 2026-06-19 — headed Playwright, ręczny login raz, potem auto-capture.
 * Persistent profile w /tmp/chrome-survey-profile (login przeżywa kolejne uruchomienia).
 * Output: docs/qa/screens/survey-2026-06-19/{module}/{tab}-{theme}.png  (+ -detail dla encji)
 * Run: node docs/qa/survey-capture.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const ROOT = 'docs/qa/screens/survey-2026-06-19';
const PROFILE = '/tmp/chrome-survey-profile';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const log = (...a) => console.log('[survey]', ...a);

// Rail modules (title=) → pod-zakładki w <main> (puste = tylko default). Drill = próbuj otworzyć 1. wiersz.
const MANIFEST = [
  { m: 'Chat', tabs: [], drill: false },
  { m: 'My Work', tabs: ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Manager'], drill: true },
  { m: 'Interview', tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'], drill: true },
  { m: 'Tools', tabs: ['Library', 'Sessions', 'Reports & Presentations', 'Initiatives'], drill: true },
  { m: 'Initiatives', tabs: ['Portfolio', 'Analysis'], drill: true },
  { m: 'Execution', tabs: [], drill: false },
  { m: 'Results', tabs: ['Initiatives', 'KPI', 'KPI Reports', 'ROI', 'ROI Analysis'], drill: true },
  { m: 'Finance', tabs: [], drill: true },
  { m: 'Audits', tabs: [], drill: true },
  { m: 'Documents', tabs: [], drill: true },
  { m: 'Document Studio', tabs: [], drill: false },
  { m: 'Presentation Studio', tabs: [], drill: true },
  { m: 'Table Studio', tabs: [], drill: true },
  { m: 'Meeting', tabs: [], drill: true },
  { m: 'Organization', tabs: [], drill: false },
  { m: 'Admin Panel', tabs: [], drill: false },
  { m: 'Internal Tools', tabs: [], drill: false },
  { m: 'Settings', tabs: [], drill: false },
  { m: 'Partner Portal', tabs: [], drill: false },
];

fs.mkdirSync(ROOT, { recursive: true });
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1600, height: 1000 },
  args: ['--window-size=1620,1040'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const results = [];

async function settle(ms = 3500) {
  try { await page.waitForLoadState('networkidle', { timeout: 7000 }); } catch {}
  await page.waitForTimeout(ms);
}
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
async function isAuthed() {
  try {
    const rail = await page.locator('nav button[title="Chat"]').count().catch(() => 0);
    if (rail > 0) return true;
    const pw = await page.locator('input[type="password"]').count().catch(() => 0);
    const navBtns = await page.locator('nav button').count().catch(() => 0);
    return pw === 0 && navBtns > 3;
  } catch { return false; }
}
async function pageBroken() {
  const t = (await page.title().catch(() => '')) || '';
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  return /can.t be reached|ERR_CONNECTION|refused to connect/i.test(t + body);
}
async function clickModule(name) {
  await page.locator(`nav button[title="${name}"], nav button[aria-label="${name}"]`).first().click({ timeout: 9000 });
}
async function clickTab(label) {
  const main = page.locator('main');
  for (const loc of [
    main.getByRole('button', { name: label, exact: true }),
    main.getByRole('tab', { name: label, exact: true }),
    main.getByRole('button', { name: label }),
  ]) {
    if (await loc.first().count().catch(() => 0)) { await loc.first().click({ timeout: 5000 }); return true; }
  }
  return false;
}
async function shot(file) {
  fs.mkdirSync(file.substring(0, file.lastIndexOf('/')), { recursive: true });
  await page.screenshot({ path: file });
  results.push(file);
  log('saved', file);
}
async function tryDrill(dir, base, theme) {
  // otwórz pierwszy wiersz tabeli → preview/detail
  const rowSel = 'main table tbody tr, main [role="row"]:not(:first-child), main .cursor-pointer';
  const row = page.locator(rowSel).first();
  if (await row.count().catch(() => 0)) {
    try {
      await row.click({ timeout: 4000 });
      await page.waitForTimeout(2500);
      await shot(`${dir}/${base}-detail-${theme}.png`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(600);
    } catch (e) { log('drill skip', base, e.message); }
  }
}

// ---- WAIT FOR LOGIN ----
await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
let authed = await isAuthed();
if (authed) {
  log('=== profil już zalogowany — startuję od razu ===');
} else {
  log('>>> ZALOGUJ SIĘ w otwartym oknie (http://localhost:3000). Czekam do 15 min...');
  for (let i = 0; i < 300; i++) {           // 300 × 3s = 15 min
    await page.waitForTimeout(3000);
    if (await isAuthed()) { authed = true; break; }
    if (await pageBroken()) { log('   (strona niedostępna — reload)'); await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {}); }
    if (i % 10 === 9) log(`   ...czekam (${(i + 1) * 3}s)`);
  }
}
if (!authed) { log('!!! brak logowania w czasie — przerwane'); await ctx.close(); process.exit(1); }
log('=== zalogowano, zapisuję sesję i startuję capture ===');
await ctx.storageState({ path: '/tmp/consultify-pw-state.json' }).catch(() => {});

for (const theme of ['light', 'dark']) {
  for (const { m, tabs, drill } of MANIFEST) {
    const dir = `${ROOT}/${slug(m)}`;
    const list = tabs.length ? tabs : ['default'];
    let onModule = false;
    for (const tab of list) {
      try {
        if (!onModule) {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          await setTheme(theme);
          await page.waitForTimeout(1200);
          await clickModule(m);
          onModule = true;
          await settle();
        }
        if (tab !== 'default') { const ok = await clickTab(tab); if (ok) await settle(2500); }
        await shot(`${dir}/${slug(tab)}-${theme}.png`);
        if (drill) await tryDrill(dir, slug(tab), theme);
      } catch (e) { log('FAIL', m, tab, theme, e.message); }
    }
  }
}

log(`=== DONE: ${results.length} screenów ===`);
fs.writeFileSync(`${ROOT}/_manifest.json`, JSON.stringify(results, null, 2));
await ctx.close();
