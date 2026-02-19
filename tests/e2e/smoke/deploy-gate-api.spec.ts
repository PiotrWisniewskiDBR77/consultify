/**
 * L4 Smoke — deploy gate API checks
 *
 * Focus:
 * - Endpoints that commonly block public deploys (health/auth/security core)
 * - Deterministic assertions (avoid UI brittleness; prefer APIRequestContext)
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

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

function extractId(payload: any): string | null {
  const direct = payload?.id || payload?.data?.id || payload?.project?.id || payload?.initiative?.id;
  if (typeof direct === 'string' && direct.length) return direct;
  return null;
}

test.describe('L4 Smoke — deploy gate API', () => {
  test.setTimeout(60000);

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
    expect(createProject.ok()).toBeTruthy();
    const projBody = await jsonOrText(createProject);
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
});
