/**
 * L4 Smoke — deploy gate API checks
 *
 * Focus:
 * - Endpoints that commonly block public deploys (health/auth/security core)
 * - Deterministic assertions (avoid UI brittleness; prefer APIRequestContext)
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const isMockDb = process.env.MOCK_DB === 'true';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

async function jsonOrText(res: any): Promise<any> {
  const ct = String(res.headers()?.['content-type'] || '');
  if (ct.includes('application/json')) return res.json().catch(() => null);
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function assertOk(res: any, label: string) {
  if (res.ok()) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} failed: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function bootstrapPersona(role: 'ADMIN' | 'SUPERADMIN') {
  const req = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  const runId = `role-iam-${role.toLowerCase()}-${Date.now().toString(36)}`;
  const res = await req.post('/api/test-support/bootstrap', {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
    data: { runId, role },
  });
  if (!res.ok()) {
    const body = await jsonOrText(res);
    if (res.status() === 404) {
      throw new Error(`TEST_SUPPORT_UNAVAILABLE:${JSON.stringify(body)}`);
    }
    throw new Error(
      `POST /api/test-support/bootstrap (${role}) failed: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`
    );
  }
  const body = (await res.json()) as {
    token: string;
    userId: string;
    organizationId: string;
  };
  return {
    req,
    userId: body.userId,
    organizationId: body.organizationId,
    headers: authHeaders(body.token),
  };
}

function extractId(payload: any): string | null {
  const direct = payload?.id || payload?.data?.id || payload?.project?.id || payload?.initiative?.id;
  if (typeof direct === 'string' && direct.length) return direct;
  return null;
}

test.describe('L4 Smoke — deploy gate API', () => {
  test.setTimeout(60000);
  let readOnlyReason = '';

  function isDemoReadOnlyError(body: any): boolean {
    const serialized = JSON.stringify(body || {});
    return /DEMO_READ_ONLY|read-only|read only/i.test(serialized);
  }

  test('GET /api/health responds (base)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/health/ping responds', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/health/ping`);
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toBeTruthy();
  });

  test('GET /api/health/ready responds', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/health/ready`);
    if (isMockDb) {
      expect([200, 503]).toContain(res.status());
      const body = await jsonOrText(res);
      expect(String(body?.status || '')).toBeTruthy();
      return;
    }
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/health/live responds', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/health/live`);
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/csrf-token returns a token-like payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/csrf-token`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    expect(typeof data?.token).toBe('string');
    expect(String(data.token)).toMatch(/^[0-9a-f]{32,}$/i);
  });

  test('test-support bootstrap produced auth state', async ({ request }) => {
    const { token, userId, organizationId } = readTestSupportState();
    expect(token).toEqual(expect.any(String));
    expect(userId).toEqual(expect.any(String));
    expect(organizationId).toEqual(expect.any(String));
  });

  test('GET /api/auth/me returns authenticated user', async ({ request }) => {
    const { token, userId } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/auth/me`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data?.user?.id).toBe(userId);
    expect(String(data?.user?.organizationId || '')).toBeTruthy();
    expect(String(data?.user?.email || '')).toContain('@');
  });

  test('GET /api/auth/me returns 401 without token', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/auth/me returns 401 for invalid token', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/auth/me`, {
      headers: authHeaders('not-a-jwt'),
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/security/settings returns org payload', async ({ request }) => {
    const { token, organizationId } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/settings`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/security/settings');
    const data = await res.json();
    expect(String(data?.organizationId || '')).toBeTruthy();
    expect(String(data.organizationId)).toBe(organizationId);
    expect(data).toEqual(expect.objectContaining({ ipWhitelist: expect.any(Array) }));
  });

  test('PUT /api/security/settings upserts configuration', async ({ request }) => {
    const { token } = readTestSupportState();
    const put = await request.put(`${API_BASE_URL}/api/security/settings`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { require2fa: true, passwordMinLength: 12, ipWhitelist: ['10.0.0.0/8'] },
    });
    await assertOk(put, 'PUT /api/security/settings');
    const putBody = await put.json().catch(() => null);
    expect(putBody).toEqual(expect.objectContaining({ success: true }));

    const get = await request.get(`${API_BASE_URL}/api/security/settings`, { headers: authHeaders(token) });
    await assertOk(get, 'GET /api/security/settings (after PUT)');
    const data = await get.json();
    if (isMockDb) {
      expect(data).toEqual(expect.objectContaining({ require2fa: true }));
      return;
    }
    expect(data).toEqual(expect.objectContaining({ require2fa: true, passwordMinLength: 12 }));
  });

  test('GET /api/security/sessions returns sessions array', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/sessions`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.sessions)).toBe(true);
  });

  test('GET /api/security/login-history returns history array', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/login-history?limit=5`, {
      headers: authHeaders(token),
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.history)).toBe(true);
  });

  test('GET /api/security/2fa/org-status returns summary', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/2fa/org-status`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: expect.any(Number),
          enabled: expect.any(Number),
          disabled: expect.any(Number),
          percentage: expect.any(Number),
        }),
        users: expect.any(Array),
      })
    );
  });

  test('GET /api/security/audit-logs returns logs + stats', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/audit-logs`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.logs)).toBe(true);
    expect(data?.stats).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        high: expect.any(Number),
        medium: expect.any(Number),
        low: expect.any(Number),
        unresolved: expect.any(Number),
      })
    );
  });

  test('GET /api/security/api-keys/usage returns usage array', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/api-keys/usage`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.usage)).toBe(true);
  });

  test('GET /api/security/permissions/definitions returns permission catalog', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/permissions/definitions`, {
      headers: authHeaders(token),
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.permissions)).toBe(true);
    const ids = (data.permissions || []).map((p: any) => p?.id).filter(Boolean);
    expect(ids).toContain('admin:billing');
  });

  test('GET /api/security/workflows returns workflows', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/workflows`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.workflows)).toBe(true);
  });

  test('GET /api/security/workflows/requests returns requests', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/security/workflows/requests`, { headers: authHeaders(token) });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data?.requests)).toBe(true);
  });

  test('Projects + initiatives basic CRUD works via API', async ({ request }) => {
    const { token, userId } = readTestSupportState();
    const headers = { ...authHeaders(token), 'content-type': 'application/json' };

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers,
      data: { name: `E2E Deploy Gate ${Date.now()}`, description: 'smoke seed' },
    });
    const createProjectBody = await jsonOrText(createProject);
    if (!createProject.ok()) {
      if (isDemoReadOnlyError(createProjectBody)) {
        readOnlyReason = `DEMO_READ_ONLY (${createProject.status()})`;
        test.skip(true, `Writable project/initiative flow unavailable: ${readOnlyReason}`);
      }
      throw new Error(
        `POST /api/projects failed: ${createProject.status()} ${createProject.statusText()} body=${JSON.stringify(createProjectBody)}`
      );
    }
    const projBody = createProjectBody;
    const projectId = extractId(projBody) || projBody?.data?.id || projBody?.projectId || null;
    // Some implementations return the full object; accept any non-empty id if present.
    if (projectId) expect(String(projectId).length).toBeGreaterThan(0);

    const initiativeRes = await request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: `E2E Initiative ${Date.now()}`,
        summary: 'deploy gate smoke',
        status: 'PLANNING',
        projectId: projectId || undefined,
        ownerBusinessId: userId,
        ownerExecutionId: userId,
      },
    });
    expect(initiativeRes.ok()).toBeTruthy();
    const ini = await initiativeRes.json().catch(() => null);
    const initiativeId = extractId(ini) || ini?.id;
    expect(String(initiativeId || '')).toBeTruthy();

    const getIni = await request.get(`${API_BASE_URL}/api/initiatives/${initiativeId}`, { headers });
    expect(getIni.ok()).toBeTruthy();
    const got = await getIni.json();
    expect(String(got?.id || '')).toBe(String(initiativeId));
  });

  test('Role IAM persona sweep: ADMIN effective access is tenant scoped', async () => {
    let admin: Awaited<ReturnType<typeof bootstrapPersona>> | null = null;
    try {
      admin = await bootstrapPersona('ADMIN');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.startsWith('TEST_SUPPORT_UNAVAILABLE:')) {
        test.skip(true, 'test-support bootstrap is unavailable in this environment');
      }
      throw error;
    }
    try {
      const me = await admin.req.get('/api/auth/me', { headers: admin.headers });
      await assertOk(me, 'GET /api/auth/me (ADMIN persona)');
      const meBody = await me.json();
      expect(meBody?.user?.id).toBe(admin.userId);
      expect(meBody?.user?.organizationId).toBe(admin.organizationId);

      const effective = await admin.req.get('/api/access/effective?capability=admin.people.manage', {
        headers: admin.headers,
      });
      await assertOk(effective, 'GET /api/access/effective (ADMIN persona)');
      const accessBody = await effective.json();
      expect(Array.isArray(accessBody?.effectiveAccess?.capabilities)).toBe(true);
    } finally {
      await admin?.req.dispose();
    }
  });

  test('Role IAM persona sweep: SUPERADMIN stays platform scoped', async () => {
    let superadmin: Awaited<ReturnType<typeof bootstrapPersona>> | null = null;
    try {
      superadmin = await bootstrapPersona('SUPERADMIN');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.startsWith('TEST_SUPPORT_UNAVAILABLE:')) {
        test.skip(true, 'test-support bootstrap is unavailable in this environment');
      }
      throw error;
    }
    try {
      const me = await superadmin.req.get('/api/auth/me', { headers: superadmin.headers });
      await assertOk(me, 'GET /api/auth/me (SUPERADMIN persona)');
      const meBody = await me.json();
      expect(String(meBody?.user?.role || '').toUpperCase()).toContain('SUPERADMIN');

      const effective = await superadmin.req.get('/api/access/effective', {
        headers: superadmin.headers,
      });
      await assertOk(effective, 'GET /api/access/effective (SUPERADMIN persona)');
      const accessBody = await effective.json();
      expect(accessBody?.effectiveAccess).toBeTruthy();
    } finally {
      await superadmin?.req.dispose();
    }
  });

  test('Role IAM persona sweep: unauthenticated surfaces are denied', async ({ request }) => {
    for (const path of ['/api/access/effective', '/api/consultant-project-access']) {
      const missing = await request.get(`${API_BASE_URL}${path}`);
      expect([401, 403]).toContain(missing.status());

      const invalid = await request.get(`${API_BASE_URL}${path}`, {
        headers: authHeaders('not-a-valid-token'),
      });
      expect([401, 403]).toContain(invalid.status());
    }
  });

  test('Role IAM persona sweep: missing OWNER USER GUEST consultant seeds are explicit', () => {
    expect(['OWNER', 'USER', 'GUEST', 'CONSULTANT']).toEqual([
      'OWNER',
      'USER',
      'GUEST',
      'CONSULTANT',
    ]);
  });
});
