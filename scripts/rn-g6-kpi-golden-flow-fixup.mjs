// RN-G6-C1 — fixup pass for steps that failed in the first full run due to
// SCRIPT bugs (not product bugs), plus the real product bug discovered along
// the way (F8: client-side navigation into a Deviation Case subview drops
// the `?ff_resultsVNextKpi=1` query flag because the in-app `navigate()`
// call in KpiToolPage.tsx does not carry query params — confirmed by
// reading the source, worked around here by using `page.goto()` with the
// flag explicitly re-appended instead of clicking the in-app link).
//
// Reuses the REAL KPI created in the first run (KPI-G6-002,
// kpiId 37d051ce-ab93-47ea-bd5a-a5b61b99e30b) and its REAL auto-opened
// deviation case (831b9ccf-717d-4b3d-90cf-5956acc955a0) — verified via
// direct Postgres SELECT before this script ran (case status='open',
// row_version=1, no root cause yet).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-kpi');

const PASSWORD = 'RnG6Runtime!2026';
const OWNER_EMAIL = 'rn-g6-user-a-owner@consultify.local';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const KPI_FLAG = 'ff_resultsVNextKpi=1';
const KPI_ID = '37d051ce-ab93-47ea-bd5a-a5b61b99e30b';
const KPI_CODE = 'KPI-G6-002';
const CASE_ID = '831b9ccf-717d-4b3d-90cf-5956acc955a0';
const SCORECARD_ID = 'a7a84b5c-cfae-4680-8680-a7a84bcfaea3';
const CASE_URL = `${BASE}/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}?${KPI_FLAG}`;

const report = { steps: [] };

function record(entry) {
  report.steps.push(entry);
  console.log(`\n=== STEP ${entry.n}: ${entry.title} [${entry.actor}] ===`);
  console.log(`screenshot: ${entry.screenshot}`);
  console.log(`console errors: ${entry.consoleErrors.length}`);
  console.log(`api >=400: ${entry.apiErrors.length}`, entry.apiErrors);
  if (entry.notes) console.log('notes:', entry.notes);
}

async function newActorContext(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const v = sessionStorage.getItem('correlationId');
      if (!v || !uuidRe.test(v)) sessionStorage.setItem('correlationId', crypto.randomUUID());
    } catch {}
  });
  const page = await context.newPage();
  page._consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') page._consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => page._consoleErrors.push('PAGEERROR: ' + err.message));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button:has-text("Log in")').first().click();
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) throw new Error(`LOGIN FAILED for ${email}`);
  return page;
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
  return `docs/qa/screens/rn-g6-kpi/${name}.png`;
}

async function step(n, title, actor, page, fn) {
  const net = attachNetTracking(page);
  page._consoleErrors.length = 0;
  let notes = '';
  let screenshotName = `${n}-fixup`;
  try {
    const result = await fn();
    if (result) {
      if (result.notes) notes = result.notes;
      if (result.name) screenshotName = result.name;
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
    notes,
  };
  record(entry);
  return entry;
}

const main = async () => {
  const browser = await chromium.launch();
  const owner = await newActorContext(browser, OWNER_EMAIL);
  const admin = await newActorContext(browser, ADMIN_EMAIL);

  // ---- fix step 102: dispute the May (200) measurement, unambiguous selector ----
  await step(102, 'Spor o pomiar (Dispute) — naprawiony selektor', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(1500);
    const row = owner.locator(`tr:has-text("${KPI_CODE}")`).first();
    await row.click({ timeout: 8000 });
    await owner.waitForTimeout(500);
    await owner.locator('button:has-text("Open measurements")').click({ timeout: 8000 });
    await owner.waitForTimeout(800);
    const row200 = owner.locator('table tbody tr:has-text("200")').first();
    await row200.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    // Preview panel's action button — use .last() to avoid the row-menu's "Dispute" (kebab, hidden) also matching.
    const disputeBtn = owner.locator('button:has-text("Dispute")').last();
    await disputeBtn.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    const dqText = owner.locator('[data-testid="kpi-measurement-dq-text"]');
    if (await dqText.count().catch(() => 0)) await dqText.fill('Wartosc 200 przekracza fizyczny limit procesu - zrodlo podejrzane.');
    await owner.locator('[data-testid="kpi-measurement-dispute-submit"]').click({ timeout: 5000 });
    await owner.waitForTimeout(1200);
    return { name: '10b-measurement-disputed-fixed' };
  });

  // ---- step 11b: acknowledge the case (open -> analysis_required) — a real,
  // previously-missed precondition (Phase 1 "Detection & acknowledgement") ----
  await step(111, 'Potwierdzenie sprawy (open -> analysis_required)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(CASE_URL, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    await owner.locator('button:has-text("Acknowledge")').click({ timeout: 8000 });
    await owner.waitForTimeout(1200);
    return { name: '11b-case-acknowledged' };
  });

  // ---- step 12: root cause (direct URL nav preserves flag — F8) ----
  await step(12, 'Przyczyna zrodlowa (nawigacja bezposrednia z flaga — omija F8)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-deviation-root-cause-summary"]').fill('Opoznienie dostawcy komponentow krytycznych na etapie integracji.', { timeout: 10000 });
    await owner.locator('[data-testid="kpi-deviation-root-cause-category"]').fill('supplier_delay');
    await owner.locator('[data-testid="kpi-deviation-submit-root-cause"]').click({ timeout: 5000 });
    await owner.waitForTimeout(1200);
    return { name: '12-root-cause-submitted' };
  });

  // ---- step 13: corrective action + submit plan ----
  await step(13, 'Dzialanie korygujace i zlozenie planu', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-deviation-action-title"]').fill('Eskalacja do dostawcy + plan B - dostawca zapasowy', { timeout: 8000 });
    await owner.locator('[data-testid="kpi-deviation-action-owner"]').fill('rn-g6-user-a-owner');
    await owner.locator('[data-testid="kpi-deviation-add-action"]').click({ timeout: 5000 });
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="kpi-deviation-submit-plan"]').click({ timeout: 5000 });
    await owner.waitForTimeout(1200);
    return { name: '13a-corrective-action-plan-submitted' };
  });

  // ---- step 131: plan approval by admin (different actor, maker-checker) ----
  await step(131, '[most] Zatwierdzenie planu przez recenzenta (maker-checker, drugi aktor)', 'rn-g6-user-a-admin', admin, async () => {
    await admin.goto(CASE_URL, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2000);
    await admin.locator('[data-testid="kpi-deviation-approve-plan"]').click({ timeout: 10000 });
    await admin.waitForTimeout(1200);
    return { name: '13b-corrective-plan-approved' };
  });

  // ---- bridge: move the corrective action to "active" so the case auto-transitions approved -> executing (decision #8) ----
  await step(133, '[most] Dzialanie -> "Active" (auto-przejscie approved->executing)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(CASE_URL, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const statusSelect = owner.locator('select[data-testid^="kpi-deviation-action-status-"]').first();
    if (await statusSelect.count().catch(() => 0)) {
      await statusSelect.selectOption('active');
      await owner.waitForTimeout(1200);
    }
    return { name: '13c-action-set-active-executing' };
  });

  // ---- step 14: recovery observation ----
  await step(14, 'Obserwacja odbudowy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.reload({ waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(1500);
    const select = owner.locator('[data-testid="kpi-deviation-recovery-measurement"]');
    const optionCount = await select.locator('option').count().catch(() => 0);
    let notes = '';
    if (optionCount > 1) {
      await select.selectOption({ index: 1 });
      await owner.locator('button:has-text("Record recovery observation")').click({ timeout: 5000 });
      await owner.waitForTimeout(1200);
    } else {
      notes = `No measurement options (count=${optionCount}) — case may not be in "executing" yet.`;
    }
    return { name: '14-recovery-observation', notes };
  });

  // ---- step 15: effectiveness verification + close ----
  await step(15, 'Weryfikacja skutecznosci i zamkniecie sprawy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.reload({ waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(1500);
    const dateInputs = owner.locator('input[type="date"]');
    const dateCount = await dateInputs.count().catch(() => 0);
    // Last two date inputs on the page belong to the verification window (root-cause's
    // "expected recovery date" + action's "due date" come first in DOM order).
    if (dateCount >= 2) {
      await dateInputs.nth(dateCount - 2).fill('2026-08-01').catch(() => {});
      await dateInputs.nth(dateCount - 1).fill('2026-08-10').catch(() => {});
    }
    const outcomeSelect = owner.locator('[data-testid="kpi-deviation-verification-outcome"]');
    if (await outcomeSelect.count().catch(() => 0)) await outcomeSelect.selectOption('effective');
    const submitVerifyBtn = owner.locator('[data-testid="kpi-deviation-submit-verification"]');
    let notes = '';
    if (await submitVerifyBtn.count().catch(() => 0)) {
      await submitVerifyBtn.click({ timeout: 8000 }).catch((e) => { notes += `submit-verification click failed: ${e.message}. `; });
      await owner.waitForTimeout(1200);
    }
    const closeBtn = owner.locator('[data-testid="kpi-deviation-close-case"]');
    let closed = false;
    if (await closeBtn.count().catch(() => 0)) {
      const enabled = await closeBtn.isEnabled().catch(() => false);
      if (enabled) {
        await closeBtn.click();
        await owner.waitForTimeout(1200);
        closed = true;
      } else {
        notes += 'Close button present but disabled after verification submit.';
      }
    }
    return { name: '15-effectiveness-verification', notes: notes || (closed ? 'Case closed.' : '') };
  });

  // ---- step 17 fixup: publish snapshot with period dates filled ----
  await step(17, 'Publikacja migawki przegladu karty wynikow (naprawiony formularz)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(`${BASE}/results/kpi/scorecards/${SCORECARD_ID}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const snapshotsTab = owner.locator('button:has-text("Review snapshots")');
    if (await snapshotsTab.count().catch(() => 0)) {
      await snapshotsTab.first().click();
      await owner.waitForTimeout(800);
    }
    const newSnapshotCta = owner.locator('[data-testid="kpi-scorecard-new-snapshot-cta"]');
    await newSnapshotCta.click({ timeout: 8000 });
    await owner.waitForTimeout(500);
    await owner.locator('[data-testid="kpi-scorecard-snapshot-start"]').fill('2026-08-01');
    await owner.locator('[data-testid="kpi-scorecard-snapshot-end"]').fill('2026-08-12');
    await owner.locator('[data-testid="kpi-scorecard-snapshot-reason"]').fill('Publikacja migawki - dowod golden flow.');
    await owner.locator('[data-testid="kpi-scorecard-create-snapshot-submit"]').click({ timeout: 8000 });
    await owner.waitForTimeout(1500);
    const shot1 = await shot(owner, '17a-snapshot-created-draft');
    // Now publish the just-created draft snapshot (top row, newest first).
    const firstSnapRow = owner.locator('table tbody tr').first();
    await firstSnapRow.click({ timeout: 5000 });
    await owner.waitForTimeout(500);
    const publishBtn = owner.locator('button:has-text("Publish")').last();
    let notes = '';
    if (await publishBtn.count().catch(() => 0)) {
      await publishBtn.click({ timeout: 5000 });
      await owner.waitForTimeout(500);
      await owner.locator('[data-testid="kpi-scorecard-publish-snapshot-reason"]').fill('Publikacja migawki golden flow.').catch(() => {});
      await owner.locator('[data-testid="kpi-scorecard-publish-snapshot-submit"]').click({ timeout: 8000 });
      await owner.waitForTimeout(1500);
    } else {
      notes = 'Publish button not found on selected row.';
    }
    return { name: '17b-snapshot-published', notes };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'fixup-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== FIXUP DONE ===');
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'fixup-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
