/**
 * L4 Smoke — deploy gate API (GDPR / compliance / security policies)
 *
 * Focus:
 * - Public deploy blockers: endpoints must not 5xx
 * - Deterministic assertions (status + minimal shape)
 * - Role-gated updates may 403 for demo user
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const isMockDb = process.env.MOCK_DB === 'true';

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

async function assertNo5xx(res: any, label: string) {
  if (res.status() < 500) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} 5xx: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

async function demoLoginApi(_request: any): Promise<{
  token: string;
  userId: string;
  organizationId: string;
}> {
  return readTestSupportState();
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (GDPR / compliance / security policies)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let orgId = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
    orgId = login.organizationId;
  });

  // ----------------------------
  // Security policies
  // ----------------------------

  test('GET /api/security-policies returns policies payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/security-policies`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/security-policies');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.policies)).toBe(true);
    const ids = (data?.policies || []).map((p: any) => String(p?.id || '')).filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
  });

  test('PUT /api/security-policies/password-policy toggles enabled (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/security-policies/password-policy`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { enabled: false },
    });
    await assertNo5xx(res, 'PUT /api/security-policies/password-policy');
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Boolean(data?.success)).toBe(true);
    }
  });

  test('GET /api/security-policies reflects password-policy state (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/security-policies`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/security-policies (after update)');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.policies)).toBe(true);
    const policy = (data?.policies || []).find((p: any) => String(p?.id || '') === 'password-policy');
    if (!policy) {
      expect((data?.policies || []).length).toBeGreaterThan(0);
      return;
    }
    expect(typeof policy?.enabled).toBe('boolean');
  });

  test('PUT /api/security-policies/password-policy updates settings (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/security-policies/password-policy`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { settings: { minLength: 10 } },
    });
    await assertNo5xx(res, 'PUT /api/security-policies/password-policy (settings)');
    expect([200, 404]).toContain(res.status());
  });

  test('PUT /api/security-policies/does-not-exist returns 404 (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/security-policies/does-not-exist`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { enabled: true },
    });
    await assertNo5xx(res, 'PUT /api/security-policies/does-not-exist');
    if (isMockDb) {
      expect([200, 400, 404]).toContain(res.status());
      return;
    }
    expect([404, 400]).toContain(res.status());
  });

  // ----------------------------
  // GDPR
  // ----------------------------

  test('GET /api/gdpr/consents returns consents object', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/gdpr/consents`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/gdpr/consents');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
    expect(typeof data?.consents).toBe('object');
  });

  test('PUT /api/gdpr/consents without payload returns 400', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/gdpr/consents`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/gdpr/consents updates values (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/gdpr/consents`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        consents: {
          analytics: true,
          personalization: true,
          marketing: true,
          thirdPartySharing: false,
          aiTraining: true,
        },
      },
    });
    await assertNo5xx(res, 'PUT /api/gdpr/consents');
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Boolean(data?.success)).toBe(true);
    }
  });

  test('GET /api/gdpr/retention returns retention payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/gdpr/retention`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/gdpr/retention');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
    expect(typeof data?.retention).toBe('object');
  });

  test('PUT /api/gdpr/retention invalid period returns 400', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/gdpr/retention`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { retention: { period: '999', autoDelete: false } },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/gdpr/retention updates (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/gdpr/retention`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { retention: { period: '365', autoDelete: false } },
    });
    await assertNo5xx(res, 'PUT /api/gdpr/retention');
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Boolean(data?.success)).toBe(true);
    }
  });

  test('GET /api/gdpr/export-status returns request or null', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/gdpr/export-status`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/gdpr/export-status');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
    expect(data?.request === null || typeof data?.request === 'object').toBe(true);
  });

  test('POST /api/gdpr/export-request returns success or 400 (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/gdpr/export-request`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'POST /api/gdpr/export-request');
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Boolean(data?.success)).toBe(true);
      expect(String(data?.request?.id || '')).toBeTruthy();
    }
  });

  test('POST /api/gdpr/deletion-request returns success or 400 (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/gdpr/deletion-request`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'POST /api/gdpr/deletion-request');
    expect([200, 400]).toContain(res.status());
  });

  // ----------------------------
  // Compliance
  // ----------------------------

  test('GET /api/compliance/gdpr returns org GDPR settings (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/compliance/gdpr`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/compliance/gdpr');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
  });

  test('PUT /api/compliance/gdpr is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/compliance/gdpr`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { enabled: false, features: [] },
    });
    await assertNo5xx(res, 'PUT /api/compliance/gdpr');
    expect([200, 403]).toContain(res.status());
  });

  test('GET /api/compliance/cookies returns cookie settings (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/compliance/cookies`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/compliance/cookies');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
  });

  test('PUT /api/compliance/cookies is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/compliance/cookies`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { enabled: false, bannerTitle: 'E2E' },
    });
    await assertNo5xx(res, 'PUT /api/compliance/cookies');
    expect([200, 403]).toContain(res.status());
  });

  test('GET /api/compliance/data-retention returns retention settings (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/compliance/data-retention`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/compliance/data-retention');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
  });

  test('PUT /api/compliance/data-retention is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/compliance/data-retention`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { userDataRetentionDays: 365, auditLogRetentionDays: 730 },
    });
    await assertNo5xx(res, 'PUT /api/compliance/data-retention');
    expect([200, 403]).toContain(res.status());
  });
});
