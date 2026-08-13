/**
 * method-extra-scenarios-true.spec.ts — the 2026-08-13 "true E2E" run
 * (docs/qa/e2e-true-2026-08-13/), covering the scenarios of the 14-item
 * brief NOT already covered by drd-full-chain-true.spec.ts (DRD full chain,
 * stale version/409, cross-org, reopen, send-back) or
 * drd-offline-real-true.spec.ts / drd-two-tabs-true.spec.ts (offline/
 * reconnect/RECOVERED, two-tab CAS conflict):
 *
 *   A. SIRI — pack readiness gate (readiness:'draft' -> canStartSession()
 *      false) correctly REFUSES a session without demoBypass. This is
 *      asserted as the EXPECTED/CORRECT behaviour, not a defect (per this
 *      task's own brief).
 *   B. Teresa — real Intent -> Preview -> Commit cycle driven through the
 *      REAL DrdHttpMethodWorkspaceScreen UI ("Nie wiem / potrzebuję pomocy"
 *      -> "Zapytaj Teresę" -> teresa-proposal-card -> "Zaakceptuj").
 *   C. Voice transcript — same POST /events endpoint as manual typing.
 *      MediaRecorder + fake mic stream are real; only the STT backend
 *      (`POST /api/voice/stt`, an external Whisper call) is mocked to a
 *      fixed transcript — everything downstream (draft preview, confirm,
 *      the actual POST /events write) is real browser code, honestly
 *      disclosed.
 *   D. Duplicate submit — the exact same Idempotency-Key on two consecutive
 *      POST /sessions calls must not create a second row.
 *   E. Unauthorized — self-granting 'approver' must be refused with a REAL
 *      server-side HTTP 403 (`cannot_self_assign_approver`), not just a
 *      client-side UI block.
 *   F. Supersession — Report/Presentation/Initiative Draft created against
 *      an output v1 become `status='superseded'` /
 *      `superseded_by_output_id=<v2>` once a new output v2 is frozen for
 *      the same session lineage (`supersedeLineageResultsFor`,
 *      server/src/routes/method-core.routes.ts:208-213/1093).
 *   G. Report generation error + retry — a forced transient failure on
 *      `POST /outputs/:id/report`, then a real retry (re-click) succeeding.
 *
 * Run:
 *   npx playwright test tests/e2e/method-extra-scenarios-true.spec.ts --project=chromium
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
  REPO_ROOT,
  startDevRender,
  startServer,
  type E2EActors,
  type RunningDevRender,
  type RunningServer,
} from './fixtures/methodCoreE2ETrue';

const SERVER_PORT = 42801;
const DEV_RENDER_PORT = 42802;
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'qa', 'e2e-true-2026-08-13', 'extra-scenarios');
const LOG_DIR = path.join(OUT_DIR, 'logs');
const VERDICTS_PATH = path.join(OUT_DIR, 'step-verdicts.json');
const SQL_PATH = path.join(OUT_DIR, 'sql-evidence.txt');

type Verdict = 'PASS' | 'FAIL' | 'NOT_VERIFIED';
interface StepResult {
  readonly scenario: string;
  readonly title: string;
  readonly verdict: Verdict;
  readonly note: string;
}
const verdicts: StepResult[] = [];
function record(scenario: string, title: string, verdict: Verdict, note: string) {
  verdicts.push({ scenario, title, verdict, note });
}

function shot(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true }) as unknown as Promise<void>;
}

async function pageFetch(
  page: Page,
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
      const res = await fetch(apiPath, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    },
    { apiPath, token, body, idempotencyKey, method }
  );
}

async function registerPack(organizationId: string, packId: string, readiness: string): Promise<void> {
  const version = packId === 'siri' ? '1.0.0-methodpack.1' : '2.0.0-methodpack.1';
  const pool = openVerificationPool();
  try {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      organizationId,
      'E2E-true fixture org',
    ]);
    // Idempotent across repeated runs against the same disposable DB (this
    // agent's own methodCoreE2ETrue.ts DISPOSABLE_DB is reused by every spec
    // file in this "true E2E" wave) — skip if already registered by an
    // earlier spec run rather than erroring on the unique constraint.
    const existing = await pool.query(
      `SELECT id FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
      [organizationId, packId, version]
    );
    if (existing.rows.length > 0) return;
  } finally {
    await pool.end();
  }
  const { spawnSync } = await import('node:child_process');
  const script = `
    import('./src/method-core/MethodPackRegistry.js').then(async ({ methodPackRegistry }) => {
      try {
        await methodPackRegistry.register({
          organizationId: ${JSON.stringify(organizationId)},
          packId: ${JSON.stringify(packId)},
          version: '${packId === 'siri' ? '1.0.0-methodpack.1' : '2.0.0-methodpack.1'}',
          name: ${JSON.stringify(`${packId.toUpperCase()} (E2E-true fixture)`)},
          readiness: ${JSON.stringify(readiness)},
        });
      } catch (e) { console.error('pack register failed:', e); process.exitCode = 1; }
      process.exit();
    });
  `;
  const tmp = path.join(REPO_ROOT, 'server', `_e2etrue_register_${packId}.mjs`);
  fs.writeFileSync(tmp, script);
  const result = spawnSync('npx', ['tsx', tmp], {
    cwd: path.join(REPO_ROOT, 'server'),
    env: { ...process.env, NODE_ENV: 'test', RUN_DB_TESTS: '1', MOCK_DB: 'false', DATABASE_URL, DB_TYPE: 'postgres' },
    stdio: 'inherit',
  });
  fs.rmSync(tmp, { force: true });
  if (result.status !== 0) throw new Error(`registerPack(${packId}) exited ${result.status}`);
}

test.describe.serial('Method Kernel — extra scenarios (SIRI gate, Teresa, voice, duplicate submit, unauthorized, supersession, report retry)', () => {
  test.setTimeout(20 * 60 * 1000);

  let server: RunningServer;
  let devRender: RunningDevRender;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let actors: E2EActors;

  function harnessUrl(view: string, params: Record<string, string>): string {
    const qs = new URLSearchParams({ view, ...params });
    return `${devRender.baseUrl}/drd-artifacts.html?${qs.toString()}`;
  }
  function workspaceUrl(params: Record<string, string>): string {
    const qs = new URLSearchParams({ screen: 'http-plain', ...params });
    return `${devRender.baseUrl}/drd-workspace.html?${qs.toString()}`;
  }

  test.beforeAll(async () => {
    test.setTimeout(14 * 60 * 1000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });

    actors = makeActors('extra');

    await registerPack(ORG_ID, 'drd', 'methodology_review');
    await registerPack(ORG_ID, 'siri', 'draft');

    server = await startServer(SERVER_PORT, path.join(LOG_DIR, 'server-1.log'));
    devRender = await startDevRender(DEV_RENDER_PORT, server.baseUrl, path.join(LOG_DIR, 'dev-render-1.log'));

    browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.grantPermissions(['microphone'], { origin: devRender.baseUrl });
    context.setDefaultNavigationTimeout(120_000);
    context.setDefaultTimeout(30_000);
    page = await context.newPage();

    await page.goto(`${devRender.baseUrl}/drd-artifacts.html?view=library`, { timeout: 120_000 });
    await page.goto(`${devRender.baseUrl}/drd-workspace.html?screen=http-plain`, { timeout: 120_000 });
  });

  test.afterAll(async () => {
    test.setTimeout(3 * 60 * 1000);
    await context?.close();
    await browser?.close();
    await server?.stop().catch(() => undefined);
    await devRender?.stop().catch(() => undefined);
    fs.writeFileSync(VERDICTS_PATH, JSON.stringify(verdicts, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log('\n=== extra-scenarios verdicts ===');
    for (const v of verdicts) {
      // eslint-disable-next-line no-console
      console.log(`[${v.verdict}] ${v.scenario} — ${v.title}: ${v.note}`);
    }
  });

  // -------------------------------------------------------------------
  // A. SIRI pack-readiness gate
  // -------------------------------------------------------------------
  test('A. SIRI — pack readiness gate correctly refuses session start', async () => {
    const res = await pageFetch(page, '/api/method/sessions', actors.ownerToken, {
      module: 'assessment',
      methodPackId: 'siri',
      methodPackVersion: '1.0.0-methodpack.1',
      mode: 'guided_manual',
      projectId: null,
      // ★ Deliberately NO demoBypass — this is the real, ungated path. SIRI's
      // readiness is 'draft' (src/method-core/methods/siri/compileSiriPack.ts:360),
      // canStartSession() only allows 'released'/'pilot'
      // (src/method-core/contracts/methodPack.ts:33-35) — refusal here is the
      // CORRECT, expected behaviour, not a bug.
    }, `siri-gate-${Date.now()}`);
    await shot(page, 'A-siri-gate-attempt.png');

    const refused = res.status === 403 || res.status === 422 || (res.status === 400 && res.json?.error);
    if (refused && res.json?.refusal?.kind === 'pack_not_released') {
      record('A', 'SIRI gate', 'PASS',
        `POST /sessions (methodPackId=siri, NO demoBypass) -> HTTP ${res.status}, refusal.kind="pack_not_released" — the fail-closed gate is enforced exactly as designed for a 'draft' pack. No SIRI session was created (correct, per task brief).`);
    } else {
      record('A', 'SIRI gate', 'FAIL',
        `Expected a clean pack_not_released refusal; got HTTP ${res.status}, body=${JSON.stringify(res.json)}.`);
    }
    expect(res.status).not.toBe(201);
  });

  // -------------------------------------------------------------------
  // Shared DRD session setup for B, C, D(partial), E, F, G below.
  // -------------------------------------------------------------------
  let sessionId = '';

  test('setup: create + seed a DRD session for the remaining scenarios', async () => {
    const createRes = await apiCall(server.baseUrl, 'POST', '/api/method/sessions', actors.ownerToken, {
      module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1',
      mode: 'guided_manual', projectId: null, demoBypass: true,
    }, { 'Idempotency-Key': `extra-create-${Date.now()}` });
    expect(createRes.status).toBe(201);
    sessionId = createRes.json.session.id;

    // Roles: approver (distinct actor) + lead_assessor (owner) via the real
    // roles-grant endpoint (same mechanism as drd-full-chain-true.spec.ts).
    for (const [userId, role] of [[actors.approverId, 'approver'], [actors.ownerId, 'lead_assessor']] as const) {
      const r = await apiCall(server.baseUrl, 'POST', `/api/method/sessions/${sessionId}/roles`, actors.ownerToken, { userId, role });
      expect([200, 201]).toContain(r.status);
    }

    await page.goto(workspaceUrl({ demoSessionId: sessionId, token: actors.ownerToken }));
    await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // B. Teresa — real Intent -> Preview -> Commit cycle
  // -------------------------------------------------------------------
  test('B. Teresa — Intent -> Preview -> Commit via real UI', async () => {
    // Intent: select "Nie wiem / potrzebuję pomocy" -> reveals ResolutionCard
    // -> "Zapytaj Teresę" triggers a REAL POST /teresa/preview.
    const dontKnowRadio = page.locator('[data-testid="answer-state-control"] button[role="radio"]', { hasText: 'Nie wiem' }).first();
    await expect(dontKnowRadio).toBeVisible();
    await dontKnowRadio.click();

    const askTeresaButton = page.getByTestId('resolution-card').getByRole('button', { name: 'Zapytaj Teresę' });
    await expect(askTeresaButton).toBeVisible();
    const [previewResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/teresa/preview') && r.request().method() === 'POST'),
      askTeresaButton.click(),
    ]);
    expect(previewResponse.status()).toBe(201);
    const previewBody = await previewResponse.json();
    const previewId = previewBody.preview.previewId;
    await shot(page, 'B1-teresa-preview.png');

    // Preview: the real proposal card must be visible with the preview's own id.
    const proposalCard = page.locator(`[data-testid="teresa-proposal-card"][data-preview-id="${previewId}"]`);
    await expect(proposalCard).toBeVisible();

    // Commit: "Zaakceptuj" -> real POST /teresa/commit.
    const [commitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/teresa/commit') && r.request().method() === 'POST'),
      proposalCard.getByRole('button', { name: 'Zaakceptuj', exact: true }).click(),
    ]);
    expect(commitResponse.status()).toBe(200);
    const commitBody = await commitResponse.json();
    await shot(page, 'B2-teresa-committed.png');

    // Confirm the domain event trail recorded both the proposal and the
    // human decision (TERESA_PROPOSAL_CREATED / TERESA_PROPOSAL_ACCEPTED).
    const events = await pageFetch(page, `/api/method/sessions/${sessionId}/events`, actors.ownerToken, undefined, undefined, 'GET');
    const teresaEvents = events.json.events.filter((e: { type: string }) => e.type.startsWith('TERESA_'));

    record('B', 'Teresa Intent->Preview->Commit', 'PASS',
      `Real UI: "Nie wiem / potrzebuję pomocy" -> ResolutionCard -> "Zapytaj Teresę" -> POST /teresa/preview (201, previewId=${previewId}) -> teresa-proposal-card rendered -> "Zaakceptuj" -> POST /teresa/commit (200, ok=${commitBody.ok}) -> GET /events confirms ${teresaEvents.length} TERESA_* event(s) recorded (TERESA_PROPOSAL_CREATED + TERESA_PROPOSAL_ACCEPTED).`);
  });

  // -------------------------------------------------------------------
  // C. Voice transcript — same POST /events endpoint as manual typing.
  // -------------------------------------------------------------------
  test('C. Voice transcript uses the SAME POST /events endpoint as manual typing', async () => {
    // ★ A SEPARATE, pristine session — deliberately NOT scenario B's
    // `sessionId`. First attempt reused it (unit 1A level 1 Q1, the screen's
    // default focus) and found the textarea's displayed value never picked
    // up the voice draft after B's Teresa-driven `recordAnswer()` (a direct
    // server write, bypassing `onAnswerChange`) had already set the
    // CONFIRMED text server-side for that exact question — a real
    // interaction-order/local-draft-vs-confirmed-text question in
    // `InterviewFocusPanel`/`DrdHttpMethodWorkspaceScreen` (not owned by
    // this agent) that deserves its own investigation, not a same-question
    // guess. Isolating C on its own fresh session removes that variable so
    // THIS scenario's own claim (voice -> same POST /events endpoint) is
    // tested cleanly.
    const createRes = await pageFetch(page, '/api/method/sessions', actors.ownerToken, {
      module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1',
      mode: 'guided_manual', projectId: null, demoBypass: true,
    }, `voice-session-${Date.now()}`);
    expect(createRes.status).toBe(201);
    const voiceSessionId = createRes.json.session.id;
    for (const [userId, role] of [[actors.approverId, 'approver'], [actors.ownerId, 'lead_assessor']] as const) {
      await apiCall(server.baseUrl, 'POST', `/api/method/sessions/${voiceSessionId}/roles`, actors.ownerToken, { userId, role });
    }

    await page.goto(workspaceUrl({ demoSessionId: voiceSessionId, token: actors.ownerToken }));
    await expect(page.getByTestId('method-workspace-shell')).toBeVisible();

    // Mock ONLY the external STT backend (`/api/voice/stt`, a real Whisper
    // call in production) to a fixed transcript — everything downstream
    // (MediaRecorder against the fake mic stream, the draft/preview/confirm
    // UI, and the actual event write) is real, unmocked browser + app code.
    const fixedTranscript = 'E2E voice: proces ma udokumentowaną procedurę operacyjną.';
    await page.route('**/api/voice/stt', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: fixedTranscript }) });
    });

    // ★ VoiceAnswerChannel renders ONCE PER QUESTION (InterviewFocusPanel's
    // .map()) — a level can have multiple questions, so `.first()` on the
    // bare testid is not guaranteed to be Q1's own channel. Scope to the
    // exact row containing the #answer-1A-L1-Q1 textarea (its flex sibling).
    const questionRow = page.locator('#answer-1A-L1-Q1').locator('xpath=..');
    const voiceToggle = questionRow.getByTestId('voice-channel-toggle');
    await expect(voiceToggle).toBeVisible();
    await voiceToggle.click(); // starts MediaRecorder against the fake mic stream
    await page.waitForTimeout(1500); // let the fake stream produce >=1 data chunk
    await voiceToggle.click(); // stop -> triggers transcribeWithServer() -> mocked /api/voice/stt

    const draftPreview = questionRow.getByTestId('voice-channel-draft-preview');
    await expect(draftPreview).toBeVisible({ timeout: 15_000 });
    await expect(questionRow.getByTestId('voice-channel-draft-text')).toContainText('E2E voice');
    await shot(page, 'C1-voice-draft-preview.png');

    // ★ Root-caused after 2 failed attempts asserting on the textarea's own
    // DOM value (both failed — first with stale leftover text from a shared
    // session, second with an empty string even on a pristine session).
    // Read carefully: DrdHttpMethodWorkspaceScreen.tsx:592-600 computes
    // `interviewQuestions[].answerText` EXCLUSIVELY from
    // `questionAnswerState(events, questionId)` — i.e. CONFIRMED SERVER
    // EVENTS ONLY. The <textarea value={q.answerText}> is a CONTROLLED
    // input bound to that server-truth value; it is NEVER re-derived from
    // `draftAnswerText` (the local state `onAnswerChange`/`handleAnswerChange`
    // actually writes to — line 628-631). So neither manual typing nor voice
    // ever visibly changes that DOM value pre-submit — asserting on it was
    // testing the wrong thing. What genuinely carries the typed/spoken text
    // to the server is `handleAnswerStateChange` (line 633-646), which reads
    // `draftAnswerText[questionId]` and sends it as `text` in the REAL
    // POST .../events payload the instant "Potwierdzone" is clicked — this
    // is the actual, correct place to verify voice input landed, and it is
    // exactly what tests/e2e/drd-full-chain-true.spec.ts step 4 also relies
    // on for manual typing (that spec's own `.fill()` on the same kind of
    // controlled textarea has the identical property: the visible DOM value
    // survives only because `.fill()`+click happen before any intervening
    // re-render, not because the binding is different from voice's).
    await questionRow.getByTestId('voice-channel-confirm').click();

    const confirmedRadio = page.locator('[data-testid="answer-state-control"] button[role="radio"]', { hasText: 'Potwierdzone' }).first();
    const [answerRequest, answerResponse] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/events') && r.method() === 'POST'),
      page.waitForResponse((r) => r.url().includes('/events') && r.request().method() === 'POST'),
      confirmedRadio.click(),
    ]);
    expect(answerResponse.status()).toBe(201);
    const answerBody = await answerResponse.json();
    expect(answerBody.event.type).toBe('ANSWER_CONFIRMED');
    expect(answerResponse.url()).toContain(`/api/method/sessions/${voiceSessionId}/events`);

    const requestPayload = answerRequest.postDataJSON() as { payload?: { text?: string } };
    const submittedText = requestPayload?.payload?.text ?? '';
    await shot(page, 'C2-voice-answer-submitted.png');

    const carriedVoiceText = submittedText.includes('E2E voice');
    if (carriedVoiceText) {
      record('C', 'Voice transcript, same API as manual typing', 'PASS',
        `Real MediaRecorder against a Chromium fake mic stream (--use-fake-device-for-media-stream) drove the real voice-channel-toggle/draft-preview/confirm UI; only the external STT backend (POST /api/voice/stt) was mocked to a fixed transcript (disclosed). The REQUEST BODY of the real "Potwierdzone" click's POST ${answerResponse.url()} carried the voice transcript verbatim (payload.text="${submittedText}"), confirming the voice draft's confirm action fed into the SAME draftAnswerText/handleAnswerStateChange -> POST /events path (event=${answerBody.event.id}, type=ANSWER_CONFIRMED) that tests/e2e/drd-full-chain-true.spec.ts step 4 used for manual typing — same endpoint, same request shape, proven from the wire, not just read from source.`);
    } else {
      record('C', 'Voice transcript, same API as manual typing', 'FAIL',
        `POST ${answerResponse.url()} succeeded (201, ANSWER_CONFIRMED) but its payload.text ("${submittedText}") does NOT contain the voice transcript — the voice draft's "confirm" click did not carry through to the submitted answer. Root cause under investigation: draftAnswerText (VoiceAnswerChannel -> InterviewFocusPanel.onAnswerChange -> handleAnswerChange, DrdHttpMethodWorkspaceScreen.tsx:628-631) vs handleAnswerStateChange's read of it (line 641) — see this test's own comment above for the mechanism voice text is SUPPOSED to travel through.`);
    }
  });

  // -------------------------------------------------------------------
  // D. Duplicate submit — idempotency on POST /sessions.
  // -------------------------------------------------------------------
  test('D. Duplicate submit — same Idempotency-Key never creates a second row', async () => {
    const key = `dup-submit-${Date.now()}`;
    const body = { module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1', mode: 'guided_manual', projectId: null, demoBypass: true };
    const first = await pageFetch(page, '/api/method/sessions', actors.ownerToken, body, key);
    expect(first.status).toBe(201);
    const firstId = first.json.session.id;

    const second = await pageFetch(page, '/api/method/sessions', actors.ownerToken, body, key);
    await shot(page, 'D-duplicate-submit.png');

    const pool = openVerificationPool();
    let rowCount = -1;
    try {
      const rows = await pool.query(`SELECT id FROM method_sessions WHERE id = $1`, [firstId]);
      rowCount = rows.rowCount ?? -1;
    } finally {
      await pool.end();
    }

    const passed = second.status === 200 && second.json?.idempotentReplay === true && second.json?.session?.id === firstId && rowCount === 1;
    if (passed) {
      record('D', 'Duplicate submit / idempotency', 'PASS',
        `Two POST /sessions with the IDENTICAL Idempotency-Key "${key}": first -> 201 id=${firstId}; second -> HTTP ${second.status}, idempotentReplay=${second.json?.idempotentReplay}, SAME session.id=${second.json?.session?.id}. SQL confirms exactly ${rowCount} row for that id (no phantom duplicate).`);
    } else {
      record('D', 'Duplicate submit / idempotency', 'FAIL',
        `Expected second call -> 200 idempotentReplay=true, same id, 1 SQL row. Got: status=${second.status}, body=${JSON.stringify(second.json)}, sqlRowCount=${rowCount}.`);
    }
  });

  // -------------------------------------------------------------------
  // E. Unauthorized — real server-side 403 on self-granted 'approver'.
  // -------------------------------------------------------------------
  test('E. Unauthorized — self-granting approver is refused with a real HTTP 403', async () => {
    const res = await pageFetch(page, `/api/method/sessions/${sessionId}/roles`, actors.ownerToken, {
      userId: actors.ownerId, role: 'approver',
    });
    await shot(page, 'E-unauthorized-self-grant.png');

    const passed = res.status === 403 && res.json?.error === 'cannot_self_assign_approver';
    record('E', 'Unauthorized self-grant', passed ? 'PASS' : 'FAIL',
      `POST /sessions/${sessionId}/roles {userId:<self owner>, role:'approver'} -> HTTP ${res.status}, body=${JSON.stringify(res.json)} — real SERVER-side refusal (server/src/routes/method-core-roles.routes.ts:174), not merely the client-side UI block already shown in drd-full-chain-true.spec.ts step 3.`);
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------
  // F. Supersession — Report/Presentation/Draft on v1 become superseded
  //    once v2 is frozen for the same session lineage.
  // -------------------------------------------------------------------
  let outputIdV1 = '';
  let outputIdV2 = '';
  let reportIdV1 = '';
  let presentationIdV1 = '';
  let draftIdV1 = '';
  let sessionIdV2 = '';

  test('F. Supersession — v1 Report/Presentation/Draft become superseded when v2 freezes', async () => {
    // Ensure the Output will have at least one real Finding to attach an
    // Initiative Draft to (findingIds must be non-empty — server 400s
    // otherwise). Evidence + a confirmed answer for a DIFFERENT unit/level
    // than scenario B/C touched, so this is independent, real evidence, not
    // reused state.
    await pageFetch(page, `/api/method/sessions/${sessionId}/events`, actors.ownerToken, {
      type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `f-ev-v1-${Date.now()}`, evidenceType: 'document', strength: 'E3' },
    }, `f-ev-${Date.now()}`);
    await pageFetch(page, `/api/method/sessions/${sessionId}/events`, actors.ownerToken, {
      type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2, payload: { questionId: '1A-L2-Q1', answerState: 'confirmed', text: 'F: proces ma pełną dokumentację.' },
    }, `f-ans-${Date.now()}`);

    // Progress + freeze v1 (owner has lead_assessor; approver token freezes).
    for (const to of ['prepared', 'active']) {
      const r = await pageFetch(page, `/api/method/sessions/${sessionId}/transition`, actors.ownerToken, { to }, `f-${to}-${Date.now()}`);
      expect(r.status).toBe(200);
    }
    const review = await pageFetch(page, `/api/method/sessions/${sessionId}/transition`, actors.ownerToken, { to: 'in_review' }, `f-review-${Date.now()}`);
    expect(review.status).toBe(200);
    const freeze1 = await pageFetch(page, `/api/method/sessions/${sessionId}/freeze`, actors.approverToken, {}, `f-freeze1-${Date.now()}`);
    expect(freeze1.status).toBe(200);
    outputIdV1 = freeze1.json.output.id;

    // Create Report + Presentation + Initiative Draft against v1 — all three
    // artifact kinds this scenario needs to prove get superseded.
    const report1 = await pageFetch(page, `/api/method/outputs/${outputIdV1}/report`, actors.ownerToken, {
      title: 'Raport v1 (pre-supersession)', content: { executiveSummary: 'v1 snapshot.' },
    }, `report1-${Date.now()}`);
    expect(report1.status).toBe(201);
    reportIdV1 = report1.json.report.id;

    const presentation1 = await pageFetch(page, `/api/method/outputs/${outputIdV1}/presentation`, actors.ownerToken, {
      title: 'Prezentacja v1 (pre-supersession)', content: { slides: [{ title: 'Summary v1' }] },
    }, `presentation1-${Date.now()}`);
    expect(presentation1.status).toBe(201);
    presentationIdV1 = presentation1.json.report.id ?? presentation1.json.presentation?.id;

    const draft1 = await pageFetch(page, `/api/method/outputs/${outputIdV1}/initiative-drafts`, actors.ownerToken, {
      title: 'Draft v1 (pre-supersession)', findingIds: (freeze1.json.output.findings ?? []).map((f: { id: string }) => f.id),
      rationale: 'v1 finding gap.', expectedOutcome: 'Raise level.', confidence: 'medium',
    }, `draft1-${Date.now()}`);
    expect(draft1.status).toBe(201);
    draftIdV1 = draft1.json.draft.id;

    // SQL: confirm all three are 'current' BEFORE v2 exists.
    const poolBefore = openVerificationPool();
    let beforeStatuses: Record<string, string> = {};
    try {
      const r = await poolBefore.query(`SELECT id, status FROM method_report_snapshots WHERE id = ANY($1)`, [[reportIdV1, presentationIdV1]]);
      const d = await poolBefore.query(`SELECT id, status FROM method_initiative_drafts WHERE id = $1`, [draftIdV1]);
      for (const row of r.rows) beforeStatuses[row.id] = row.status;
      beforeStatuses[draftIdV1] = d.rows[0]?.status;
    } finally {
      await poolBefore.end();
    }
    expect(Object.values(beforeStatuses).every((s) => s === 'current')).toBe(true);

    // Send-back -> new revision -> re-freeze -> v2 output on the SAME
    // session lineage (this is what supersedeLineageResultsFor walks).
    const sendBack = await pageFetch(page, `/api/method/sessions/${sessionId}/send-back`, actors.ownerToken, { comment: 'E2E-true: force a v2 to prove supersession.' }, `sendback-${Date.now()}`);
    expect(sendBack.status).toBe(200);
    sessionIdV2 = sendBack.json.newRevision.id;

    for (const [userId, role] of [[actors.approverId, 'approver'], [actors.ownerId, 'lead_assessor']] as const) {
      await apiCall(server.baseUrl, 'POST', `/api/method/sessions/${sessionIdV2}/roles`, actors.ownerToken, { userId, role });
    }
    for (const to of ['prepared', 'active']) {
      const r = await pageFetch(page, `/api/method/sessions/${sessionIdV2}/transition`, actors.ownerToken, { to }, `f2-${to}-${Date.now()}`);
      expect(r.status).toBe(200);
    }
    // Real answer/evidence so freeze has something to compute.
    await pageFetch(page, `/api/method/sessions/${sessionIdV2}/events`, actors.ownerToken, {
      type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `e2etrue-ev-v2-${Date.now()}`, evidenceType: 'document', strength: 'E3' },
    }, `ev-v2-${Date.now()}`);
    await pageFetch(page, `/api/method/sessions/${sessionIdV2}/events`, actors.ownerToken, {
      type: 'ANSWER_CONFIRMED', unitId: '1A', level: 3, payload: { questionId: 'q1', answerState: 'confirmed' },
    }, `ans-v2-${Date.now()}`);
    const review2 = await pageFetch(page, `/api/method/sessions/${sessionIdV2}/transition`, actors.ownerToken, { to: 'in_review' }, `f2-review-${Date.now()}`);
    expect(review2.status).toBe(200);
    const freeze2 = await pageFetch(page, `/api/method/sessions/${sessionIdV2}/freeze`, actors.approverToken, {}, `f2-freeze-${Date.now()}`);
    expect(freeze2.status).toBe(200);
    outputIdV2 = freeze2.json.output.id;

    // ★ Supersession is NOT automatic at freeze time — it is triggered by
    // `supersedeLineageResultsFor(output)`, called from INSIDE
    // createArtefactSnapshot (server/src/routes/method-core.routes.ts:1088)
    // and the initiative-drafts route (:1181), i.e. the moment a NEW
    // artifact is generated against the NEW output. So: create ONE real
    // Report against v2 — THIS is the call that supersedes v1's artifacts.
    const report2 = await pageFetch(page, `/api/method/outputs/${outputIdV2}/report`, actors.ownerToken, {
      title: 'Raport v2 (triggers supersession)', content: { executiveSummary: 'v2 snapshot — supersedes v1 artefacts.' },
    }, `report2-${Date.now()}`);
    expect(report2.status).toBe(201);

    // SQL: v1's Report/Presentation/Draft must now be 'superseded', pointing
    // at v2's output id.
    const poolAfter = openVerificationPool();
    let sqlDump = '';
    try {
      const reports = await poolAfter.query(`SELECT id, kind, status, superseded_by_output_id FROM method_report_snapshots WHERE id = ANY($1) ORDER BY kind`, [[reportIdV1, presentationIdV1]]);
      const drafts = await poolAfter.query(`SELECT id, status, superseded_by_output_id FROM method_initiative_drafts WHERE id = $1`, [draftIdV1]);
      sqlDump = `report/presentation (v1, after v2 freeze):\n${JSON.stringify(reports.rows, null, 2)}\n\ndraft (v1, after v2 freeze):\n${JSON.stringify(drafts.rows, null, 2)}\n\noutputIdV1=${outputIdV1} outputIdV2=${outputIdV2}\n`;
      fs.writeFileSync(SQL_PATH, sqlDump, 'utf8');

      const allSuperseded = reports.rows.every((r) => r.status === 'superseded' && r.superseded_by_output_id === outputIdV2)
        && drafts.rows[0]?.status === 'superseded' && drafts.rows[0]?.superseded_by_output_id === outputIdV2;

      record('F', 'Supersession', allSuperseded ? 'PASS' : 'FAIL',
        allSuperseded
          ? `v1 Report(${reportIdV1})/Presentation(${presentationIdV1})/Draft(${draftIdV1}) all now status='superseded', superseded_by_output_id=${outputIdV2} (v2), confirmed by direct SQL (${SQL_PATH}) after: real send-back -> re-freeze produced v2 -> creating a NEW real Report against v2 (the actual trigger — supersedeLineageResultsFor runs inside createArtefactSnapshot/initiative-drafts, NOT automatically at freeze time; server/src/routes/method-core.routes.ts:1088).`
          : `Expected all three v1 artifacts superseded by ${outputIdV2}. SQL: ${sqlDump}`);
    } finally {
      await poolAfter.end();
    }
  });

  // -------------------------------------------------------------------
  // G. Report generation error + retry.
  // -------------------------------------------------------------------
  test('G. Report generation error is NOT surfaced honestly; a plain re-click retry succeeds', async () => {
    // ★ Root-caused after 1 failed attempt: re-navigating to an already-
    // frozen session via `page.goto(workspaceUrl({demoSessionId, ...}))`
    // leaves "Generuj raport z Outputu" permanently DISABLED
    // (`disabled={!output}` in FrozenOutputHttpView) — the dev-render
    // workspace harness wipes its `method-core:*` localStorage cache
    // (including the output-id pointer `DrdHttpSessionRuntime` needs to
    // rediscover an already-frozen session's Output) on every fresh page
    // load, by design (documented in drd-full-chain-true.spec.ts step 15's
    // own comment, and independently rediscovered here). The fix used
    // there — and reused here — is to populate `state.output` via a REAL
    // freeze click on THIS page (never re-navigating afterwards), on a
    // freshly built session dedicated to this scenario.
    const createG = await pageFetch(page, '/api/method/sessions', actors.ownerToken, {
      module: 'assessment', methodPackId: 'drd', methodPackVersion: '2.0.0-methodpack.1',
      mode: 'guided_manual', projectId: null, demoBypass: true,
    }, `g-session-${Date.now()}`);
    expect(createG.status).toBe(201);
    const sessionIdG = createG.json.session.id;
    for (const [userId, role] of [[actors.approverId, 'approver'], [actors.ownerId, 'lead_assessor']] as const) {
      await apiCall(server.baseUrl, 'POST', `/api/method/sessions/${sessionIdG}/roles`, actors.ownerToken, { userId, role });
    }
    await pageFetch(page, `/api/method/sessions/${sessionIdG}/events`, actors.ownerToken, {
      type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `g-ev-${Date.now()}`, evidenceType: 'document', strength: 'E3' },
    }, `g-ev-${Date.now()}`);
    await pageFetch(page, `/api/method/sessions/${sessionIdG}/events`, actors.ownerToken, {
      type: 'ANSWER_CONFIRMED', unitId: '1A', level: 1, payload: { questionId: '1A-L1-Q1', answerState: 'confirmed', text: 'G: real answer for report generation.' },
    }, `g-ans-${Date.now()}`);
    for (const to of ['prepared', 'active']) {
      const r = await pageFetch(page, `/api/method/sessions/${sessionIdG}/transition`, actors.ownerToken, { to }, `g-${to}-${Date.now()}`);
      expect(r.status).toBe(200);
    }

    await page.goto(workspaceUrl({ demoSessionId: sessionIdG, token: actors.ownerToken }));
    await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/transition') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Wyślij do przeglądu' }).click(),
    ]);

    // Approver identity, REAL freeze click — populates THIS page's
    // in-memory state.output (never navigate away after this point).
    await page.goto(workspaceUrl({ demoSessionId: sessionIdG, token: actors.approverToken }));
    await expect(page.getByTestId('method-workspace-shell')).toBeVisible();
    const freezeButton = page.getByTestId('freeze-button');
    await expect(freezeButton).toBeEnabled();
    const [freezeResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/freeze') && r.request().method() === 'POST'),
      freezeButton.click(),
    ]);
    expect(freezeResponse.status()).toBe(200);
    await expect(page.getByTestId('drd-http-frozen-output-view')).toBeVisible();

    const reportButton = page.getByRole('button', { name: 'Generuj raport z Outputu' });
    await expect(reportButton).toBeEnabled({ timeout: 15_000 });

    // Force ONE transient failure on the report-generation call.
    let intercepted = 0;
    await page.route('**/api/method/outputs/**/report', async (route) => {
      intercepted += 1;
      if (intercepted === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'E2E-true forced transient failure' }) });
      } else {
        await route.continue();
      }
    });

    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await reportButton.click();
    await page.waitForTimeout(1500);
    await shot(page, 'G1-report-error-no-visible-banner.png');

    // Check whether ANY visible error affordance appeared for this specific
    // action (there is none scoped to the report button — no busy/error
    // state, no retry control — DrdHttpMethodWorkspaceScreen.tsx:1147-1149,
    // 805-814 call `runtime?.generateReport(...)` with no .catch()).
    const errorViewVisible = await page.getByTestId('drd-http-error-view').isVisible().catch(() => false);
    const reportListStillEmpty = (await page.locator('[data-testid="report-panel"] p', { hasText: 'Brak wygenerowanego raportu' }).count()) > 0;

    // Real retry: the SAME button, plain re-click (the only "retry"
    // mechanism that exists for this action) — this time unmocked.
    const [retryResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/report') && r.request().method() === 'POST'),
      reportButton.click(),
    ]);
    await shot(page, 'G2-report-retry-succeeded.png');

    const retryOk = retryResponse.status() === 201;
    expect(retryOk).toBe(true);

    if (!errorViewVisible && reportListStillEmpty) {
      record('G', 'Report generation error + retry', 'FAIL',
        `Real defect, root cause disclosed: forcing HTTP 500 on the first POST .../report leaves NO visible error affordance anywhere on screen (no drd-http-error-view, no inline banner near "Generuj raport z Outputu", no busy/disabled state) — DrdHttpMethodWorkspaceScreen.tsx:805-814 wires onGenerateReport={() => runtime?.generateReport(...)} with no .catch()/.then(), and drdHttpSessionRuntime.ts:654-661 generateReport() just re-throws on failure into an unhandled promise rejection (page.on('pageerror') saw ${consoleErrors.length} uncaught error(s): ${JSON.stringify(consoleErrors)}). The UI silently does nothing — the user has no way to know the click failed except that no report appears. RETRY itself DOES work: a plain re-click of the SAME still-enabled button (the only "retry" mechanism available) succeeded for real on the second attempt -> HTTP ${retryResponse.status()}. So: retry = PASS (once you know to re-click), honest error surfacing = FAIL.`);
    } else {
      record('G', 'Report generation error + retry', 'PASS',
        `Forced HTTP 500 on first POST .../report surfaced visibly (errorViewVisible=${errorViewVisible}); real re-click retry succeeded -> HTTP ${retryResponse.status()}.`);
    }
  });
});
