import { expect, test } from '@playwright/test';
import pg from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

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

test('TLS-02/03: SWOT deep-link, edit, durable autosave and hard-reload resume on real PostgreSQL', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const { token } = readTestSupportState();
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const marker = `SWOT durable weakness ${Date.now()}`;

  const create = await request.post(`${API_BASE_URL}/api/tools`, {
    headers,
    data: { toolType: 'dynamic-swot', name: `TLS real-PG SWOT ${Date.now()}` },
  });
  expect(create.status()).toBe(200);
  const createdSession = await create.json();
  const sessionId = String(createdSession.id || '');
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

  const weaknessInput = page.getByPlaceholder(/Add point|Dodaj punkt/i).nth(1);
  await expect(weaknessInput).toBeVisible();
  await weaknessInput.fill(marker);
  await weaknessInput.locator('..').getByRole('button').click();
  await expect(page.getByText(marker)).toBeVisible();

  await expect
    .poll(
      async () => {
        const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
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
  await expect(page.getByText(marker)).toBeVisible();

  const finalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(finalRead.status()).toBe(200);
  const finalBody = await finalRead.json();
  expect(finalBody.id).toBe(sessionId);
  expect(finalBody.answers.items.some((item: any) => item?.text === marker)).toBe(true);
});

test('TLS-05: ready SWOT is submitted and approved in UI, frozen in PostgreSQL and immutable after reload', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const { token, organizationId } = readTestSupportState();
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const create = await request.post(`${API_BASE_URL}/api/tools`, {
    headers,
    data: { toolType: 'dynamic-swot', name: `TLS quality gate ${Date.now()}` },
  });
  expect(create.status()).toBe(200);
  const createdSession = await create.json();
  const sessionId = String(createdSession.id || '');

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
  await page.getByRole('button', { name: /Outputs & Actions/i }).click();
  await expect(page.getByRole('heading', { name: /Outputs & Actions/i })).toBeVisible();
  await expect
    .poll(
      async () => {
        const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (read.status() !== 200) return false;
        return (await read.json())?.answers?.context?.timeframe === 'medium';
      },
      { timeout: 15_000, message: 'normalized UI state was not durably autosaved before review' }
    )
    .toBe(true);

  const preApprovalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(preApprovalRead.status()).toBe(200);
  const answersAtApproval = (await preApprovalRead.json()).answers;
  expect(answersAtApproval).toMatchObject(completeSwotAnswers);

  const requestReview = page.getByRole('button', { name: /Request review|Wyślij do przeglądu/i });
  await expect(requestReview).toBeEnabled();
  await requestReview.click();
  const sendReview = page.getByRole('button', { name: /Send review|Wyślij/i }).last();
  await expect(sendReview).toBeVisible();
  await sendReview.click();

  const approve = page.getByRole('button', { name: /^Approve$|^Zatwierdź$/i });
  await expect(approve).toBeVisible({ timeout: 15_000 });
  await approve.click();

  await expect
    .poll(async () => {
      const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return read.status() === 200 ? (await read.json()).status : null;
    })
    .toBe('APPROVED');

  const approvedRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(approvedRead.status()).toBe(200);
  const approved = await approvedRead.json();
  expect(approved.contextSnapshot.snapshotVersion).toBe(1);
  expect(approved.contextSnapshot.approvedSnapshot.answers).toEqual(answersAtApproval);

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
  const finalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const finalBody = await finalRead.json();
  expect(finalBody.status).toBe('APPROVED');
  expect(finalBody.answers).toEqual(answersAtApproval);
  expect(finalBody.contextSnapshot.approvedSnapshot.answers).toEqual(answersAtApproval);

  const promotionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tools/${sessionId}/promote`) &&
      response.request().method() === 'POST'
  );
  const generateReport = page.getByRole('button', { name: /Generate report|Generuj raport/i });
  await expect(generateReport).toBeEnabled();
  await generateReport.click();
  const promotionResponse = await promotionResponsePromise;
  const promotionBody = await promotionResponse.json();
  expect(promotionResponse.status(), JSON.stringify(promotionBody)).toBe(200);
  const reportId = String(promotionBody?.id || '');
  expect(reportId).toBeTruthy();

  const reportRead = await request.get(`${API_BASE_URL}/api/report-builder/${reportId}`, {
    headers: { Authorization: `Bearer ${token}` },
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
      (section: any) => String(section.generatedContent || section.editedContent || '').length > 20
    )
  ).toBe(true);

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `UPDATE organizations SET plan = 'enterprise', organization_type = 'PAID' WHERE id = $1`,
      [organizationId]
    );
  } finally {
    await db.end();
  }

  const pdfExport = await request.get(`${API_BASE_URL}/api/report-builder/${reportId}/export/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(pdfExport.status(), await pdfExport.text()).toBe(200);
  expect(pdfExport.headers()['content-type']).toContain('application/pdf');
  expect((await pdfExport.body()).length).toBeGreaterThan(500);

  await page.getByRole('button', { name: /Report created|Raport utworzony/i }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/builder/${reportId}`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/reports/builder/${reportId}`));
  await expect(page.getByRole('textbox', { name: /Report title/i })).toHaveValue(
    reportBody.report.title,
    { timeout: 30_000 }
  );
});
