/**
 * L4 Smoke — deploy gate API (billing)
 *
 * Focus:
 * - Endpoints that often block GO deploys due to schema drift (plans/usage/spending alerts/webhooks)
 * - Deterministic assertions (status + minimal shape)
 *
 * Note:
 * - Some billing validators require UUID organization IDs, while demo org IDs are not UUIDs.
 *   This suite intentionally avoids endpoints that require passing organizationId in query/body.
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

test.describe('L4 Smoke — deploy gate API (billing)', () => {
  test.setTimeout(90000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let usageId = '';
  let alertId = '';

  test.beforeAll(async ({ request }) => {
    const auth = await demoLoginApi(request);
    token = auth.token;
  });

  test('GET /api/billing/plans returns plans array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/plans`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/billing/plans');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ plans: expect.any(Array) }));
  });

  test('GET /api/billing/plans?includeInactive=true returns plans array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/plans?includeInactive=true`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/plans?includeInactive=true');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ plans: expect.any(Array) }));
  });

  test('GET /api/billing/subscriptions returns subscriptions list payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/subscriptions?page=1&pageSize=10`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/subscriptions');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ subscriptions: expect.any(Array) }));
  });

  test('GET /api/billing/subscriptions?status=active supports filtering', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/subscriptions?status=active&page=1&pageSize=10`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/subscriptions?status=active');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ subscriptions: expect.any(Array) }));
  });

  test('GET /api/billing/invoices returns invoices list payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/invoices?page=1&pageSize=10`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/invoices');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(
      expect.objectContaining({
        invoices: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        pageSize: expect.any(Number),
      })
    );
  });

  test('GET /api/billing/invoices?status=draft supports filtering', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/invoices?status=draft&page=1&pageSize=10`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/invoices?status=draft');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ invoices: expect.any(Array) }));
  });

  test('GET /api/billing/usage returns usage payload + structuredUsage', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/usage`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/billing/usage');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(
      expect.objectContaining({
        usage: expect.any(Array),
        structuredUsage: expect.any(Object),
        totals: expect.any(Array),
      })
    );
  });

  test('POST /api/billing/usage records usage metric', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/billing/usage`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { metricName: 'e2e_smoke', quantity: 1, metadata: { source: 'smoke' } },
    });
    await assertOk(res, 'POST /api/billing/usage');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    usageId = String(data?.id || '');
    expect(usageId.length).toBeGreaterThan(10);
  });

  test('GET /api/billing/usage?metric=e2e_smoke filters usage records', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/usage?metric=e2e_smoke`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/usage?metric=e2e_smoke');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.usage)).toBeTruthy();
  });

  test('GET /api/billing/spending-alerts returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/spending-alerts`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/spending-alerts');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /api/billing/spending-alerts creates an alert', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/billing/spending-alerts`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        type: 'budget',
        threshold: 10,
        thresholdType: 'absolute',
        action: 'notify',
        notifyEmails: [],
        isActive: true,
      },
    });
    await assertOk(res, 'POST /api/billing/spending-alerts');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    alertId = String(data?.id || '');
    expect(alertId.length).toBeGreaterThan(10);
  });

  test('PUT /api/billing/spending-alerts/:id updates an alert', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/billing/spending-alerts/${alertId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        type: 'budget',
        threshold: 20,
        thresholdType: 'absolute',
        action: 'notify',
        notifyEmails: [],
        isActive: true,
      },
    });
    await assertOk(res, 'PUT /api/billing/spending-alerts/:id');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
  });

  test('POST /api/billing/spending-alerts/:id/toggle toggles alert', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/billing/spending-alerts/${alertId}/toggle`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { enabled: false },
    });
    await assertOk(res, 'POST /api/billing/spending-alerts/:id/toggle');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/billing/spending-alerts contains created alert', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/spending-alerts`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/spending-alerts (after create)');
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data) ? data : [];
    const mine = list.find((a: any) => String(a?.id || '') === alertId);
    expect(mine).toBeTruthy();
    expect(String(mine?.id || '')).toBe(alertId);
  });

  test('DELETE /api/billing/spending-alerts/:id deletes alert', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/billing/spending-alerts/${alertId}`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'DELETE /api/billing/spending-alerts/:id');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/billing/spending-alerts no longer includes deleted alert', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/spending-alerts`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/spending-alerts (after delete)');
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data) ? data : [];
    const mine = list.find((a: any) => String(a?.id || '') === alertId);
    expect(mine).toBeFalsy();
  });

  test('GET /api/billing/addons returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/addons`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/billing/addons');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/billing/webhook-event-types returns static catalog', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/webhook-event-types`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/billing/webhook-event-types');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ eventTypes: expect.any(Object) }));
    expect(Object.keys(data?.eventTypes || {}).length).toBeGreaterThan(0);
  });

  test('GET /api/billing/webhook-events returns events array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/webhook-events?limit=10`, {
      headers: authHeaders(token),
    });
    // Depending on org role mapping in the current environment, this may be gated.
    // We only assert "no 5xx" and shape if accessible.
    if (res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.error || '')).toMatch(/billing access/i);
      return;
    }
    await assertOk(res, 'GET /api/billing/webhook-events');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ events: expect.any(Array) }));
  });

  test('GET /api/billing/webhook-events/stats returns stats payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/billing/webhook-events/stats?period=7%20days`, {
      headers: authHeaders(token),
    });
    if (res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.error || '')).toMatch(/billing access/i);
      return;
    }
    await assertOk(res, 'GET /api/billing/webhook-events/stats');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ stats: expect.any(Object) }));
  });
});
