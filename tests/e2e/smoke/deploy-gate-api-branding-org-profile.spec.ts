/**
 * L4 Smoke — deploy gate API (branding + organization profile)
 *
 * Focus:
 * - Settings > Organization/Profile/Branding must not 5xx on public deploy
 * - Role-gated endpoints may 403 for demo user
 * - Deterministic assertions (status + minimal shape)
 */

import { expect, test } from '@playwright/test';

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

async function assertNo5xx(res: any, label: string) {
  if (res.status() < 500) return;
  if (res.status() === 503) {
    const body = await jsonOrText(res);
    if (body?.code === 'FEATURE_UNAVAILABLE') return;
  }
  const body = await jsonOrText(res);
  throw new Error(`${label} 5xx: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

async function demoLoginApi(request: any): Promise<{ token: string; organizationId: string }> {
  const res = await request.post(`${API_BASE_URL}/api/auth/demo-login`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const token = String(data?.token || '');
  const organizationId = String(data?.user?.organizationId || '');
  expect(token.length).toBeGreaterThan(10);
  expect(organizationId.length).toBeGreaterThan(0);
  return { token, organizationId };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (branding + organization profile)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let orgId = '';
  const otherOrgId = 'org-does-not-exist';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
    orgId = login.organizationId;
  });

  // ----------------------------
  // Branding (/api/branding)
  // ----------------------------

  test('GET /api/branding is superadmin-only (403/401; no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/branding');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/branding/:orgId returns defaults or branding', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/branding/:orgId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
    expect(data?.branding === null || typeof data?.branding === 'object').toBe(true);
  });

  test('PATCH /api/branding/:orgId upserts branding', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { primaryColor: '#111111', secondaryColor: '#222222', accentColor: '#333333' },
    });
    await assertNo5xx(res, 'PATCH /api/branding/:orgId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
    expect(String(data?.branding?.primaryColor || '')).toBe('#111111');
  });

  test('GET /api/branding/:orgId reflects updated primaryColor', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/branding/:orgId (after patch)');
    const data = await res.json().catch(() => null);
    expect(String(data?.branding?.primaryColor || '')).toBe('#111111');
  });

  test('PATCH /api/branding/:orgId updates booleans + support email', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { hidePoweredBy: true, customSupportEmail: 'support@example.invalid' },
    });
    await assertNo5xx(res, 'PATCH /api/branding/:orgId (booleans)');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('GET /api/branding/:orgId reflects hidePoweredBy', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/branding/:orgId (booleans)');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.branding?.hidePoweredBy)).toBe(true);
    expect(String(data?.branding?.customSupportEmail || '')).toContain('support@');
  });

  test('PATCH /api/branding/:orgId updates custom domain flags', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { customDomain: 'example.invalid', customDomainVerified: true, customDomainSslStatus: 'active' },
    });
    await assertNo5xx(res, 'PATCH /api/branding/:orgId (custom domain)');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('GET /api/branding/:orgId reflects custom domain', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/branding/:orgId (custom domain)');
    const data = await res.json().catch(() => null);
    expect(String(data?.branding?.customDomain || '')).toBe('example.invalid');
    expect(Boolean(data?.branding?.customDomainVerified)).toBe(true);
  });

  test('DELETE /api/branding/:orgId resets branding', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'DELETE /api/branding/:orgId');
    expect([200, 404]).toContain(res.status());
  });

  test('DELETE /api/branding/:orgId again returns 404 (no 5xx)', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'DELETE /api/branding/:orgId (again)');
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/branding/:orgId returns defaults after reset', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/branding/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/branding/:orgId (after delete)');
    const data = await res.json().catch(() => null);
    expect(data?.branding === null || typeof data?.branding === 'object').toBe(true);
    expect(typeof data?.defaults).toBe('object');
  });

  // ----------------------------
  // Organization profiles (/api/organization-profiles)
  // ----------------------------

  test('GET /api/organization-profiles/:orgId returns profile payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/organization-profiles/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/organization-profiles/:orgId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(typeof data?.profile).toBe('object');
    expect(typeof data?.completeness).toBe('number');
  });

  test('PUT /api/organization-profiles/:orgId is role-gated (200 or 403; no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/organization-profiles/${orgId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { description: 'E2E', industry: 'General', companySize: '1-10', brandColor: '#444444' },
    });
    await assertNo5xx(res, 'PUT /api/organization-profiles/:orgId');
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Boolean(data?.success)).toBe(true);
    }
  });

  test('POST /api/organization-profiles/:orgId/logo returns 503 FEATURE_UNAVAILABLE (no fake uploads)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/organization-profiles/${orgId}/logo`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'POST /api/organization-profiles/:orgId/logo');
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(String(data?.code || '')).toBe('FEATURE_UNAVAILABLE');
  });

  test('POST /api/organization-profiles/:orgId/verify-domain without domain returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/organization-profiles/${orgId}/verify-domain`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/organization-profiles/:orgId/verify-domain invalid domain returns verified=false', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/organization-profiles/${orgId}/verify-domain`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { domain: 'not a domain' },
    });
    await assertNo5xx(res, 'POST /api/organization-profiles/:orgId/verify-domain (invalid)');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.verified)).toBe(false);
  });

  test('POST /api/organization-profiles/:orgId/verify-domain valid domain returns 503 FEATURE_UNAVAILABLE (no simulated verify)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/organization-profiles/${orgId}/verify-domain`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { domain: 'example.invalid' },
    });
    await assertNo5xx(res, 'POST /api/organization-profiles/:orgId/verify-domain (valid)');
    expect(res.status()).toBe(503);
    const data = await res.json().catch(() => null);
    expect(String(data?.code || '')).toBe('FEATURE_UNAVAILABLE');
  });

  test('GET /api/organization-profiles/:orgId does not flip customDomainVerified from a simulated verify', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/organization-profiles/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/organization-profiles/:orgId (after domain verify)');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.profile?.customDomainVerified)).not.toBe(true);
  });

  test('GET /api/organization-profiles/:otherOrgId returns 403', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/organization-profiles/${otherOrgId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/organization-profiles/:otherOrgId');
    expect(res.status()).toBe(403);
  });

  test('PUT /api/organization-profiles/:otherOrgId returns 403', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/organization-profiles/${otherOrgId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { description: 'nope' },
    });
    await assertNo5xx(res, 'PUT /api/organization-profiles/:otherOrgId');
    expect(res.status()).toBe(403);
  });
});
