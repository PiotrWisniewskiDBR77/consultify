import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  addMember,
  assertSignedJwt,
  authHeaders,
  bootstrapTenant,
  cleanupRuns,
  setMembershipState,
  signedBrowserContext,
  type SwotPersona,
} from './_helpers/swotUiTechnicalFixture';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

const validAnswers = {
  context: {
    goal: 'Choose a defensible growth priority',
    scope: 'European B2B operations',
    timeframe: 'medium',
    successSignal: 'One approved, evidence-linked move',
  },
  items: [
    { id: 'tls-ui-s', text: 'Trusted brand', quadrant: 'strengths', proposalStatus: 'accepted' },
    { id: 'tls-ui-w', text: 'Slow reporting', quadrant: 'weaknesses', proposalStatus: 'accepted' },
    {
      id: 'tls-ui-o',
      text: 'Automation demand',
      quadrant: 'opportunities',
      proposalStatus: 'accepted',
    },
    { id: 'tls-ui-t', text: 'Price pressure', quadrant: 'threats', proposalStatus: 'accepted' },
  ],
  tensions: [
    {
      id: 'tls-ui-tension',
      title: 'Brand versus price pressure',
      insight: 'Protect value before expanding.',
      type: 'protect',
      linkedItemIds: ['tls-ui-s', 'tls-ui-t'],
      proposalStatus: 'accepted',
    },
  ],
  recommendedMoves: [
    {
      id: 'tls-ui-move',
      title: 'Launch value-retention programme',
      category: 'defensive-move',
      rationale: 'The trusted brand can offset price pressure.',
      linkedItemIds: ['tls-ui-s', 'tls-ui-t'],
      linkedTensionIds: ['tls-ui-tension'],
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      firstStep: 'Assign the programme to the commercial owner.',
      ownerRole: 'Commercial owner',
      tradeoff: {
        chosen: 'Retention of the valuable B2B base',
        deferred: 'Broad price-led expansion',
        cost: 'Slower acquisition this quarter',
      },
      rejectedAlternative: {
        option: 'Across-the-board discounting',
        reason: 'It destroys the differentiated value identified by the analysis.',
      },
      proposalStatus: 'accepted',
    },
  ],
  summary: {
    executiveSummary: 'Protect differentiated value and repair reporting.',
    proposalStatus: 'accepted',
  },
  outputCandidates: [
    {
      id: 'tls-ui-output',
      title: 'B2B retention initiative',
      description: 'Convert the approved move into an accountable initiative.',
      outputType: 'initiative',
      readiness: 'ready-for-initiative',
      proposalStatus: 'accepted',
    },
  ],
};

async function createReadySession(persona: SwotPersona, request: APIRequestContext) {
  const headers = authHeaders(persona);
  const create = await request.post(`${API_BASE_URL}/api/tools`, {
    headers,
    data: { toolType: 'dynamic-swot', name: `TLS UI technical ${Date.now()}` },
  });
  expect(create.status(), await create.text()).toBe(200);
  const session = await create.json();
  const ready = await request.put(`${API_BASE_URL}/api/tools/${session.id}`, {
    headers,
    data: {
      expectedVersion: session.version,
      answers: validAnswers,
      completionPercent: 100,
      confidenceAvg: 4,
      missingItems: [],
    },
  });
  expect(ready.status(), await ready.text()).toBe(200);
  return ready.json();
}

test.describe.serial('TLS-UI-CANON signed technical state packet', () => {
  const runIds: string[] = [];

  test.afterAll(async ({ request }) => {
    if (runIds.length > 0) await cleanupRuns(request, runIds);
  });

  test('separate signed creator and approver freeze one canonical session; ordinary member is forbidden', async ({
    request,
  }) => {
    const runId = `tls-ui-role-${Date.now().toString(36)}`;
    runIds.push(runId);
    const creator = await bootstrapTenant(request, runId, 'ADMIN');
    const approver = await addMember(request, creator, 'ADMIN');
    const ordinary = await addMember(request, creator, 'USER');
    [creator, approver, ordinary].forEach(assertSignedJwt);

    const session = await createReadySession(creator, request);
    const review = await request.post(`${API_BASE_URL}/api/tools/${session.id}/request-review`, {
      headers: authHeaders(creator),
      data: {},
    });
    expect(review.status(), await review.text()).toBe(200);

    const forbidden = await request.post(`${API_BASE_URL}/api/tools/${session.id}/approve`, {
      headers: authHeaders(ordinary),
      data: {},
    });
    expect(forbidden.status()).toBe(403);
    const stillReview = await request.get(`${API_BASE_URL}/api/tools/${session.id}`, {
      headers: authHeaders(creator),
    });
    expect((await stillReview.json()).status).toBe('REVIEW');

    const approved = await request.post(`${API_BASE_URL}/api/tools/${session.id}/approve`, {
      headers: authHeaders(approver),
      data: {},
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const frozen = await request.get(`${API_BASE_URL}/api/tools/${session.id}`, {
      headers: authHeaders(creator),
    });
    const frozenBody = await frozen.json();
    expect(frozenBody.status).toBe('APPROVED');
    expect(frozenBody.contextSnapshot.approvedSnapshot.answers).toEqual(validAnswers);
  });

  test('stale concurrent edits have exactly one winner and preserve its canonical value', async ({
    request,
  }) => {
    const runId = `tls-ui-stale-${Date.now().toString(36)}`;
    runIds.push(runId);
    const creator = await bootstrapTenant(request, runId, 'ADMIN');
    const session = await createReadySession(creator, request);
    const headers = authHeaders(creator);
    const writes = await Promise.all(
      ['winner-a', 'winner-b'].map((marker) =>
        request.put(`${API_BASE_URL}/api/tools/${session.id}`, {
          headers,
          data: {
            expectedVersion: session.version,
            answers: {
              ...validAnswers,
              context: { ...validAnswers.context, successSignal: marker },
            },
          },
        })
      )
    );
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 409]);
    const read = await request.get(`${API_BASE_URL}/api/tools/${session.id}`, { headers });
    expect(['winner-a', 'winner-b']).toContain((await read.json()).answers.context.successSignal);
  });

  test('foreign tenant and revoked signed identity fail closed without changing the session', async ({
    request,
  }) => {
    const ownerRun = `tls-ui-owner-${Date.now().toString(36)}`;
    const foreignRun = `tls-ui-foreign-${Date.now().toString(36)}`;
    runIds.push(ownerRun, foreignRun);
    const owner = await bootstrapTenant(request, ownerRun, 'ADMIN');
    const revoked = await addMember(request, owner, 'USER');
    const foreign = await bootstrapTenant(request, foreignRun, 'ADMIN');
    const session = await createReadySession(owner, request);

    const foreignRead = await request.get(`${API_BASE_URL}/api/tools/${session.id}`, {
      headers: authHeaders(foreign),
    });
    expect(foreignRead.status()).toBe(404);

    await setMembershipState(revoked, 'REVOKED');
    const revokedRead = await request.get(`${API_BASE_URL}/api/tools/${session.id}`, {
      headers: authHeaders(revoked),
    });
    expect(revokedRead.status()).toBe(403);
  });

  test('mounted promotion failure never renders report success and remains deterministically retryable', async ({
    browser,
    request,
  }) => {
    const runId = `tls-ui-failure-${Date.now().toString(36)}`;
    runIds.push(runId);
    const admin = await bootstrapTenant(request, runId, 'ADMIN');
    const session = await createReadySession(admin, request);
    await request.post(`${API_BASE_URL}/api/tools/${session.id}/request-review`, {
      headers: authHeaders(admin),
      data: {},
    });
    await request.post(`${API_BASE_URL}/api/tools/${session.id}/approve`, {
      headers: authHeaders(admin),
      data: {},
    });

    const context = await signedBrowserContext(browser, admin);
    const page = await context.newPage();
    let promotionAttempts = 0;
    await page.route(`**/api/tools/${session.id}/promote`, async (route) => {
      promotionAttempts += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced bounded outage' }),
      });
    });
    await page.goto(`/discovery-tools?docId=${encodeURIComponent(session.id)}`);
    await page.getByRole('button', { name: /Outputs & Actions/i }).click();
    const generate = page.getByRole('button', { name: /Generate report|Generuj raport/i });
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.getByText(/forced bounded outage/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Report created|Raport utworzony/i })
    ).toHaveCount(0);
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect.poll(() => promotionAttempts).toBe(2);
    await context.close();
  });
});
