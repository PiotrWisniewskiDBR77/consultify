// RN-G6-EVID — P0-A (rejected KPI definition revision) evidence capture.
// Real backend (this worktree, port from RN_G6_EVID_BACKEND_PORT / default
// 3103), real frontend (RN_G6_EVID_FRONTEND_URL / default
// http://localhost:3203), real Postgres 17 on :55821 (rn_g6_runtime,
// SHARED — do not touch PID 38806).
//
// Feeds docs/product/results-vnext/RN_G6_EVIDENCE_PACKET.md §Task-1. See
// docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md (design) and
// RN_G6_P0D_WRITE_PATH_FIX.md (F1/F1B fix that unblocks this flow — F1 broke
// every fresh-session write with a non-UUID X-Correlation-ID, F1B left
// Approve/Reject permanently disabled for any second real actor). Both are
// fixed at this worktree's HEAD (4af92d207d, which contains merge f02603b378
// "P0-A — komenda reviseDefinition" AND merge 177104d409 "P0-D — naprawa
// calej powierzchni zapisu"), so this script does NOT need the F1
// sessionStorage workaround the earlier RN_G6_C1 script needed.
//
// 9 steps, screenshot after each UI step (1-8); step 9 is a database
// readback (psql), not a browser action, so it has no PNG — reported as
// literal query output in the evidence packet instead, same convention the
// RN_G6_C1/C2/C3 gold-flow reports already use for their own DB readbacks.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_EVID_FRONTEND_URL || 'http://localhost:3203';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-p0a');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const OWNER_EMAIL = 'rn-g6-user-a-owner@consultify.local';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const KPI_FLAG = 'ff_resultsVNextKpi=1';
const KPI_CODE = 'KPI-G6-EVID-P0A-001';

const V1_VALUES = {
  name: 'P0-A dowod - wersja odrzucona',
  unit: 'dni',
  targetValue: '45',
  warningHigh: '60',
  criticalHigh: '90',
  description: 'RN-G6-EVID P0-A: wersja 1, do odrzucenia przez recenzenta.',
};

const report = { steps: [], ids: {}, v1FieldsAsEntered: V1_VALUES, dbReadback: null };

function record(entry) {
  report.steps.push(entry);
  console.log(`\n=== STEP ${entry.n}: ${entry.title} [${entry.actor}] ===`);
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
    await page.waitForTimeout(1500);
    let loggedIn = page.url().includes('/login') === false;
    if (!loggedIn) {
      await page.waitForTimeout(2000);
      loggedIn = page.url().includes('/login') === false;
    }
    if (!loggedIn) {
      console.warn(`[login] retry for ${email} — still on /login after first attempt`);
      await page.locator('button:has-text("Log in")').first().click().catch(() => {});
      await page.waitForTimeout(3000);
      loggedIn = page.url().includes('/login') === false;
    }
    if (!loggedIn) throw new Error(`LOGIN FAILED for ${email} — still on /login after retries`);
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
  return `docs/qa/screens/rn-g6-p0a/${name}.png`;
}

async function step(n, title, actor, page, fn) {
  const net = attachNetTracking(page);
  page._consoleErrors.length = 0;
  let notes = '';
  let screenshotName = `${String(n).padStart(2, '0')}-step`;
  let extra = {};
  try {
    const result = await fn();
    if (result) {
      if (result.notes) notes = result.notes;
      if (result.name) screenshotName = result.name;
      if (result.extra) extra = result.extra;
    }
  } catch (err) {
    notes = `EXCEPTION: ${err && err.message ? err.message : String(err)}`;
    console.error(`Step ${n} exception:`, err);
  }
  await page.waitForTimeout(500);
  const screenshot = await shot(page, screenshotName);
  net.stop();
  const entry = {
    n,
    title,
    actor,
    screenshot,
    consoleErrors: [...page._consoleErrors],
    apiErrors: net.calls.filter((c) => c.status >= 400),
    apiCalls: net.calls,
    notes,
    ...extra,
  };
  record(entry);
  return entry;
}

async function gotoKpiRegistry(page) {
  await page.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const skipBtn = page.locator('button:has-text("Skip for now")');
  if (await skipBtn.count().catch(() => 0)) {
    await skipBtn.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function openKpiRow(page, kpiCode) {
  const row = page.locator(`tr:has-text("${kpiCode}")`).first();
  await row.click({ timeout: 8000 });
  await page.waitForTimeout(1200); // allow GET .../version to hydrate knownVersions (P0-D fix)
}

const main = async () => {
  const browser = await chromium.launch();

  const ownerCtx = await newActorContext(browser, OWNER_EMAIL);
  const owner = ownerCtx.page;

  let createdKpiId = null;
  const createRespListener = (resp) => {
    if (resp.url().endsWith('/api/vnext/results/kpi') && resp.request().method() === 'POST') {
      resp
        .json()
        .then((body) => {
          if (body && body.kpi && body.kpi.kpiId) createdKpiId = body.kpi.kpiId;
        })
        .catch(() => {});
    }
  };

  // ---------- STEP 1 — create KPI (version 1) ----------
  owner.on('response', createRespListener);
  await step(1, 'Utworzenie KPI — wersja 1 (draft)', 'rn-g6-user-a-owner', owner, async () => {
    await gotoKpiRegistry(owner);
    await owner.locator('button:has-text("New KPI")').click();
    await owner.waitForTimeout(600);
    await owner.locator('[data-testid="kpi-draft-code"]').fill(KPI_CODE);
    await owner.locator('[data-testid="kpi-draft-name"]').fill(V1_VALUES.name);
    await owner.locator('[data-testid="kpi-draft-unit"]').fill(V1_VALUES.unit);
    await owner.locator('[data-testid="kpi-draft-geometry"]').selectOption('threshold_max');
    await owner.waitForTimeout(300);
    await owner.locator('[data-testid="kpi-draft-description"]').fill(V1_VALUES.description);
    await owner.locator('[data-testid="kpi-draft-target-value"]').fill(V1_VALUES.targetValue);
    await owner.locator('[data-testid="kpi-draft-warning-high"]').fill(V1_VALUES.warningHigh);
    await owner.locator('[data-testid="kpi-draft-critical-high"]').fill(V1_VALUES.criticalHigh);
    await owner.locator('[data-testid="kpi-draft-reason"]').fill('RN-G6-EVID P0-A golden-path v1 creation.');
    await owner.locator('[data-testid="kpi-draft-form-submit"]').click();
    await owner.waitForTimeout(1800);
    return { name: '01-kpi-created-v1-draft' };
  });
  owner.off('response', createRespListener);
  report.ids.kpiCode = KPI_CODE;
  report.ids.kpiId = createdKpiId;
  console.log('Created kpiId:', createdKpiId);
  if (!createdKpiId) throw new Error('STEP 1 FAILED — no kpiId captured from POST /api/vnext/results/kpi response. Aborting rest of flow.');

  // ---------- STEP 2 — submit v1 for approval ----------
  await step(2, 'Zgłoszenie wersji 1 do zatwierdzenia', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Submit for approval")').click();
    await owner.waitForTimeout(500);
    const reason = owner.locator('[data-testid="kpi-transition-reason"]');
    if (await reason.count().catch(() => 0)) await reason.fill('Zgloszenie v1 do przegladu — RN-G6-EVID.');
    await owner.locator('[data-testid="kpi-transition-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '02-v1-submitted-pending-approval' };
  });

  // ---------- STEP 3 — reject by second actor ----------
  const adminCtx = await newActorContext(browser, ADMIN_EMAIL);
  const admin = adminCtx.page;
  const REJECT_REASON = 'Progi wymagaja korekty — RN-G6-EVID P0-A recenzja.';
  await step(3, 'Odrzucenie przez drugiego aktora (maker-checker)', 'rn-g6-user-a-admin', admin, async () => {
    await gotoKpiRegistry(admin);
    const orgTab = admin.locator('button:has-text("Org")');
    if (await orgTab.count().catch(() => 0)) {
      await orgTab.first().click();
      await admin.waitForTimeout(1000);
    }
    await openKpiRow(admin, KPI_CODE);
    const rejectBtn = admin.locator('button:has-text("Reject")');
    const enabled = await rejectBtn.isEnabled().catch(() => false);
    if (!enabled) throw new Error('Reject button disabled — F1B regression (maker-checker read gap reappeared)');
    await rejectBtn.click({ timeout: 8000 });
    await admin.waitForTimeout(500);
    await admin.locator('[data-testid="kpi-transition-reason"]').fill(REJECT_REASON);
    await admin.locator('[data-testid="kpi-transition-submit"]').click();
    await admin.waitForTimeout(1500);
    return { name: '03-v1-rejected-by-admin' };
  });

  // ---------- STEP 4 — "Revise and resubmit" creates version 2 ----------
  await step(4, '„Popraw i zgłoś" (Revise and resubmit) — utworzenie wersji 2', 'rn-g6-user-a-owner', owner, async () => {
    await gotoKpiRegistry(owner);
    await openKpiRow(owner, KPI_CODE);
    const reviseBtn = owner.locator('button:has-text("Revise and resubmit"), button:has-text("Popraw i zgłoś")');
    const enabled = await reviseBtn.first().isEnabled().catch(() => false);
    if (!enabled) throw new Error('Revise and resubmit button not enabled after rejection — P0-A regression');
    await reviseBtn.first().click({ timeout: 8000 });
    await owner.waitForTimeout(1500);
    return { name: '04-v2-created-via-revise' };
  });

  // ---------- STEP 5 — proof v2 fields copied from rejected v1 ----------
  await step(5, 'Dowod: pola wersji 2 skopiowane z odrzuconej wersji 1', 'rn-g6-user-a-owner', owner, async () => {
    const editBtn = owner.locator('button:has-text("Edit draft"), button:has-text("Edytuj szkic")');
    await editBtn.first().click({ timeout: 8000 });
    await owner.waitForTimeout(700);
    const fields = await owner.evaluate(() => {
      const get = (testid) => {
        const el = document.querySelector(`[data-testid="${testid}"]`);
        return el ? el.value : null;
      };
      return {
        name: get('kpi-draft-name'),
        unit: get('kpi-draft-unit'),
        description: get('kpi-draft-description'),
        targetValue: get('kpi-draft-target-value'),
        warningHigh: get('kpi-draft-warning-high'),
        criticalHigh: get('kpi-draft-critical-high'),
      };
    });
    const mismatches = [];
    if (fields.name !== V1_VALUES.name) mismatches.push(`name: got "${fields.name}" expected "${V1_VALUES.name}"`);
    if (fields.unit !== V1_VALUES.unit) mismatches.push(`unit: got "${fields.unit}" expected "${V1_VALUES.unit}"`);
    if (fields.description !== V1_VALUES.description) mismatches.push(`description: got "${fields.description}" expected "${V1_VALUES.description}"`);
    if (fields.targetValue !== V1_VALUES.targetValue) mismatches.push(`targetValue: got "${fields.targetValue}" expected "${V1_VALUES.targetValue}"`);
    if (fields.warningHigh !== V1_VALUES.warningHigh) mismatches.push(`warningHigh: got "${fields.warningHigh}" expected "${V1_VALUES.warningHigh}"`);
    if (fields.criticalHigh !== V1_VALUES.criticalHigh) mismatches.push(`criticalHigh: got "${fields.criticalHigh}" expected "${V1_VALUES.criticalHigh}"`);
    report.v2FieldsReadFromForm = fields;
    report.copyMismatches = mismatches;
    return {
      name: '05-v2-form-fields-copied-from-v1',
      notes: mismatches.length === 0
        ? `PROVEN: all 6 checked fields on the v2 edit-draft form match v1's entered values verbatim. Read via page.evaluate() DOM .value reads: ${JSON.stringify(fields)}`
        : `MISMATCH — fields NOT copied correctly: ${mismatches.join('; ')}`,
    };
  });
  if (report.copyMismatches && report.copyMismatches.length > 0) {
    console.error('STEP 5 COPY-PROOF FAILED:', report.copyMismatches);
  }

  // ---------- STEP 6 — edit version 2 ----------
  await step(6, 'Edycja wersji 2', 'rn-g6-user-a-owner', owner, async () => {
    const descField = owner.locator('[data-testid="kpi-draft-description"]');
    const current = await descField.inputValue().catch(() => '');
    await descField.fill(current + ' [v2: threshold uzasadniony etapowym wdrozeniem — RN-G6-EVID edit.]');
    await owner.locator('[data-testid="kpi-draft-warning-high"]').fill('65');
    await owner.locator('[data-testid="kpi-draft-form-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '06-v2-edited-and-saved' };
  });

  // ---------- STEP 7 — submit version 2 ----------
  await step(7, 'Zgłoszenie wersji 2 do zatwierdzenia', 'rn-g6-user-a-owner', owner, async () => {
    const submitBtn = owner.locator('button:has-text("Submit for approval")');
    await submitBtn.click({ timeout: 8000 });
    await owner.waitForTimeout(500);
    const reason = owner.locator('[data-testid="kpi-transition-reason"]');
    if (await reason.count().catch(() => 0)) await reason.fill('Zgloszenie v2 po poprawkach — RN-G6-EVID.');
    await owner.locator('[data-testid="kpi-transition-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '07-v2-submitted-pending-approval' };
  });

  // ---------- STEP 8 — approve version 2 by second actor ----------
  await step(8, 'Zatwierdzenie wersji 2 przez drugiego aktora', 'rn-g6-user-a-admin', admin, async () => {
    await gotoKpiRegistry(admin);
    const orgTab = admin.locator('button:has-text("Org")');
    if (await orgTab.count().catch(() => 0)) {
      await orgTab.first().click();
      await admin.waitForTimeout(1000);
    }
    await openKpiRow(admin, KPI_CODE);
    const approveBtn = admin.locator('button:has-text("Approve")');
    const enabled = await approveBtn.isEnabled().catch(() => false);
    if (!enabled) throw new Error('Approve button disabled for v2 — unexpected regression');
    await approveBtn.click({ timeout: 8000 });
    await admin.waitForTimeout(500);
    const reason = admin.locator('[data-testid="kpi-transition-reason"]');
    if (await reason.count().catch(() => 0)) await reason.fill('v2 wyglada poprawnie — RN-G6-EVID.');
    await admin.locator('[data-testid="kpi-transition-submit"]').click();
    await admin.waitForTimeout(1500);
    return { name: '08-v2-approved-by-admin' };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== ALL 8 UI STEPS DONE — run step 9 (DB readback) separately via psql ===');
  console.log('kpiId:', report.ids.kpiId, 'kpiCode:', report.ids.kpiCode);
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
