// RN-G6-C2 — targeted follow-up covering steps 20-24 of the ROI gold flow,
// run against the ALREADY-tracking case produced by
// rn-g6-roi-golden-flow.mjs's run14 (case 2b4e94f0-6bef-4ab9-ac63-cb89afe7f8f8,
// status='tracking', real approval snapshot + calc run + forecast + actuals
// + variance already proven in that run's own log). Starting fresh here
// (not chained after step 19) deliberately avoids the stuck-modal cascade
// documented in the report finding on Finance links being locked from
// 'tracking' onward (NON_EDITABLE_STATUSES) — that finding is real and
// reported separately, not routed around by skipping it silently.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3198';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-roi');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const ROI_FLAG = 'ff_resultsVNextRoi=1';
const CASE_ID = '2b4e94f0-6bef-4ab9-ac63-cb89afe7f8f8';
const CASE_TITLE = 'Zlota sciezka ROI v5 - standaryzacja zakupow EMEA (RN-G6-C2)';

const report = { steps: [] };
function record(entry) {
  report.steps.push(entry);
  console.log(`\n=== STEP ${entry.n}: ${entry.title} ===`);
  console.log(`screenshot: ${entry.screenshot}`);
  console.log(`console errors: ${entry.consoleErrors.length}`, entry.consoleErrors.slice(0, 5));
  console.log(`api >=400: ${entry.apiErrors.length}`, entry.apiErrors);
  if (entry.notes) console.log('notes:', entry.notes);
}
function attachNetTracking(page) {
  const calls = [];
  const listener = (resp) => { try { const url = resp.url(); if (url.includes('/api/')) calls.push({ url, status: resp.status(), method: resp.request().method() }); } catch {} };
  page.on('response', listener);
  return { calls, stop: () => page.off('response', listener) };
}
async function shot(page, name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return `docs/qa/screens/rn-g6-roi/${name}.png`;
}
async function step(n, title, page, fn) {
  const net = attachNetTracking(page);
  page._consoleErrors.length = 0;
  let notes = '';
  let screenshotName = `${String(n).padStart(2, '0')}-tail-step`;
  try {
    const result = await fn();
    if (result) { if (result.notes) notes = result.notes; if (result.name) screenshotName = result.name; }
  } catch (err) {
    notes = `EXCEPTION: ${err && err.message ? err.message : String(err)}`;
    console.error(`Step ${n} exception:`, err);
  }
  await page.waitForTimeout(500);
  const screenshot = await shot(page, screenshotName);
  net.stop();
  record({ n, title, screenshot, consoleErrors: [...page._consoleErrors], apiErrors: net.calls.filter((c) => c.status >= 400), apiCalls: net.calls, notes });
}
async function rowMenuAction(page, rowText, itemRegex) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  const row = page.locator(`tr:has-text("${rowText}")`).first();
  await row.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await page.getByRole('menuitem', { name: itemRegex }).first().click({ timeout: 8000 });
  await page.waitForTimeout(400);
}
async function confirmTransitionDialog(page, { reason } = {}) {
  await page.waitForSelector('[data-testid="roi-transition-reason"]', { timeout: 8000 }).catch(() => {});
  if (reason) await page.locator('[data-testid="roi-transition-reason"]').fill(reason);
  await page.locator('[data-testid="roi-transition-submit"]').click();
  await page.waitForTimeout(1200);
}

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page._consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') page._consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => page._consoleErrors.push('PAGEERROR: ' + err.message));

  // Fresh login (fresh session, not chained).
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button:has-text("Log in")').first().click();
  await page.waitForTimeout(2000);

  async function openFullTool() {
    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await rowMenuAction(page, CASE_TITLE, /Open full tool|Otwórz pełne narzędzie/);
    await page.waitForTimeout(1200);
  }

  // ---------- STEP 20 — benefits realization ----------
  await step(20, 'Realizacja korzyści po zakończeniu inicjatywy', page, async () => {
    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await rowMenuAction(page, CASE_TITLE, /Start benefits realization|Rozpocznij realizację korzyści/);
    await confirmTransitionDialog(page, { reason: 'Wdrozenie zakonczone - start fazy realizacji korzysci.' });
    await page.waitForTimeout(800);
    await openFullTool();
    await page.locator('button:has-text("Realize Value"), button:has-text("Realizacja wartości")').first().click();
    await page.waitForTimeout(800);
    await page.locator('button:has-text("Benefits realization"), button:has-text("Realizacja korzyści")').first().click();
    await page.waitForTimeout(800);
    const row = page.locator('tbody tr').first();
    await row.click().catch(() => {});
    await page.waitForTimeout(600);
    return { name: '20-benefits-realization-tail' };
  });

  // ---------- STEP 21 — PIR ----------
  await step(21, 'Przegląd poinwestycyjny — PIR due, harmonogram, start, szkic', page, async () => {
    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await rowMenuAction(page, CASE_TITLE, /Mark PIR due|Oznacz PIR jako wymagany/);
    await confirmTransitionDialog(page, { reason: 'Okres realizacji zakonczony - PIR wymagany.' });
    await page.waitForTimeout(800);

    await openFullTool();
    await page.locator('button:has-text("Learn"), button:has-text("Wnioski")').first().click();
    await page.waitForTimeout(800);
    await page.locator('[data-testid="roi-learn-pir-schedule-cta"]').click();
    await page.waitForSelector('[data-testid="roi-pir-schedule-date"]', { timeout: 8000 });
    await page.locator('[data-testid="roi-pir-schedule-date"]').fill('2027-04-15T10:00');
    await page.locator('[data-testid="roi-pir-schedule-reason"]').fill('Zaplanowany przeglad poinwestycyjny.');
    await page.locator('[data-testid="roi-pir-schedule-submit"]').click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await rowMenuAction(page, CASE_TITLE, /^Start PIR$|^Rozpocznij PIR$/);
    await confirmTransitionDialog(page, {});
    await page.waitForTimeout(800);

    await openFullTool();
    await page.locator('button:has-text("Learn"), button:has-text("Wnioski")').first().click();
    await page.waitForTimeout(800);
    const pirRow = page.locator('tbody tr').first();
    await pirRow.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: /Edit draft|Edytuj szkic/ }).first().click();
    await page.waitForSelector('[data-testid="roi-pir-lessons"]', { timeout: 8000 });
    await page.locator('[data-testid="roi-pir-outcome"]').selectOption({ index: 1 });
    await page.locator('[data-testid="roi-pir-lessons"]').fill('Wdrozenie SSC przyniosto oczekiwana redukcje kosztow FTE, z jednomiesiecznym opoznieniem startu.');
    await page.locator('[data-testid="roi-pir-recommendation"]').fill('Kontynuowac monitoring i rozwazyc replikacje na inne dzialy operacyjne.');
    await page.locator('[data-testid="roi-pir-draft-submit"]').click();
    await page.waitForTimeout(1200);
    return { name: '21-pir-draft-tail' };
  });

  // ---------- STEP 22 — closure ----------
  await step(22, 'Zamknięcie sprawy', page, async () => {
    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await rowMenuAction(page, CASE_TITLE, /^Close case$|^Zamknij sprawę$/);
    await confirmTransitionDialog(page, { reason: 'PIR zakonczony - zamykam sprawe.' });
    await page.waitForTimeout(1000);
    return { name: '22-case-closed-tail' };
  });

  // ---------- STEP 23 — history (closest honest equivalent) ----------
  await step(23, 'Historia — migawki zatwierdzenia + przebiegi kalkulacji', page, async () => {
    await openFullTool();
    await page.locator('button:has-text("Decision"), button:has-text("Decyzja")').first().click();
    await page.waitForTimeout(800);
    return { name: '23-history-tail' };
  });

  // ---------- STEP 24a — F5 ----------
  await step(241, 'Przeładowanie strony (F5) na ekranie zamkniętej sprawy', page, async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    return { name: '24a-f5-reload-tail' };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'tail-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== TAIL STEPS DONE ===');
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'tail-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
