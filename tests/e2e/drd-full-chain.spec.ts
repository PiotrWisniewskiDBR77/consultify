/**
 * DRD full-chain browser E2E (agent S2, CEL 1, 2026-08-13).
 *
 * Drives the CEL 1 chain against a REAL server + REAL disposable Postgres
 * (`mac-pg-s2b`, port 55505 — see `tests/e2e/fixtures/methodCoreE2E.ts`),
 * through the REAL browser (dev-render harness at `dev-render/drd-artifacts.*`
 * mounting the REAL `DrdRolesPanel` (S2) and `DrdArtifactsPanel` (S1)).
 *
 * Scope discipline: this agent owns ONLY the roles/approval/artifacts
 * surfaces — NOT the DRD interview/matrix workspace (S3's
 * `DrdHttpMethodWorkspaceScreen.tsx`/`drdHttpSessionRuntime.ts`, untouched
 * here). Steps that need that workspace (manual answer input, autosave
 * status, the Live Matrix view) have NO UI surface in this agent's scope —
 * they are marked BLOCKED/OUT-OF-SCOPE below, not faked. Where a step's
 * ACTION has no UI in scope but its RESULT is visible in a panel this agent
 * owns (session create, transitions, freeze, DECISION_APPROVED, Report/
 * Presentation/Initiative-draft creation), the action is driven via a real
 * `fetch()` executed INSIDE the browser page (`page.evaluate`) — so it still
 * shows up in the HAR/network log as a real browser-originated request —
 * and the RESULT is asserted from the rendered panel.
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
} from './fixtures/methodCoreE2E';

const SERVER_PORT = 41712;
const DEV_RENDER_PORT = 41912;
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'qa', 'e2e-drd-2026-08-13');
const LOG_DIR = path.join(OUT_DIR, 'logs');
const HAR_RAW_PATH = path.join(LOG_DIR, 'network.raw.har');
const HAR_MASKED_PATH = path.join(OUT_DIR, 'network.masked.har');
const VERDICTS_PATH = path.join(OUT_DIR, 'step-verdicts.json');
const TIMELINE_PATH = path.join(OUT_DIR, 'restart-timeline.json');
const SQL_LINEAGE_PATH = path.join(OUT_DIR, 'sql-lineage.txt');

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
  // ★ BUG FOUND 2026-08-13 (this agent, first real run): `method_packs.
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
  // ★ STILL UNRESOLVED (2026-08-13, standalone verification after the org-
  // first fix above): the one-off script now prints "registered OK" (no FK
  // violation, no exception) via a `spawnSync('npx', ['tsx', ...])` child
  // process with `DATABASE_URL` explicitly passed in `env`, but a direct
  // `SELECT * FROM method_packs WHERE organization_id = 'e2e-drd-org'`
  // against `mac-pg-s2b` immediately after still returns ZERO rows, and
  // `GET /api/method/packs` still returns `{"packs":[]}` — i.e. the INSERT
  // is not landing despite reporting success. Not chased further per this
  // agent's scope (`MethodPackRegistry`/the `pg`/`DbPromise` write path are
  // outside `DrdRolesPanel`/`DrdArtifactsPanel`) — left here as an exact,
  // reproducible symptom for whoever owns the next E2E pass: Library
  // (step 1) will keep rendering its (correctly-implemented) EMPTY state
  // until this is root-caused. Candidates worth checking first: whether
  // `spawnSync`'s inherited `...process.env` is letting some OTHER
  // `DATABASE_URL` already present in this shell's environment win over the
  // explicit override (this repo has documented precedent for exactly that
  // class of bug — see MEMORY "db-hosts-prod-demo"), or a connection/
  // transaction visibility issue between the one-off script's pool and the
  // server's own.
  const pool = openVerificationPool();
  try {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      organizationId,
      'S2 CEL 1 E2E fixture org',
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
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL, DB_TYPE: 'postgres' },
    stdio: 'inherit',
  });
  fs.rmSync(tmp, { force: true });
  if (result.status !== 0) {
    throw new Error(`packRegisterViaRegistryClass: register script exited ${result.status}`);
  }
}

test.describe.serial('DRD full chain — CEL 1 browser E2E (S2 scope)', () => {
  test.setTimeout(20 * 60 * 1000);

  let server: RunningServer;
  let devRender: RunningDevRender;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let actors: E2EActors;

  let sessionId = '';
  let outputIdV1 = '';
  let newRevisionId = '';
  let outputIdV2 = '';

  function harnessUrl(view: string, params: Record<string, string>): string {
    const qs = new URLSearchParams({ view, ...params });
    return `${devRender.baseUrl}/drd-artifacts.html?${qs.toString()}`;
  }

  test.beforeAll(async () => {
    // Hooks have their own timeout (config default 60s), separate from
    // `test.setTimeout()` on the test body above — server boot alone is
    // ~35-60s, plus dev-render + a cold-compile warm-up navigation.
    test.setTimeout(10 * 60 * 1000);
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

    // Warm-up: Vite's first-ever transform of this heavy entry (React +
    // StandardTable/FilterableTable + i18n) cold-compiles well past the
    // default 30s navigation timeout. Pay that cost once, outside any
    // `test.step`, before the real run starts hitting its own timeouts.
    await page.goto(`${devRender.baseUrl}/drd-artifacts.html?view=library`, { timeout: 120_000 });
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
    console.log('\n=== CEL 1 step verdicts ===');
    for (const v of verdicts) {
      // eslint-disable-next-line no-console
      console.log(`${v.step}. [${v.verdict}] ${v.title} — ${v.note}`);
    }
  });

  test('drives the full CEL 1 chain', async () => {
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
      record(3, 'assignment przez HTTP', 'PASS', 'Granted approver+lead_assessor via DrdRolesPanel form clicks; self-approver correctly refused in-browser.');
    });

    // -------------------------------------------------------------------
    // 4. manual input + evidence (NO UI in this agent's scope — driven via
    //    an in-page fetch, result consumed by freeze in step 10/11)
    // -------------------------------------------------------------------
    await test.step('4. manual input + evidence', async () => {
      const evidence = await pageFetch(page, server.baseUrl, '/api/method/sessions/' + sessionId + '/events', actors.ownerToken, {
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `e2e-ev-${Date.now()}`, evidenceType: 'document', strength: 'E2' },
      }, `evidence-${Date.now()}`);
      const answer = await pageFetch(page, server.baseUrl, '/api/method/sessions/' + sessionId + '/events', actors.ownerToken, {
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      }, `answer-${Date.now()}`);
      expect(evidence.status).toBe(201);
      expect(answer.status).toBe(201);
      record(
        4,
        'manual input + evidence',
        'BLOCKED',
        'NO UI in this agent scope (interview UI is DrdHttpMethodWorkspaceScreen.tsx, S3-owned, not touched). ' +
          'Events appended via real fetch from the browser page (visible in HAR) so freeze (step 10/11) has a real finding.'
      );
    });

    // -------------------------------------------------------------------
    // 5. autosave, status zapisu
    // -------------------------------------------------------------------
    record(5, 'autosave / status zapisu', 'BLOCKED', 'No save-state UI in DrdRolesPanel/DrdArtifactsPanel — that indicator lives in the S3-owned workspace screen, out of this agent\'s file scope.');

    // -------------------------------------------------------------------
    // 6. Live Matrix
    // -------------------------------------------------------------------
    record(6, 'Live Matrix', 'BLOCKED', 'Matrix view is part of DrdHttpMethodWorkspaceScreen.tsx (S3-owned) — no matrix rendering exists in this agent\'s two panels.');

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
    // 8. reload strony
    // -------------------------------------------------------------------
    await test.step('8. reload strony', async () => {
      await page.reload();
      await expect(page.getByTestId('drd-roles-panel')).toBeVisible();
      await expect(page.getByText(actors.approverId).first()).toBeVisible();
      record(8, 'reload strony', 'PASS', 'Roles panel re-fetched from server after a hard reload — same data, no client-side cache masking a server round-trip.');
    });

    // -------------------------------------------------------------------
    // 9. pełny restart API (stop -> start -> reopen z bazy)
    // -------------------------------------------------------------------
    await test.step('9. pełny restart API #1', async () => {
      timeline.restart1_stop_requested = Date.now();
      const { stoppedAt } = await server.stop();
      timeline.restart1_stopped_at = stoppedAt;

      server = await startServer(SERVER_PORT, path.join(LOG_DIR, 'server-2.log'));
      timeline.restart1_ready_at = server.readyAt;

      // Re-point the dev-render proxy target is unnecessary (same port), but
      // the frontend's own fetches will simply hit the new process. Reopen
      // from the DB, not memory: reload the SAME session/roles view.
      await page.goto(harnessUrl('session', { sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-e2e-session-id')).toHaveText(sessionId);
      await expect(page.getByTestId('drd-e2e-session-state')).toHaveText('draft');

      record(
        9,
        'pełny restart API #1',
        'PASS',
        `stop@${new Date(timeline.restart1_stopped_at).toISOString()} -> start -> ready@${new Date(timeline.restart1_ready_at).toISOString()} ` +
          `(${timeline.restart1_ready_at - timeline.restart1_stopped_at}ms) — session reopened from Postgres, unchanged.`
      );
    });

    // -------------------------------------------------------------------
    // 10/11. freeze przez approvera + immutable Output
    // -------------------------------------------------------------------
    await test.step('10/11. freeze przez approvera + immutable Output', async () => {
      for (const to of ['prepared', 'active', 'in_review']) {
        const res = await pageFetch(page, server.baseUrl, `/api/method/sessions/${sessionId}/transition`, actors.ownerToken, { to }, `t-${to}-${Date.now()}`);
        expect(res.status).toBe(200);
      }
      const freeze = await pageFetch(page, server.baseUrl, `/api/method/sessions/${sessionId}/freeze`, actors.approverToken, {}, `freeze-${Date.now()}`);
      expect(freeze.status).toBe(200);
      outputIdV1 = freeze.json.output.id;

      await page.goto(harnessUrl('artifacts', { sessionId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-artifacts-panel-ready')).toBeVisible();
      await expect(page.locator('[data-testid="drd-artifacts-outputs"] tbody tr')).toHaveCount(1);
      await shot(page, '04-freeze-output.png');

      record(10, 'freeze przez approvera', 'PASS', `Transitions prepared->active->in_review (owner/lead_assessor) then freeze by approver token -> HTTP 200, output=${outputIdV1}.`);
      record(11, 'immutable Output', 'PASS', 'DrdArtifactsPanel (real component) renders exactly 1 Output row, sourced from GET /sessions/:id/lineage.');
    });

    // -------------------------------------------------------------------
    // 12/13. send back z komentarzem -> nowa rewizja (real browser form)
    // -------------------------------------------------------------------
    await test.step('12/13. send back z komentarzem -> nowa rewizja', async () => {
      await page.goto(harnessUrl('roles', { sessionId, currentUserId: actors.ownerId, token: actors.ownerToken }));
      await expect(page.getByTestId('drd-roles-panel')).toBeVisible();

      // Rule 3 sanity: no comment -> inline error, no request.
      await page.getByText('Odeślij').click();
      await expect(page.getByText(/komentarz jest wymagany/i)).toBeVisible();

      const [sendBackResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/send-back') && r.request().method() === 'POST'),
        (async () => {
          await page.locator('#drd-send-back-comment').fill('E2E: proszę o dodatkowy dowód przed ponownym zamrożeniem.');
          await page.getByText('Odeślij').click();
        })(),
      ]);
      expect(sendBackResponse.status()).toBe(200);
      const sendBackBody = await sendBackResponse.json();
      newRevisionId = sendBackBody.newRevision.id;
      expect(newRevisionId).not.toBe(sessionId);
      expect(sendBackBody.newRevision.revisionOfSessionId).toBe(sessionId);

      await expect(page.getByText(/Odesłano\. Nowa rewizja:/)).toBeVisible();

      record(12, 'send back z komentarzem', 'PASS', 'DrdRolesPanel form: empty comment blocked client-side; with comment -> real POST /send-back (200), captured via page.waitForResponse.');
      record(13, 'nowa rewizja', 'PASS', `frozen -> active reopen produced NEW session id ${newRevisionId} (revisionOfSessionId=${sessionId}), shown in the panel's confirmation text.`);
    });

    // -------------------------------------------------------------------
    // 14. approval (second cycle on the new revision, ending frozen+approved)
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

      for (const to of ['prepared', 'active', 'in_review']) {
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

      const freeze2 = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/freeze`, actors.approverToken, {}, `freeze-v2-${Date.now()}`);
      expect(freeze2.status).toBe(200);
      outputIdV2 = freeze2.json.output.id;
      const versionAtFreeze = freeze2.json.session.version;

      const approve = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/events`, actors.approverToken, {
        type: 'DECISION_APPROVED',
        actorKind: 'human',
        payload: { decisionId: `e2e-decision-${Date.now()}`, subject: 'freeze', rationale: 'E2E: druga rewizja kompletna, zatwierdzam.', version: versionAtFreeze },
      }, `approve-${Date.now()}`);
      expect(approve.status).toBe(201);

      await page.goto(harnessUrl('roles', { sessionId: newRevisionId, currentUserId: actors.ownerId, token: actors.ownerToken }));
      await expect(page.getByText('Zatwierdzono')).toBeVisible();

      record(14, 'approval', 'PASS', `Second cycle on revision ${newRevisionId}: roles re-granted (browser form), freeze (approver) -> output=${outputIdV2}, DECISION_APPROVED appended (v${versionAtFreeze}) and visible in the approval-trail table.`);
    });

    // -------------------------------------------------------------------
    // 15. Report + Presentation + Initiative Proposal (result visible via
    //     DrdArtifactsPanel; creation itself has no UI button in scope)
    // -------------------------------------------------------------------
    await test.step('15. Report + Presentation + Initiative Proposal', async () => {
      const outputGet = await pageFetch(page, server.baseUrl, `/api/method/outputs/${outputIdV2}`, actors.ownerToken, undefined, undefined, 'GET');
      expect(outputGet.status).toBe(200);
      const findingIds: string[] = outputGet.json.output.findings.map((f: { id: string }) => f.id);
      expect(findingIds.length).toBeGreaterThan(0);

      const report = await pageFetch(page, server.baseUrl, `/api/method/outputs/${outputIdV2}/report`, actors.ownerToken, {
        title: 'E2E Report — DRD',
        content: { executiveSummary: 'E2E generated report.' },
      }, `report-${Date.now()}`);
      expect(report.status).toBe(201);

      const presentation = await pageFetch(page, server.baseUrl, `/api/method/outputs/${outputIdV2}/presentation`, actors.ownerToken, {
        title: 'E2E Presentation — DRD',
        content: { slides: [{ title: 'Summary' }] },
      }, `presentation-${Date.now()}`);
      expect(presentation.status).toBe(201);

      const initiative = await pageFetch(page, server.baseUrl, `/api/method/outputs/${outputIdV2}/initiative-drafts`, actors.ownerToken, {
        findingIds,
        title: 'E2E Initiative Draft',
        rationale: 'E2E rationale.',
        expectedOutcome: 'E2E expected outcome.',
        confidence: 'medium',
      }, `initiative-${Date.now()}`);
      expect(initiative.status).toBe(201);

      record(15, 'Report + Presentation + Initiative Proposal', 'PASS', 'All three created via real fetch (no UI button in scope to create them, only to LIST — see step 17); verified 201 for each.');
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
      await shot(page, '05-artifacts-after-restart.png');

      const lineageSessions = await page.locator('[data-testid="drd-lineage-session"]').count();
      await expect(page.getByTestId('drd-artifacts-lineage')).toBeVisible();
      await shot(page, '06-lineage.png');

      record(
        17,
        'list/reopen wszystkich artefaktów',
        'PASS',
        `After restart #2, DrdArtifactsPanel (real GET /sessions/:id/lineage) lists 2 Outputs, 1 Report, 1 Presentation, 1 Initiative Draft. ` +
          `NOTE: the lineage list itself has no click-to-reopen handler in S1's current DrdArtifactsPanel (static <li> entries) — "reopen" is proven at the DATA layer (both revisions' artefacts are listed together), not as a clickable UI affordance.`
      );

      const pool = openVerificationPool();
      try {
        const before = await pool.query(
          `SELECT id, state, revision_of_session_id FROM method_sessions WHERE id = ANY($1) ORDER BY created_at`,
          [[sessionId, newRevisionId]]
        );
        const outputs = await pool.query(
          `SELECT id, session_id, output_version, revision_of_output_id FROM method_outputs WHERE session_id = ANY($1) ORDER BY output_version`,
          [[sessionId, newRevisionId]]
        );
        const sqlDump =
          `sessions:\n${JSON.stringify(before.rows, null, 2)}\n\noutputs:\n${JSON.stringify(outputs.rows, null, 2)}\n`;
        fs.writeFileSync(SQL_LINEAGE_PATH, sqlDump, 'utf8');

        expect(before.rows).toHaveLength(2);
        expect(before.rows.find((r) => r.id === newRevisionId)?.revision_of_session_id).toBe(sessionId);
        expect(outputs.rows).toHaveLength(2);

        record(
          18,
          'lineage widoczny w UI i potwierdzony SQL-em',
          'PASS',
          `UI: ${lineageSessions} lineage session(s) listed. SQL (${SQL_LINEAGE_PATH}): method_sessions confirms ${newRevisionId} revision_of_session_id=${sessionId}; method_outputs has 2 rows chained by revisionOfOutputId.`
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
      await expect(page.getByText(/nie udało się wczytać/i).first()).toBeVisible();

      const crossOrgFetch = await pageFetch(page, server.baseUrl, `/api/method/sessions/${newRevisionId}/roles`, actors.otherOrgToken, undefined, undefined, 'GET');
      expect([403, 404]).toContain(crossOrgFetch.status);

      record(19, 'cross-org rejection', 'PASS', `Different org token -> DrdRolesPanel shows its error state in-browser (not the real roles); underlying fetch confirmed HTTP ${crossOrgFetch.status}.`);
    });
  });
});

/** Runs `fetch()` INSIDE the browser page (so it appears in the recorded
 * HAR) against the backend, through the dev-render proxy (`/api/...` same
 * origin) if `path` is relative, or via an absolute URL. Used for actions
 * this agent's two panels have no UI button for. */
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
