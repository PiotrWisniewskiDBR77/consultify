import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://staging.consultify.ai';
const SESSION_PATH = process.env.STAGING_SESSION_PATH || '';
const STORAGE_PATH = process.env.E2E_STORAGE_STATE_PATH || '';

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
      const readBody = (await read.json()) as { title?: string; messages?: Array<{ content?: string }> };
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
      await expect(page.getByRole('button', { name: nextTheme === 'dark' ? /Dark|Ciemny/i : /Light|Jasny/i })).toBeVisible({
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
      expect(await versionRead.json()).toMatchObject({
        definitionVersion: {
          definitionVersionId: createdBody.definitionVersion?.definitionVersionId,
          name,
        },
      });
      await independent.dispose();

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
});
