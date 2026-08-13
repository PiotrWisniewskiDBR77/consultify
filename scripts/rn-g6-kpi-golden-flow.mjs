// RN-G6-C1 — KPI golden flow evidence capture (real backend on :3097, real
// Postgres on :55821, real frontend on :3197). See
// docs/product/results-vnext/RN_G6_C1_KPI_GOLD_FLOW.md for the report this
// feeds. NOT a test — a scripted click-through that saves one screenshot per
// step + console/network evidence, driven by Playwright because the
// interactive browser tool used earlier in this session has no way to
// persist PNGs to disk.
//
// ============================================================================
// KNOWN BLOCKER WORKED AROUND HERE — see report finding F1.
// ============================================================================
// The app's session-wide `X-Correlation-ID` header
// (src/services/apiUtils.ts:10-14: `Math.random().toString(36).substring(2,15)
// + Math.random().toString(36).substring(2,15)`, NOT a UUID) is forwarded
// verbatim into `rvn_platform_events.correlation_id` (a `UUID NOT NULL`
// column) by every RN vNext write route's `getCorrelationId(req)` helper
// (server/src/routes/resultsVnext/kpi.routes.ts:181-186 and identical
// siblings in kpiDeviation/kpiScorecard/kpiPerspectives/roi/okr routes),
// with NO format validation and no fallback unless the value is literally
// absent (`correlationId ?? randomUUID()` — `??` never triggers on a
// non-empty malformed string). Result: on a FRESH browser session (fresh
// sessionStorage), the very FIRST RN vNext write of ANY kind 500s with
// Postgres 22P02 "invalid input syntax for type uuid". This is not
// probabilistic — the generator never produces hyphens in UUID positions,
// so it is a deterministic, total block on every fresh session. Reproduced
// live in this session: POST /api/vnext/results/kpi -> 500
// {"error":"Internal server error","code":"KPI_INTERNAL_ERROR"}, backend log
// showed `invalid input syntax for type uuid: "rdapdtb8bljfysmfqa6nhk"`.
//
// Below we pre-seed `sessionStorage.correlationId` with a real UUID via
// `context.addInitScript` before the app's JS module runs, so the REST of
// the golden flow can be exercised end-to-end. This is a session-local
// workaround for evidence-gathering only — NOT a code change, and a real
// user in a fresh browser session/tab remains fully blocked with no
// actionable error message (retrying keeps reusing the same broken
// sessionStorage value, so "Please try again" never succeeds).
// ============================================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-kpi');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const OWNER_EMAIL = 'rn-g6-user-a-owner@consultify.local';
const ADMIN_EMAIL = 'rn-g6-user-a-admin@consultify.local';
const ORGB_ADMIN_EMAIL = 'rn-g6-user-b-admin@consultify.local';
const KPI_FLAG = 'ff_resultsVNextKpi=1';

const report = { steps: [], findings: [], readbacks: [], ids: {} };

function record(entry) {
  report.steps.push(entry);
  console.log(`\n=== STEP ${entry.n}: ${entry.title} [${entry.actor}] ===`);
  console.log(`screenshot: ${entry.screenshot}`);
  console.log(`console errors: ${entry.consoleErrors.length}`, entry.consoleErrors.slice(0, 5));
  console.log(`api >=400: ${entry.apiErrors.length}`, entry.apiErrors);
  if (entry.notes) console.log('notes:', entry.notes);
}

async function newActorContext(browser, email, { skipWorkaround = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (!skipWorkaround) {
    await context.addInitScript(() => {
      try {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const v = sessionStorage.getItem('correlationId');
        if (!v || !uuidRe.test(v)) sessionStorage.setItem('correlationId', crypto.randomUUID());
      } catch {}
    });
  }
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
    // Verify login actually succeeded (backend can be flaky/shared across lanes) —
    // retry once on a visible failure rather than silently continuing on the login page.
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
      if (url.includes('/api/')) calls.push({ url, status: resp.status() });
    } catch {}
  };
  page.on('response', listener);
  return {
    calls,
    stop: () => page.off('response', listener),
  };
}

async function dismissOnboarding(page) {
  const skipBtn = page.locator('button:has-text("Skip for now")');
  if (await skipBtn.count().catch(() => 0)) {
    try {
      await skipBtn.first().click({ timeout: 2000 });
      await page.waitForTimeout(1000);
    } catch {}
  }
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

async function gotoKpiRegistry(page) {
  await page.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissOnboarding(page);
  if (page.url().includes('/results/kpi') === false) {
    await page.goto(`${BASE}/results/kpi?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }
}

async function openKpiRow(page, kpiCode) {
  const row = page.locator(`tr:has-text("${kpiCode}")`).first();
  await row.click({ timeout: 5000 });
  await page.waitForTimeout(800);
}

const main = async () => {
  const browser = await chromium.launch();

  // ================= OWNER context (maker) =================
  const ownerCtx = await newActorContext(browser, OWNER_EMAIL);
  const owner = ownerCtx.page;

  // ---------- STEP 1 ----------
  await step(1, 'Wejście do rejestru KPI z /results/kpi (real route)', 'rn-g6-user-a-owner', owner, async () => {
    await gotoKpiRegistry(owner);
    return { name: '01-registry-entry-owner' };
  });

  const KPI_CODE = 'KPI-G6-002';

  // ---------- STEP 2 — open New KPI modal ----------
  await step(2, 'Utworzenie KPI — otwarcie formularza "New KPI"', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("New KPI")').click();
    await owner.waitForTimeout(600);
    return { name: '02-new-kpi-modal-empty' };
  });

  // ---------- STEP 3 — fill + STEP 4 definition fields ----------
  await step(
    3,
    'Definicja: kod, nazwa, jednostka, geometria celu, progi, opis (kadencja/owner UI gap — patrz F2)',
    'rn-g6-user-a-owner',
    owner,
    async () => {
      await owner.locator('[data-testid="kpi-draft-code"]').fill(KPI_CODE);
      await owner.locator('[data-testid="kpi-draft-name"]').fill('Zlota sciezka KPI - czas realizacji wdrozenia');
      await owner.locator('[data-testid="kpi-draft-unit"]').fill('dni');
      await owner.locator('[data-testid="kpi-draft-geometry"]').selectOption('threshold_max');
      await owner.waitForTimeout(300);
      await owner.locator('[data-testid="kpi-draft-description"]').fill('KPI zlotej sciezki RN-G6 - dowod realnego przeplywu maker-checker end-to-end.');
      await owner.locator('[data-testid="kpi-draft-target-value"]').fill('45');
      await owner.locator('[data-testid="kpi-draft-warning-high"]').fill('60');
      await owner.locator('[data-testid="kpi-draft-critical-high"]').fill('90');
      await owner.locator('[data-testid="kpi-draft-reason"]').fill('Utworzenie wersji 1 - zlota sciezka RN-G6 (scripted run).');
      return { name: '03-new-kpi-modal-filled' };
    }
  );

  // ---------- STEP 2/3/4 SAVE (creates draft v1) ----------
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
  owner.on('response', createRespListener);
  const createEntry = await step(4, 'Zapis szkicu (Save KPI) — createKpiDraft, wersja 1', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-draft-form-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '04-kpi-created-draft-v1' };
  });
  owner.off('response', createRespListener);
  const createResp = createEntry.apiCalls.find((c) => c.url.endsWith('/api/vnext/results/kpi') && c.status < 400);
  report.ids.kpiCode = KPI_CODE;
  report.ids.kpiId = createdKpiId;
  report.notes_createStatus = createResp ? createResp.status : 'NOT FOUND — see apiErrors';
  console.log('Created kpiId:', createdKpiId);

  // ---------- STEP 5 — submit for approval ----------
  await step(5, 'Zgłoszenie wersji 1 do zatwierdzenia (Submit for approval)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('button:has-text("Submit for approval")').click();
    await owner.waitForTimeout(500);
    const reason = owner.locator('[data-testid="kpi-transition-reason"]');
    if (await reason.count().catch(() => 0)) {
      await reason.fill('Zgloszenie v1 do przegladu.');
    }
    await owner.locator('[data-testid="kpi-transition-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '05-submitted-pending-approval' };
  });

  // ================= ADMIN context (checker) =================
  const adminCtx = await newActorContext(browser, ADMIN_EMAIL);
  const admin = adminCtx.page;

  // ---------- STEP 6 — reject by second actor ----------
  await step(
    6,
    'Odrzucenie przez recenzenta (drugi aktor) — maker-checker',
    'rn-g6-user-a-admin',
    admin,
    async () => {
      await gotoKpiRegistry(admin);
      await admin.locator('button:has-text("Org")').click();
      await admin.waitForTimeout(1000);
      await openKpiRow(admin, KPI_CODE);
      await admin.locator('button:has-text("Reject")').click();
      await admin.waitForTimeout(500);
      await admin.locator('[data-testid="kpi-transition-reason"]').fill('Progi wymagaja korekty — brakuje uzasadnienia dla warning=60/critical=90 wzgledem targetu 45.');
      await admin.locator('[data-testid="kpi-transition-submit"]').click();
      await admin.waitForTimeout(1200);
      return { name: '06-rejected-by-admin' };
    }
  );

  // Try self-approval-denied negative check first (owner tries to approve their own submit before reject — skip,
  // already covered by P0-A test suite per docs; not re-tested here to save time).

  // ---------- STEP 7 — revise after rejection ----------
  await step(
    7,
    'Utworzenie kolejnej wersji roboczej po odrzuceniu (reviseDefinition) — pola SKOPIOWANE',
    'rn-g6-user-a-owner',
    owner,
    async () => {
      await gotoKpiRegistry(owner);
      await openKpiRow(owner, KPI_CODE);
      await owner.waitForTimeout(500);
      const reviseBtn = owner.locator('button:has-text("Revise and resubmit")');
      await reviseBtn.click({ timeout: 8000 });
      await owner.waitForTimeout(1200);
      return { name: '07a-revise-clicked-v2-draft' };
    }
  );

  // Confirm v2 form shows copied values (screenshot only — edit modal may auto-open)
  await step(71, 'Formularz v2 pokazuje pola skopiowane z v1 (dowod wizualny)', 'rn-g6-user-a-owner', owner, async () => {
    // If revise opened an edit modal directly, capture it; else open edit draft explicitly.
    const modalVisible = await owner.locator('dialog, [role="dialog"]').count().catch(() => 0);
    if (!modalVisible) {
      const editBtn = owner.locator('button:has-text("Edit draft")');
      if (await editBtn.count().catch(() => 0)) {
        await editBtn.click();
        await owner.waitForTimeout(700);
      }
    }
    return { name: '07b-v2-form-copied-fields' };
  });

  // Tweak + submit v2
  await step(72, 'Poprawka pola i ponowne zgłoszenie wersji 2', 'rn-g6-user-a-owner', owner, async () => {
    const descField = owner.locator('[data-testid="kpi-draft-description"]');
    if (await descField.count().catch(() => 0)) {
      const current = await descField.inputValue().catch(() => '');
      await descField.fill(current + ' [v2: threshold uzasadniony wdrozeniem etapowym]');
    }
    const saveBtn = owner.locator('[data-testid="kpi-draft-form-submit"]');
    if (await saveBtn.count().catch(() => 0)) {
      await saveBtn.click();
      await owner.waitForTimeout(1000);
    }
    // Now submit v2
    const submitBtn = owner.locator('button:has-text("Submit for approval")');
    if (await submitBtn.count().catch(() => 0)) {
      await submitBtn.click();
      await owner.waitForTimeout(500);
      const reason = owner.locator('[data-testid="kpi-transition-reason"]');
      if (await reason.count().catch(() => 0)) await reason.fill('Zgloszenie v2 po poprawkach.');
      await owner.locator('[data-testid="kpi-transition-submit"]').click();
      await owner.waitForTimeout(1200);
    }
    return { name: '07c-v2-submitted' };
  });

  // Admin approves v2 (bridge step, needed for measurements onward)
  await step(73, '[most] Zatwierdzenie wersji 2 przez recenzenta (potrzebne dla dalszych krokow)', 'rn-g6-user-a-admin', admin, async () => {
    await gotoKpiRegistry(admin);
    await admin.locator('button:has-text("Org")').click().catch(() => {});
    await admin.waitForTimeout(800);
    await openKpiRow(admin, KPI_CODE);
    const approveBtn = admin.locator('button:has-text("Approve")');
    await approveBtn.click({ timeout: 8000 });
    await admin.waitForTimeout(400);
    const reason = admin.locator('[data-testid="kpi-transition-reason"]');
    if (await reason.count().catch(() => 0)) await reason.fill('v2 wyglada poprawnie.');
    await admin.locator('[data-testid="kpi-transition-submit"]').click();
    await admin.waitForTimeout(1200);
    return { name: '07d-v2-approved' };
  });

  // Activate KPI (bridge)
  await step(74, '[most] Aktywacja KPI (wymagana zeby rejestrowac pomiary)', 'rn-g6-user-a-admin', admin, async () => {
    await gotoKpiRegistry(admin);
    await admin.waitForTimeout(800);
    await openKpiRow(admin, KPI_CODE);
    const activateBtn = admin.locator('button:has-text("Activate")');
    if (await activateBtn.count().catch(() => 0)) {
      await activateBtn.click();
      await admin.waitForTimeout(1000);
    }
    return { name: '07e-kpi-activated' };
  });

  // ================= STEP 8 — record measurement (critical, opens deviation case) =================
  await step(8, 'Zarejestrowanie pomiaru (wartosc krytyczna -> auto deviation case)', 'rn-g6-user-a-owner', owner, async () => {
    await gotoKpiRegistry(owner);
    await openKpiRow(owner, KPI_CODE);
    await owner.locator('button:has-text("Open measurements")').click({ timeout: 8000 });
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="kpi-measurements-record-cta"]').click();
    await owner.waitForTimeout(500);
    await owner.locator('[data-testid="kpi-measurement-period-start"]').fill('2026-07-01');
    await owner.locator('[data-testid="kpi-measurement-period-end"]').fill('2026-07-31');
    await owner.locator('[data-testid="kpi-measurement-actual-value"]').fill('95');
    await owner.locator('[data-testid="kpi-measurement-source"]').fill('scripted-golden-flow');
    await owner.locator('[data-testid="kpi-measurement-notes"]').fill('Krytyczne opoznienie - test golden flow.');
    await owner.locator('[data-testid="kpi-measurement-record-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '08-measurement-recorded-critical' };
  });

  // ================= STEP 9 — correct that measurement =================
  await step(9, 'Korekta pomiaru', 'rn-g6-user-a-owner', owner, async () => {
    const firstRow = owner.locator('table tbody tr').first();
    await firstRow.click({ timeout: 5000 });
    await owner.waitForTimeout(500);
    const correctBtn = owner.locator('button:has-text("Correct value"), button:has-text("Correct")');
    await correctBtn.click({ timeout: 5000 });
    await owner.waitForTimeout(500);
    await owner.locator('[data-testid="kpi-measurement-correction-value"]').fill('92');
    await owner.locator('[data-testid="kpi-measurement-correction-reason"]').fill('Sprostowanie wartosci po ponownej weryfikacji zrodla danych.');
    await owner.locator('[data-testid="kpi-measurement-correction-submit"]').click();
    await owner.waitForTimeout(1500);
    return { name: '09-measurement-corrected' };
  });

  // ================= STEP 10a — record + verify a measurement =================
  await step(101, 'Weryfikacja pomiaru', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-measurements-record-cta"]').click();
    await owner.waitForTimeout(400);
    await owner.locator('[data-testid="kpi-measurement-period-start"]').fill('2026-06-01');
    await owner.locator('[data-testid="kpi-measurement-period-end"]').fill('2026-06-30');
    await owner.locator('[data-testid="kpi-measurement-actual-value"]').fill('40');
    await owner.locator('[data-testid="kpi-measurement-source"]').fill('scripted-golden-flow');
    await owner.locator('[data-testid="kpi-measurement-record-submit"]').click();
    await owner.waitForTimeout(1200);
    const firstRow = owner.locator('table tbody tr').first();
    await firstRow.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    const verifyBtn = owner.locator('button:has-text("Verify")');
    await verifyBtn.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    const dqText = owner.locator('[data-testid="kpi-measurement-dq-text"]');
    if (await dqText.count().catch(() => 0)) await dqText.fill('Zweryfikowano zrodlowo.');
    await owner.locator('[data-testid="kpi-measurement-verify-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '10a-measurement-verified' };
  });

  // ================= STEP 10b — record + dispute a measurement =================
  await step(102, 'Spor o pomiar (Dispute)', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-measurements-record-cta"]').click();
    await owner.waitForTimeout(400);
    await owner.locator('[data-testid="kpi-measurement-period-start"]').fill('2026-05-01');
    await owner.locator('[data-testid="kpi-measurement-period-end"]').fill('2026-05-31');
    await owner.locator('[data-testid="kpi-measurement-actual-value"]').fill('200');
    await owner.locator('[data-testid="kpi-measurement-source"]').fill('scripted-golden-flow-suspect');
    await owner.locator('[data-testid="kpi-measurement-record-submit"]').click();
    await owner.waitForTimeout(1200);
    const firstRow = owner.locator('table tbody tr').first();
    await firstRow.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    const disputeBtn = owner.locator('button:has-text("Dispute")');
    await disputeBtn.click({ timeout: 5000 });
    await owner.waitForTimeout(400);
    const dqText = owner.locator('[data-testid="kpi-measurement-dq-text"]');
    if (await dqText.count().catch(() => 0)) await dqText.fill('Wartosc wyglada na blad zrodla - 200 przekracza fizyczny limit procesu.');
    await owner.locator('[data-testid="kpi-measurement-dispute-submit"]').click();
    await owner.waitForTimeout(1200);
    return { name: '10b-measurement-disputed' };
  });

  // ================= STEP 11 — open the auto-created deviation case =================
  let deviationCaseUrl = null;
  await step(11, 'Otwarcie sprawy odchylenia (auto-utworzonej przez krytyczny pomiar)', 'rn-g6-user-a-owner', owner, async () => {
    // Back to KPI tool
    const kpiId = report.ids.kpiId;
    await owner.goto(`${BASE}/results/kpi/${kpiId}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const deviationsTab = owner.locator('button:has-text("Deviations"), button:has-text("Sprawy odchyleń")');
    if (await deviationsTab.count().catch(() => 0)) {
      await deviationsTab.first().click();
      await owner.waitForTimeout(800);
    }
    const caseRow = owner.locator('[data-testid^="kpi-deviation-case-row-"]').first();
    await caseRow.click({ timeout: 8000 });
    await owner.waitForTimeout(1200);
    deviationCaseUrl = owner.url();
    report.ids.deviationCaseUrl = deviationCaseUrl;
    return { name: '11-deviation-case-opened' };
  });

  // ================= STEP 12 — root cause =================
  await step(12, 'Przyczyna zrodlowa', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-deviation-root-cause-summary"]').fill('Opoznienie dostawcy komponentow krytycznych na etapie integracji.');
    await owner.locator('[data-testid="kpi-deviation-root-cause-category"]').fill('supplier_delay');
    await owner.locator('[data-testid="kpi-deviation-submit-root-cause"]').click({ timeout: 5000 });
    await owner.waitForTimeout(1200);
    return { name: '12-root-cause-submitted' };
  });

  // ================= STEP 13 — corrective action + submit plan =================
  await step(13, 'Dzialanie korygujace i zlozenie planu', 'rn-g6-user-a-owner', owner, async () => {
    await owner.locator('[data-testid="kpi-deviation-action-title"]').fill('Eskalacja do dostawcy + plan B - dostawca zapasowy');
    await owner.locator('[data-testid="kpi-deviation-action-owner"]').fill('rn-g6-user-a-owner');
    await owner.locator('[data-testid="kpi-deviation-add-action"]').click({ timeout: 5000 });
    await owner.waitForTimeout(800);
    await owner.locator('[data-testid="kpi-deviation-submit-plan"]').click({ timeout: 5000 });
    await owner.waitForTimeout(1200);
    return { name: '13a-corrective-action-plan-submitted' };
  });

  // Plan approval — MUST be a different actor than the submitter (maker-checker)
  await step(131, '[most] Zatwierdzenie planu przez recenzenta (maker-checker)', 'rn-g6-user-a-admin', admin, async () => {
    await admin.goto(deviationCaseUrl, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(2000);
    await admin.locator('[data-testid="kpi-deviation-approve-plan"]').click({ timeout: 8000 });
    await admin.waitForTimeout(1200);
    return { name: '13b-corrective-plan-approved' };
  });

  // ================= STEP 14 — recovery observation =================
  await step(14, 'Obserwacja odbudowy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(deviationCaseUrl, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const select = owner.locator('[data-testid="kpi-deviation-recovery-measurement"]');
    const optionCount = await select.locator('option').count();
    if (optionCount > 1) {
      await select.selectOption({ index: 1 });
      await owner.locator('button:has-text("Record recovery observation")').click({ timeout: 5000 });
      await owner.waitForTimeout(1200);
    }
    return { name: '14-recovery-observation', notes: optionCount <= 1 ? 'No measurement options available for recovery link — case may still be in analysis/plan phase, not yet executing.' : '' };
  });

  // ================= STEP 15 — effectiveness verification + close =================
  await step(15, 'Weryfikacja skutecznosci i zamkniecie sprawy', 'rn-g6-user-a-owner', owner, async () => {
    await owner.reload({ waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(1500);
    const startInput = owner.locator('input[type="date"]').nth(2);
    const endInput = owner.locator('input[type="date"]').nth(3);
    if (await startInput.count().catch(() => 0)) {
      await startInput.fill('2026-08-01').catch(() => {});
      await endInput.fill('2026-08-10').catch(() => {});
    }
    const outcomeSelect = owner.locator('[data-testid="kpi-deviation-verification-outcome"]');
    if (await outcomeSelect.count().catch(() => 0)) {
      await outcomeSelect.selectOption('effective');
    }
    const submitVerifyBtn = owner.locator('[data-testid="kpi-deviation-submit-verification"]');
    if (await submitVerifyBtn.count().catch(() => 0)) {
      await submitVerifyBtn.click({ timeout: 5000 }).catch(() => {});
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
      }
    }
    return { name: '15-effectiveness-verification', notes: closed ? 'Case closed.' : 'Close button not yet enabled after verification submit — see screenshot for case state.' };
  });

  // ================= STEP 16 — scorecard: add KPI as item to existing seeded scorecard =================
  const SEED_SCORECARD_ID = 'a7a84b5c-cfae-4680-8680-a7a84bcfaea3';
  await step(16, 'Karta wynikow — dodanie KPI jako pozycji do istniejacej karty', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(`${BASE}/results/kpi/scorecards/${SEED_SCORECARD_ID}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const addBtn = owner.locator('[data-testid="kpi-scorecard-add-item-cta"]');
    if (await addBtn.count().catch(() => 0)) {
      await addBtn.click();
      await owner.waitForTimeout(500);
      // NOTE (real finding): "Add KPI to scorecard" has no picker — plain
      // text UUID paste (KpiScorecardItemDialogs.tsx own header comment
      // confirms this is intentional/known, not a script bug).
      const kpiIdField = owner.locator('[data-testid="kpi-scorecard-add-item-kpi"]');
      if (await kpiIdField.count().catch(() => 0)) {
        await kpiIdField.fill(report.ids.kpiId ?? '');
      }
      const roleSelect = owner.locator('[data-testid="kpi-scorecard-add-item-role"]');
      if (await roleSelect.count().catch(() => 0)) await roleSelect.selectOption({ index: 1 }).catch(() => {});
      await owner.locator('[data-testid="kpi-scorecard-add-item-submit"]').click({ timeout: 5000 });
      await owner.waitForTimeout(1500);
    }
    return { name: '16-scorecard-item-added' };
  });

  // ================= STEP 17 — create + publish review snapshot =================
  await step(17, 'Publikacja migawki przegladu karty wynikow', 'rn-g6-user-a-owner', owner, async () => {
    const snapshotsTab = owner.locator('button:has-text("Review snapshots"), button:has-text("Migawki przeglądu")');
    if (await snapshotsTab.count().catch(() => 0)) {
      await snapshotsTab.first().click();
      await owner.waitForTimeout(800);
    }
    const newSnapshotCta = owner.locator('[data-testid="kpi-scorecard-new-snapshot-cta"]');
    if (await newSnapshotCta.count().catch(() => 0)) {
      await newSnapshotCta.click();
      await owner.waitForTimeout(500);
      await owner.locator('[data-testid="kpi-scorecard-snapshot-reason"]').fill('Publikacja migawki - dowod golden flow.').catch(() => {});
      await owner.locator('[data-testid="kpi-scorecard-create-snapshot-submit"]').click({ timeout: 5000 });
      await owner.waitForTimeout(1500);
    }
    // Now find the created (draft) snapshot row and publish it
    const firstSnapRow = owner.locator('table tbody tr').first();
    if (await firstSnapRow.count().catch(() => 0)) {
      await firstSnapRow.click({ timeout: 5000 }).catch(() => {});
      await owner.waitForTimeout(500);
      const publishBtn = owner.locator('button:has-text("Publish")');
      if (await publishBtn.count().catch(() => 0)) {
        await publishBtn.first().click();
        await owner.waitForTimeout(500);
        await owner.locator('[data-testid="kpi-scorecard-publish-snapshot-reason"]').fill('Publikacja migawki golden flow.').catch(() => {});
        await owner.locator('[data-testid="kpi-scorecard-publish-snapshot-submit"]').click({ timeout: 5000 });
        await owner.waitForTimeout(1500);
      }
    }
    report.ids.scorecardId = SEED_SCORECARD_ID;
    return { name: '17-snapshot-published' };
  });

  // ================= STEP 18 — narrower-access reader views the snapshot =================
  const orgBCtx = await newActorContext(browser, ORGB_ADMIN_EMAIL);
  const orgBAdmin = orgBCtx.page;
  await step(18, 'Migawka pod katem czytelnika o wezszym dostepie (org B, cross-org fail-closed)', 'rn-g6-user-b-admin', orgBAdmin, async () => {
    await orgBAdmin.goto(`${BASE}/results/kpi/scorecards/${SEED_SCORECARD_ID}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await orgBAdmin.waitForTimeout(2500);
    return {
      name: '18-narrower-reader-org-b',
      notes: 'Org B admin (different organization) attempting to open org A scorecard by direct URL — expected fail-closed (0 rows / not-found), NOT same-org RESTRICTED-ACL scenario (seed data uses OPEN_ORG visibility for all org A resources, so no same-org narrower reader exists to demonstrate the finer-grained P0-C redaction path).',
    };
  });

  // ================= STEP 19 — history (expected: documented gap, GapNotice) =================
  await step(19, 'Historia / rodowod KPI', 'rn-g6-user-a-owner', owner, async () => {
    await owner.goto(`${BASE}/results/kpi/${report.ids.kpiId}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2000);
    const historyTab = owner.locator('button:has-text("History / lineage"), button:has-text("Historia")');
    if (await historyTab.count().catch(() => 0)) {
      await historyTab.first().click();
      await owner.waitForTimeout(800);
    }
    return { name: '19-history-tab' };
  });

  // ================= STEP 20a — F5 reload on KPI tool page =================
  await step(201, 'Przeladowanie strony (F5) na ekranie rekordu', 'rn-g6-user-a-owner', owner, async () => {
    await owner.reload({ waitUntil: 'domcontentloaded' });
    await owner.waitForTimeout(2500);
    return { name: '20a-f5-reload' };
  });

  // ================= STEP 20b — cold deep link in a fresh browser session =================
  const coldCtx = await newActorContext(browser, null); // no login yet — fresh session
  const cold = coldCtx.page;
  await step(202, 'Zimny deep link do rekordu (swieza sesja, bez logowania, bez przejscia przez liste)', 'rn-g6-user-a-owner (fresh session)', cold, async () => {
    await cold.goto(`${BASE}/results/kpi/${report.ids.kpiId}?${KPI_FLAG}`, { waitUntil: 'domcontentloaded' });
    await cold.waitForTimeout(2000);
    const preLoginUrl = cold.url();
    // Expect redirect to /login?redirect=... — now actually log in and confirm it lands back on the deep link.
    if (preLoginUrl.includes('/login')) {
      await cold.locator('input[type="email"], input[name="email"]').first().fill(OWNER_EMAIL);
      await cold.locator('input[type="password"]').first().fill(PASSWORD);
      await cold.locator('button:has-text("Log in")').first().click();
      await cold.waitForTimeout(3000);
    }
    return { name: '20b-cold-deeplink-post-login', notes: `pre-login URL: ${preLoginUrl}, post-login URL: ${cold.url()}` };
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== ALL STEPS DONE ===');
};

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT_DIR, 'full-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
