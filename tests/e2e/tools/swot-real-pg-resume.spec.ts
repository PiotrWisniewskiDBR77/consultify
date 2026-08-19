import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
import { Pool } from 'pg';

import { computeOutputHash } from '../../../server/src/sharedRuntime/toolOutputs/outputLifecycle.js';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const APP_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const supportHeaders = {
  'x-test-support-key': SUPPORT_KEY,
  'content-type': 'application/json',
};

type Persona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: 'ADMIN' | 'USER';
};

const authHeaders = (persona: Persona) => ({
  Authorization: `Bearer ${persona.token}`,
  'content-type': 'application/json',
});

async function checked(response: Awaited<ReturnType<APIRequestContext['post']>>, label: string) {
  if (!response.ok()) throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function bootstrap(
  request: APIRequestContext,
  runId: string,
  role: Persona['role'] = 'ADMIN'
): Promise<Persona> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role },
  });
  return { ...(await checked(response, `bootstrap ${role}`)), runId, role } as Persona;
}

async function addMember(
  request: APIRequestContext,
  tenant: Persona,
  role: Persona['role'] = 'USER'
): Promise<Persona> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId: tenant.runId, role },
  });
  return { ...(await checked(response, `member ${role}`)), runId: tenant.runId, role } as Persona;
}

async function signedContext(browser: Browser, persona: Persona): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: APP_BASE_URL,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(
    ({ auth, origin }) => {
      if (location.origin !== origin) return;
      const user = {
        id: auth.userId,
        email: `${auth.userId}@tools.local`,
        role: auth.role,
        organizationId: auth.organizationId,
        organizationName: 'TLS technical tenant',
        isAuthenticated: true,
        accessLevel: 'full',
        isDemo: false,
      };
      localStorage.setItem('token', auth.token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(`consultify_onboarding_done:${auth.userId}`, 'true');
      localStorage.setItem(
        'consultify-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            isDemoMode: false,
            isDemoSession: false,
            currentUser: user,
            currentOrganization: { id: auth.organizationId, name: user.organizationName },
          },
          version: 0,
        })
      );
    },
    { auth: persona, origin: new URL(APP_BASE_URL).origin }
  );
  return context;
}

async function cleanup(request: APIRequestContext, runId: string): Promise<void> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
    headers: supportHeaders,
    data: { runId },
  });
  if (!response.ok())
    throw new Error(`cleanup ${runId}: ${response.status()} ${await response.text()}`);
}

async function assertDisposableDatabase(pool: Pool): Promise<void> {
  const prefix = process.env.TLS_BVP_DISPOSABLE_DB_PREFIX || '';
  if (!prefix) throw new Error('TLS_BVP_DISPOSABLE_DB_PREFIX is required');
  const current = await pool.query<{ name: string }>('SELECT current_database() name');
  if (!current.rows[0]?.name.startsWith(prefix)) {
    throw new Error(`refusing TLS cleanup in non-owned database ${current.rows[0]?.name || ''}`);
  }
}

async function downstreamSnapshot(pool: Pool, sessionId: string) {
  return (
    await pool.query(
      `SELECT
         (SELECT count(*)::int FROM tool_outputs WHERE tool_session_id=$1) outputs,
         (SELECT count(*)::int FROM tool_output_initiative_proposals WHERE tool_output_id IN (SELECT id FROM tool_outputs WHERE tool_session_id=$1)) proposals,
         (SELECT count(*)::int FROM tool_session_events WHERE tool_session_id=$1) events,
         (SELECT count(*)::int FROM tool_initiative_links WHERE tool_session_id=$1) links,
         (SELECT count(*)::int FROM report_builder_reports WHERE source_type='TOOL' AND source_id=$1) reports,
         (SELECT count(*)::int FROM audit_log WHERE resource_id=$1) audit`,
      [sessionId]
    )
  ).rows[0];
}

const completeSwotAnswers = {
  context: {
    goal: 'Choose the safest growth priority for the next quarter',
    scope: 'European B2B operations',
    successSignal: 'One approved move with an accountable owner',
  },
  items: [
    { id: 'tls-q-s', text: 'Trusted B2B brand', quadrant: 'strengths', proposalStatus: 'accepted' },
    { id: 'tls-q-w', text: 'Legacy reporting', quadrant: 'weaknesses', proposalStatus: 'accepted' },
    {
      id: 'tls-q-o',
      text: 'Growing automation demand',
      quadrant: 'opportunities',
      proposalStatus: 'accepted',
    },
    {
      id: 'tls-q-t',
      text: 'Lower-price entrants',
      quadrant: 'threats',
      proposalStatus: 'accepted',
    },
  ],
  tensions: [
    {
      id: 'tls-tension',
      title: 'Brand advantage versus price pressure',
      insight: 'Protect value before expanding.',
      type: 'protect',
      linkedItemIds: ['tls-q-s', 'tls-q-t'],
      proposalStatus: 'accepted',
    },
  ],
  recommendedMoves: [
    {
      id: 'tls-move',
      title: 'Launch value-retention programme',
      category: 'defensive-move',
      rationale: 'Protect the strongest revenue base first.',
      linkedItemIds: ['tls-q-s', 'tls-q-w'],
      linkedTensionIds: ['tls-tension'],
      tradeoff: {
        chosen: 'Protect value in the existing B2B base',
        deferred: 'Broad expansion into price-sensitive segments',
        cost: 'A slower top-line expansion during the next quarter',
      },
      rejectedAlternative: {
        option: 'Compete primarily through price reductions',
        reason: 'It would erode the trusted-brand advantage identified in the SWOT.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      firstStep: 'Assign the retention programme to the commercial owner.',
      ownerRole: 'Commercial owner',
      proposalStatus: 'accepted',
    },
  ],
  summary: {
    executiveSummary: 'Protect the existing B2B advantage while fixing reporting.',
    proposalStatus: 'accepted',
  },
  outputCandidates: [
    {
      id: 'tls-output',
      title: 'B2B retention initiative',
      description: 'Turn the selected move into an owned initiative.',
      outputType: 'initiative',
      readiness: 'ready-for-initiative',
      proposalStatus: 'accepted',
    },
  ],
};

test('TLS-02/03: mounted SWOT edit persists while empty, stale, foreign and revoked writes fail closed', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const runId = `tls-edit-${Date.now()}`;
  const foreignRunId = `tls-foreign-${Date.now()}`;
  const marker = `SWOT durable weakness ${Date.now()}`;
  let owner: Persona | undefined;
  let foreign: Persona | undefined;
  let ownerContext: BrowserContext | undefined;
  let sessionId = '';
  let emptySessionId = '';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  try {
    await assertDisposableDatabase(pool);
    owner = await bootstrap(request, runId);
    foreign = await bootstrap(request, foreignRunId);
    ownerContext = await signedContext(browser, owner);
    const page = await ownerContext.newPage();
    const headers = authHeaders(owner);
    const create = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: { toolType: 'dynamic-swot', name: `TLS real-PG SWOT ${Date.now()}` },
    });
    expect(create.status()).toBe(200);
    const createdSession = await create.json();
    sessionId = String(createdSession.id || '');
    expect(sessionId.length).toBeGreaterThan(8);

    const seed = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers,
      data: {
        expectedVersion: createdSession.version,
        status: 'IN_PROGRESS',
        completionPercent: 20,
        confidenceAvg: 4,
        answers: {
          items: [
            {
              id: 'tls-browser-strength-1',
              text: 'Durable strength from PostgreSQL',
              quadrant: 'strengths',
              impact: 'high',
              source: 'user',
              confidence: 4,
              status: 'accepted',
              proposalStatus: 'accepted',
            },
          ],
        },
      },
    });
    expect(seed.status()).toBe(200);

    await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
    await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));

    await expect(page.getByRole('button', { name: /SWOT Build/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    const dismissOnboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
    const onboardingWasDismissed = await dismissOnboarding
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(async () => {
        await dismissOnboarding.click();
        return true;
      })
      .catch(() => false);
    if (onboardingWasDismissed) {
      await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
      await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
    }
    const swotPhase = page.getByRole('button', { name: /SWOT Build/i }).first();
    await expect(swotPhase).toBeVisible({ timeout: 30_000 });
    await swotPhase.click();
    await expect(page.getByText('Durable strength from PostgreSQL')).toBeVisible();

    await page.getByRole('tab', { name: /Weaknesses/i }).click();
    const weaknessInput = page.getByPlaceholder(/Add point|Dodaj punkt/i);
    await expect(weaknessInput).toBeVisible();
    await weaknessInput.fill(marker);
    await weaknessInput.locator('..').getByRole('button').click();
    await expect(page.getByText(marker)).toBeVisible();

    await expect
      .poll(
        async () => {
          const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
            headers: { Authorization: `Bearer ${owner.token}` },
          });
          if (read.status() !== 200) return false;
          const body = await read.json();
          return Array.isArray(body?.answers?.items)
            ? body.answers.items.some((item: any) => item?.text === marker)
            : false;
        },
        { timeout: 20_000, message: 'SWOT edit did not reach PostgreSQL' }
      )
      .toBe(true);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
    const reopenedSwotPhase = page.getByRole('button', { name: /SWOT Build/i }).first();
    await expect(reopenedSwotPhase).toBeVisible({ timeout: 30_000 });
    await reopenedSwotPhase.click();
    await page.getByRole('tab', { name: /Weaknesses/i }).click();
    await expect(page.getByText(marker)).toBeVisible();

    const finalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(finalRead.status()).toBe(200);
    const finalBody = await finalRead.json();
    expect(finalBody.id).toBe(sessionId);
    expect(finalBody.answers.items.some((item: any) => item?.text === marker)).toBe(true);

    const empty = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
      headers,
      data: { outputType: 'report', title: `Premature ${marker}` },
    });
    expect(empty.status()).toBe(409);

    const emptyCreate = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: { toolType: 'dynamic-swot', name: `TLS approved empty ${Date.now()}` },
    });
    expect(emptyCreate.status()).toBe(200);
    emptySessionId = String((await emptyCreate.json()).id || '');
    await pool.query(
      `UPDATE tool_sessions
          SET status='APPROVED', completion_percent=100, confidence_avg=4,
              missing_items_json='[]', answers_json='{}'
        WHERE id=$1 AND organization_id=$2`,
      [emptySessionId, owner.organizationId]
    );
    const beforeEmpty = await downstreamSnapshot(pool, emptySessionId);
    expect(beforeEmpty).toEqual({
      outputs: 0,
      proposals: 0,
      events: 0,
      links: 0,
      reports: 0,
      audit: 0,
    });
    const emptyApproved = await request.post(
      `${API_BASE_URL}/api/tools/${emptySessionId}/promote`,
      { headers, data: { outputType: 'report', title: `Blocked empty ${marker}` } }
    );
    expect(emptyApproved.status()).toBe(409);
    expect(await emptyApproved.json()).toMatchObject({ code: 'EMPTY_TOOL_OUTPUT' });
    expect(await downstreamSnapshot(pool, emptySessionId)).toEqual(beforeEmpty);

    const deniedBaseline = await downstreamSnapshot(pool, sessionId);
    const stale = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers,
      data: { expectedVersion: createdSession.version, answers: { stale: true } },
    });
    expect(stale.status()).toBe(409);
    expect(await downstreamSnapshot(pool, sessionId)).toEqual(deniedBaseline);

    const foreignRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers: authHeaders(foreign),
    });
    expect(foreignRead.status()).toBe(404);
    const foreignPromote = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
      headers: authHeaders(foreign),
      data: { outputType: 'report', title: `Foreign ${marker}` },
    });
    expect(foreignPromote.status()).toBe(404);
    expect(await downstreamSnapshot(pool, sessionId)).toEqual(deniedBaseline);

    const beforeRevoked = await pool.query(
      `SELECT version, answers_json FROM tool_sessions WHERE id=$1 AND organization_id=$2`,
      [sessionId, owner.organizationId]
    );
    await pool.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [owner.organizationId, owner.userId]
    );
    try {
      const revokedWrite = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
        headers,
        data: { expectedVersion: finalBody.version, answers: { revoked: true } },
      });
      expect(revokedWrite.status()).toBe(403);
      const revokedPromote = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
        headers,
        data: { outputType: 'report', title: `Revoked ${marker}` },
      });
      expect(revokedPromote.status()).toBe(403);
      const afterRevoked = await pool.query(
        `SELECT version, answers_json FROM tool_sessions WHERE id=$1 AND organization_id=$2`,
        [sessionId, owner.organizationId]
      );
      expect(afterRevoked.rows).toEqual(beforeRevoked.rows);
      expect(await downstreamSnapshot(pool, sessionId)).toEqual(deniedBaseline);
    } finally {
      await pool.query(
        `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
        [owner.organizationId, owner.userId]
      );
    }
  } finally {
    await ownerContext?.close();
    if (owner) await cleanup(request, runId);
    if (foreign) await cleanup(request, foreignRunId);
    if (sessionId || emptySessionId) {
      const residue = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM tool_sessions WHERE id=ANY($1::text[])) sessions,
           (SELECT count(*)::int FROM tool_outputs WHERE tool_session_id=ANY($1::text[])) outputs,
           (SELECT count(*)::int FROM tool_output_initiative_proposals WHERE tool_output_id IN (SELECT id FROM tool_outputs WHERE tool_session_id=ANY($1::text[]))) proposals,
           (SELECT count(*)::int FROM tool_session_events WHERE tool_session_id=ANY($1::text[])) events,
           (SELECT count(*)::int FROM tool_initiative_links WHERE tool_session_id=ANY($1::text[])) links,
           (SELECT count(*)::int FROM report_builder_reports WHERE source_type='TOOL' AND source_id=ANY($1::text[])) reports,
           (SELECT count(*)::int FROM audit_log WHERE resource_id=ANY($1::text[])) audit,
           (SELECT count(*)::int FROM tool_decisions WHERE tool_session_id=ANY($1::text[])) decisions,
           (SELECT count(*)::int FROM organization_members WHERE organization_id=ANY($2::text[])) memberships,
           (SELECT count(*)::int FROM users WHERE organization_id=ANY($2::text[])) users,
           (SELECT count(*)::int FROM organizations WHERE id=ANY($2::text[])) organizations,
           (SELECT count(*)::int FROM test_support_runs WHERE run_id=ANY($3::text[])) test_support`,
        [
          [sessionId, emptySessionId].filter(Boolean),
          [owner?.organizationId, foreign?.organizationId].filter(Boolean),
          [runId, foreignRunId],
        ]
      );
      expect(residue.rows[0]).toEqual({
        sessions: 0,
        outputs: 0,
        proposals: 0,
        events: 0,
        links: 0,
        reports: 0,
        audit: 0,
        decisions: 0,
        memberships: 0,
        users: 0,
        organizations: 0,
        test_support: 0,
      });
    }
    await pool.end();
  }
});

test('TLS-05: signed creator and separate approver freeze, promote, replay and cold-reopen one immutable SWOT lineage', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const runId = `tls-freeze-${Date.now()}`;
  const marker = `TLS visible nonempty ${Date.now()}`;
  const attachmentName = `uia-source-${Date.now()}.txt`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  let owner: Persona | undefined;
  let approver: Persona | undefined;
  let ownerContext: BrowserContext | undefined;
  let sessionId = '';
  let reportId = '';
  let outputId = '';
  let candidateId = '';
  let candidateTitle = '';
  let decisionIds: string[] = [];
  let approverContext: BrowserContext | undefined;
  let coldContext: BrowserContext | undefined;

  try {
    await assertDisposableDatabase(pool);
    owner = await bootstrap(request, runId);
    approver = await addMember(request, owner, 'ADMIN');
    ownerContext = await signedContext(browser, owner);
    const page = await ownerContext.newPage();
    const headers = authHeaders(owner);

    await page.goto('/discovery-tools');
    await page.getByText('Dynamic SWOT', { exact: true }).dblclick();
    await expect(page.getByRole('button', { name: /^Goal$/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^Process$/i }).click();
    await expect(page.getByRole('list', { name: /Tool process/i }).getByRole('listitem')).toHaveCount(
      4
    );
    await page.getByRole('button', { name: /^Outcomes$/i }).click();
    await expect(page.getByRole('button', { name: /^Outcomes$/i })).toBeVisible();
    await page.getByRole('button', { name: /^Example$/i }).nth(1).click();
    await expect(page.getByRole('button', { name: /^Example$/i }).nth(1)).toBeVisible();
    await expect(page.getByText(/Context:/i)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Start$/i })).toHaveCount(1);
    const create = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: { toolType: 'dynamic-swot', name: `TLS quality gate ${Date.now()}` },
    });
    expect(create.status()).toBe(200);
    const createdSession = await create.json();
    sessionId = String(createdSession.id || '');

    const ready = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers,
      data: {
        expectedVersion: createdSession.version,
        answers: completeSwotAnswers,
        completionPercent: 100,
        confidenceAvg: 4,
        missingItems: [],
      },
    });
    expect(ready.status()).toBe(200);

    await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
    await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
    const dismissOnboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
    const onboardingWasDismissed = await dismissOnboarding
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(async () => {
        await dismissOnboarding.click();
        return true;
      })
      .catch(() => false);
    if (onboardingWasDismissed) {
      await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
      await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
    }
    const swotPhase = page.getByRole('button', { name: /SWOT Build/i }).first();
    await expect(swotPhase).toBeVisible({ timeout: 30_000 });
    await swotPhase.click();
    await page.getByRole('tab', { name: /Weaknesses/i }).click();
    const weaknessInput = page.getByPlaceholder(/Add point|Dodaj punkt/i);
    await weaknessInput.fill(marker);
    await weaknessInput.locator('..').getByRole('button').click();
    await expect(page.getByText(marker)).toBeVisible();
    await expect
      .poll(async () => {
        const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
          headers: { Authorization: `Bearer ${owner.token}` },
        });
        if (!read.ok()) return false;
        const body = await read.json();
        return body.answers?.items?.some((item: any) => item.text === marker) === true;
      })
      .toBe(true);
    await page.getByRole('button', { name: /Outputs & Actions/i }).click();
    await expect(page.getByRole('heading', { name: /Outputs & Actions/i })).toBeVisible();
    await expect(page.getByTestId('tool-session-properties')).toContainText('Tool type');
    await expect(page.getByTestId('tool-session-properties')).toContainText('Progress');
    await page
      .getByRole('button', { name: /Synthesis & Insights/i })
      .first()
      .click();
    await expect(page.locator('[data-synthesis-section]')).toHaveCount(9);
    await expect(page.getByText(/^Validated$/)).toHaveCount(0);
    await page.getByText(/Show supporting analysis/i).click();
    const draftCandidateAction = page.getByRole('button', { name: /Send to candidates/i }).first();
    await expect(draftCandidateAction).toBeDisabled();
    await expect(draftCandidateAction).toHaveAttribute(
      'title',
      /Approve this SWOT before sending/i
    );
    await page.getByRole('button', { name: /Outputs & Actions/i }).click();
    await expect
      .poll(
        async () => {
          const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
            headers: { Authorization: `Bearer ${owner.token}` },
          });
          if (read.status() !== 200) return false;
          return (await read.json())?.answers?.context?.timeframe === 'medium';
        },
        { timeout: 15_000, message: 'normalized UI state was not durably autosaved before review' }
      )
      .toBe(true);

    const preApprovalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(preApprovalRead.status()).toBe(200);
    const answersAtApproval = (await preApprovalRead.json()).answers;
    expect(answersAtApproval.context).toMatchObject(completeSwotAnswers.context);
    for (const expectedItem of completeSwotAnswers.items) {
      expect(answersAtApproval.items).toEqual(
        expect.arrayContaining([expect.objectContaining(expectedItem)])
      );
    }
    expect(answersAtApproval.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: marker, quadrant: 'weaknesses' })])
    );

    const requestReview = page.getByRole('button', { name: /Request review|Wyślij do przeglądu/i });
    await expect(requestReview).toBeEnabled();
    await requestReview.click();
    const sendReview = page.getByRole('button', { name: /Send review|Wyślij/i }).last();
    await expect(sendReview).toBeVisible();
    await sendReview.click();

    approverContext = await signedContext(browser, approver);
    const approverPage = await approverContext.newPage();
    await approverPage.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
    await approverPage.getByRole('button', { name: /Outputs & Actions/i }).click();
    const approve = approverPage.getByRole('button', { name: /^Approve$|^Zatwierdź$/i });
    await expect(approve).toBeVisible({ timeout: 15_000 });
    await approve.click();

    await expect
      .poll(async () => {
        const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
          headers: { Authorization: `Bearer ${approver.token}` },
        });
        return read.status() === 200 ? (await read.json()).status : null;
      })
      .toBe('APPROVED');

    const approvedRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });
    expect(approvedRead.status()).toBe(200);
    const approved = await approvedRead.json();
    expect(approved.contextSnapshot.snapshotVersion).toBe(1);
    expect(approved.contextSnapshot.approvedSnapshot.approvedBy).toBe(approver.userId);
    expect(approved.contextSnapshot.approvedSnapshot.answers).toEqual(answersAtApproval);

    await approverPage
      .getByRole('button', { name: /Synthesis & Insights/i })
      .first()
      .click();
    await approverPage.getByText(/Show supporting analysis/i).click();
    const handoffResponsePromise = approverPage.waitForResponse(
      (response) =>
        response.url().includes(`/api/tools/${sessionId}/swot-candidates`) &&
        response.request().method() === 'POST'
    );
    const approvedCandidateAction = approverPage
      .getByRole('button', { name: /Send to candidates/i })
      .first();
    await expect(approvedCandidateAction).toBeEnabled();
    await approvedCandidateAction.click();
    const handoffResponse = await handoffResponsePromise;
    const candidateHandoff = await handoffResponse.json();
    expect(handoffResponse.status(), JSON.stringify(candidateHandoff)).toBe(201);
    candidateId = String(candidateHandoff?.candidate?.id || '');
    candidateTitle = String(candidateHandoff?.candidate?.title || '');
    expect(candidateId).toBeTruthy();
    expect(candidateTitle).toBeTruthy();

    const tamper = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers,
      data: { answers: { tampered: true } },
    });
    expect(tamper.status()).toBe(409);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
    await page.getByRole('button', { name: /Outputs & Actions/i }).click();
    await expect(page.getByRole('heading', { name: /Outputs & Actions/i })).toBeVisible({
      timeout: 30_000,
    });
    const attachmentInput = page.getByLabel(/Attach file|Dodaj plik/i);
    await attachmentInput.setInputFiles({
      name: attachmentName,
      mimeType: 'text/plain',
      buffer: Buffer.from(`UIA source for ${sessionId}`),
    });
    await expect(page.getByText(attachmentName)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await page.getByRole('button', { name: /Outputs & Actions/i }).click();
    await expect(page.getByText(attachmentName)).toBeVisible({ timeout: 30_000 });
    const downloadResponse = page.waitForResponse(
      (response) => response.request().method() === 'GET' && response.url().includes('/download')
    );
    await page.getByRole('button', { name: /Download|Pobierz/i }).click();
    await expect((await downloadResponse).status()).toBe(200);
    const finalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const finalBody = await finalRead.json();
    expect(finalBody.status).toBe('APPROVED');
    expect(finalBody.answers).toEqual(answersAtApproval);
    expect(finalBody.contextSnapshot.approvedSnapshot.answers).toEqual(answersAtApproval);

    await page.getByRole('button', { name: /Open Report Generator|Otwórz generator raportu/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/reports/builder\\?new=true&sourceType=TOOL&sourceId=${sessionId}`)
    );
    const promotionResponse = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
      headers,
      data: { outputType: 'report', title: `TLS governed report ${sessionId}` },
    });
    const promotionBody = await promotionResponse.json();
    expect(promotionResponse.status(), JSON.stringify(promotionBody)).toBe(200);
    reportId = String(promotionBody?.id || '');
    expect(reportId).toBeTruthy();

    const reportRead = await request.get(`${API_BASE_URL}/api/report-builder/${reportId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(reportRead.status()).toBe(200);
    const reportBody = await reportRead.json();
    expect(reportBody.report).toMatchObject({
      id: reportId,
      sourceType: 'TOOL',
      sourceId: sessionId,
      status: 'GENERATED',
    });
    expect(reportBody.sections.length).toBeGreaterThan(0);
    expect(
      reportBody.sections.every(
        (section: any) =>
          String(section.generatedContent || section.editedContent || '').length > 20
      )
    ).toBe(true);

    await page.getByRole('button', { name: /Report created|Raport utworzony/i }).click();
    await expect(page).toHaveURL(new RegExp(`/reports/builder/${reportId}`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/reports/builder/${reportId}`));
    await expect(page.getByRole('textbox', { name: /Report title/i })).toHaveValue(
      reportBody.report.title,
      { timeout: 30_000 }
    );

    const frozen = await pool.query<{
      id: string;
      payload_json: unknown;
      content_hash: string;
      tool_type: string;
      method_pack_version: string;
      status: string;
      created_by: string;
      approved_by: string;
      created_at: Date;
      approved_at: Date;
      frozen_at: Date;
    }>(
      `SELECT id,tool_type,method_pack_version,payload_json,content_hash,status,created_by,approved_by,created_at,approved_at,frozen_at
       FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2`,
      [owner.organizationId, sessionId]
    );
    expect(frozen.rowCount).toBe(1);
    outputId = frozen.rows[0].id;
    const frozenPayload = frozen.rows[0].payload_json as {
      items: unknown[];
      tensions: unknown[];
      conclusions: unknown[];
      sourceRevision: number;
    };
    expect(frozen.rows[0].content_hash).toMatch(/^[a-f0-9]{16}$/);
    expect(frozen.rows[0].content_hash).toBe(
      computeOutputHash({
        toolType: frozen.rows[0].tool_type,
        methodPackVersion: frozen.rows[0].method_pack_version,
        items: frozenPayload.items,
        tensions: frozenPayload.tensions,
        conclusions: frozenPayload.conclusions,
      })
    );
    expect(frozenPayload.items.length).toBeGreaterThan(0);
    expect(frozenPayload.tensions.length).toBeGreaterThan(0);
    expect(frozenPayload.conclusions.length).toBeGreaterThan(0);
    expect(frozenPayload.sourceRevision).toBe(finalBody.version);
    expect(JSON.stringify(frozenPayload)).toContain(marker);
    expect(frozen.rows[0]).toMatchObject({
      status: 'approved',
      created_by: owner.userId,
      approved_by: owner.userId,
    });
    expect(frozen.rows[0].created_at).toBeTruthy();
    expect(frozen.rows[0].approved_at).toBeTruthy();
    expect(frozen.rows[0].frozen_at).toBeTruthy();
    const immutableSnapshot = JSON.stringify(frozen.rows[0]);

    const replay = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
      headers,
      data: { outputType: 'report', title: reportBody.report.title },
    });
    const replayBody = await replay.json();
    expect(replay.status(), JSON.stringify(replayBody)).toBe(200);
    expect(String(replayBody.id)).toBe(reportId);
    const beforePayloadConflict = await pool.query(
      `SELECT
       (SELECT count(*)::int FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2) outputs,
       (SELECT count(*)::int FROM report_builder_reports WHERE organization_id=$1 AND source_type='TOOL' AND source_id=$2) reports,
       (SELECT count(*)::int FROM tool_initiative_links WHERE organization_id=$1 AND tool_session_id=$2) links,
       (SELECT content_hash FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2) content_hash`,
      [owner.organizationId, sessionId]
    );
    const changedPayload = await request.post(`${API_BASE_URL}/api/tools/${sessionId}/promote`, {
      headers,
      data: { outputType: 'report', title: `${reportBody.report.title} changed` },
    });
    expect(changedPayload.status()).toBe(409);
    const afterPayloadConflict = await pool.query(
      `SELECT
       (SELECT count(*)::int FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2) outputs,
       (SELECT count(*)::int FROM report_builder_reports WHERE organization_id=$1 AND source_type='TOOL' AND source_id=$2) reports,
       (SELECT count(*)::int FROM tool_initiative_links WHERE organization_id=$1 AND tool_session_id=$2) links,
       (SELECT content_hash FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2) content_hash`,
      [owner.organizationId, sessionId]
    );
    expect(afterPayloadConflict.rows).toEqual(beforePayloadConflict.rows);
    const replayCounts = await pool.query<{
      outputs: number;
      reports: number;
      sections: number;
      canonical_reports: number;
      canonical_sources: number;
      approvals: number;
      links: number;
    }>(
      `SELECT
       (SELECT count(*)::int FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2) outputs,
       (SELECT count(*)::int FROM report_builder_reports WHERE organization_id=$1 AND id=$3) reports,
       (SELECT count(*)::int FROM report_builder_sections WHERE report_id=$3) sections,
       (SELECT count(*)::int FROM tool_reports WHERE organization_id=$1 AND kind='report') canonical_reports,
       (SELECT count(*)::int FROM tool_report_sources WHERE organization_id=$1 AND tool_output_id=$4) canonical_sources,
       (SELECT count(*)::int FROM tool_output_approvals WHERE organization_id=$1 AND tool_output_id=$4) approvals,
       (SELECT count(*)::int FROM tool_initiative_links WHERE organization_id=$1 AND tool_session_id=$2 AND output_type='report') links`,
      [owner.organizationId, sessionId, reportId, outputId]
    );
    expect(replayCounts.rows[0].outputs).toBe(1);
    expect(replayCounts.rows[0].reports).toBe(1);
    expect(replayCounts.rows[0].sections).toBeGreaterThan(0);
    expect(replayCounts.rows[0].canonical_reports).toBe(1);
    expect(replayCounts.rows[0].canonical_sources).toBe(1);
    expect(replayCounts.rows[0].approvals).toBe(2);
    expect(replayCounts.rows[0].links).toBe(1);

    const exactLineage = await pool.query<{
      initiative_id: string;
      source_revision: number;
      output_type: string;
      tool_report_id: string;
      tool_output_id: string;
      link_created_at: Date;
      report_created_at: Date;
    }>(
      `SELECT l.initiative_id,l.source_revision,l.output_type,s.tool_report_id,s.tool_output_id,
            l.created_at link_created_at,r.created_at report_created_at
       FROM tool_initiative_links l
       JOIN tool_report_sources s ON s.organization_id=l.organization_id AND s.tool_output_id=$4
       JOIN tool_reports r ON r.id=s.tool_report_id AND r.organization_id=l.organization_id AND r.kind='report'
      WHERE l.organization_id=$1 AND l.tool_session_id=$2 AND l.initiative_id=$3`,
      [owner.organizationId, sessionId, reportId, outputId]
    );
    expect(exactLineage.rowCount).toBe(1);
    expect(exactLineage.rows[0]).toMatchObject({
      initiative_id: reportId,
      source_revision: finalBody.version,
      output_type: 'report',
      tool_output_id: outputId,
    });
    expect(exactLineage.rows[0].link_created_at).toBeTruthy();
    expect(exactLineage.rows[0].report_created_at).toBeTruthy();
    const approvalActors = await pool.query<{ actor_user_id: string; action: string }>(
      `SELECT actor_user_id,action FROM tool_output_approvals
      WHERE organization_id=$1 AND tool_output_id=$2 ORDER BY created_at`,
      [owner.organizationId, outputId]
    );
    expect(approvalActors.rows).toEqual([
      { actor_user_id: owner.userId, action: 'submitted' },
      { actor_user_id: owner.userId, action: 'approved' },
    ]);

    coldContext = await signedContext(browser, owner);
    const coldPage = await coldContext.newPage();
    await coldPage.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
    await coldPage.getByRole('button', { name: /Outputs & Actions/i }).click();
    await expect(coldPage.getByText(marker)).toBeVisible({ timeout: 30_000 });
    await coldPage.goto(`/reports/builder/${encodeURIComponent(reportId)}`);
    await coldPage.reload();
    await expect(coldPage.getByRole('textbox', { name: /Report title/i })).toHaveValue(
      reportBody.report.title
    );
    await coldPage.goto(
      `/initiatives?tab=candidates&candidateInbox=discovery&candidateId=${encodeURIComponent(candidateId)}`
    );
    await expect(coldPage.getByText(candidateTitle).first()).toBeVisible({ timeout: 30_000 });
    await coldPage.reload();
    await expect(coldPage.getByText(candidateTitle).first()).toBeVisible({ timeout: 30_000 });
    const coldFrozen = await pool.query(
      `SELECT id,tool_type,method_pack_version,payload_json,content_hash,status,
              created_by,approved_by,created_at,approved_at,frozen_at
       FROM tool_outputs WHERE organization_id=$1 AND tool_session_id=$2`,
      [owner.organizationId, sessionId]
    );
    expect(JSON.stringify(coldFrozen.rows[0])).toBe(immutableSnapshot);
  } finally {
    await coldContext?.close();
    await approverContext?.close();
    await ownerContext?.close();
    if (sessionId) {
      const ownedDecisions = await pool.query<{ decision_id: string }>(
        `SELECT decision_id FROM tool_decisions WHERE tool_session_id=$1 AND decision_id IS NOT NULL`,
        [sessionId]
      );
      decisionIds = ownedDecisions.rows.map((row) => row.decision_id);
      if (decisionIds.length > 0) {
        await pool.query(`DELETE FROM decision_history WHERE decision_id=ANY($1::text[])`, [
          decisionIds,
        ]);
      }
      await pool.query(`DELETE FROM tool_decisions WHERE tool_session_id=$1`, [sessionId]);
    }
    if (owner) await cleanup(request, runId);
    if (sessionId) {
      const residue = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM tool_sessions WHERE id=$1) sessions,
           (SELECT count(*)::int FROM tool_outputs WHERE tool_session_id=$1) outputs,
           (SELECT count(*)::int FROM tool_output_initiative_proposals WHERE tool_output_id=$3) proposals,
           (SELECT count(*)::int FROM tool_session_events WHERE tool_session_id=$1) events,
           (SELECT count(*)::int FROM tool_initiative_links WHERE tool_session_id=$1) links,
           (SELECT count(*)::int FROM report_builder_reports WHERE id=$2) reports,
           (SELECT count(*)::int FROM report_builder_sections WHERE report_id=$2) sections,
           (SELECT count(*)::int FROM report_exports WHERE report_id=$2) exports,
           (SELECT count(*)::int FROM report_edit_history WHERE report_id=$2) report_history,
           (SELECT count(*)::int FROM tool_output_approvals WHERE tool_output_id=$3) approvals,
           (SELECT count(*)::int FROM tool_report_sources WHERE tool_output_id=$3) canonical_sources,
           (SELECT count(*)::int FROM tool_reports WHERE organization_id=$4) canonical_reports,
           (SELECT count(*)::int FROM tool_decisions WHERE tool_session_id=$1) decisions,
           (SELECT count(*)::int FROM swot_candidate_handoffs WHERE tool_session_id=$1) candidate_receipts,
           (SELECT count(*)::int FROM initiative_candidates WHERE id=$8) candidates,
           (SELECT count(*)::int FROM decision_history WHERE decision_id=ANY($6::text[])) decision_history,
           (SELECT count(*)::int FROM audit_log WHERE resource_id=ANY($7::text[])) audit,
           (SELECT count(*)::int FROM organization_members WHERE organization_id=$4) memberships,
           (SELECT count(*)::int FROM users WHERE organization_id=$4) users,
           (SELECT count(*)::int FROM organizations WHERE id=$4) organizations,
           (SELECT count(*)::int FROM test_support_runs WHERE run_id=$5) test_support`,
        [
          sessionId,
          reportId || 'missing',
          outputId || 'missing',
          owner?.organizationId || 'missing',
          runId,
          decisionIds,
          [sessionId, outputId, reportId, owner?.organizationId].filter(Boolean),
          candidateId || 'missing',
        ]
      );
      expect(residue.rows[0]).toEqual({
        sessions: 0,
        outputs: 0,
        proposals: 0,
        events: 0,
        links: 0,
        reports: 0,
        sections: 0,
        exports: 0,
        report_history: 0,
        approvals: 0,
        canonical_sources: 0,
        canonical_reports: 0,
        decisions: 0,
        candidate_receipts: 0,
        candidates: 0,
        decision_history: 0,
        audit: 0,
        memberships: 0,
        users: 0,
        organizations: 0,
        test_support: 0,
      });
    }
    const locks = await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM pg_locks WHERE locktype='advisory' AND granted`
    );
    expect(locks.rows[0].count).toBe(0);
    await pool.end();
  }
});
