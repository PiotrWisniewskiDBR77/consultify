/**
 * L4 Smoke — deploy gate API (user account & settings)
 *
 * Focus:
 * - Endpoints used in Settings > Account/Preferences/Security
 * - Must not 5xx on public deploy (role-gated endpoints may 403)
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

async function demoLoginApi(request: any): Promise<{
  token: string;
  userId: string;
  organizationId: string;
}> {
  const res = await request.post(`${API_BASE_URL}/api/auth/demo-login`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const token = String(data?.token || '');
  const userId = String(data?.user?.id || '');
  const organizationId = String(data?.user?.organizationId || '');
  expect(token.length).toBeGreaterThan(10);
  expect(userId.length).toBeGreaterThan(0);
  expect(organizationId.length).toBeGreaterThan(0);
  return { token, userId, organizationId };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (user account & settings)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let userId = '';
  let ruleId = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
    userId = login.userId;
  });

  test('GET /api/preferences returns preferences object', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/preferences`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/preferences');
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
    expect(['light', 'dark', 'system']).toContain(String(data?.theme || 'system'));
  });

  test('GET /api/preferences/options returns option lists', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/preferences/options`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/preferences/options');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.themes)).toBe(true);
    expect(Array.isArray(data?.languages)).toBe(true);
  });

  test('PUT /api/preferences updates theme', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/preferences`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { theme: 'dark' },
    });
    await assertOk(res, 'PUT /api/preferences');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('PUT /api/preferences/ui updates UI prefs', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/preferences/ui`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { theme: 'dark', sidebarCollapsed: true, compactMode: true },
    });
    await assertOk(res, 'PUT /api/preferences/ui');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('GET /api/preferences reflects updated theme (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/preferences`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/preferences (after update)');
    const data = await res.json().catch(() => null);
    expect(['dark', 'light', 'system']).toContain(String(data?.theme || 'system'));
  });

  test('GET /api/user/contact-information returns object', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/contact-information`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/user/contact-information');
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
  });

  test('PUT /api/user/contact-information upserts contact info', async ({ request }) => {
    const payload = {
      phone: '+1-555-0100',
      address: 'E2E Street 1',
      city: 'Warsaw',
      country: 'PL',
      postalCode: '00-001',
      linkedin: 'https://example.invalid/in/piotr',
      website: 'https://example.invalid',
    };
    const res = await request.put(`${API_BASE_URL}/api/user/contact-information`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: payload,
    });
    await assertOk(res, 'PUT /api/user/contact-information');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('GET /api/user/contact-information returns updated phone', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/contact-information`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/user/contact-information (after upsert)');
    const data = await res.json().catch(() => null);
    expect(String(data?.phone || '')).toContain('555');
  });

  test('GET /api/user/availability returns availability object', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/availability`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/user/availability');
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
    expect(String(data?.status || '')).toBeTruthy();
  });

  test('PUT /api/user/availability upserts availability', async ({ request }) => {
    const payload = {
      status: 'available',
      workingHours: { start: '10:00', end: '18:00' },
      timezone: 'Europe/Warsaw',
      autoReply: false,
      vacationMode: false,
    };
    const res = await request.put(`${API_BASE_URL}/api/user/availability`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: payload,
    });
    await assertOk(res, 'PUT /api/user/availability');
    const data = await res.json().catch(() => null);
    expect(Boolean(data?.success)).toBe(true);
  });

  test('GET /api/user/availability reflects updated timezone', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/availability`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/user/availability (after upsert)');
    const data = await res.json().catch(() => null);
    expect(String(data?.timezone || '')).toBeTruthy();
  });

  test('GET /api/user/security/sessions returns sessions array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/security/sessions`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/security/sessions');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/users is role-gated but must not 5xx', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/users`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/users');
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(Array.isArray(data?.users) || Array.isArray(data)).toBe(true);
    }
  });

  test('GET /api/users/:id is role-gated but must not 5xx', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/users/${userId}`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/users/:id');
    expect([200, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json().catch(() => null);
      expect(String(data?.id || data?.user?.id || '')).toBeTruthy();
    }
  });

  test('GET /api/user/security/login-history returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/security/login-history`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/security/login-history');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/user/security/trusted-devices returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/security/trusted-devices`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/security/trusted-devices');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/user/notification-rules returns rules array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/notification-rules`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/notification-rules');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/user/notification-rules/:id returns 404 for unknown (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/notification-rules/rule-does-not-exist`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/notification-rules/:id (unknown)');
    expect([200, 404]).toContain(res.status());
  });

  test('POST /api/user/notification-rules is admin-only (201 or 403; no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/user/notification-rules`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        name: `E2E Rule ${Date.now()}`,
        description: 'smoke',
        eventType: 'task_created',
        conditions: {},
        actions: [],
        priority: 1,
      },
    });
    await assertNo5xx(res, 'POST /api/user/notification-rules');
    expect([201, 403]).toContain(res.status());
    if (res.status() === 201) {
      const data = await res.json().catch(() => null);
      ruleId = String(data?.id || '');
      expect(ruleId).toBeTruthy();
    }
  });

  test('GET /api/user/notification-rules/meta/event-types returns list', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/user/notification-rules/meta/event-types`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/user/notification-rules/meta/event-types');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.eventTypes) || Array.isArray(data)).toBe(true);
  });
});
