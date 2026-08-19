/**
 * L4 Smoke — deploy gate API (SSO / SCIM / Webhooks)
 *
 * Focus:
 * - Enterprise endpoints mounted in production must not 5xx
 * - Deterministic assertions (status + minimal shape)
 * - Admin-only routes may 403 for demo user
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

async function assertNo5xx(res: any, label: string) {
  if (res.status() < 500) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} 5xx: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

async function demoLoginApi(_request: any): Promise<{ token: string }> {
  const { token } = readTestSupportState();
  return { token };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (SSO / SCIM / Webhooks)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let scimUserName = '';
  let webhookSubId = '';
  let scimCreateAllowed = false;

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
  });

  // ----------------------------
  // SSO
  // ----------------------------

  test('GET /api/sso/config without domain returns 400', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/sso/config`, { params: {} });
    expect(res.status()).toBe(400);
  });

  test('GET /api/sso/config with domain returns ssoEnabled flag', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/sso/config`, { params: { domain: 'example.com' } });
    await assertOk(res, 'GET /api/sso/config');
    const data = await res.json().catch(() => null);
    expect(typeof data?.ssoEnabled).toBe('boolean');
  });

  test('POST /api/sso/saml/callback without SAMLResponse returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/sso/saml/callback`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/sso/saml/login fails before creating unsigned auth state', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/sso/saml/login`, {
      params: { domain: 'example.com' },
    });
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(data?.code).toBe('SAML_SIGNATURE_VERIFICATION_UNAVAILABLE');
    expect(data?.redirectUrl).toBeUndefined();
    expect(data?.state).toBeUndefined();
  });

  test('POST /api/sso/saml/callback fails closed without issuing tokens', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/sso/saml/callback`, {
      headers: { 'content-type': 'application/json' },
      data: { SAMLResponse: 'dummy' },
    });
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(data?.code).toBe('SAML_SIGNATURE_VERIFICATION_UNAVAILABLE');
    expect(data?.token).toBeUndefined();
    expect(data?.refreshToken).toBeUndefined();
  });

  test('POST /api/sso/oidc/callback without code returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/sso/oidc/callback`, {
      headers: { 'content-type': 'application/json' },
      data: { state: 'x' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/sso/oidc/authorize fails before creating unverified auth state', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/sso/oidc/authorize`, {
      params: { domain: 'example.com' },
    });
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(data?.code).toBe('OIDC_TOKEN_VERIFICATION_UNAVAILABLE');
    expect(data?.authUrl).toBeUndefined();
    expect(data?.state).toBeUndefined();
  });

  test('POST /api/sso/oidc/callback fails closed without issuing tokens', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/sso/oidc/callback`, {
      headers: { 'content-type': 'application/json' },
      data: { code: 'dummy', state: 'x' },
    });
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(data?.code).toBe('OIDC_TOKEN_VERIFICATION_UNAVAILABLE');
    expect(data?.token).toBeUndefined();
    expect(data?.refreshToken).toBeUndefined();
  });

  // ----------------------------
  // SCIM (mounted at /api/scim/v2 and /api/scim/admin)
  // ----------------------------

  test('GET /api/scim/v2/Users returns SCIM ListResponse shape', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/scim/v2/Users`);
    await assertNo5xx(res, 'GET /api/scim/v2/Users');
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() !== 200) return;
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.schemas)).toBe(true);
    expect(Array.isArray(data?.Resources)).toBe(true);
    expect(typeof data?.totalResults).toBe('number');
  });

  test('GET /api/scim/v2/Users supports pagination params', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/scim/v2/Users`, {
      params: { startIndex: '1', count: '2' },
    });
    await assertNo5xx(res, 'GET /api/scim/v2/Users (paged)');
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() !== 200) return;
    const data = await res.json().catch(() => null);
    expect(data?.itemsPerPage).toBe(2);
    expect(Array.isArray(data?.Resources)).toBe(true);
  });

  test('POST /api/scim/v2/Users without userName returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/scim/v2/Users`, {
      headers: { 'content-type': 'application/json' },
      data: { active: true, name: { givenName: 'E2E', familyName: 'User' } },
    });
    await assertNo5xx(res, 'POST /api/scim/v2/Users (missing userName)');
    expect([400, 401, 403]).toContain(res.status());
  });

  test('POST /api/scim/v2/Users creates a user', async ({ request }) => {
    scimUserName = `e2e_scim_${Date.now()}@example.invalid`;
    const res = await request.post(`${API_BASE_URL}/api/scim/v2/Users`, {
      headers: { 'content-type': 'application/json' },
      data: { userName: scimUserName, active: true, name: { givenName: 'E2E', familyName: 'SCIM' } },
    });
    await assertNo5xx(res, 'POST /api/scim/v2/Users');
    expect([201, 401, 403]).toContain(res.status());
    if (res.status() !== 201) return;
    scimCreateAllowed = true;
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBeTruthy();
    expect(String(data?.userName || '')).toBe(scimUserName);
  });

  test('GET /api/scim/v2/Users contains created userName', async ({ request }) => {
    if (!scimCreateAllowed) return;
    const res = await request.get(`${API_BASE_URL}/api/scim/v2/Users`, { params: { count: '200' } });
    await assertNo5xx(res, 'GET /api/scim/v2/Users (after create)');
    if (res.status() !== 200) return;
    const data = await res.json().catch(() => null);
    const resources = Array.isArray(data?.Resources) ? data.Resources : [];
    const userNames = resources.map((u: any) => String(u?.userName || '')).filter(Boolean);
    expect(userNames).toContain(scimUserName);
  });

  test('GET /api/scim/v2/Groups returns SCIM ListResponse shape', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/scim/v2/Groups`);
    await assertNo5xx(res, 'GET /api/scim/v2/Groups');
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() !== 200) return;
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.schemas)).toBe(true);
    expect(Array.isArray(data?.Resources)).toBe(true);
    expect(typeof data?.totalResults).toBe('number');
  });

  test('GET /api/scim/admin/Users is reachable and returns SCIM ListResponse', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/scim/admin/Users`, { params: { count: '1' } });
    await assertNo5xx(res, 'GET /api/scim/admin/Users');
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() !== 200) return;
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.schemas)).toBe(true);
    expect(Array.isArray(data?.Resources)).toBe(true);
  });

  // ----------------------------
  // Webhooks (incoming) + events (admin-only)
  // ----------------------------

  test('POST /api/webhooks/stripe receives event', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/stripe`, {
      headers: { 'content-type': 'application/json' },
      data: { id: `evt_${Date.now()}`, type: 'invoice.paid' },
    });
    await assertOk(res, 'POST /api/webhooks/stripe');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.received)).toBe(true);
  });

  test('POST /api/webhooks/github receives event', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/github`, {
      headers: { 'content-type': 'application/json', 'x-github-event': 'ping', 'x-github-delivery': `gh_${Date.now()}` },
      data: { zen: 'Keep it logically awesome.' },
    });
    await assertOk(res, 'POST /api/webhooks/github');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.received)).toBe(true);
  });

  test('POST /api/webhooks/:provider receives generic event', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/custom`, {
      headers: { 'content-type': 'application/json' },
      data: { hello: 'world' },
    });
    await assertOk(res, 'POST /api/webhooks/custom');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.received)).toBe(true);
  });

  test('GET /api/webhooks/events is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/webhooks/events`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/webhooks/events');
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Array.isArray(data)).toBe(true);
    }
  });

  // ----------------------------
  // Webhook subscriptions (admin-only)
  // ----------------------------

  test('GET /api/webhooks/subscriptions is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/webhooks/subscriptions`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/webhooks/subscriptions');
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('POST /api/webhooks/subscriptions is role-gated (201 or 403; no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/subscriptions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Sub ${Date.now()}`, url: 'https://example.invalid/webhook', events: ['*'] },
    });
    await assertNo5xx(res, 'POST /api/webhooks/subscriptions');
    // Some deployments may respond 200 for idempotent create; accept as long as it's not 5xx.
    expect([200, 201, 403]).toContain(res.status());
    if (res.status() === 201 || res.status() === 200) {
      const data = await res.json().catch(() => null);
      webhookSubId = String(data?.id || '');
      if (res.status() === 201) {
        expect(webhookSubId).toBeTruthy();
      }
    }
  });

  test('PUT + DELETE /api/webhooks/subscriptions/:id is role-gated (no 5xx)', async ({ request }) => {
    const id = webhookSubId || 'e2e_missing_subscription_id';

    const putRes = await request.put(`${API_BASE_URL}/api/webhooks/subscriptions/${id}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: 'E2E Updated', isActive: false },
    });
    await assertNo5xx(putRes, 'PUT /api/webhooks/subscriptions/:id');
    expect([200, 400, 403, 404, 422]).toContain(putRes.status());

    const delRes = await request.delete(`${API_BASE_URL}/api/webhooks/subscriptions/${id}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(delRes, 'DELETE /api/webhooks/subscriptions/:id');
    expect([200, 400, 403, 404, 422]).toContain(delRes.status());
  });
});
