// RN-G6-C2 — ROI golden flow evidence capture (real backend on :3098, real
// Postgres db `rn_g6_roi` on :55821, real frontend on :3198). See
// docs/product/results-vnext/RN_G6_C2_ROI_GOLD_FLOW.md for the report this
// feeds. NOT a test — a scripted click-through that saves one screenshot per
// step + console/network evidence, following the proven pattern from
// scripts/rn-g6-kpi-golden-flow.mjs (RN-G6-C1).
//
// Ports differ from the "shared" runtime doc (RN_G6_RUNTIME_ENVIRONMENT.md
// says 3097/3197): a live testdrive environment for the product owner was
// already running on those ports from a different worktree (g6-runtime,
// branch rn-g6-testdrive) when this session started. Rather than kill it,
// this session stood up its own backend/frontend (3098/3198) against a
// NEW, separate database (rn_g6_roi) on the SAME already-running Postgres
// cluster (PID 38806, never touched) — see the report's "environment"
// section for the full rationale.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3198';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-roi');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const OWNER_EMAIL = 'rn-g6-user-a-owner@consultify.local';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const ROI_FLAG = 'ff_resultsVNextRoi=1';

// Real seeded values (see RN_G6_C2_ROI_GOLD_FLOW.md "seed" section).
// rn-g6-init-a6 (first attempt) is a documented casualty of this session's
// own script bug (analysisStart/analysisEnd left blank at creation) — see
// report finding on the create-modal fix. Its case is permanently stuck in
// `modeling` with no calculation-run/cancel path, on purpose left as-is
// (not cleaned up via direct SQL — the task's own instruction is to never
// paper over a real product gap that way). rn-g6-init-a7 is a fresh
// initiative for this corrected run.
// rn-g6-init-a6 and rn-g6-init-a7 are documented casualties of this
// session's own script bugs, fixed in order: a6 hit the missing
// analysisStart/analysisEnd (now required by the create-modal fix), a7
// proved steps 1-15 cleanly through real "approved" -> "tracking" but was
// then re-run from scratch against its own already-`tracking` case (a
// script-harness mistake, not a product bug) and got legitimately locked
// out of re-editing a frozen baseline. rn-g6-init-a8 is the third and
// final fresh initiative, run once with every fix applied.
// a6/a7/a8 are documented casualties/partial-proof runs of this session
// (see report "Znaleziska" — each fixed a real, distinct defect: missing
// analysisStart/analysisEnd, a harness re-run against an already-frozen
// case, and the verify/correct/dispute field gaps). a9 is the fourth and
// definitively final fresh initiative, run once with every fix applied
// (including the step()-level defensive Escape-press against a
// previous step's still-open error modal).
const INITIATIVE_ID = 'rn-g6-init-a10';
const INITIATIVE_TITLE = 'Standaryzacja procesu zakupowego w regionie EMEA - inicjatywa ROI v5';
const KPI_ID = '4d5db4f3-454e-4813-8813-4d5db4454ebd'; // KPI-A-002, active
const KPI_VERSION_ID = '6cc452ae-b764-467b-867b-6cc452b76466';

const report = { steps: [], ids: {} };

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
    if (!loggedIn) {
      throw new Error(`LOGIN FAILED for ${email} — still on /login after retries`);
    }
  }
  return { context, page };
}

function attachNetTracking(page) {
  const calls = [];
  const listener = (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/')) calls.push({ url, status: resp.status(), method: resp.request().method() });
    } catch {}
  };
  page.on('response', listener);
  return { calls, stop: () => page.off('response', listener) };
}

async function dismissOnboarding(page) {
  const skipBtn = page.locator('button:has-text("Skip for now"), a:has-text("Skip for now")');
  if (await skipBtn.count().catch(() => 0)) {
    try {
      await skipBtn.first().click({ timeout: 3000 });
      await page.waitForTimeout(800);
    } catch {}
  }
}

async function shot(page, name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return `docs/qa/screens/rn-g6-roi/${name}.png`;
}

async function step(n, title, actor, page, fn) {
  // NOTE: a step-global "press Escape before every step" was tried here and
  // reverted — it closed step 2's deliberately-left-open create modal
  // before step 3 could use it (reproduced live: the create submit button
  // went "not visible" / "detached from DOM"). Modal cleanup after a real
  // validation error is instead handled at the specific step that can
  // leave one open (see steps 11 and 17 below), not globally.
  const net = attachNetTracking(page);
  page._consoleErrors.length = 0;
  let notes = '';
  let screenshotName = `${String(n).padStart(2, '0')}-step`;
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
    apiCalls: net.calls,
    notes,
  };
  record(entry);
  return entry;
}

async function gotoRoiRegistry(page) {
  await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissOnboarding(page);
  // "Skip for now" on the onboarding modal navigates to /chat (app default
  // landing), not back to the page it was opened on — re-navigate.
  if (page.url().includes('/results/roi') === false) {
    await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await dismissOnboarding(page);
    if (page.url().includes('/results/roi') === false) {
      await page.goto(`${BASE}/results/roi?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }
  }
}

/** Opens the kebab (Row actions) for a table row identified by visible text
 * and clicks a menuitem matching `itemRegex`. `within` scopes which zone of
 * the row menu to search first (not strictly needed since role=menuitem is
 * unique per rendered item), kept simple: just search the whole open menu. */
async function rowMenuAction(page, rowText, itemRegex) {
  // Defensive: close any menu left open by a previous action before opening
  // a new one — a stray open menu's own container can intercept the click
  // on a freshly-opened menu's item (observed live: "Open full tool" span
  // reported as covered by role=menu ... data-row-actions-menu="kebab").
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  const row = page.locator(`tr:has-text("${rowText}")`).first();
  await row.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  const item = page.getByRole('menuitem', { name: itemRegex }).first();
  try {
    await item.click({ timeout: 8000 });
  } catch {
    // One retry: close/reopen, then force-click past any residual overlay.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    await row.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: itemRegex }).first().click({ timeout: 8000, force: true });
  }
  await page.waitForTimeout(400);
}

async function confirmTransitionDialog(page, { reason } = {}) {
  await page.waitForSelector('[data-testid="roi-transition-reason"]', { timeout: 8000 }).catch(() => {});
  if (reason) {
    await page.locator('[data-testid="roi-transition-reason"]').fill(reason);
  }
  await page.locator('[data-testid="roi-transition-submit"]').click();
  await page.waitForTimeout(1200);
}

const main = async () => {
  const browser = await chromium.launch();

  // ================= OWNER context (maker) =================
  const ownerCtx = await newActorContext(browser, OWNER_EMAIL);
  const owner = ownerCtx.page;

  // ---------- STEP 1 — registry entry ----------
  await step(1, 'Wejście do rejestru ROI z /results/roi (real route)', 'rn-g6-user-a-owner', owner, async () => {
    await gotoRoiRegistry(owner);
    return { name: '01-registry-entry-owner' };
  });

  // ---------- STEP 2 — select initiative (open create modal) ----------
  await step(2, 'Wybór inicjatywy — otwarcie formularza "Nowa sprawa ROI", wybór inicjatywy z listy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="roi-registry-create-cta"]').click();
    await owner.waitForTimeout(600);
    await owner.waitForSelector('[data-testid="roi-create-initiative"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-create-initiative"]').selectOption({ value: INITIATIVE_ID }).catch(async () => {
      // Fall back to matching by label text if the value attr differs.
      await owner.locator('[data-testid="roi-create-initiative"]').selectOption({ label: INITIATIVE_TITLE });
    });
    return { name: '02-create-modal-initiative-selected' };
  });

  // ---------- STEP 3 — create the ROI case ----------
  // Distinct from the first (stuck, pre-fix) attempt's case title on
  // rn-g6-init-a6 so `tr:has-text(CASE_TITLE)` below can never ambiguously
  // match both rows once this new one is created.
  const CASE_TITLE = 'Zlota sciezka ROI v5 - standaryzacja zakupow EMEA (RN-G6-C2)';
  let createdCaseId = null;
  const createRespListener = (resp) => {
    if (resp.url().endsWith('/api/vnext/results/roi/cases') && resp.request().method() === 'POST') {
      resp.json().then((body) => { if (body?.case?.caseId) createdCaseId = body.case.caseId; }).catch(() => {});
    }
  };
  owner.on('response', createRespListener);
  await step(3, 'Utworzenie sprawy ROI (Create case — real Draft)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="roi-create-title"]').fill(CASE_TITLE);
    await owner.locator('[data-testid="roi-create-currency"]').selectOption('PLN');
    await owner.locator('[data-testid="roi-create-granularity"]').selectOption('monthly');
    // Required as of this session's fix (RoiCaseCreateModal.tsx) — a case
    // created without these can never run a calculation (see report
    // finding). rn-g6-init-a6's case, created in this session's FIRST
    // attempt before the fix landed, is the documented proof.
    await owner.locator('[data-testid="roi-create-start"]').fill('2026-09-01');
    await owner.locator('[data-testid="roi-create-end"]').fill('2029-12-31');
    await owner.locator('[data-testid="roi-create-reason"]').fill('Zlota sciezka RN-G6-C2 - dowod realnego przeplywu ROI end-to-end.');
    await owner.locator('[data-testid="roi-case-create-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '03-case-created-draft' };
  });
  owner.off('response', createRespListener);
  report.ids.caseId = createdCaseId;
  console.log('Created ROI caseId:', createdCaseId);
  if (!createdCaseId) throw new Error('FATAL: case creation did not return a caseId — cannot continue golden flow');

  async function openFullTool(page) {
    await rowMenuAction(page, CASE_TITLE, /Open full tool|Otwórz pełne narzędzie/);
    await page.waitForTimeout(1200);
  }

  // ---------- STEP 4 — baseline ----------
  await step(4, 'Baseline — Build Case / Settings, edycja i zapis baseline', 'rn-g6-user-a-owner', owner, async () => {
    await openFullTool(owner);
    await owner.locator('tr:has-text("Baseline")').first().locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await owner.waitForTimeout(300);
    await owner.getByRole('menuitem', { name: /Edit|Edytuj/ }).first().click();
    await owner.waitForSelector('[data-testid="roi-baseline-current-value"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-baseline-current-value"]').fill('42');
    await owner.locator('[data-testid="roi-baseline-current-unit"]').fill('dni cyklu rozliczeniowego');
    await owner.locator('[data-testid="roi-baseline-current-as-of"]').fill('2026-07-01');
    // Required for the ready-for-review economic-model guard
    // (isRoiCaseReadyForReviewEligibleWithEconomicModel) — first attempt at
    // this step omitted these and step 12 later failed 409
    // "baseline_period_missing", a real finding worth noting: the create
    // modal's own analysisStart/analysisEnd (case-level) and baseline's
    // period start/end are TWO SEPARATE date-range fields a user must fill
    // correctly and separately, with no cross-check or hint connecting them
    // until the ready-for-review guard rejects at the far end of Build
    // Case.
    await owner.locator('[data-testid="roi-baseline-period-start"]').fill('2026-09-01');
    await owner.locator('[data-testid="roi-baseline-period-end"]').fill('2026-12-31');
    await owner.locator('[data-testid="roi-baseline-method"]').selectOption('flat');
    await owner.locator('[data-testid="roi-baseline-source"]').fill('System ERP - raport zamkniecia miesiaca');
    await owner.locator('[data-testid="roi-baseline-confidence"]').selectOption('medium');
    await owner.locator('[data-testid="roi-baseline-edit-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '04-baseline-saved' };
  });

  // ---------- STEP 5 — calculation policy ----------
  await step(5, 'Polityka obliczeń — edycja i zapis calculation policy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('tr:has-text("Calculation policy"), tr:has-text("Polityka kalkulacji")').first().locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await owner.waitForTimeout(300);
    await owner.getByRole('menuitem', { name: /Edit|Edytuj/ }).first().click();
    await owner.waitForSelector('[data-testid="roi-policy-discount-rate"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-policy-discount-rate"]').fill('8');
    await owner.locator('[data-testid="roi-policy-tax-treatment"]').selectOption({ index: 1 });
    await owner.locator('[data-testid="roi-policy-inflation-rate"]').fill('3.5');
    await owner.locator('[data-testid="roi-policy-required-metrics"]').fill('npv, simple_roi, irr, payback');
    await owner.locator('[data-testid="roi-policy-confidence"]').selectOption('medium');
    await owner.locator('[data-testid="roi-policy-edit-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '05-calc-policy-saved' };
  });

  // ---------- STEP 6 — assumptions ----------
  await step(6, 'Założenia — nowe założenie', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Assumptions"), button:has-text("Założenia")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="roi-model-assumption-create-cta"]').click();
    await owner.waitForSelector('[data-testid="roi-assumption-category"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-assumption-category"]').fill('Operacyjne');
    await owner.locator('[data-testid="roi-assumption-label"]').fill('Liczba faktur przetwarzanych miesiecznie');
    await owner.locator('[data-testid="roi-assumption-base"]').fill('12000');
    await owner.locator('[data-testid="roi-assumption-downside"]').fill('9000');
    await owner.locator('[data-testid="roi-assumption-upside"]').fill('15000');
    await owner.locator('[data-testid="roi-assumption-unit"]').fill('szt/miesiac');
    await owner.locator('[data-testid="roi-assumption-confidence"]').selectOption('medium');
    await owner.locator('[data-testid="roi-assumption-form-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '06-assumption-saved' };
  });

  // ---------- STEP 7 — cost lines ----------
  await step(7, 'Linie kosztów — nowa pozycja kosztowa', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Cost lines"), button:has-text("Koszty")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="roi-model-cost-line-create-cta"]').click();
    await owner.waitForSelector('[data-testid="roi-cost-category"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-cost-category"]').fill('Wdrozenie');
    await owner.locator('[data-testid="roi-cost-label"]').fill('Licencje i wdrozenie platformy SSC');
    await owner.locator('[data-testid="roi-cost-amount"]').fill('850000');
    await owner.locator('[data-testid="roi-cost-timing-type"]').selectOption('one_time');
    await owner.locator('[data-testid="roi-cost-one-time-date"]').fill('2026-09-01');
    await owner.locator('[data-testid="roi-cost-confidence"]').selectOption('high');
    await owner.locator('[data-testid="roi-cost-line-form-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '07-cost-line-saved' };
  });

  // ---------- STEP 8 — benefit lines ----------
  let benefitLineLabel = 'Redukcja kosztow FTE w dziale ksiegowosci';
  await step(8, 'Linie korzyści — nowa pozycja korzyści (finansowa)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Benefit lines"), button:has-text("Korzyści")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="roi-model-benefit-line-create-cta"]').click();
    await owner.waitForSelector('[data-testid="roi-benefit-category"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-benefit-category"]').fill('Efektywnosc operacyjna');
    await owner.locator('[data-testid="roi-benefit-label"]').fill(benefitLineLabel);
    await owner.locator('[data-testid="roi-benefit-amount"]').fill('420000');
    await owner.locator('[data-testid="roi-benefit-timing-type"]').selectOption('recurring');
    await owner.locator('[data-testid="roi-benefit-recurrence-start"]').fill('2027-01-01');
    await owner.locator('[data-testid="roi-benefit-recurrence-end"]').fill('2029-12-31');
    await owner.locator('[data-testid="roi-benefit-cadence"]').selectOption('annual');
    await owner.locator('[data-testid="roi-benefit-confidence"]').selectOption('medium');
    await owner.locator('[data-testid="roi-benefit-line-form-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '08-benefit-line-saved' };
  });

  // ---------- STEP 9 — KPI evidence link on the benefit line ----------
  await step(9, 'Powiązanie dowodu KPI z linią korzyści', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator(`tr:has-text("${benefitLineLabel}")`).first().click();
    await owner.waitForTimeout(600);
    await owner.locator('button:has-text("Add KPI evidence"), button:has-text("Dodaj dowód KPI")').first().click();
    await owner.waitForSelector('[data-testid="roi-evidence-kpi-id"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-evidence-kpi-id"]').fill(KPI_ID);
    await owner.locator('[data-testid="roi-evidence-version-id"]').fill(KPI_VERSION_ID);
    await owner.locator('[data-testid="roi-evidence-purpose"]').selectOption('primary_evidence');
    await owner.locator('[data-testid="roi-evidence-unit"]').fill('dni cyklu rozliczeniowego');
    await owner.locator('[data-testid="roi-evidence-notes"]').fill('KPI-A-002 jako glowny dowod redukcji kosztow FTE.');
    await owner.locator('[data-testid="roi-kpi-evidence-link-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '09-kpi-evidence-linked' };
  });

  // ---------- STEP 10 — scenarios ----------
  await step(10, 'Scenariusze — nowy scenariusz', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Scenarios"), button:has-text("Scenariusze")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="roi-model-scenario-create-cta"]').click();
    await owner.waitForSelector('[data-testid="roi-scenario-label"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-scenario-type"]').selectOption('custom');
    await owner.locator('[data-testid="roi-scenario-label"]').fill('Scenariusz konserwatywny');
    await owner.locator('[data-testid="roi-scenario-description"]').fill('Niższe wolumeny redukcji kosztów, dłuższy ramp-up.');
    await owner.locator('[data-testid="roi-scenario-form-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '10-scenario-saved' };
  });

  // ---------- STEP 11 — calculation run (needs draft -> modeling first) ----------
  await step(11, 'Przebieg obliczeń — start modelowania (naprawiony brak wpiecia) + uruchomienie kalkulacji', 'rn-g6-user-a-owner', owner, async () => {
    // 11a — draft -> modeling. This transition had NO frontend caller before
    // this session's fix (see report "Znaleziska"); go back to the registry
    // to use the kebab. Idempotent-safe: on a re-run against an already-
    // `modeling` case (e.g. after a script-side retry) the menuitem is
    // rendered disabled (TRIADA — visible with a reason, never hidden), so
    // the click below is wrapped and any failure here is non-fatal — the
    // real, already-proven transition is documented separately.
    await owner.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await owner.waitForTimeout(1200);
    try {
      await rowMenuAction(owner, CASE_TITLE, /Start modeling|Rozpocznij modelowanie/);
      await confirmTransitionDialog(owner, { reason: 'Model ekonomiczny zbudowany — rozpoczecie modelowania.' });
      await owner.waitForTimeout(800);
    } catch (e) {
      console.warn('[step 11a] start_modeling click non-fatal (likely already modeling):', e.message);
      await owner.keyboard.press('Escape').catch(() => {});
      await owner.waitForTimeout(400);
    }

    // 11b — back into the full tool, Calculation runs tab, trigger a run.
    await openFullTool(owner);
    await owner.locator('button:has-text("Calculation runs"), button:has-text("Przebiegi kalkulacji")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="roi-model-calc-run-trigger-cta"]').click();
    await owner.waitForSelector('[data-testid="roi-calc-run-reason"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-calc-run-reason"]').fill('Pierwszy przebieg kalkulacji - zlota sciezka.');
    await owner.locator('[data-testid="roi-calc-run-trigger-submit"]').click();
    await owner.waitForTimeout(2500);
    // Defensive: if the run failed, the modal stays open showing the error
    // (expected UX — never auto-dismiss a real error) — close it explicitly
    // so it can't block the next step's navigation clicks.
    await owner.keyboard.press('Escape').catch(() => {});
    await owner.waitForTimeout(400);
    return { name: '11-calculation-run-triggered' };
  });

  // ---------- STEP 12 — submit for approval (ready-for-review then submit) ----------
  await step(12, 'Zgłoszenie do zatwierdzenia — gotowe do przeglądu + zgłoszenie', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await owner.waitForTimeout(1200);
    await rowMenuAction(owner, CASE_TITLE, /Mark ready for review|Oznacz jako gotowe do przeglądu/);
    await confirmTransitionDialog(owner, { reason: 'Kalkulacja zakonczona sukcesem - gotowe do przegladu.' });
    await owner.waitForTimeout(800);
    await rowMenuAction(owner, CASE_TITLE, /Submit for approval|Zgłoś do zatwierdzenia/);
    await confirmTransitionDialog(owner, { reason: 'Zglaszam sprawe do akceptacji.' });
    await owner.waitForTimeout(800);
    return { name: '12-submitted-for-approval' };
  });

  // ================= ADMIN context (checker) =================
  const adminCtx = await newActorContext(browser, ADMIN_EMAIL);
  const admin = adminCtx.page;

  // ---------- STEP 13 — review (second actor opens the case) ----------
  await step(13, 'Przegląd — drugi aktor (ADMIN) otwiera sprawę złożoną do akceptacji', 'rn-g6-user-a-admin', admin, async () => {
    await gotoRoiRegistry(admin);
    await admin.waitForTimeout(1000);
    await openFullTool(admin);
    await admin.locator('button:has-text("Decision"), button:has-text("Decyzja")').first().click();
    await admin.waitForTimeout(800);
    return { name: '13-admin-review-decision-phase' };
  });

  // ---------- STEP 14 — approval (immutable snapshot) ----------
  await step(14, 'Zatwierdzenie sprawy — powstaje niezmienna migawka zatwierdzenia', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /^Approve$|^Zaakceptuj$/);
    await confirmTransitionDialog(admin, { reason: 'Model ekonomiczny zweryfikowany, akceptuje.' });
    await admin.waitForTimeout(1000);
    await openFullTool(admin);
    await admin.locator('button:has-text("Decision"), button:has-text("Decyzja")').first().click();
    await admin.waitForTimeout(800);
    const snapRow = admin.locator('tbody tr').first();
    await snapRow.click().catch(() => {});
    await admin.waitForTimeout(600);
    return { name: '14-approval-snapshot' };
  });

  // ---------- STEP 15 — forecast version ----------
  await step(15, 'Wersja prognozy — start śledzenia + publikacja prognozy', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /Start tracking|Rozpocznij śledzenie/);
    await confirmTransitionDialog(admin, { reason: 'Inicjatywa rozpoczeta - start sledzenia realizacji.' });
    await admin.waitForTimeout(800);
    await openFullTool(admin);
    await admin.locator('button:has-text("Realize Value"), button:has-text("Realizacja wartości")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-realize-forecast-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-forecast-reason"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-forecast-reason"]').fill('Pierwsza opublikowana wersja prognozy.');
    await admin.locator('[data-testid="roi-forecast-version-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '15-forecast-version-published' };
  });

  // ---------- STEP 16 — actual value ----------
  let actualEntrySource = 'ERP - raport miesieczny 2027-01';
  await step(16, 'Wartość rzeczywista — rejestracja wykonania', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("Actuals"), button:has-text("Wykonania")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-realize-actual-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-actual-source"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-actual-type"]').selectOption('benefit');
    // Required: server rejects entry_type="benefit" without a benefitLineId
    // (reproduced live: 409 "entry_type 'benefit' requires benefitLineId
    // and forbids costLineId" when this select was left at its default "—").
    await admin.locator('[data-testid="roi-actual-line"]').selectOption({ index: 1 });
    await admin.locator('[data-testid="roi-actual-period-start"]').fill('2027-01-01');
    await admin.locator('[data-testid="roi-actual-period-end"]').fill('2027-01-31');
    await admin.locator('[data-testid="roi-actual-amount"]').fill('31000');
    await admin.locator('[data-testid="roi-actual-source"]').fill(actualEntrySource);
    await admin.locator('[data-testid="roi-actual-notes"]').fill('Pierwszy miesiac realizacji korzysci.');
    await admin.locator('[data-testid="roi-actual-entry-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '16-actual-entry-recorded' };
  });

  // ---------- STEP 17 — verify, correct, dispute ----------
  await step(17, 'Weryfikacja, korekta, spór — trzy działania na wpisach wykonania', 'rn-g6-user-a-owner + rn-g6-user-a-admin', owner, async () => {
    // Verify by a DIFFERENT actor than the recorder (rn-g6-user-a-admin
    // recorded this entry in step 16) — real, correct server-side
    // segregation-of-duties guard reproduced live: "User ... may not verify
    // actual entry ...: they are the chain's original recorder" (403) when
    // the SAME actor who recorded tries to verify. Owner switches tabs to
    // the same case here rather than a fresh navigation.
    await owner.goto(`${BASE}/results/roi/cases/${report.ids.caseId}?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(1500);
    await owner.locator('button:has-text("Realize Value"), button:has-text("Realizacja wartości")').first().click();
    await owner.waitForTimeout(800);
    await owner.locator('button:has-text("Actuals"), button:has-text("Wykonania")').first().click();
    await owner.waitForTimeout(800);
    await rowMenuAction(owner, actualEntrySource, /^Verify$|^Zweryfikuj$/);
    await owner.waitForSelector('[data-testid="roi-actual-action-submit"]', { timeout: 8000 });
    await owner.locator('[data-testid="roi-action-text"]').fill('Zgadza sie z raportem ERP.');
    await owner.locator('[data-testid="roi-actual-action-submit"]').click();
    await owner.waitForTimeout(1000);

    // Correct the same entry (allowed with no status guard, any actor).
    await rowMenuAction(admin, actualEntrySource, /^Correct$|^Koryguj$/);
    await admin.waitForSelector('[data-testid="roi-correction-amount"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-correction-amount"]').fill('31500');
    // Required alongside amount — 409 "currency is required when amount is
    // provided" reproduced live when this was left blank.
    await admin.locator('[data-testid="roi-correction-currency"]').fill('PLN');
    await admin.locator('[data-testid="roi-action-text"]').fill('Korekta po dodatkowej fakturze korygujacej.');
    await admin.locator('[data-testid="roi-actual-action-submit"]').click();
    await admin.waitForTimeout(1000);

    // Record and dispute a second entry.
    await admin.locator('[data-testid="roi-realize-actual-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-actual-source"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-actual-type"]').selectOption('cost');
    await admin.locator('[data-testid="roi-actual-line"]').selectOption({ index: 1 });
    await admin.locator('[data-testid="roi-actual-period-start"]').fill('2027-01-01');
    await admin.locator('[data-testid="roi-actual-period-end"]').fill('2027-01-31');
    await admin.locator('[data-testid="roi-actual-amount"]').fill('99999');
    await admin.locator('[data-testid="roi-actual-source"]').fill('Wstepny wyciag - do weryfikacji');
    await admin.locator('[data-testid="roi-actual-entry-submit"]').click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, 'Wstepny wyciag', /^Dispute$|^Zakwestionuj$/);
    await admin.waitForSelector('[data-testid="roi-action-text"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-action-text"]').fill('Kwota nie zgadza sie z systemem zrodlowym - do wyjasnienia z Finance.');
    await admin.locator('[data-testid="roi-actual-action-submit"]').click();
    await admin.waitForTimeout(1200);
    // Defensive, targeted at this specific boundary (not global — see the
    // step() function's header note): if any of the three actions above
    // left its modal open on a real error, close it now so step 18's tab
    // clicks aren't blocked by a stray backdrop.
    await admin.keyboard.press('Escape').catch(() => {});
    await admin.waitForTimeout(300);
    return { name: '17-verify-correct-dispute' };
  });

  // ---------- STEP 18 — variance and its cause ----------
  await step(18, 'Odchylenie i jego przyczyna — rejestracja wariancji + dodanie przyczyny', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("Variances"), button:has-text("Wariancje")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-realize-variance-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-variance-comparison"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-variance-comparison"]').selectOption('approved_vs_forecast');
    await admin.locator('[data-testid="roi-variance-metric"]').selectOption('npv');
    // Required for comparisonType "approved_vs_forecast" — server 409s
    // "requires both a approved reference and a forecast reference"
    // without both. The approval-snapshot picker only has real options as
    // of this session's fix (RoiCaseRealizeValueWorkspace.tsx).
    await admin.locator('[data-testid="roi-variance-approval"]').selectOption({ index: 1 });
    await admin.locator('[data-testid="roi-variance-forecast"]').selectOption({ index: 1 });
    await admin.locator('[data-testid="roi-variance-submit"]').click();
    await admin.waitForTimeout(1200);
    // Defensive, targeted at this boundary: if the submit above failed
    // (real error), its modal stays open and would block the row-menu
    // click right below.
    await admin.keyboard.press('Escape').catch(() => {});
    await admin.waitForTimeout(300);
    // Add a cause on the newly created variance (first row).
    const firstRow = admin.locator('tbody tr').first();
    await firstRow.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await admin.waitForTimeout(300);
    await admin.getByRole('menuitem', { name: /Add cause|Dodaj przyczynę/ }).first().click();
    await admin.waitForSelector('[data-testid="roi-cause-category"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-cause-category"]').fill('Wolniejsze wdrozenie procesu');
    await admin.locator('[data-testid="roi-cause-contribution"]').fill('60');
    await admin.locator('[data-testid="roi-cause-narrative"]').fill('Opoznienie w migracji danych z systemu zrodlowego przesunelo start realizacji korzysci o 1 miesiac.');
    await admin.locator('[data-testid="roi-variance-cause-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '18-variance-and-cause' };
  });

  // ---------- STEP 19 — Finance reconciliation ----------
  await step(19, 'Uzgodnienie z Finansami — powiązanie + otwarcie rekoncyliacji', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("Learn"), button:has-text("Wnioski")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('button:has-text("Finance links"), button:has-text("Powiązania Finance")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-learn-finance-link-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-finance-artifact-type"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-finance-artifact-type"]').fill('financial_statement_pack');
    await admin.locator('[data-testid="roi-finance-artifact-id"]').fill('rn-g6-fin-pack-roi-c2');
    await admin.locator('[data-testid="roi-finance-version-id"]').fill('v1');
    await admin.locator('[data-testid="roi-finance-source"]').fill('Finance - pakiet sprawozdan Q1 2027');
    await admin.locator('[data-testid="roi-finance-as-of"]').fill('2027-01-31T12:00');
    await admin.locator('[data-testid="roi-finance-purpose"]').fill('Uzgodnienie kosztow FTE');
    await admin.locator('[data-testid="roi-finance-link-submit"]').click();
    await admin.waitForTimeout(1200);

    await admin.locator('button:has-text("Reconciliations"), button:has-text("Rekoncyliacje")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-learn-reconciliation-create-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-recon-roi-value"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-recon-roi-value"]').fill('31500');
    await admin.locator('[data-testid="roi-recon-finance-value"]').fill('31200');
    await admin.locator('[data-testid="roi-recon-divergence"]').fill('Drobna roznica zaokraglenia miedzy systemami.');
    await admin.locator('[data-testid="roi-finance-reconciliation-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '19-finance-reconciliation' };
  });

  // ---------- STEP 20 — benefits realization after initiative completion ----------
  await step(20, 'Realizacja korzyści po zakończeniu inicjatywy', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /Start benefits realization|Rozpocznij realizację korzyści/);
    await confirmTransitionDialog(admin, { reason: 'Wdrozenie zakonczone - start fazy realizacji korzysci.' });
    await admin.waitForTimeout(800);
    await openFullTool(admin);
    await admin.locator('button:has-text("Realize Value"), button:has-text("Realizacja wartości")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('button:has-text("Benefits realization"), button:has-text("Realizacja korzyści")').first().click();
    await admin.waitForTimeout(800);
    const row = admin.locator('tbody tr').first();
    await row.click().catch(() => {});
    await admin.waitForTimeout(600);
    return { name: '20-benefits-realization' };
  });

  // ---------- STEP 21 — post-investment review ----------
  await step(21, 'Przegląd poinwestycyjny — PIR due, harmonogram, start, szkic', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /Mark PIR due|Oznacz PIR jako wymagany/);
    await confirmTransitionDialog(admin, { reason: 'Okres realizacji zakonczony - PIR wymagany.' });
    await admin.waitForTimeout(800);

    await openFullTool(admin);
    await admin.locator('button:has-text("Learn"), button:has-text("Wnioski")').first().click();
    await admin.waitForTimeout(800);
    await admin.locator('[data-testid="roi-learn-pir-schedule-cta"]').click();
    await admin.waitForSelector('[data-testid="roi-pir-schedule-date"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-pir-schedule-date"]').fill('2027-04-15T10:00');
    await admin.locator('[data-testid="roi-pir-schedule-reason"]').fill('Zaplanowany przeglad poinwestycyjny.');
    await admin.locator('[data-testid="roi-pir-schedule-submit"]').click();
    await admin.waitForTimeout(1200);

    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /^Start PIR$|^Rozpocznij PIR$/);
    await confirmTransitionDialog(admin, {});
    await admin.waitForTimeout(800);

    await openFullTool(admin);
    await admin.locator('button:has-text("Learn"), button:has-text("Wnioski")').first().click();
    await admin.waitForTimeout(800);
    const pirRow = admin.locator('tbody tr').first();
    await pirRow.locator('button[aria-label="Row actions"]').click({ timeout: 8000 });
    await admin.waitForTimeout(300);
    await admin.getByRole('menuitem', { name: /Edit draft|Edytuj szkic/ }).first().click();
    await admin.waitForSelector('[data-testid="roi-pir-lessons"]', { timeout: 8000 });
    await admin.locator('[data-testid="roi-pir-outcome"]').selectOption({ index: 1 });
    await admin.locator('[data-testid="roi-pir-lessons"]').fill('Wdrozenie SSC przyniosto oczekiwana redukcje kosztow FTE, z jednomiesiecznym opoznieniem startu.');
    await admin.locator('[data-testid="roi-pir-recommendation"]').fill('Kontynuowac monitoring i rozwazyc replikacje na inne dzialy operacyjne.');
    await admin.locator('[data-testid="roi-pir-draft-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '21-pir-draft' };
  });

  // ---------- STEP 22 — closure ----------
  await step(22, 'Zamknięcie sprawy', 'rn-g6-user-a-admin', admin, async () => {
    await admin.locator('button:has-text("ROI registry"), button:has-text("Rejestr ROI")').first().click();
    await admin.waitForTimeout(1200);
    await rowMenuAction(admin, CASE_TITLE, /^Close case$|^Zamknij sprawę$/);
    await confirmTransitionDialog(admin, { reason: 'PIR zakonczony - zamykam sprawe.' });
    await admin.waitForTimeout(1000);
    return { name: '22-case-closed' };
  });

  // ---------- STEP 23 — history ----------
  await step(23, 'Historia — brak dedykowanej zakładki „Historia”; najbliższy uczciwy odpowiednik: migawki zatwierdzenia + przebiegi kalkulacji', 'rn-g6-user-a-admin', admin, async () => {
    await openFullTool(admin);
    await admin.locator('button:has-text("Decision"), button:has-text("Decyzja")').first().click();
    await admin.waitForTimeout(800);
    return { name: '23-history-approval-snapshots' };
  });

  // ---------- STEP 24a — F5 reload ----------
  await step(241, 'Przeładowanie strony (F5) na ekranie pełnego narzędzia sprawy', 'rn-g6-user-a-admin', admin, async () => {
    await admin.reload({ waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2500);
    return { name: '24a-f5-reload' };
  });

  // ---------- STEP 24b — cold deep link, fresh session ----------
  const coldCtx = await newActorContext(browser, null);
  const cold = coldCtx.page;
  await step(242, 'Zimny deep link do sprawy (świeża sesja, bez logowania, bez przejścia przez listę)', 'rn-g6-user-a-admin (fresh session)', cold, async () => {
    await cold.goto(`${BASE}/results/roi/cases/${report.ids.caseId}?${ROI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await cold.waitForTimeout(2000);
    const preLoginUrl = cold.url();
    if (preLoginUrl.includes('/login')) {
      await cold.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
      await cold.locator('input[type="password"]').first().fill(PASSWORD);
      await cold.locator('button:has-text("Log in")').first().click();
      await cold.waitForTimeout(3000);
    }
    return { name: '24b-cold-deeplink-post-login', notes: `pre-login URL: ${preLoginUrl}, post-login URL: ${cold.url()}` };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== ALL STEPS DONE ===');
  console.log('caseId:', report.ids.caseId);
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
