/**
 * L4 Smoke — deploy gate API (app core)
 *
 * Focus:
 * - Deterministic endpoints that commonly block public deploys (settings/notifications/projects/org)
 * - Assertions kept intentionally minimal (status + basic shape)
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

async function assertOk(res: any, label: string) {
  if (res.ok()) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} failed: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

async function demoLoginApi(request: any): Promise<{
  token: string;
  userId: string;
  organizationId?: string;
}> {
  const res = await request.post(`${API_BASE_URL}/api/auth/demo-login`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const token = String(data?.token || '');
  const userId = String(data?.user?.id || '');
  const organizationId = data?.user?.organizationId ? String(data.user.organizationId) : undefined;
  expect(token.length).toBeGreaterThan(10);
  expect(userId.length).toBeGreaterThan(0);
  return { token, userId, organizationId };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (app core)', () => {
  test.setTimeout(60000);

  test('GET /api/settings returns key-value object', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/settings');
    const data = await res.json();
    expect(typeof data).toBe('object');
  });

  test('POST /api/settings persists a key', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const key = `e2e_smoke_${Date.now()}`;
    const value = `v_${Date.now()}`;

    const post = await request.post(`${API_BASE_URL}/api/settings`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { key, value },
    });
    await assertOk(post, 'POST /api/settings');
    const postBody = await post.json().catch(() => null);
    expect(postBody).toEqual(expect.objectContaining({ success: true }));

    const get = await request.get(`${API_BASE_URL}/api/settings`, { headers: authHeaders(token) });
    await assertOk(get, 'GET /api/settings (after POST)');
    const settings = await get.json();
    expect(String(settings?.[key] || '')).toBe(value);
  });

  test('GET /api/settings/preferences/regional returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/regional`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/regional');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/notifications returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/notifications`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/notifications');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/quietHours returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/quietHours`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/quietHours');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/privacy returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/privacy`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/privacy');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/dashboard returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/dashboard`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/dashboard');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/work returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/work`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/work');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/ai-instructions returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/ai-instructions`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/ai-instructions');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/settings/preferences/appearance returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/appearance`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/appearance');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });

  test('GET /api/notifications returns an array', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/notifications?limit=5`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/notifications');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/notifications/counts returns unread count', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/notifications/counts`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/notifications/counts');
    const data = await res.json();
    expect(typeof data?.unread).toBe('number');
  });

  test('GET /api/notifications/unread-count returns count', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/notifications/unread-count`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/notifications/unread-count');
    const data = await res.json();
    expect(typeof data?.count).toBe('number');
  });

  test('POST /api/notifications/mark-all-read succeeds', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.post(`${API_BASE_URL}/api/notifications/mark-all-read`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'POST /api/notifications/mark-all-read');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
    if (data?.updated !== undefined) expect(typeof data.updated).toBe('number');
  });

  test('GET /api/pmo/projects/my-memberships returns memberships (route not shadowed)', async ({
    request,
  }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/pmo/projects/my-memberships`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/pmo/projects/my-memberships');
    const data = await res.json();
    expect(Array.isArray(data?.memberships)).toBe(true);
  });

  test('GET /api/projects returns an array', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/projects?limit=5`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/projects');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/teams returns an array', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/teams`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/teams');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/organizations/current returns organizations array', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/organizations/current`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/organizations/current');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/organizations/:orgId returns org payload', async ({ request }) => {
    const { token, organizationId } = await demoLoginApi(request);
    const orgId = organizationId || 'demo-org';
    const res = await request.get(`${API_BASE_URL}/api/organizations/${orgId}`, {
      headers: authHeaders(token),
    });
    await assertOk(res, `GET /api/organizations/${orgId}`);
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    if (data?.id) expect(String(data.id)).toBe(orgId);
  });

  test('GET /api/settings/preferences/ai-model returns preferences', async ({ request }) => {
    const { token } = await demoLoginApi(request);
    const res = await request.get(`${API_BASE_URL}/api/settings/preferences/ai-model`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/settings/preferences/ai-model');
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
  });
});

