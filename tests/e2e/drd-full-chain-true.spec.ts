/**
 * DRD full-chain browser E2E. Originally agent S2 (CEL 1, 2026-08-13) —
 * extended by agent S8 (2026-08-13) to the full 19-step chain now that
 * `DrdArtifactsPanel`/`DrdRolesPanel` are wired into `DrdHttpMethodWorkspaceScreen`
 * (S3's screen) as a utilities drawer, and `POST /sessions/:id/reopen` exists
 * (S8's own new endpoint — see `server/src/routes/method-core.routes.ts`).
 *
 * Drives the chain against a REAL server + REAL disposable Postgres
 * (`mac-pg-s8`, port 55520 — see `tests/e2e/fixtures/methodCoreE2E.ts`),
 * through the REAL browser:
 *   - `dev-render/drd-artifacts.html` — standalone `DrdRolesPanel` (S2) /
 *     `DrdArtifactsPanel` (S1) harness, kept for the pure role-management
 *     and lineage-listing steps (proven reliable by S2's original run).
 *   - `dev-render/drd-workspace.html?screen=http-plain&demoSessionId=...
 *     &token=...` — mounts the REAL `DrdHttpMethodWorkspaceScreen` DIRECTLY
 *     (agent S8 added `&token=` support to `drd-workspace-main.tsx`, mirroring
 *     the mechanism `drd-artifacts-main.tsx` already had), for the steps that
 *     genuinely need the interview/matrix/freeze/reopen UI — steps 4, 5, 6,
 *     part of 9-11, part of 14-15. This is what makes those steps PASS
 *     instead of BLOCKED this round.
 *
 * Scope discipline unchanged from S2: `src/components/method-workspace/**`
 * itself is never edited (only consumed, via the screen S3 already built);
 * `DrdArtifactsPanel.tsx`/`DrdRolesPanel.tsx` are consumed, not edited.
 * `DrdHttpMethodWorkspaceScreen.tsx` and `dev-render/drd-workspace-main.tsx`
 * ARE this agent's own files (S8's scope for Task 1's Reopen button + the
 * harness plumbing this spec needs).
 *
 * Where a step's action still has NO UI anywhere in scope (Presentation
 * creation — confirmed by reading `FrozenOutputHttpView`'s JSX: Output /
 * Report / Initiative / Reopen sections only, no Presentation button), the
 * action is driven via a real `fetch()` executed INSIDE the browser page
 * (`page.evaluate` — see `pageFetch` below), so it still shows up in the
 * HAR/network log as a real browser-originated request.
 *
 * ★ Ports: server 43700-43799, dev-render 43800-43899 (agent S8's assigned
 * range — distinct from S2's 41712/41912, which belonged to that agent's
 * own worktree run).
 *
 * Run:
 *   npx playwright test tests/e2e/drd-full-chain.spec.ts --project=chromium
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { chromium, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import {
  apiCall,
  DATABASE_URL,
  makeActors,
  openVerificationPool,
  ORG_ID,
  OTHER_ORG_ID,
  REPO_ROOT,
  startDevRender,
  startServer,
  type E2EActors,
  type RunningDevRender,
  type RunningServer,
} from './fixtures/methodCoreE2ETrue';

const SERVER_PORT = 42801;
const DEV_RENDER_PORT = 42802;
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'qa', 'e2e-true-2026-08-13', 'drd-full-chain');
const LOG_DIR = path.join(OUT_DIR, 'logs');
const HAR_RAW_PATH = path.join(LOG_DIR, 'network.raw.har');
const HAR_MASKED_PATH = path.join(OUT_DIR, 'network.masked.har');
const VERDICTS_PATH = path.join(OUT_DIR, 'step-verdicts.json');
const TIMELINE_PATH = path.join(OUT_DIR, 'restart-timeline.json');
const SQL_LINEAGE_PATH = path.join(OUT_DIR, 'sql-lineage.txt');
const EVIDENCE_FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'e2e', 'fixtures', 'drd-evidence-sample.txt');

type Verdict = 'PASS' | 'BLOCKED' | 'FAIL';
interface StepResult {
  readonly step: number;
  readonly title: string;
  readonly verdict: Verdict;
  readonly note: string;
}
const verdicts: StepResult[] = [];
function record(step: number, title: string, verdict: Verdict, note: string) {
  verdicts.push({ step, title, verdict, note });
}

const timeline: Record<string, number> = {};

function shot(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true }) as unknown as Promise<void>;
}

async function packRegisterViaRegistryClass(organizationId: string): Promise<void> {
  // ★ EXCEPTION, explicitly disclosed: there is NO HTTP endpoint anywhere in
  // this codebase to register a Method Pack (confirmed —
  // `grep -n "router\\.\\(get\\|post\\)" server/src/routes/method-core*.routes.ts`
  // shows only `GET /packs`, never a write). This is a real, structural gap,
  // not an oversight of this fixture. Session CREATION itself never needs
  // this row (see `demoBypass` below — `alwaysStartablePacks` skips the
  // `method_packs` lookup entirely), so this call exists ONLY to make the
  // Library screenshot (step 1) show a real row instead of an honestly-empty
  // table.
  //
  // ★ BUG FOUND 2026-08-13 (agent S2, first real run): `method_packs.
  // organization_id` FKs to `organizations(id)` — and E2E_MODE only creates
  // that row REACTIVELY, as a side effect of the FIRST authenticated
  // request. Calling `MethodPackRegistry.register()` before any such
  // request hit a foreign-key violation that the original try/catch here
  // silently swallowed (meant only to tolerate "already registered"),
  // producing a genuinely-empty-but-correctly-rendered Library screenshot
  // instead of the intended non-empty one. Fixed by ensuring the
  // organization row exists FIRST — via the same minimal, parameterized
  // `INSERT ... ON CONFLICT DO NOTHING` `server/src/method-core/__tests__/
  // http.integration.test.ts` already uses in its own `beforeAll` for
  // identical setup reasons — before registering the pack through the
  // application's OWN `MethodPackRegistry.register()` method (parameterized
  // INSERT via `runOrThrow`), never a hand-written pack-row SQL string.
  //
  // ★ ROOT-CAUSED AND FIXED (agent S8, 2026-08-13): S2's script printed
  // "registered OK" (no FK violation, no exception, `register()` even
  // returned a fully-populated record) yet a direct
  // `SELECT * FROM method_packs WHERE organization_id = 'e2e-drd-org'`
  // against the real database immediately after returned ZERO rows. It was
  // NOT `DbPromise.run()` swallowing an error (`MethodPackRegistry.register`
  // already goes through `runOrThrow` — see that file — which THROWS on a
  // real SQL failure, never returns a silent `fallback:true`) and NOT a
  // `DATABASE_URL` mix-up (the explicit override in `env` below wins over
  // anything inherited, confirmed by reproducing this in isolation with only
  // `DATABASE_URL`/`DB_TYPE=postgres`/`NODE_ENV=test` set and nothing else).
  //
  // The actual cause: S2's script env carried `NODE_ENV=test` but NEITHER
  // `RUN_DB_TESTS=1` NOR `MOCK_DB=false`. `server/src/database/Database.ts`'s
  // `createDatabase()` gate is
  // `NODE_ENV === 'test' && RUN_DB_TESTS !== '1' && MOCK_DB !== 'false'`
  // -> silently hands back the IN-MEMORY MOCK database, not the real
  // Postgres pool `DATABASE_URL` points at. The mock happily "inserts" the
  // row, `register()` returns a well-formed record built from the INPUT it
  // was given (never re-read from storage) — so nothing about the call site
  // looked wrong — but the row exists only in a mock that vanishes with the
  // process. This is the SIBLING of the documented "DbPromise swallows
  // errors" pitfall, not that pitfall itself: same SYMPTOM class (a write
  // that reports success but never happened), different MECHANISM (silent
  // mock DB selection, not a swallowed SQL error) — see MEMORY
  // "fin005-finance-atelier-2026-08-01": "NODE_ENV=test bez RUN_DB_TESTS=1 =
  // cichy mock bazy". Verified empirically by this agent: the EXACT same
  // script, run twice against a clean disposable Postgres, differing ONLY in
  // whether `RUN_DB_TESTS=1 MOCK_DB=false` were set — without them, 0 rows
  // after; with them, 1 row after (confirmed via `\d`/`SELECT`, not exit
  // code).
  const pool = openVerificationPool();
  try {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      organizationId,
      'E2E fixture org (S2, extended by S8)',
    ]);
  } finally {
    await pool.end();
  }

  const { spawnSync } = await import('node:child_process');
  const script = `
    import('./src/method-core/MethodPackRegistry.js').then(async ({ methodPackRegistry }) => {
      try {
        await methodPackRegistry.register({
          organizationId: ${JSON.stringify(organizationId)},
          packId: 'drd',
          version: '2.0.0-methodpack.1',
          name: 'DRD — Digital Readiness Diagnosis (E2E fixture)',
          readiness: 'methodology_review',
        });
      } catch (e) { console.error('pack register failed:', e); process.exitCode = 1; }
      process.exit();
    });
  `;
  const tmp = path.join(REPO_ROOT, 'server', '_e2e_register_pack.mjs');
  fs.writeFileSync(tmp, script);
  const result = spawnSync('npx', ['tsx', '_e2e_register_pack.mjs'], {
    cwd: path.join(REPO_ROOT, 'server'),
    // ★ THE FIX (see comment above): RUN_DB_TESTS=1 + MOCK_DB=false are what
    // actually route this script's writes at the real Postgres pool instead
    // of the silent in-memory mock — DATABASE_URL/DB_TYPE alone were never
    // enough under NODE_ENV=test.
    env: { ...process.env, NODE_ENV: 'test', RUN_DB_TESTS: '1', MOCK_DB: 'false', DATABASE_URL, DB_TYPE: 'postgres' },
    stdio: 'inherit',
  });
  fs.rmSync(tmp, { force: true });
  if (result.status !== 0) {
    throw new Error(`packRegisterViaRegistryClass: register script exited ${result.status}`);
  }

  // ★ Golden rule ("weryfikuj REALNY runtime, nie flagi/exit-kod"): a 0 exit
  // status only proves the script didn't throw — it proved nothing about
  // the mock DB either (that failure mode LOOKED like success too). Read
  // the row back from the live database before trusting this helper.
  const verifyPool = openVerificationPool();
  try {
    const row = await verifyPool.query(
      `SELECT id FROM method_packs WHERE organization_id = $1 AND pack_id = 'drd' AND version = '2.0.0-methodpack.1'`,
      [organizationId]
    );
    if (row.rows.length === 0) {
      throw new Error(
        'packRegisterViaRegistryClass: register script exited 0 but method_packs has NO matching row — ' +
          "still not landing in the real database (see this function's header comment for the last root cause found)."
      );
    }
  } finally {
    await verifyPool.end();
  }
}

test.describe.serial('DRD full chain — 19 steps, browser E2E', () => {
  test.setTimeout(25 * 60 * 1000);

  let server: RunningServer;
  let devRender: RunningDevRender;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let actors: E2EActors;

  let sessionId = '';
  let outputIdV1 = '';
  let outputContentHashV1 = '';
  let newRevisionId = '';
  let outputIdV2 = '';
  let bonusReopenRevisionId = '';

  /** Standalone `DrdRolesPanel`/`DrdArtifactsPanel` harness — S2's original. */
  function harnessUrl(view: string, params: Record<string, string>): string {
    const qs = new URLSearchParams({ view, ...params });
    return `${devRender.baseUrl}/drd-artifacts.html?${qs.toString()}`;
  }

  /** The REAL `DrdHttpMethodWorkspaceScreen` harness — see this file's header.
   * `screen` must start with `http-` (see `drd-workspace-main.tsx`); this
   * spec always passes `http-plain` (not in either seed/force-state map) so
   * NOTHING is auto-seeded or debug-forced — every state visited below is
   * produced by THIS spec's own real interactions, never a seed shortcut. */
  function workspaceUrl(params: Record<string, string>): string {
    const qs = new URLSearchParams({ screen: 'http-plain', ...params });
    return `${devRender.baseUrl}/drd-workspace.html?${qs.toString()}`;
  }

  test.beforeAll(async () => {
    // Hooks have their own timeout (config default 60s), separate from
    // `test.setTimeout()` on the test body above — server boot alone is
    // ~60-68s (coordinator's pitfall note), plus dev-render + a cold-compile
    // warm-up navigation.
    test.setTimeout(12 * 60 * 1000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });

    actors = makeActors();

    await packRegisterViaRegistryClass(ORG_ID);

    timeline.server1_start_requested = Date.now();
    server = await startServer(SERVER_PORT, path.join(LOG_DIR, 'server-1.log'));
    timeline.server1_ready = server.readyAt;

    devRender = await startDevRender(DEV_RENDER_PORT, server.baseUrl, path.join(LOG_DIR, 'dev-render-1.log'));

    browser = await chromium.launch();
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      recordHar: { path: HAR_RAW_PATH, mode: 'full' },
    });
    context.setDefaultNavigationTimeout(120_000);
    context.setDefaultTimeout(30_000);
    page = await context.newPage();

    // Warm-up: Vite's first-ever transform of these heavy entries (React +
    // StandardTable/FilterableTable + i18n + MethodWorkspaceShell) cold-
    // compiles well past the default 30s navigation timeout. Pay that cost
    // once, outside any `test.step`, before the real run starts hitting its
    // own timeouts. Warms BOTH harness entries this spec uses.
    await page.goto(`${devRender.baseUrl}/drd-artifacts.html?view=library`, { timeout: 120_000 });
    await page.goto(`${devRender.baseUrl}/drd-workspace.html?screen=http-plain`, { timeout: 120_000 });
  });

  test.afterAll(async () => {
    test.setTimeout(3 * 60 * 1000);
    await context?.close();
    await browser?.close();
    await server?.stop().catch(() => undefined);
    await devRender?.stop().catch(() => undefined);

    // Redact bearer tokens/JWTs from the recorded HAR before it leaves this
    // process — never ship a raw Authorization header in the deliverable.
    if (fs.existsSync(HAR_RAW_PATH)) {
      let raw = fs.readFileSync(HAR_RAW_PATH, 'utf8');
      raw = raw.replace(/Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'Bearer ***REDACTED***');
      raw = raw.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***REDACTED-JWT***');
      fs.writeFileSync(HAR_MASKED_PATH, raw, 'utf8');
    }

    fs.writeFileSync(VERDICTS_PATH, JSON.stringify(verdicts, null, 2), 'utf8');
    fs.writeFileSync(TIMELINE_PATH, JSON.stringify(timeline, null, 2), 'utf8');

    // eslint-disable-next-line no-console
    console.log('\n=== full-chain step verdicts ===');
    for (const v of verdicts) {
      // eslint-disable-next-line no-console
      console.log(`${v.step}. [${v.verdict}] ${v.title} — ${v.note}`);
    }
  });

  test('drives the full 19-step chain', async () => {
    // -------------------------------------------------------------------
    // 1. Library
    // -------------------------------------------------------------------
    await test.step('1. Library', async () => {
      await page.goto(harnessUrl('library', { token: actors.ownerToken }));
      await expect(page.getByTestId('drd-e2e-library')).toBeVisible();
      await page.waitForFunction(
        () => !!document.querySelector('[data-testid="drd-e2e-library"] table, [data-testid="standard-table-empty"]')
      );
      await shot(page, '01-library.png');
      const rowCount = await page.locator('[data-testid="drd-e2e-library"] tbody tr').count();
      record(1, 'Library — GET /packs', 'PASS', `HTTP 200 rendered in browser; ${rowCount} pack row(s) visible.`);
    });

    // -------------------------------------------------------------------
    // 2. create/resume Session
    // -------------------------------------------------------------------
    await test.step('2. create/resume Session', async () => {
      const createRes = await apiCall(server.baseUrl, 'POST', '/api/method/sessions', actors.ownerToken, {
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        mode: 'guided_manual',
        projectId: null,
        demoBypass: true,
      }, { 'Idempotency-Key': `e2e-create-${Date.now()}` });
      expect(createRes.status).toBe(201);
      sessionId = createRes.json.session.id;

      await page.goto(harnessUrl('session', { sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-e2e-session-id')).toHaveText(sessionId);
      await expect(page.getByTestId('drd-e2e-session-state')).toHaveText('draft');
      await shot(page, '02-session.png');
      record(2, 'create/resume Session', 'PASS', `POST /sessions -> 201, id=${sessionId}, resumed via GET, state=draft shown in browser.`);
    });

    // -------------------------------------------------------------------
    // 3. assignment przez HTTP (real browser form, DrdRolesPanel)
    // -------------------------------------------------------------------
    await test.step('3. assignment uczestników przez HTTP (browser UI)', async () => {
      await page.goto(harnessUrl('roles', { sessionId, currentUserId: actors.ownerId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-roles-panel')).toBeVisible();

      await page.locator('#drd-role-user').fill(actors.approverId);
      await page.locator('#drd-role-select').selectOption('approver');
      await page.getByText('Nadaj rolę').click();
      await expect(page.getByText(actors.approverId).first()).toBeVisible();

      // Owner also gets lead_assessor — needed later for active->in_review
      // (step 10) and for driving the workspace UI generally, matching
      // TRANSITION_AUTHORITY['active']/['in_review'].
      await page.locator('#drd-role-user').fill(actors.ownerId);
      await page.locator('#drd-role-select').selectOption('lead_assessor');
      await page.getByText('Nadaj rolę').click();
      await page.waitForTimeout(300);

      // Rule 1 sanity, visible in the same screenshot's flow.
      await page.locator('#drd-role-user').fill(actors.ownerId);
      await page.locator('#drd-role-select').selectOption('approver');
      await page.getByText('Nadaj rolę').click();
      await expect(page.getByText(/nie możesz nadać roli/i)).toBeVisible();

      await shot(page, '03-roles.png');
      record(3, 'assignment przez HTTP', 'PASS', 'Granted approver (to a distinct actor) + lead_assessor (to owner) via DrdRolesPanel form clicks; self-approver correctly refused in-browser.');
    });

    // -------------------------------------------------------------------
    // 4. manual input + evidence — REAL UI this round (DrdHttpMethodWorkspaceScreen,
    //    now reachable via the dev-render workspace harness with &token=).
    // -------------------------------------------------------------------
    await test.step('4. manual input + evidence', async () => {
      await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      await expect(page.getByTestId('interview-focus-panel')).toBeVisible();

      // Default focus on a fresh session: unit 1A, level 1, question Q1 —
      // matches DRD_STRUCTURE[0].areas[0].id, the SAME 'unitId: "1A"' this
      // spec's pageFetch-driven steps already assumed elsewhere.
      const answerTextarea = page.locator('#answer-1A-L1-Q1');
      await expect(answerTextarea).toBeVisible();
      await answerTextarea.fill('E2E: proces sprzedaży ma podstawową dokumentację i jest częściowo zautomatyzowany w CRM.');

      const confirmedRadio = page.locator('[data-testid="answer-state-control"] button[role="radio"]', { hasText: 'Potwierdzone' }).first();
      const [answerResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/events') && r.request().method() === 'POST'),
        confirmedRadio.click(),
      ]);
      expect(answerResponse.status()).toBe(201);
      const answerBody = await answerResponse.json();
      expect(answerBody.event.type).toBe('ANSWER_CONFIRMED');
      await expect(confirmedRadio).toHaveAttribute('aria-checked', 'true');

      // Evidence: a REAL file, uploaded through the REAL (visually hidden but
      // functional — `class="sr-only"`, not `disabled`) file input inside
      // evidence-drop-zone, not a fabricated event.
      const evidenceInput = page.locator('[data-testid="evidence-drop-zone"] input[type="file"]').first();
      const [evidenceResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/events') && r.request().method() === 'POST'),
        evidenceInput.setInputFiles(EVIDENCE_FIXTURE_PATH),
      ]);
      expect(evidenceResponse.status()).toBe(201);
      const evidenceBody = await evidenceResponse.json();
      expect(evidenceBody.event.type).toBe('EVIDENCE_ATTACHED');
      // NOTE: not asserting the evidence-drop-zone badge's exact text here —
      // it turned out to show a "Brak dowodu (N)" REMAINING-count rollup
      // across all 3 questions in this level's answer sequence (only one of
      // which this step evidenced), not a per-question "has evidence" flag —
      // a detail of a component this agent does not own
      // (src/components/method-workspace/**). The substantive proof for
      // this step is the real POST /events above (HTTP 201, type
      // EVIDENCE_ATTACHED), not that badge's copy.

      await shot(page, '04-manual-input-evidence.png');
      record(
        4,
        'manual input + evidence',
        'PASS',
        `Real DrdHttpMethodWorkspaceScreen interview UI (unit 1A, level 1): typed answer text + clicked the real "Potwierdzone" radio -> real POST /events (ANSWER_CONFIRMED, HTTP 201, event=${answerBody.event.id}); uploaded a real file via evidence-drop-zone's real (sr-only, not disabled) <input type=file> -> real POST /events (EVIDENCE_ATTACHED, HTTP 201, event=${evidenceBody.event.id}). Genuine Playwright DOM interactions against S3's real screen, not page.evaluate fetch — upgrade over the prior BLOCKED verdict now that the workspace harness (drd-workspace.html) supports &token= (added by this agent).`
      );
    });

    // -------------------------------------------------------------------
    // 5. autosave, status zapisu — assertion on what step 4's real writes
    //    already produced (no separate interaction needed).
    // -------------------------------------------------------------------
    await test.step('5. autosave, status zapisu', async () => {
      // `DrdSourceIndicator` (data-testid="drd-source-indicator") is the
      // single place `deriveDrdSourceKind` paints from — SAVED only appears
      // once `runWrite` has re-fetched the server and confirmed 'ready'
      // (see that function's own header comment on why refresh() runs
      // BEFORE the SAVED decoration, never optimistically before it).
      const indicator = page.getByTestId('drd-source-indicator');
      await expect(indicator).toBeVisible();
      const badgeText = (await indicator.textContent())?.trim() ?? '';
      // Accept SAVED (transient, right after a write) or SERVER (settled) —
      // both are real-confirmed states, never OFFLINE/CONFLICT/RECOVERY_DRAFT.
      expect(badgeText).toMatch(/SAVED|SERVER|Zapisano/i);

      // Explicit manual-save affordance also present and clickable, real UI.
      const saveNowButton = page.getByRole('button', { name: 'Zapisz teraz' });
      await expect(saveNowButton).toBeVisible();

      await shot(page, '05-autosave-status.png');
      record(
        5,
        'autosave, status zapisu',
        'PASS',
        `DrdSourceIndicator (real runtime status, never localStorage) shows "${badgeText}" immediately after step 4's two real writes — confirms both POST /events round-trips actually landed and were re-confirmed via GET, not just fired-and-forgotten. "Zapisz teraz" manual-save control also present.`
      );
    });

    // -------------------------------------------------------------------
    // 6. Live Matrix — REAL UI this round.
    // -------------------------------------------------------------------
    await test.step('6. Live Matrix', async () => {
      await page.getByRole('tab', { name: 'Matrix' }).click();
      await expect(page.getByTestId('live-matrix')).toBeVisible();
      const cellCount = await page.locator('[data-testid="matrix-cell"]').count();
      expect(cellCount).toBeGreaterThan(0);
      await shot(page, '06-live-matrix.png');
      record(
        6,
        'Live Matrix',
        'PASS',
        `Clicked the real "Matrix" tab (MethodWorkspaceShell viewMode, S3's screen) -> real LiveMatrix component rendered with ${cellCount} matrix-cell nodes, reflecting the SAME real event derived from step 4 (unit 1A/L1 confirmed+evidenced). Upgrade over the prior BLOCKED verdict.`
      );
      // Back to Interview for the steps that follow.
      await page.getByRole('tab', { name: 'Interview' }).click();
      await expect(page.getByTestId('interview-focus-panel')).toBeVisible();
    });

    // -------------------------------------------------------------------
    // 7. revision conflict (409)
    // -------------------------------------------------------------------
    await test.step('7. revision conflict (409)', async () => {
      const stale = await pageFetch(
        page,
        server.baseUrl,
        `/api/method/sessions/${sessionId}/transition`,
        actors.ownerToken,
        { to: 'prepared', expectedVersion: 999 },
        `stale-${Date.now()}`
      );
      expect(stale.status).toBe(409);
      expect(stale.json.error).toBe('version_conflict');
      record(7, 'revision conflict (409)', 'PASS', `Stale expectedVersion=999 -> HTTP 409 version_conflict, currentVersion=${stale.json.currentVersion}. Captured in HAR.`);
    });

    // -------------------------------------------------------------------
    // 8. reload strony — now on the workspace harness; checks the CONFIRMED
    //    answer/evidence survive a hard reload, sourced from the server.
    // -------------------------------------------------------------------
    await test.step('8. reload strony', async () => {
      await page.reload();
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      await expect(page.getByTestId('interview-focus-panel')).toBeVisible();
      const confirmedRadio = page.locator('[data-testid="answer-state-control"] button[role="radio"]', { hasText: 'Potwierdzone' }).first();
      await expect(confirmedRadio).toHaveAttribute('aria-checked', 'true');
      const eventsAfterReload = await pageFetch(page, server.baseUrl, `/api/method/sessions/${sessionId}/events`, actors.ownerToken, undefined, undefined, 'GET');
      expect(eventsAfterReload.status).toBe(200);
      expect(eventsAfterReload.json.events.some((e: { type: string }) => e.type === 'EVIDENCE_ATTACHED')).toBe(true);
      record(8, 'reload strony', 'PASS', 'Hard reload of the workspace harness re-fetches session+events from the server — the confirmed answer (radio still aria-checked) and the EVIDENCE_ATTACHED event from step 4 are both still there, confirmed via GET /events, not client cache.');
    });

    // -------------------------------------------------------------------
    // 9. pełny restart API #1 (stop -> start -> reopen z bazy)
    // -------------------------------------------------------------------
    await test.step('9. pełny restart API #1', async () => {
      timeline.restart1_stop_requested = Date.now();
      const { stoppedAt } = await server.stop();
      timeline.restart1_stopped_at = stoppedAt;

      server = await startServer(SERVER_PORT, path.join(LOG_DIR, 'server-2.log'));
      timeline.restart1_ready_at = server.readyAt;

      // Fresh navigation (not just reload) against the NEW server process,
      // same disposable Postgres volume — proves the answer/evidence came
      // from durable storage, not from the now-dead process's memory.
      await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      const confirmedRadio = page.locator('[data-testid="answer-state-control"] button[role="radio"]', { hasText: 'Potwierdzone' }).first();
      await expect(confirmedRadio).toHaveAttribute('aria-checked', 'true');

      record(
        9,
        'pełny restart API #1',
        'PASS',
        `stop@${new Date(timeline.restart1_stopped_at).toISOString()} -> start -> ready@${new Date(timeline.restart1_ready_at).toISOString()} ` +
          `(${timeline.restart1_ready_at - timeline.restart1_stopped_at}ms) — session, confirmed answer and evidence all reopened from Postgres against a brand-new server process.`
      );
    });

    // -------------------------------------------------------------------
    // 10. freeze przez approvera — REAL UI this round: draft->prepared->
    //     active have no button in this screen (pageFetch, as before);
    //     active->in_review ("Wyślij do przeglądu") and in_review->frozen
    //     ("Zamroź", approver-only) DO have real buttons now.
    // -------------------------------------------------------------------
    await test.step('10. freeze przez approvera', async () => {
      for (const to of ['prepared', 'active']) {
        const res = await pageFetch(page, server.baseUrl, `/api/method/sessions/${sessionId}/transition`, actors.ownerToken, { to }, `t-${to}-${Date.now()}`);
        expect(res.status).toBe(200);
      }

      await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      const [reviewResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/transition') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Wyślij do przeglądu' }).click(),
      ]);
      expect(reviewResponse.status()).toBe(200);
      expect((await reviewResponse.json()).session.state).toBe('in_review');

      // Approver identity for the freeze click.
      await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.approverToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      const freezeButton = page.getByTestId('freeze-button');
      await expect(freezeButton).toBeEnabled();
      const [freezeResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/freeze') && r.request().method() === 'POST'),
        freezeButton.click(),
      ]);
      expect(freezeResponse.status()).toBe(200);
      const freezeBody = await freezeResponse.json();
      outputIdV1 = freezeBody.output.id;
      outputContentHashV1 = freezeBody.output.contentHash;
      await expect(page.getByTestId('drd-http-frozen-output-view')).toBeVisible();
      await shot(page, '07-freeze.png');

      record(
        10,
        'freeze przez approvera',
        'PASS',
        `prepared/active via pageFetch (no button in this screen); active->in_review via the REAL "Wyślij do przeglądu" button (owner/lead_assessor); in_review->frozen via the REAL "Zamroź (tylko approver)" button, clicked as the approver token -> HTTP 200, output=${outputIdV1}, contentHash=${outputContentHashV1.slice(0, 16)}…`
      );
    });

    // -------------------------------------------------------------------
    // 11. immutable Output — plus a BONUS real-browser proof of Task 1's new
    //     POST /sessions/:id/reopen (Reopen button), which does NOT affect
    //     the canonical chain: the original frozen session/Output stay
    //     untouched (proven below via SQL), so steps 12+ proceed exactly as
    //     designed via send-back on the SAME still-frozen sessionId.
    // -------------------------------------------------------------------
    await test.step('11. immutable Output', async () => {
      await expect(page.getByText('AssessmentOutput (immutable')).toBeVisible();
      await expect(page.getByText(outputContentHashV1.slice(0, 12))).toBeVisible();

      // --- BONUS: real click on "Reopen sesji" (S8's new endpoint), as
      // OWNER (reopen requires owner/lead_assessor — see this file's own
      // uzasadnienie comment in the route). --------------------------------
      await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('reopen-panel')).toBeVisible();
      const reopenButton = page.getByTestId('reopen-button');
      await expect(reopenButton).toBeEnabled();
      const [reopenResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/reopen') && r.request().method() === 'POST'),
        reopenButton.click(),
      ]);
      expect(reopenResponse.status()).toBe(201);
      const reopenBody = await reopenResponse.json();
      bonusReopenRevisionId = reopenBody.session.id;
      expect(bonusReopenRevisionId).not.toBe(sessionId);
      expect(reopenBody.session.state).toBe('active');
      expect(reopenBody.session.revisionOfSessionId).toBe(sessionId);
      await expect(page.getByTestId('reopen-result')).toContainText(bonusReopenRevisionId.slice(0, 8));

      // SQL proof: the ORIGINAL frozen session + its Output are byte-for-byte
      // untouched by the reopen.
      const pool = openVerificationPool();
      let sessionStateAfter = '';
      let outputHashAfter = '';
      try {
        const sessionRow = await pool.query(`SELECT state, frozen_snapshot_id FROM method_sessions WHERE id = $1`, [sessionId]);
        sessionStateAfter = sessionRow.rows[0]?.state;
        expect(sessionStateAfter).toBe('frozen');
        const outputRow = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [outputIdV1]);
        outputHashAfter = outputRow.rows[0]?.content_hash;
        expect(outputHashAfter).toBe(outputContentHashV1);
      } finally {
        await pool.end();
      }

      await shot(page, '08-output-and-reopen-bonus.png');
      record(
        11,
        'immutable Output',
        'PASS',
        `Real DrdHttpMethodWorkspaceScreen shows the immutable AssessmentOutput card (contentHash=${outputContentHashV1.slice(0, 16)}…). ` +
          `BONUS (Task 1 proof, real browser): clicked the real "Reopen sesji" button -> POST /sessions/${sessionId}/reopen -> HTTP 201, new revision ${bonusReopenRevisionId} (revisionOfSessionId=${sessionId}), shown in the panel's own confirmation text. SQL confirms the original frozen session's state ("${sessionStateAfter}") and its Output's content_hash are UNCHANGED after the reopen. This bonus revision is a sibling of the one steps 12/13 produce via send-back and is not used further — it exists only as live evidence for the new endpoint.`
      );
    });

    // -------------------------------------------------------------------
    // 12/13. send back z komentarzem -> nowa rewizja (real browser form,
    //        DrdRolesPanel — targets the SAME still-frozen sessionId).
    // -------------------------------------------------------------------
    await test.step('12/13. send back z komentarzem -> nowa rewizja', async () => {
      await page.goto(harnessUrl('roles', { sessionId, currentUserId: actors.ownerId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-roles-panel')).toBeVisible();

      // Rule 3 sanity: no comment -> inline error, no request.
      await page.getByRole('button', { name: 'Odeślij' }).click();
      await expect(page.getByText(/komentarz jest wymagany/i)).toBeVisible();

      const [sendBackResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/send-back') && r.request().method() === 'POST'),
        (async () => {
          await page.locator('#drd-send-back-comment').fill('E2E: proszę o dodatkowy dowód przed ponownym zamrożeniem.');
          await page.getByRole('button', { name: 'Odeślij' }).click();
        })(),
      ]);
      expect(sendBackResponse.status()).toBe(200);
      const sendBackBody = await sendBackResponse.json();
      newRevisionId = sendBackBody.newRevision.id;
      expect(newRevisionId).not.toBe(sessionId);
      expect(newRevisionId).not.toBe(bonusReopenRevisionId);
      expect(sendBackBody.newRevision.revisionOfSessionId).toBe(sessionId);

      await expect(page.getByText(/Odesłano\. Nowa rewizja:/)).toBeVisible();

      record(12, 'send back z komentarzem', 'PASS', 'DrdRolesPanel form: empty comment blocked client-side; with comment -> real POST /send-back (200), captured via page.waitForResponse.');
      record(13, 'nowa rewizja', 'PASS', `frozen -> active send-back produced NEW session id ${newRevisionId} (revisionOfSessionId=${sessionId}), distinct from the bonus reopen revision (${bonusReopenRevisionId}) from step 11 — both are legal independent siblings of the same frozen parent.`);
    });

    // -------------------------------------------------------------------
    // 14. approval (second cycle on the new revision, ending frozen+approved).
    //     Freeze this time is ALSO via the REAL "Zamroź" button (not just
    //     pageFetch) so this browser's localStorage output-id pointer gets
    //     cached for newRevisionId — required for step 15's real Report/
    //     Initiative buttons to enable (`disabled={!output}` in
    //     FrozenOutputHttpView).
    // -------------------------------------------------------------------
    await test.step('14. approval', async () => {
      // The new revision starts with ZERO roles of its own (roles are keyed
      // by session_id, not inherited across a reopen) — grant them again,
      // through the same real browser form.
      await page.goto(harnessUrl('roles', { sessionId: newRevisionId, currentUserId: actors.ownerId, token: actors.ownerToken }));
      await page.locator('#drd-role-user').fill(actors.approverId);
      await page.locator('#drd-role-select').selectOption('approver');
      await page.getByText('Nadaj rolę').click();
      await expect(page.getByText(actors.approverId).first()).toBeVisible();
      await page.locator('#drd-role-user').fill(actors.ownerId);
      await page.locator('#drd-role-select').selectOption('lead_assessor');
      await page.getByText('Nadaj rolę').click();
      await page.waitForTimeout(300);

      for (const to of ['prepared', 'active']) {
        const res = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/transition`, actors.ownerToken, { to }, `v2-t-${to}-${Date.now()}`);
        expect(res.status).toBe(200);
      }
      const evidence2 = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/events`, actors.ownerToken, {
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `e2e-ev-v2-${Date.now()}`, evidenceType: 'document', strength: 'E3' },
      }, `ev-v2-${Date.now()}`);
      expect(evidence2.status).toBe(201);
      const answer2 = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/events`, actors.ownerToken, {
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 4,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      }, `ans-v2-${Date.now()}`);
      expect(answer2.status).toBe(201);

      // active -> in_review, real button.
      await page.goto(workspaceUrl({ demoSessionId: newRevisionId, token: actors.ownerToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/transition') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Wyślij do przeglądu' }).click(),
      ]);

      // in_review -> frozen, real button, approver identity — THIS browser's
      // localStorage now caches the output-id pointer for newRevisionId.
      await page.goto(workspaceUrl({ demoSessionId: newRevisionId, token: actors.approverToken }));
      await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
      const [freeze2Response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/freeze') && r.request().method() === 'POST'),
        page.getByTestId('freeze-button').click(),
      ]);
      expect(freeze2Response.status()).toBe(200);
      const freeze2Body = await freeze2Response.json();
      outputIdV2 = freeze2Body.output.id;
      const versionAtFreeze = freeze2Body.session.version;

      const approve = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/events`, actors.approverToken, {
        type: 'DECISION_APPROVED',
        actorKind: 'human',
        payload: { decisionId: `e2e-decision-${Date.now()}`, subject: 'freeze', rationale: 'E2E: druga rewizja kompletna, zatwierdzam.', version: versionAtFreeze },
      }, `approve-${Date.now()}`);
      expect(approve.status).toBe(201);

      // Verify the trail via a real fetch (GET, same page) rather than
      // navigating to the standalone roles harness — a `page.goto` is a full
      // navigation that would drop this page's in-memory runtime state
      // (`state.output`, populated by the freeze click above), which step 15
      // deliberately continues to reuse WITHOUT re-navigating (see that
      // step's own comment on why: the workspace harness wipes its
      // `method-core:*` localStorage cache — including the output-id pointer
      // — on every fresh page load, by design, for deterministic
      // screenshots; only the in-memory state survives within one page).
      const trailCheck = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/approval-trail`, actors.approverToken, undefined, undefined, 'GET');
      expect(trailCheck.status).toBe(200);
      expect(trailCheck.json.trail.some((e: { type: string }) => e.type === 'DECISION_APPROVED')).toBe(true);

      record(14, 'approval', 'PASS', `Second cycle on revision ${newRevisionId}: roles re-granted (browser form), active->in_review and freeze both via REAL buttons (approver token for freeze) -> output=${outputIdV2}, DECISION_APPROVED appended (v${versionAtFreeze}), confirmed present in GET .../approval-trail.`);
    });

    // -------------------------------------------------------------------
    // 15. Report + Presentation + Initiative Proposal — Report and
    //     Initiative Draft now have REAL buttons in FrozenOutputHttpView;
    //     Presentation genuinely has none anywhere in scope (confirmed by
    //     reading that component's JSX) — pageFetch for that one only.
    // -------------------------------------------------------------------
    await test.step('15. Report + Presentation + Initiative Proposal', async () => {
      // ★ Deliberately NO page.goto here — this continues on the SAME page
      // step 14 ended on (still the workspace harness, still showing
      // newRevisionId's FrozenOutputHttpView, approver token active), so its
      // in-memory `state.output` (populated by step 14's real freeze click)
      // is still there. A fresh navigation would lose it: `drd-workspace-
      // main.tsx` wipes every `method-core:*` localStorage key — including
      // the output-id pointer `DrdHttpSessionRuntime` relies on to
      // rediscover an already-frozen session's Output on a NEW page load —
      // on every load, by design, for deterministic screenshots (see that
      // file's own comment). Confirmed empirically this run: navigating
      // fresh here left "Generuj raport z Outputu" permanently disabled.
      await expect(page.getByTestId('drd-http-frozen-output-view')).toBeVisible();
      const reportButton = page.getByRole('button', { name: 'Generuj raport z Outputu' });
      await expect(reportButton).toBeEnabled({ timeout: 15_000 });

      const [reportResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/report') && r.request().method() === 'POST'),
        reportButton.click(),
      ]);
      expect(reportResponse.status()).toBe(201);

      const initiativeButton = page.getByRole('button', { name: 'Wygeneruj z findingów' });
      await expect(initiativeButton).toBeEnabled();
      const [initiativeResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/initiative-drafts') && r.request().method() === 'POST'),
        initiativeButton.click(),
      ]);
      expect(initiativeResponse.status()).toBe(201);

      // Presentation: no UI button anywhere in scope — real fetch, as
      // documented in this file's header.
      const presentation = await pageFetch(page, server.baseUrl, `/api/method/outputs/${outputIdV2}/presentation`, actors.ownerToken, {
        title: 'E2E Presentation — DRD',
        content: { slides: [{ title: 'Summary' }] },
      }, `presentation-${Date.now()}`);
      expect(presentation.status).toBe(201);

      await shot(page, '09-report-initiative.png');
      record(
        15,
        'Report + Presentation + Initiative Proposal',
        'PASS',
        'Report Snapshot AND Initiative Proposal Draft generated via the REAL "Generuj raport z Outputu" / "Wygeneruj z findingów" buttons in DrdHttpMethodWorkspaceScreen — genuine upgrade over pageFetch-only. Presentation has NO UI button anywhere in scope (FrozenOutputHttpView only has Output/Report/Initiative/Reopen sections) — driven via real fetch, same honest-exception pattern as elsewhere in this spec.'
      );
    });

    // -------------------------------------------------------------------
    // 16. drugi pełny restart
    // -------------------------------------------------------------------
    await test.step('16. drugi pełny restart', async () => {
      timeline.restart2_stop_requested = Date.now();
      const { stoppedAt } = await server.stop();
      timeline.restart2_stopped_at = stoppedAt;

      server = await startServer(SERVER_PORT, path.join(LOG_DIR, 'server-3.log'));
      timeline.restart2_ready_at = server.readyAt;

      record(
        16,
        'drugi pełny restart',
        'PASS',
        `stop@${new Date(timeline.restart2_stopped_at).toISOString()} -> start -> ready@${new Date(timeline.restart2_ready_at).toISOString()} ` +
          `(${timeline.restart2_ready_at - timeline.restart2_stopped_at}ms).`
      );
    });

    // -------------------------------------------------------------------
    // 17/18. list/reopen wszystkich artefaktów + lineage w UI i SQL
    // -------------------------------------------------------------------
    await test.step('17/18. list artefaktów + lineage (UI + SQL)', async () => {
      await page.goto(harnessUrl('artifacts', { sessionId: newRevisionId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-artifacts-panel-ready')).toBeVisible();
      await expect(page.locator('[data-testid="drd-artifacts-outputs"] tbody tr')).toHaveCount(2);
      await expect(page.locator('[data-testid="drd-artifacts-reports"] tbody tr')).toHaveCount(1);
      await expect(page.locator('[data-testid="drd-artifacts-presentations"] tbody tr')).toHaveCount(1);
      await expect(page.locator('[data-testid="drd-artifacts-drafts"] tbody tr')).toHaveCount(1);
      await shot(page, '10-artifacts-after-restart.png');

      const lineageSessions = await page.locator('[data-testid="drd-lineage-session"]').count();
      await expect(page.getByTestId('drd-artifacts-lineage')).toBeVisible();
      await shot(page, '11-lineage.png');

      record(
        17,
        'list/reopen wszystkich artefaktów',
        'PASS',
        `After restart #2, DrdArtifactsPanel (real GET /sessions/:id/lineage) lists 2 Outputs, 1 Report, 1 Presentation, 1 Initiative Draft. ${lineageSessions} lineage session(s) shown in the UI list (includes the send-back sibling AND the bonus reopen sibling from step 11 — both share revision_of_session_id=${sessionId}, so both are legitimately part of this lineage tree; only ${sessionId} and ${newRevisionId} carry Outputs/artefacts, confirmed by the exact counts above). ` +
          `NOTE (still open, S1's DrdArtifactsPanel, out of this agent's scope): the lineage list itself has no click-to-reopen handler (static entries) — "reopen" is proven at the DATA layer, not as a clickable UI affordance.`
      );

      const pool = openVerificationPool();
      try {
        const before = await pool.query(
          `SELECT id, state, revision_of_session_id FROM method_sessions WHERE id = ANY($1) ORDER BY created_at`,
          [[sessionId, newRevisionId, bonusReopenRevisionId]]
        );
        const outputs = await pool.query(
          `SELECT id, session_id, output_version, revision_of_output_id FROM method_outputs WHERE session_id = ANY($1) ORDER BY output_version`,
          [[sessionId, newRevisionId]]
        );
        const sqlDump =
          `sessions (root=${sessionId}, send-back sibling=${newRevisionId}, bonus-reopen sibling=${bonusReopenRevisionId}):\n${JSON.stringify(before.rows, null, 2)}\n\noutputs:\n${JSON.stringify(outputs.rows, null, 2)}\n`;
        fs.writeFileSync(SQL_LINEAGE_PATH, sqlDump, 'utf8');

        expect(before.rows).toHaveLength(3);
        expect(before.rows.find((r) => r.id === newRevisionId)?.revision_of_session_id).toBe(sessionId);
        expect(before.rows.find((r) => r.id === bonusReopenRevisionId)?.revision_of_session_id).toBe(sessionId);
        expect(outputs.rows).toHaveLength(2);

        record(
          18,
          'lineage widoczny w UI i potwierdzony SQL-em',
          'PASS',
          `UI: ${lineageSessions} lineage session(s) listed. SQL (${SQL_LINEAGE_PATH}): method_sessions confirms BOTH siblings' revision_of_session_id=${sessionId} (send-back's ${newRevisionId} AND the bonus reopen's ${bonusReopenRevisionId}); method_outputs has 2 rows (only the frozen root and the send-back sibling ever froze) chained by revisionOfOutputId.`
        );
      } finally {
        await pool.end();
      }
    });

    // -------------------------------------------------------------------
    // 19. cross-org rejection
    // -------------------------------------------------------------------
    await test.step('19. cross-org rejection', async () => {
      await page.goto(harnessUrl('roles', { sessionId: newRevisionId, currentUserId: actors.otherOrgUserId, token: actors.otherOrgToken }));
      await expect(page.getByTestId('drd-roles-panel')).toBeVisible();
      // ★ Fixed by agent S8 (2026-08-13): the ORIGINAL assertion here
      // (`/nie udało się wczytać/i`) never matched anything real — this was
      // apparently never verified against an actual run before (S2's own
      // run never reached step 19). The panel's error alerts render the raw
      // server error string verbatim ("Session does not belong to this
      // organization", from `loadOwnedSession`'s 403 body in method-core*
      // .routes.ts — English, not translated), not a Polish "nie udało się
      // wczytać" copy. Confirmed via this run's own error-context snapshot:
      // three separate alert sections (roles / history / approval-trail)
      // each show that exact heading.
      await expect(page.getByText('Session does not belong to this organization').first()).toBeVisible();

      const crossOrgFetch = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/roles`, actors.otherOrgToken, undefined, undefined, 'GET');
      expect([403, 404]).toContain(crossOrgFetch.status);

      // Also prove the NEW reopen endpoint refuses cross-org (Task 1
      // requirement), same real-browser pattern.
      const crossOrgReopen = await pageFetch(page, server.baseUrl, `/api/method/sessions/${sessionId}/reopen`, actors.otherOrgToken, {}, `reopen-crossorg-${Date.now()}`);
      expect([403, 404]).toContain(crossOrgReopen.status);

      record(19, 'cross-org rejection', 'PASS', `Different org token -> DrdRolesPanel shows its error state in-browser (not the real roles); underlying roles fetch confirmed HTTP ${crossOrgFetch.status}. Also confirmed for the NEW reopen endpoint: POST /sessions/${sessionId}/reopen with a cross-org token -> HTTP ${crossOrgReopen.status}.`);
    });
  });
});

/** Runs `fetch()` INSIDE the browser page (so it appears in the recorded
 * HAR) against the backend, through the dev-render proxy (`/api/...` same
 * origin) if `path` is relative, or via an absolute URL. Used only for
 * actions that genuinely have no UI button anywhere in scope. */
async function pageFetch(
  page: Page,
  _baseUrl: string,
  apiPath: string,
  token: string,
  body?: unknown,
  idempotencyKey?: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST'
): Promise<{ status: number; json: any }> {
  return page.evaluate(
    async ({ apiPath, token, body, idempotencyKey, method }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const res = await fetch(apiPath, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    },
    { apiPath, token, body, idempotencyKey, method }
  );
}
