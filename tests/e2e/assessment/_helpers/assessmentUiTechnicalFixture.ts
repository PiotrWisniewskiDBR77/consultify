import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';
import { Pool } from 'pg';

export type AssessmentPersona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: 'ADMIN' | 'USER';
};

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const APP = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const supportHeaders = { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' };

function fixtureDefinitionId(runId: string): string {
  if (!/^asm-(?:ui|stale|foreign)-\d+$/.test(runId)) {
    throw new Error(`refusing non-ASM fixture run id: ${runId}`);
  }
  return `asm-ui-definition-${runId}`;
}

async function withFixtureDatabase<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith('postgres')) {
    throw new Error('ASM UI fixture requires an explicit PostgreSQL DATABASE_URL');
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function seedPublishedDrdDefinition(runId: string, createdBy: string): Promise<void> {
  const definitionId = fixtureDefinitionId(runId);
  const now = new Date().toISOString();
  await withFixtureDatabase(async (pool) => {
    await pool.query(
      `INSERT INTO assessment_definitions
         (id, methodology_id, version, title, status, is_read_only,
          definition_json, created_by, created_at, updated_at, published_at)
       VALUES ($1, 'DRD', $2, 'DRD ASM UI fixture', 'published', 1,
               '{}'::text, $3, $4, $4, $4)
       ON CONFLICT (id) DO UPDATE SET
         status = 'published',
         is_read_only = 1,
         updated_at = EXCLUDED.updated_at,
         published_at = EXCLUDED.published_at`,
      [definitionId, `fixture-${runId}`, createdBy, now]
    );
  });
}

export const authHeaders = (persona: AssessmentPersona) => ({
  Authorization: `Bearer ${persona.token}`,
  'content-type': 'application/json',
});

async function checked(response: Awaited<ReturnType<APIRequestContext['post']>>, label: string) {
  if (!response.ok()) throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  return response.json();
}

export async function bootstrap(
  request: APIRequestContext,
  runId: string,
  role: AssessmentPersona['role'] = 'ADMIN'
): Promise<AssessmentPersona> {
  const response = await request.post(`${API}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role },
  });
  const persona = { ...(await checked(response, `bootstrap ${role}`)), runId, role } as AssessmentPersona;
  await seedPublishedDrdDefinition(runId, persona.userId);
  return persona;
}

export async function addMember(
  request: APIRequestContext,
  tenant: AssessmentPersona,
  role: AssessmentPersona['role'] = 'USER'
): Promise<AssessmentPersona> {
  const response = await request.post(`${API}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId: tenant.runId, role },
  });
  return { ...(await checked(response, `member ${role}`)), runId: tenant.runId, role } as AssessmentPersona;
}

export async function signedContext(
  browser: Browser,
  persona: AssessmentPersona,
  viewport = { width: 1440, height: 900 }
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: APP, viewport });
  await context.addInitScript(
    ({ auth, origin }) => {
      if (location.origin !== origin) return;
      const user = {
        id: auth.userId,
        email: `${auth.role.toLowerCase()}@assessment.local`,
        role: auth.role,
        organizationId: auth.organizationId,
        organizationName: 'ASM technical tenant',
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
      localStorage.setItem(
        'consultify_feature_flags',
        JSON.stringify({ drdMethodWorkspaceSliceV1: true, drdHttpSourceOfTruthV1: true })
      );
    },
    { auth: persona, origin: new URL(APP).origin }
  );
  return context;
}

export async function grantApprover(
  request: APIRequestContext,
  owner: AssessmentPersona,
  sessionId: string,
  approver: AssessmentPersona
): Promise<void> {
  const response = await request.post(`${API}/api/method/sessions/${sessionId}/roles`, {
    headers: authHeaders(owner),
    data: { userId: approver.userId, role: 'approver' },
  });
  if (!response.ok()) throw new Error(`grant approver: ${response.status()} ${await response.text()}`);
}

export async function prepareForReview(
  request: APIRequestContext,
  owner: AssessmentPersona,
  sessionId: string
): Promise<void> {
  const headers = authHeaders(owner);
  const leadRole = await request.post(`${API}/api/method/sessions/${sessionId}/roles`, {
    headers,
    data: { userId: owner.userId, role: 'lead_assessor' },
  });
  if (!leadRole.ok()) {
    throw new Error(`grant lead_assessor: ${leadRole.status()} ${await leadRole.text()}`);
  }
  for (const to of ['prepared', 'active']) {
    const response = await request.post(`${API}/api/method/sessions/${sessionId}/transition`, {
      headers: { ...headers, 'Idempotency-Key': `asm:${sessionId}:${to}` },
      data: { to },
    });
    if (!response.ok()) throw new Error(`transition ${to}: ${response.status()} ${await response.text()}`);
  }
  for (const [index, event] of [
    { type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2, payload: { questionId: '1A-L2-Q1', answerState: 'confirmed', text: 'Confirmed process evidence' } },
    { type: 'EVIDENCE_ATTACHED', unitId: '1A', level: 2, payload: { evidenceId: `asm-evidence-${sessionId}`, evidenceType: 'document', strength: 'E2' } },
    { type: 'DECISION_APPROVED', unitId: '1A', level: 4, payload: { decisionId: `asm-target-${sessionId}`, subject: 'target_level', decidedValue: 4, rationale: 'Approved target' } },
  ].entries()) {
    const response = await request.post(`${API}/api/method/sessions/${sessionId}/events`, {
      headers: { ...headers, 'Idempotency-Key': `asm:${sessionId}:event:${index}` },
      data: event,
    });
    if (!response.ok()) throw new Error(`event ${index}: ${response.status()} ${await response.text()}`);
  }
}

export async function cleanup(request: APIRequestContext, ...runs: string[]): Promise<void> {
  for (const runId of runs) {
    const definitionId = fixtureDefinitionId(runId);
    await withFixtureDatabase(async (pool) => {
      await pool.query(`DELETE FROM assessment_definitions WHERE id = $1`, [definitionId]);
      const remaining = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM assessment_definitions WHERE id = $1`,
        [definitionId]
      );
      if (remaining.rows[0]?.count !== '0') {
        throw new Error(`ASM definition fixture residue remains for ${runId}`);
      }
    });
    const response = await request.post(`${API}/api/test-support/cleanup`, {
      headers: supportHeaders,
      data: { runId },
    });
    if (!response.ok()) throw new Error(`cleanup ${runId}: ${response.status()} ${await response.text()}`);
  }
}

export function sessionIdFrom(url: string): string {
  const match = url.match(/\/assessment\/drd\/([^/?#]+)/);
  if (!match?.[1]) throw new Error(`DRD session id missing from ${url}`);
  return decodeURIComponent(match[1]);
}
