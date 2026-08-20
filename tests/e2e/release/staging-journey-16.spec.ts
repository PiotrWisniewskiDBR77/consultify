import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';

import { seedAuditProgram } from '../ui-canon-g4/_g4/auditSeed';

const BASE_URL = process.env.E2E_BASE_URL || 'https://staging.consultify.ai';
const SESSION_PATH = process.env.STAGING_SESSION_PATH || '';
const STORAGE_PATH = process.env.E2E_STORAGE_STATE_PATH || '';
const REVIEWER_SESSION_PATH = process.env.STAGING_REVIEWER_SESSION_PATH || '';

type Session = {
  token: string;
  userId: string;
  organizationId: string;
};

function primarySession(): Session {
  if (!SESSION_PATH) throw new Error('STAGING_SESSION_PATH is required.');
  const parsed = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as { primary?: Session };
  if (!parsed.primary?.token || !parsed.primary.userId || !parsed.primary.organizationId) {
    throw new Error('The real staging primary session is incomplete.');
  }
  return parsed.primary;
}

function storageStatePath(): string {
  if (!STORAGE_PATH) throw new Error('E2E_STORAGE_STATE_PATH is required.');
  return STORAGE_PATH;
}

function reviewerSession(): Session {
  if (!REVIEWER_SESSION_PATH) throw new Error('STAGING_REVIEWER_SESSION_PATH is required.');
  const parsed = JSON.parse(fs.readFileSync(REVIEWER_SESSION_PATH, 'utf8')) as {
    reviewer?: Session;
  };
  if (!parsed.reviewer?.token || !parsed.reviewer.userId || !parsed.reviewer.organizationId) {
    throw new Error('The real staging reviewer session is incomplete.');
  }
  return parsed.reviewer;
}

function authHeaders(session: Session) {
  return {
    authorization: `Bearer ${session.token}`,
    'content-type': 'application/json',
    'x-org-context': session.organizationId,
  };
}

test.describe.serial('STG-JOURNEY-16 deployed business journeys', () => {
  test.setTimeout(120_000);

  test('CHAT: persisted user message survives independent API and cold browser reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const title = `STG-JOURNEY-CHAT-${runId.slice(0, 8)}`;
    const content = `Deployed Chat cold-readback ${runId}`;

    try {
      const created = await api.post('/api/conversations', {
        data: { title, language: 'en' },
      });
      expect(created.status()).toBe(201);
      const conversation = (await created.json()) as { id?: string; title?: string };
      expect(conversation.id).toBeTruthy();
      expect(conversation.title).toBe(title);

      const added = await api.post(`/api/conversations/${conversation.id}/messages`, {
        data: {
          role: 'user',
          content,
          clientMessageId: runId,
          metadata: { releaseJourney: 'STG-JOURNEY-16' },
        },
      });
      expect(added.status()).toBe(201);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/conversations/${conversation.id}`);
      expect(read.status()).toBe(200);
      const readBody = (await read.json()) as {
        title?: string;
        messages?: Array<{ content?: string }>;
      };
      expect(readBody.title).toBe(title);
      expect(readBody.messages?.some((message) => message.content === content)).toBe(true);
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/chat/${conversation.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('SET: appearance write is confirmed by independent API and cold browser context', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });

    try {
      const before = await api.get('/api/settings/preferences/appearance');
      expect(before.status()).toBe(200);
      const beforeBody = (await before.json()) as { preferences?: Record<string, unknown> };
      const nextTheme = beforeBody.preferences?.theme === 'dark' ? 'light' : 'dark';

      const write = await api.put('/api/settings/preferences/appearance', {
        data: {
          ...beforeBody.preferences,
          theme: nextTheme,
        },
      });
      expect(write.status()).toBe(200);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get('/api/settings/preferences/appearance');
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ preferences: { theme: nextTheme } });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/settings/theme', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('button', { name: nextTheme === 'dark' ? /Dark|Ciemny/i : /Light|Jasny/i })
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('PRT: non-economic partner connection survives independent and cold UI readback', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const companyName = `STG Partner ${runId.slice(0, 8)}`;

    try {
      const current = await api.get('/api/partners/connection');
      expect(current.status()).toBe(200);
      const currentBody = (await current.json()) as {
        data?: { connected?: boolean; organization?: { name?: string } | null };
      };

      if (!currentBody.data?.connected) {
        const connected = await api.post('/api/v8/partner/connect', {
          headers: { 'idempotency-key': `stg-journey-prt-${runId}` },
          data: {
            name: companyName,
            contactEmail: `stg-journey-${runId}@example.test`,
          },
        });
        expect([200, 201]).toContain(connected.status());
      }

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get('/api/partners/connection');
      expect(read.status()).toBe(200);
      const readBody = (await read.json()) as {
        data?: { connected?: boolean; organization?: { name?: string } | null };
      };
      expect(readBody.data?.connected).toBe(true);
      const durableName = String(readBody.data?.organization?.name || '');
      expect(durableName).toBeTruthy();
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/partner?tab=company-info', { waitUntil: 'domcontentloaded' });
      const companyNameInput = page.getByRole('textbox').first();
      await expect(companyNameInput).toHaveValue(durableName, { timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('textbox').first()).toHaveValue(durableName, {
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('RES: canonical KPI draft is durable and visible after a cold registry reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const name = `STG Results KPI ${runId.slice(0, 8)}`;
    const kpiCode = `STG-${runId.slice(0, 8).toUpperCase()}`;

    try {
      const created = await api.post('/api/vnext/results/kpi', {
        data: {
          kpiCode,
          name,
          description: 'Exact deployed Results cold-readback journey',
          unit: '%',
          targetGeometry: 'threshold_min',
          targetValue: 80,
          idempotencyKey: `stg-journey-res-${runId}`,
        },
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as {
        kpi?: { kpiId?: string; status?: string };
        definitionVersion?: { definitionVersionId?: string; name?: string };
      };
      const kpiId = String(createdBody.kpi?.kpiId || '');
      expect(kpiId).toBeTruthy();
      expect(createdBody.definitionVersion?.name).toBe(name);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/vnext/results/kpi/${kpiId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ kpi: { kpiId } });
      const versionRead = await independent.get(`/api/vnext/results/kpi/${kpiId}/version`);
      expect(versionRead.status()).toBe(200);
      const initialVersion = (await versionRead.json()) as {
        definitionVersion?: { definitionVersionId?: string; name?: string; rowVersion?: number };
      };
      expect(initialVersion).toMatchObject({
        definitionVersion: {
          definitionVersionId: createdBody.definitionVersion?.definitionVersionId,
          name,
        },
      });
      await independent.dispose();

      const submitted = await api.post(`/api/vnext/results/kpi/${kpiId}/submit`, {
        data: {
          expectedVersion: initialVersion.definitionVersion?.rowVersion,
          reason: 'STG-JOURNEY-16 maker submission',
          idempotencyKey: `stg-journey-res-submit-${runId}`,
        },
      });
      expect(submitted.status()).toBe(200);
      const submittedBody = (await submitted.json()) as {
        definitionVersion?: {
          definitionVersionId?: string;
          approvalStatus?: string;
          rowVersion?: number;
        };
      };
      expect(submittedBody.definitionVersion?.approvalStatus).toBe('submitted');

      const reviewer = reviewerSession();
      const reviewerApi = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(reviewer),
      });
      const approved = await reviewerApi.post(
        `/api/vnext/results/kpi/${kpiId}/definition-versions/${createdBody.definitionVersion?.definitionVersionId}/approve`,
        {
          data: {
            expectedVersion: submittedBody.definitionVersion?.rowVersion,
            reason: 'STG-JOURNEY-16 independent reviewer approval',
            idempotencyKey: `stg-journey-res-approve-${runId}`,
          },
        }
      );
      expect(approved.status()).toBe(200);
      expect(await approved.json()).toMatchObject({
        definitionVersion: { approvalStatus: 'approved', approvedBy: reviewer.userId },
      });
      await reviewerApi.dispose();

      const preActivation = await api.get(`/api/vnext/results/kpi/${kpiId}`);
      expect(preActivation.status()).toBe(200);
      const preActivationBody = (await preActivation.json()) as {
        kpi?: { rowVersion?: number };
      };
      const activated = await api.post(`/api/vnext/results/kpi/${kpiId}/activate`, {
        data: {
          expectedVersion: preActivationBody.kpi?.rowVersion,
          reason: 'STG-JOURNEY-16 approved definition activation',
          idempotencyKey: `stg-journey-res-activate-${runId}`,
        },
      });
      expect(activated.status()).toBe(200);
      expect(await activated.json()).toMatchObject({ kpi: { kpiId, status: 'active' } });

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      // This registry is intentionally default-OFF. The dated Results design
      // exposes this explicit per-user opt-in and persists it in localStorage;
      // the staging journey must not silently promote the production default.
      await page.goto('/results/kpi?ff_resultsVNextKpi=1', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByText(kpiCode, { exact: true })).toBeVisible({ timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(kpiCode, { exact: true })).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('MAT: deterministic document generation survives canonical GET and cold studio reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const title = `STG Materials Document ${runId.slice(0, 8)}`;
    const intake = {
      title,
      description: 'Deployed deterministic document lifecycle proof.',
      documentType: 'generic_document',
      language: 'en',
      density: 'concise',
      goal: 'inform',
      audience: ['Release owner'],
    };

    try {
      const planned = await api.post('/api/document-studio/plan', {
        data: { intake, useLlm: false },
      });
      expect(planned.status()).toBe(200);
      const { outline } = (await planned.json()) as { outline?: unknown };
      expect(outline).toBeTruthy();

      const generated = await api.post('/api/document-studio/generate', {
        data: { intake, outline, useLlm: false },
        timeout: 60_000,
      });
      expect(generated.status()).toBe(200);
      const generatedBody = (await generated.json()) as {
        artifactId?: string;
        schema?: { title?: string };
      };
      const artifactId = String(generatedBody.artifactId || '');
      expect(artifactId).toBeTruthy();
      expect(generatedBody.schema?.title).toBe(title);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/document-studio/${artifactId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ schema: { title } });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/document-studio/${artifactId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('TLS: Dynamic SWOT reaches independent approval, immutable output and replayable promotion', async ({
    browser,
  }) => {
    const maker = primarySession();
    const reviewer = reviewerSession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(maker),
    });
    const reviewerApi = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(reviewer),
    });
    const runId = randomUUID();
    const name = `STG Dynamic SWOT ${runId.slice(0, 8)}`;
    const answers = {
      context: {
        goal: 'Choose a defensible growth priority',
        scope: 'Staging release rehearsal',
        timeframe: 'medium',
        successSignal: 'One independently approved move',
      },
      items: [
        {
          id: `${runId}-s`,
          text: 'Trusted delivery',
          quadrant: 'strengths',
          proposalStatus: 'accepted',
          evidenceStatus: 'confirmed',
        },
        {
          id: `${runId}-o`,
          text: 'Automation demand',
          quadrant: 'opportunities',
          proposalStatus: 'accepted',
          evidenceStatus: 'confirmed',
        },
      ],
      tensions: [
        {
          id: `${runId}-t`,
          title: 'Delivery meets demand',
          type: 'attack',
          linkedItemIds: [`${runId}-s`, `${runId}-o`],
          linkedCorrelationIds: [],
          insight: 'A bounded pilot tests the thesis.',
          proposalStatus: 'accepted',
        },
      ],
      recommendedMoves: [
        {
          id: `${runId}-m`,
          title: 'Launch bounded automation pilot',
          category: 'quick-win',
          rationale: 'Both source items are evidence-confirmed.',
          linkedTensionIds: [`${runId}-t`],
          linkedItemIds: [`${runId}-s`, `${runId}-o`],
          expectedImpact: 'high',
          estimatedEffort: 'medium',
          firstStep: 'Select one customer',
          ownerRole: 'Delivery owner',
          tradeoff: {
            chosen: 'Direct pilot',
            deferred: 'Full rollout',
            cost: 'One quarter capacity',
          },
          rejectedAlternative: {
            option: 'Immediate rollout',
            reason: 'Insufficient first-party evidence',
          },
          proposalStatus: 'accepted',
        },
      ],
      summary: {
        executiveSummary: 'Validate the bounded automation thesis.',
        proposalStatus: 'accepted',
      },
    };

    try {
      const created = await api.post('/api/tools', {
        data: { toolType: 'dynamic-swot', name },
      });
      expect(created.status()).toBe(200);
      const session = (await created.json()) as { id?: string; version?: number };
      const sessionId = String(session.id || '');
      expect(sessionId).toBeTruthy();

      const saved = await api.put(`/api/tools/${sessionId}`, {
        data: {
          expectedVersion: session.version,
          answers,
          contextSnapshot: { mission: 'Validate growth safely' },
          completionPercent: 100,
          confidenceAvg: 4.5,
          missingItems: [],
        },
      });
      expect(saved.status()).toBe(200);

      const review = await api.post(`/api/tools/${sessionId}/request-review`, { data: {} });
      expect(review.status()).toBe(200);
      expect(await review.json()).toMatchObject({ status: 'REVIEW' });

      const approved = await reviewerApi.post(`/api/tools/${sessionId}/approve`, { data: {} });
      expect(approved.status()).toBe(200);
      expect(await approved.json()).toMatchObject({ status: 'APPROVED' });

      const promotionBody = {
        outputType: 'idea',
        title: `STG SWOT promoted idea ${runId.slice(0, 8)}`,
        description: 'Frozen deployed SWOT lineage',
      };
      const promoted = await api.post(`/api/tools/${sessionId}/promote`, {
        data: promotionBody,
      });
      expect(promoted.status()).toBe(200);
      const promotedBody = (await promoted.json()) as { id?: string };
      expect(promotedBody.id).toBeTruthy();
      const replay = await api.post(`/api/tools/${sessionId}/promote`, {
        data: promotionBody,
      });
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toMatchObject({ id: promotedBody.id, deduplicated: true });

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(maker),
      });
      const read = await independent.get(`/api/tools/${sessionId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ id: sessionId, name, status: 'APPROVED' });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await reviewerApi.dispose();
      await api.dispose();
    }
  });

  test('INT: canonical interview session survives independent list and cold Hub reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const name = `STG Interview ${runId.slice(0, 8)}`;

    try {
      const projectsRead = await api.get('/api/projects');
      expect(projectsRead.status()).toBe(200);
      const projectsBody = await projectsRead.json();
      const projects = Array.isArray(projectsBody)
        ? projectsBody
        : Array.isArray(projectsBody?.data)
          ? projectsBody.data
          : [];
      let projectId = String(projects.find((project: { id?: string }) => project?.id)?.id || '');
      if (!projectId) {
        const projectCreated = await api.post('/api/projects', {
          data: { name: `STG Interview Project ${runId.slice(0, 8)}` },
        });
        expect([200, 201]).toContain(projectCreated.status());
        const project = await projectCreated.json();
        projectId = String(project?.id || project?.data?.id || '');
      }
      expect(projectId).toBeTruthy();

      const created = await api.post('/api/interview/sessions', {
        data: { projectId, name },
      });
      expect([200, 201]).toContain(created.status());
      const createdBody = (await created.json()) as {
        id?: string;
        data?: { id?: string };
        session?: { id?: string };
      };
      const sessionId = String(
        createdBody.id || createdBody.data?.id || createdBody.session?.id || ''
      );
      expect(sessionId).toBeTruthy();

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/interview/sessions/${sessionId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ id: sessionId, name });
      const list = await independent.get('/api/interview/sessions/managed?lifecycle=active');
      expect(list.status()).toBe(200);
      const listBody = await list.json();
      const sessions = Array.isArray(listBody)
        ? listBody
        : Array.isArray(listBody?.data)
          ? listBody.data
          : Array.isArray(listBody?.sessions)
            ? listBody.sessions
            : [];
      expect(sessions).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: sessionId, name })])
      );
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/interview?tab=sessions', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('ORG: independent claim decisions publish one exact immutable context snapshot', async ({
    browser,
  }) => {
    const owner = primarySession();
    const reviewer = reviewerSession();
    const ownerApi = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(owner),
    });
    const reviewerApi = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(reviewer),
    });

    try {
      const claimsRead = await reviewerApi.get('/api/organization-context/governed/claims');
      expect(claimsRead.status()).toBe(200);
      const claimsBody = (await claimsRead.json()) as {
        claims?: Array<{ claimId?: string; reviewState?: string }>;
      };
      const claims = claimsBody.claims || [];
      expect(claims.length).toBeGreaterThan(0);
      for (const claim of claims.filter((item) => item.reviewState === 'pending')) {
        const claimId = String(claim.claimId || '');
        expect(claimId).toBeTruthy();
        const approved = await reviewerApi.post(
          `/api/organization-context/governed/claims/${claimId}/approve`,
          { data: { note: 'STG-JOURNEY-16 independent reviewer approval' } }
        );
        expect(approved.status()).toBe(200);
        expect(await approved.json()).toMatchObject({
          claimId,
          reviewState: 'approved',
          decidedBy: reviewer.userId,
        });
      }

      const published = await ownerApi.post('/api/organization-context/governed/publish', {
        data: {},
      });
      expect(published.status()).toBe(201);
      const version = (await published.json()) as {
        snapshotId?: string;
        version?: number;
        contentHash?: string;
      };
      expect(version.snapshotId).toBeTruthy();
      expect(version.version).toBeGreaterThan(0);
      expect(version.contentHash).toMatch(/^[0-9a-f]{64}$/);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(owner),
      });
      const latest = await independent.get('/api/organization-context/governed/resolve-latest');
      expect(latest.status()).toBe(200);
      expect(await latest.json()).toMatchObject({
        snapshotRef: {
          snapshotId: version.snapshotId,
          version: version.version,
          contentHash: version.contentHash,
        },
      });
      const reopened = await independent.get(
        `/api/organization-context/governed/versions/${version.version}`
      );
      expect(reopened.status()).toBe(200);
      expect(await reopened.json()).toMatchObject({
        snapshotId: version.snapshotId,
        version: version.version,
        contentHash: version.contentHash,
      });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/organization/context-governance', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(String(version.snapshotId), { exact: true }).first()).toBeVisible(
        {
          timeout: 45_000,
        }
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(String(version.snapshotId), { exact: true }).first()).toBeVisible(
        {
          timeout: 45_000,
        }
      );
      await cold.close();
    } finally {
      await reviewerApi.dispose();
      await ownerApi.dispose();
    }
  });

  test('ADM: invitation command replays, cold-opens and revokes with exact readback', async ({
    browser,
  }) => {
    const owner = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(owner),
    });
    const runId = randomUUID();
    const email = `stg-admin-${runId}@example.test`;
    const createKey = `stg-journey-adm-create-${runId}`;

    try {
      const created = await api.post(
        `/api/organizations/${owner.organizationId}/admin/invitations`,
        {
          headers: { 'x-idempotency-key': createKey },
          data: { email, role: 'MEMBER' },
        }
      );
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as {
        commandId?: string;
        replayed?: boolean;
        invitation?: { id?: string; email?: string; status?: string; delivery?: string };
      };
      const invitationId = String(createdBody.invitation?.id || '');
      expect(invitationId).toBeTruthy();
      expect(createdBody).toMatchObject({ replayed: false, invitation: { email } });

      const replay = await api.post(
        `/api/organizations/${owner.organizationId}/admin/invitations`,
        {
          headers: { 'x-idempotency-key': createKey },
          data: { email, role: 'MEMBER' },
        }
      );
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toMatchObject({
        commandId: createdBody.commandId,
        replayed: true,
        invitation: { id: invitationId, email },
      });

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(owner),
      });
      const beforeRevoke = await independent.get(
        `/api/organizations/${owner.organizationId}/admin/invitations`
      );
      expect(beforeRevoke.status()).toBe(200);
      expect(await beforeRevoke.json()).toMatchObject({
        invitations: expect.arrayContaining([expect.objectContaining({ id: invitationId, email })]),
      });

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/admin/people', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(email, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });

      const revokeKey = `stg-journey-adm-revoke-${runId}`;
      const revoked = await api.post(
        `/api/organizations/${owner.organizationId}/admin/invitations/${invitationId}/revoke`,
        { headers: { 'x-idempotency-key': revokeKey }, data: {} }
      );
      expect(revoked.status()).toBe(200);
      expect(await revoked.json()).toMatchObject({
        replayed: false,
        invitation: { id: invitationId, email, status: 'revoked' },
      });
      const afterRevoke = await independent.get(
        `/api/organizations/${owner.organizationId}/admin/invitations`
      );
      expect(afterRevoke.status()).toBe(200);
      expect(await afterRevoke.json()).toMatchObject({
        invitations: expect.arrayContaining([
          expect.objectContaining({ id: invitationId, email, status: 'revoked' }),
        ]),
      });
      await independent.dispose();

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(email, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await expect(
        page
          .getByText(/revoked/i)
          .filter({ visible: true })
          .first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('MYW: idempotent personal task survives exact API and cold Tasks reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const title = `STG My Work task ${runId.slice(0, 8)}`;
    const payload = {
      title,
      status: 'todo',
      priority: 'high',
      idempotencyKey: `stg-journey-myw-${runId}`,
    };

    try {
      const created = await api.post('/api/my-work/personal-tasks', { data: payload });
      expect(created.status()).toBe(201);
      const task = (await created.json()) as { id?: string; title?: string };
      const taskId = String(task.id || '');
      expect(taskId).toBeTruthy();
      expect(task.title).toBe(title);

      const replay = await api.post('/api/my-work/personal-tasks', { data: payload });
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toMatchObject({ id: taskId, title });

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/my-work/personal-tasks/${taskId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({ id: taskId, title, status: 'todo' });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/my-work/tasks?taskId=${encodeURIComponent(taskId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('INI: canonical draft document survives update, exact GET and cold deep-link reopen', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const title = `STG Initiative ${runId.slice(0, 8)}`;
    const problemStatement = `STG-JOURNEY-16 durable problem ${runId}`;

    try {
      const projectsRead = await api.get('/api/projects');
      expect(projectsRead.status()).toBe(200);
      const projectsBody = await projectsRead.json();
      const projects = Array.isArray(projectsBody)
        ? projectsBody
        : Array.isArray(projectsBody?.data)
          ? projectsBody.data
          : [];
      const projectId = String(projects.find((project: { id?: string }) => project?.id)?.id || '');
      expect(projectId).toBeTruthy();

      const created = await api.post('/api/initiatives', {
        data: {
          projectId,
          title,
          axis: 'operational',
          category: 'operations',
          sourceType: 'manual',
        },
      });
      expect(created.status()).toBe(200);
      const createdBody = (await created.json()) as { id?: string; name?: string };
      const initiativeId = String(createdBody.id || '');
      expect(initiativeId).toBeTruthy();
      expect(createdBody.name).toBe(title);

      const updated = await api.put(`/api/initiatives/${initiativeId}`, {
        data: {
          problemStatement,
          scopeIn: ['Staging exact lifecycle'],
          successCriteria: ['Cold readback remains exact'],
          deliverables: ['Verified initiative record'],
        },
      });
      expect(updated.status()).toBe(200);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/initiatives/${initiativeId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({
        id: initiativeId,
        title,
        problemStatement,
      });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('ASM: idempotent DRD method session preserves exact pack and cold server identity', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const key = `stg-journey-asm-${runId}`;
    const payload = {
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      mode: 'guided_manual',
      projectId: null,
    };

    try {
      const created = await api.post('/api/method/sessions', {
        headers: { 'idempotency-key': key },
        data: payload,
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as {
        session?: {
          id?: string;
          methodPackId?: string;
          methodPackVersion?: string;
          version?: number;
        };
      };
      const sessionId = String(createdBody.session?.id || '');
      expect(sessionId).toBeTruthy();
      expect(createdBody.session).toMatchObject({
        methodPackId: payload.methodPackId,
        methodPackVersion: payload.methodPackVersion,
      });

      const replay = await api.post('/api/method/sessions', {
        headers: { 'idempotency-key': key },
        data: payload,
      });
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toMatchObject({
        idempotentReplay: true,
        session: { id: sessionId },
      });

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/method/sessions/${sessionId}`);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject({
        session: {
          id: sessionId,
          methodPackId: payload.methodPackId,
          methodPackVersion: payload.methodPackVersion,
        },
      });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto(`/assessment/drd/${encodeURIComponent(sessionId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByText(`ID: ${sessionId}`, { exact: true })).toBeVisible({
        timeout: 45_000,
      });
      await expect(
        page.getByText(`method: drd@${payload.methodPackVersion}`, { exact: true })
      ).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText(`ID: ${sessionId}`, { exact: true })).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('MTG: governed note proposal is independently approved and survives cold receipt readback', async ({
    browser,
  }) => {
    const owner = primarySession();
    const reviewer = reviewerSession();
    const ownerApi = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(owner),
    });
    const reviewerApi = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(reviewer),
    });
    const runId = randomUUID();
    const title = `STG Meeting ${runId.slice(0, 8)}`;
    const transcript = `${runId}: we decided to run the controlled pilot. Action item: prepare evidence.`;

    try {
      const created = await ownerApi.post('/api/meeting', {
        data: {
          title,
          startAt: '2026-09-20T09:00:00.000Z',
          agenda: ['Review staging evidence'],
          preRead: ['material://stg-journey-16'],
          attendees: [reviewer.userId],
        },
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as { meeting?: { id?: string; title?: string } };
      const meetingId = String(createdBody.meeting?.id || '');
      expect(meetingId).toBeTruthy();
      expect(createdBody.meeting?.title).toBe(title);

      const generated = await ownerApi.post(`/api/meeting/${meetingId}/generate-notes`, {
        data: {
          transcript,
          language: 'en',
          idempotencyKey: `stg-journey-mtg-${runId}`,
        },
      });
      expect(generated.status()).toBe(201);
      const generatedBody = (await generated.json()) as {
        meetingNoteId?: string;
        proposal?: { proposalId?: string; state?: string; replayed?: boolean };
      };
      const noteId = String(generatedBody.meetingNoteId || '');
      expect(noteId).toBeTruthy();
      expect(generatedBody.proposal).toMatchObject({ state: 'pending', replayed: false });

      const replay = await ownerApi.post(`/api/meeting/${meetingId}/generate-notes`, {
        data: {
          transcript,
          language: 'en',
          idempotencyKey: `stg-journey-mtg-${runId}`,
        },
      });
      expect(replay.status()).toBe(201);
      expect(await replay.json()).toMatchObject({
        meetingNoteId: noteId,
        proposal: { proposalId: generatedBody.proposal?.proposalId, replayed: true },
      });

      const approved = await reviewerApi.post(
        `/api/meeting/${meetingId}/notes/${noteId}/decision`,
        { data: { action: 'approve' } }
      );
      expect(approved.status()).toBe(200);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(owner),
      });
      const notes = await independent.get(`/api/meeting/${meetingId}/notes`);
      expect(notes.status()).toBe(200);
      const notesBody = await notes.json();
      const rows = Array.isArray(notesBody) ? notesBody : notesBody?.notes || [];
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: noteId,
            status: 'approved',
            proposalState: 'materialized',
            receiptId: expect.any(String),
          }),
        ])
      );
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/meeting', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(title, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await reviewerApi.dispose();
      await ownerApi.dispose();
    }
  });

  test('EXE: canonical Case cancel is durable and cold-opens through explicit user opt-in', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const caseName = `STG Execution Case ${runId.slice(0, 8)}`;

    try {
      const projectsRead = await api.get('/api/projects');
      expect(projectsRead.status()).toBe(200);
      const projectsBody = await projectsRead.json();
      const projects = Array.isArray(projectsBody)
        ? projectsBody
        : Array.isArray(projectsBody?.data)
          ? projectsBody.data
          : [];
      const projectId = String(projects.find((project: { id?: string }) => project?.id)?.id || '');
      expect(projectId).toBeTruthy();

      const created = await api.post('/api/v8/case-workspace/cases', {
        data: {
          projectId,
          caseName,
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
          contractedClosureType: 'DELIVERY_COMPLETED',
        },
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as { data?: { caseId?: string } };
      const caseId = String(createdBody.data?.caseId || '');
      expect(caseId).toBeTruthy();

      const cancelled = await api.post(`/api/v8/case-workspace/cases/${caseId}/cancel`, {
        data: { reason: 'STG-JOURNEY-16 controlled cancellation proof' },
      });
      expect(cancelled.status()).toBe(200);

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const read = await independent.get(`/api/v8/case-workspace/cases/${caseId}`);
      expect(read.status()).toBe(200);
      const readBody = await read.json();
      expect(readBody).toMatchObject({
        data: expect.objectContaining({ caseId, caseName, caseStatus: 'CANCELLED' }),
      });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      await cold.addInitScript(() => window.localStorage.setItem('ff.caseWorkspace', 'true'));
      const page = await cold.newPage();
      await page.goto(`/zlecenia/${encodeURIComponent(caseId)}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        page.getByText(caseName, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(caseName, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({
        timeout: 45_000,
      });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('FIN: canonical artifact lifecycle survives independent readback and cold Finance mount', async ({
    browser,
  }) => {
    const session = primarySession();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    const runId = randomUUID();
    const naturalKey = `stg-journey-fin-${runId}`;

    try {
      const created = await api.post('/api/v8/finance-v2/artifacts', {
        data: { artifactType: 'HISTORICAL_ANALYSIS', naturalKey },
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as {
        data?: {
          artifactId?: string;
          currentBusinessVersion?: { businessVersionId?: string; version?: number };
        };
      };
      const artifactId = String(createdBody.data?.artifactId || '');
      const businessVersionId = String(
        createdBody.data?.currentBusinessVersion?.businessVersionId || ''
      );
      expect(artifactId).toBeTruthy();
      expect(businessVersionId).toBeTruthy();

      const snapshot = await api.post(
        `/api/v8/finance-v2/versions/${businessVersionId}/compute-snapshot`,
        { data: {} }
      );
      expect([200, 201]).toContain(snapshot.status());
      const snapshotBody = (await snapshot.json()) as { data?: { computeSnapshotId?: string } };
      expect(snapshotBody.data?.computeSnapshotId).toBeTruthy();

      const snapshotReplay = await api.post(
        `/api/v8/finance-v2/versions/${businessVersionId}/compute-snapshot`,
        { data: {} }
      );
      expect(snapshotReplay.status()).toBe(200);
      expect(await snapshotReplay.json()).toMatchObject({
        data: { computeSnapshotId: snapshotBody.data?.computeSnapshotId, reused: true },
      });

      const independent = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: authHeaders(session),
      });
      const artifactRead = await independent.get(`/api/v8/finance-v2/artifacts/${artifactId}`);
      expect(artifactRead.status()).toBe(200);
      expect(await artifactRead.json()).toMatchObject({
        data: {
          artifactId,
          naturalKey,
          currentBusinessVersion: {
            businessVersionId,
            status: 'DRAFT',
          },
        },
      });
      const versionRead = await independent.get(`/api/v8/finance-v2/versions/${businessVersionId}`);
      expect(versionRead.status()).toBe(200);
      expect(await versionRead.json()).toMatchObject({
        data: { businessVersionId, status: 'DRAFT' },
      });
      await independent.dispose();

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      await page.goto('/finance', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
      await expect(page).toHaveURL(/\/finance/);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await api.dispose();
    }
  });

  test('AUD: published pack creates a durable criterion snapshot and cold criterion workspace', async ({
    browser,
  }) => {
    const session = primarySession();
    const runId = randomUUID();
    const seeded = await seedAuditProgram(session.token, {
      baseURL: BASE_URL,
      name: `STG Audit Program ${runId.slice(0, 8)}`,
    });

    expect(seeded.packPublicationStatus).toBe('published');
    expect(seeded.programId).toBeTruthy();
    expect(seeded.firstCriterionId).toBeTruthy();
    expect(seeded.criteria.length).toBeGreaterThan(0);

    const independent = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: authHeaders(session),
    });
    try {
      const programRead = await independent.get(`/api/audits/programs/${seeded.programId}`);
      expect(programRead.status()).toBe(200);
      expect(await programRead.json()).toMatchObject({
        data: { program: { id: seeded.programId, name: seeded.programName } },
      });
      const criteriaRead = await independent.get(
        `/api/audits/criteria?programId=${encodeURIComponent(seeded.programId)}`
      );
      expect(criteriaRead.status()).toBe(200);

      const cold = await browser.newContext({ storageState: storageStatePath() });
      const page = await cold.newPage();
      const criterionUrl = `/audit-programs/${encodeURIComponent(
        seeded.programId
      )}/criteria/${encodeURIComponent(String(seeded.firstCriterionId))}`;
      await page.goto(criterionUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('criterion-workspace')).toBeVisible({ timeout: 45_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('criterion-workspace')).toBeVisible({ timeout: 45_000 });
      await cold.close();
    } finally {
      await independent.dispose();
    }
  });
});
