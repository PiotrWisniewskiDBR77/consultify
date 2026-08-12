// RN-G6 testdrive smoke — verifies the 9 checkpoints from the mission brief
// on the REAL app (real backend :3097, real Postgres :55821, real frontend
// :3197), fresh sessions, NO correlationId workaround (that is the point:
// proving the P0-D fix at 177104d409 works for a real user, not just with a
// pre-seeded sessionStorage escape hatch like the earlier golden-flow script
// used before the fix landed).
//
// Not a test suite — a scripted walkthrough that saves one screenshot per
// checkpoint + console/network evidence to docs/qa/screens/rn-g6-testdrive/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-testdrive');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const CONTRIBUTOR_EMAIL = 'rn-g6-user-a-contributor@consultify.local';
const KPI_FLAG = 'ff_resultsVNextKpi=1';
const ROI_FLAG = 'ff_resultsVNextRoi=1';
const OKR_FLAG = 'ff_resultsVNextOkr=1';

const report = { checkpoints: [], ids: {} };

function record(entry) {
  report.checkpoints.push(entry);
  console.log(`\n=== CHECKPOINT ${entry.n}: ${entry.title} ===`);
  console.log(`screenshot: ${entry.screenshot}`);
  console.log(`console errors: ${entry.consoleErrors.length}`, entry.consoleErrors.slice(0, 5));
  console.log(`api >=400: ${entry.apiErrors.length}`, entry.apiErrors);
  if (entry.notes) console.log('notes:', entry.notes);
}

async function newActorContext(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page._consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') page._consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => page._consoleErrors.push('PAGEERROR: ' + err.message));

  if (email) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
    await page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button:has-text("Log in")').first().click();
    await page.waitForTimeout(2000);
    let loggedIn = !page.url().includes('/login');
    if (!loggedIn) {
      await page.waitForTimeout(2000);
      loggedIn = !page.url().includes('/login');
    }
    if (!loggedIn) throw new Error(`LOGIN FAILED for ${email}`);
  }
  return { context, page };
}

function attachNetTracking(page) {
  const calls = [];
  const listener = (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/')) calls.push({ url, status: resp.status() });
    } catch {}
  };
  page.on('response', listener);
  return { calls, stop: () => page.off('response', listener) };
}

async function shot(page, name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return `docs/qa/screens/rn-g6-testdrive/${name}.png`;
}

async function checkpoint(n, title, page, fn) {
  const net = attachNetTracking(page);
  page._consoleErrors.length = 0;
  let notes = '';
  let screenshotName = `${String(n).padStart(2, '0')}-checkpoint`;
  try {
    const result = await fn();
    if (result) {
      if (result.notes) notes = result.notes;
      if (result.name) screenshotName = result.name;
    }
  } catch (err) {
    notes = `EXCEPTION: ${err && err.message ? err.message : String(err)}`;
    console.error(`Checkpoint ${n} exception:`, err);
  }
  await page.waitForTimeout(500);
  const screenshot = await shot(page, screenshotName);
  net.stop();
  const entry = {
    n,
    title,
    screenshot,
    consoleErrors: [...page._consoleErrors],
    apiErrors: net.calls.filter((c) => c.status >= 400),
    apiCalls: net.calls,
    notes,
  };
  record(entry);
  return entry;
}

const main = async () => {
  const browser = await chromium.launch();

  // ============ CHECKPOINT 1a — restricted role bounced ============
  const contribCtx = await newActorContext(browser, CONTRIBUTOR_EMAIL);
  const contrib = contribCtx.page;
  await checkpoint(1.1, 'Logowanie rola BEZ dostepu (contributor/MEMBER) - oczekiwany odbicie na /interview', contrib, async () => {
    await contrib.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await contrib.waitForTimeout(2500);
    return { name: '01a-contributor-bounced', notes: `landed on: ${contrib.url()}` };
  });
  await contribCtx.context.close();

  // ============ CHECKPOINT 1b — admin role reaches /results ============
  const adminCtx = await newActorContext(browser, ADMIN_EMAIL);
  const admin = adminCtx.page;
  await checkpoint(1.2, 'Logowanie rola Z dostepem (admin) - dociera do /results/kpi', admin, async () => {
    await admin.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '01b-admin-access', notes: `landed on: ${admin.url()}` };
  });

  // ============ CHECKPOINT 2 — /results/kpi list with data ============
  await checkpoint(2, '/results/kpi - lista z danymi', admin, async () => {
    await admin.waitForSelector('[data-testid="results-vnext-kpi-registry-page"]', { timeout: 10000 }).catch(() => {});
    // Default tab is "My" (KPIs owned by this user) — seeded KPIs are org-wide,
    // not owned by this admin, so switch to "Org" to see the seeded dataset.
    await admin.locator('button:has-text("Org")').first().click({ timeout: 5000 }).catch(() => {});
    await admin.waitForTimeout(1200);
    return { name: '02-kpi-registry-list' };
  });

  // ============ CHECKPOINT 3 — open row preview (single click) ============
  const KPI_CODE = 'KPI-A-002';
  let kpiId = null;
  await checkpoint(3, 'Otwarcie podgladu wiersza (single click) - StandardPreview', admin, async () => {
    const row = admin.locator(`tr:has-text("${KPI_CODE}")`).first();
    await row.click({ timeout: 8000 });
    await admin.waitForTimeout(800);
    return { name: '03-row-preview-open' };
  });

  // ============ CHECKPOINT 4 — open full KPI tool ============
  await checkpoint(4, 'Otwarcie pelnego narzedzia KPI (Open z preview)', admin, async () => {
    const openBtn = admin.getByRole('button', { name: /^Open$|^Otwórz$/ }).first();
    await openBtn.click({ timeout: 8000 });
    await admin.waitForTimeout(1500);
    kpiId = admin.url().split('/results/kpi/')[1]?.split('?')[0] ?? null;
    report.ids.kpiId = kpiId;
    let notes = `kpiId=${kpiId}, url after in-app Open click=${admin.url()}`;
    // KNOWN DOCUMENTED DEFECT: in-app navigation drops the ?ff_resultsVNextKpi=1
    // query flag, landing on the flag-gated "not yet enabled" placeholder even
    // though the route itself is fine. Re-append the flag via the address bar,
    // exactly as a real user has to per the runbook workaround.
    if (!admin.url().includes('ff_resultsVNextKpi=1')) {
      await admin.goto(`${BASE}/results/kpi/${kpiId}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
      await admin.waitForTimeout(2000);
      notes += ` | flag was dropped by in-app nav (known defect) — re-navigated with flag: ${admin.url()}`;
    }
    return { name: '04-kpi-full-tool', notes };
  });

  // ============ CHECKPOINT 5 — REAL WRITE: record a measurement ============
  const measurementSource = `rn-g6-testdrive-${Date.now()}`;
  await checkpoint(5, 'REALNY ZAPIS - rejestracja pomiaru KPI (dowod naprawy P0 correlation-id, BEZ obejscia)', admin, async () => {
    // Left sidebar tab inside the KPI tool page (not a button) — "Measurements"/"Pomiary"
    await admin.locator('text=Measurements').first().click({ timeout: 8000 }).catch(async () => {
      await admin.locator('text=Pomiary').first().click({ timeout: 8000 });
    });
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="kpi-measurements-record-cta"]').click({ timeout: 8000 });
    await admin.waitForTimeout(500);
    await admin.locator('[data-testid="kpi-measurement-period-start"]').fill('2026-08-01');
    await admin.locator('[data-testid="kpi-measurement-period-end"]').fill('2026-08-12');
    await admin.locator('[data-testid="kpi-measurement-actual-value"]').fill('123456789');
    await admin.locator('[data-testid="kpi-measurement-source"]').fill(measurementSource);
    const notesField = admin.locator('[data-testid="kpi-measurement-notes"]');
    if (await notesField.count().catch(() => 0)) await notesField.fill('RN-G6 testdrive - dowod zapisu bez obejscia correlationId.');
    await admin.locator('[data-testid="kpi-measurement-record-submit"]').click({ timeout: 8000 });
    await admin.waitForTimeout(1800);
    return { name: '05-measurement-recorded', notes: `source marker used for DB verification: ${measurementSource}` };
  });
  report.ids.measurementSource = measurementSource;

  // ============ CHECKPOINT 6 — /results/roi list ============
  await checkpoint(6, '/results/roi - lista', admin, async () => {
    await admin.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '06-roi-registry-list' };
  });

  // ============ CHECKPOINT 7 — /results/okr list ============
  await checkpoint(7, '/results/okr - lista', admin, async () => {
    await admin.goto(`${BASE}/results/okr?${OKR_FLAG}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '07-okr-registry-list' };
  });

  // ============ CHECKPOINT 8a — /results/attention (real route) ============
  await checkpoint(8.1, '/results/attention (realna trasa, oba flagi)', admin, async () => {
    await admin.goto(`${BASE}/results/attention?${KPI_FLAG}&${OKR_FLAG}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '08a-results-attention', notes: `url=${admin.url()}` };
  });

  // ============ CHECKPOINT 8b — literal /attention (known dead route) ============
  await checkpoint(8.2, '/attention (literalne, znane jako martwe -> spada na /chat)', admin, async () => {
    await admin.goto(`${BASE}/attention`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2000);
    return { name: '08b-bare-attention-dead', notes: `landed on: ${admin.url()}` };
  });

  // ============ CHECKPOINT 9 — reload on record screen, record persists ============
  await checkpoint(9, 'Przeladowanie strony (F5) na ekranie rekordu - rekord zostaje', admin, async () => {
    await admin.goto(`${BASE}/results/kpi/${kpiId}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2000);
    await admin.reload({ waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '09-reload-record-persists', notes: `url after reload=${admin.url()}` };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'testdrive-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== ALL CHECKPOINTS DONE ===');
  console.log('kpiId:', kpiId, 'measurementSource:', measurementSource);
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'testdrive-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
