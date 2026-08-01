import { type APIRequestContext, expect, test } from '@playwright/test';

import { getPrivilegedSession, TEST_SUPPORT_SETUP_HINT } from '../_helpers/privilegedSession';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

type ResearchFinalizePayload = {
  data?: {
    reportResource?: unknown;
    readBack?: {
      evidenceSummary?: unknown[];
      [key: string]: unknown;
    };
  };
};

function isStrictCanvasGate(): boolean {
  return process.env.E2E_STRICT_CANVAS === 'true' || Boolean(process.env.CI);
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function syntheticE2EToken(): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId: 'e2e-org-id',
    isSuperAdmin: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

/**
 * Resolve a session for the lineage gate.
 *
 * `register-demo` is deliberately NOT a tier here. It is the public demo signup:
 * unprivileged by design (TEAM_MEMBER in the shared demo org) and read-only
 * (`403 DEMO_READ_ONLY`), so the research finalize writes this spec performs would be
 * refused while the harness believed it held an ADMIN session.
 */
async function resolveAuthToken(
  request: APIRequestContext,
  runId: string
): Promise<{
  token: string;
  source: 'test-support' | 'demo-login' | 'synthetic';
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const session = await getPrivilegedSession(request, {
      role: 'ADMIN',
      label: 'canvas-research-lineage',
      runId,
      apiBaseUrl: API_BASE_URL,
    });
    return { token: session.token, source: 'test-support', errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const demoLogin = await request.post(`${API_BASE_URL}/api/auth/demo-login`, { data: {} });
    if (demoLogin.ok()) {
      const payload = (await demoLogin.json()) as Record<string, unknown>;
      if (typeof payload.token === 'string' && payload.token.trim()) {
        return { token: payload.token, source: 'demo-login', errors };
      }
    } else {
      errors.push(
        `auth/demo-login ${demoLogin.status()}: ${await demoLogin.text().catch(() => '<no-body>')}`
      );
    }
  } catch (error) {
    errors.push(
      `auth/demo-login request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // NOTE: the former `register-demo` tier is gone on purpose — see the doc comment above.

  return { token: syntheticE2EToken(), source: 'synthetic', errors };
}

test.describe('Work Canvas research lineage Playwright gate', () => {
  test('finalizes research report with auditable lineage read-back', async ({ request }) => {
    const strictCanvasGate = isStrictCanvasGate();
    const runId = `canvas-research-lineage-${Date.now().toString(36)}`;
    const auth = await resolveAuthToken(request, runId);
    if (auth.source === 'synthetic' && strictCanvasGate) {
      throw new Error(
        [
          'Strict Canvas gate: real auth bootstrap is required.',
          TEST_SUPPORT_SETUP_HINT,
          'Alternatively enable the test gateway demo login (`ENABLE_TEST_GATEWAY=true`).',
          ...auth.errors.map((item) => `- ${item}`),
        ].join('\n')
      );
    }
    const token = auth.token;
    expect(token.length).toBeGreaterThan(20);

    const headers = { Authorization: `Bearer ${token}` };
    const createDraft = await request.post(`${API_BASE_URL}/api/work-canvas/drafts`, {
      headers,
      data: {
        conversationId: `conv-${runId}`,
        kind: 'research',
        title: 'Research lineage brief',
        contentMd: '# Research lineage brief\n\n- Validate source chain.',
        researchSessionId: `rs-${runId}`,
        blocks: [
          {
            id: 'research-block-lineage',
            kind: 'research',
            schemaVersion: 'canvas-block/v1',
            title: 'Evidence block',
            status: 'ready',
            capabilities: ['view'],
            data: {
              question: 'What evidence supports this recommendation?',
              findings: ['Demand trend confirmed across sources.'],
              sources: ['Interview transcript', 'Market report'],
              confidence: 'high',
            },
            provenance: { source: 'assistant', conversationId: `conv-${runId}` },
            markdownProjection: '### Evidence block',
            markdownProjectionStatus: 'synced',
          },
        ],
      },
    });
    if (!createDraft.ok()) {
      const errorBody = await createDraft.text().catch(() => '<no-body>');
      throw new Error(
        `${
          strictCanvasGate ? 'Strict Canvas gate' : 'Canvas smoke gate'
        }: work-canvas create draft request failed (${createDraft.status()}): ${errorBody}`
      );
    }
    expect(createDraft.ok()).toBeTruthy();
    const createPayload = (await createDraft.json()) as { data?: { id?: unknown } };
    const draftId = String(createPayload?.data?.id || '');
    expect(draftId).toBeTruthy();

    const finalize = await request.post(
      `${API_BASE_URL}/api/work-canvas/drafts/${encodeURIComponent(draftId)}/research/finalize-report`,
      {
        headers,
        data: {},
      }
    );
    expect(finalize.ok()).toBeTruthy();
    const finalizePayload = (await finalize.json()) as ResearchFinalizePayload;

    expect(finalizePayload?.data?.reportResource).toMatchObject({
      type: 'report',
      id: expect.any(String),
      title: expect.stringContaining('Report:'),
    });
    expect(finalizePayload?.data?.readBack).toMatchObject({
      target: 'research_final_report',
      status: 'promotion_recorded',
      sourceDraftId: draftId,
      reportDraftId: expect.any(String),
    });
    expect(Array.isArray(finalizePayload?.data?.readBack?.evidenceSummary)).toBeTruthy();
    expect(finalizePayload?.data?.readBack?.evidenceSummary?.[0]).toMatchObject({
      blockId: 'research-block-lineage',
      sourceCount: 2,
      confidence: 'high',
    });
  });
});
