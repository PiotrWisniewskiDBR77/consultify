/**
 * L4 Smoke — deploy gate API (tools workflow)
 *
 * Focus:
 * - `/api/tools` must not 5xx on public deploy
 * - Validate the key workflow transitions without relying on placeholders
 * - Deterministic assertions: status + minimal shape
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
  const body = await jsonOrText(res);
  throw new Error(`${label} 5xx: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

async function demoLoginApi(request: any): Promise<{ token: string }> {
  const res = await request.post(`${API_BASE_URL}/api/auth/demo-login`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const token = String(data?.token || '');
  expect(token.length).toBeGreaterThan(10);
  return { token };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('L4 Smoke — deploy gate API (tools workflow)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let toolIdA = '';
  let toolIdB = '';
  let toolIdC = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
  });

  test('GET /api/tools without auth returns 401/403 (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tools`);
    await assertNo5xx(res, 'GET /api/tools (no auth)');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/tools with auth returns list payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tools`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/tools');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.items)).toBe(true);
    expect(typeof data?.total).toBe('number');
  });

  test('POST /api/tools creates a tool session (DRAFT)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { toolType: 'dynamic-swot', name: `E2E Tool A ${Date.now()}` },
    });
    await assertNo5xx(res, 'POST /api/tools');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    toolIdA = String(data?.id || '');
    expect(toolIdA.length).toBeGreaterThan(8);
    expect(String(data?.status || '')).toBe('DRAFT');
  });

  test('GET /api/tools/:toolId returns session details', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tools/${toolIdA}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/tools/:toolId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(toolIdA);
    expect(String(data?.status || '')).toBe('DRAFT');
    expect(typeof data?.permissions).toBe('object');
  });

  test('PUT /api/tools/:toolId updates answers + progress (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/tools/${toolIdA}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        answers: { swot: { strengths: ['A'], weaknesses: ['B'] } },
        completionPercent: 50,
        confidenceAvg: 2,
        contextSnapshot: { org: { name: 'Demo' } },
      },
    });
    await assertNo5xx(res, 'PUT /api/tools/:toolId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(toolIdA);
    expect(String(data?.updatedAt || '')).toContain('T');
  });

  test('POST /api/tools/:toolId/request-review before DoD returns 409 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdA}/request-review`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { priority: 'medium' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/request-review (before DoD)');
    expect(res.status()).toBe(409);
  });

  test('PUT /api/tools/:toolId sets DoD satisfied (progress 100 + confidence 3)', async ({
    request,
  }) => {
    const res = await request.put(`${API_BASE_URL}/api/tools/${toolIdA}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        answers: { swot: { strengths: ['A'], weaknesses: ['B'], opportunities: ['C'] } },
        completionPercent: 100,
        confidenceAvg: 3,
      },
    });
    await assertNo5xx(res, 'PUT /api/tools/:toolId (DoD)');
    expect(res.status()).toBe(200);
  });

  test('POST /api/tools/:toolId/request-review transitions to REVIEW', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdA}/request-review`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { priority: 'high' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/request-review');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.status || '')).toBe('REVIEW');
  });

  test('POST /api/tools/:toolId/approve transitions to APPROVED', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdA}/approve`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { priority: 'high' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/approve');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.status || '')).toBe('APPROVED');
  });

  test('PUT /api/tools/:toolId after approval returns 409 (immutability)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/tools/${toolIdA}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { completionPercent: 0 },
    });
    await assertNo5xx(res, 'PUT /api/tools/:toolId (after approval)');
    expect(res.status()).toBe(409);
  });

  test('POST /api/tools/:toolId/send-back on APPROVED returns 409', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdA}/send-back`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { comment: 'Back to draft' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/send-back (wrong status)');
    expect(res.status()).toBe(409);
  });

  test('POST /api/tools/:toolId/generate-initiatives missing body returns 400/422 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdA}/generate-initiatives`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {},
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/generate-initiatives (missing)');
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/tools creates another session (B)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { toolType: 'market-forces', name: `E2E Tool B ${Date.now()}` },
    });
    await assertNo5xx(res, 'POST /api/tools (B)');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    toolIdB = String(data?.id || '');
    expect(toolIdB.length).toBeGreaterThan(8);
  });

  test('POST /api/tools/:toolId/generate-initiatives on DRAFT returns 409 (not approved)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdB}/generate-initiatives`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { methodologyId: 'default', count: 1, includeChatContext: false },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/generate-initiatives (not approved)');
    expect(res.status()).toBe(409);
  });

  test('GET /api/tools/:toolId/generated-initiatives returns empty list by default', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/tools/${toolIdB}/generated-initiatives`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/tools/:toolId/generated-initiatives');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.initiatives)).toBe(true);
  });

  test('POST /api/tools creates session (C) for send-back flow', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { toolType: 'risk-uncertainty', name: `E2E Tool C ${Date.now()}` },
    });
    await assertNo5xx(res, 'POST /api/tools (C)');
    const data = await res.json().catch(() => null);
    toolIdC = String(data?.id || '');
    expect(toolIdC.length).toBeGreaterThan(8);
  });

  test('C: PUT /api/tools/:toolId sets DoD satisfied', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/tools/${toolIdC}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { answers: { risk: { notes: 'E2E' } }, completionPercent: 100, confidenceAvg: 3 },
    });
    await assertNo5xx(res, 'PUT /api/tools/:toolId (C DoD)');
    expect(res.status()).toBe(200);
  });

  test('C: request-review transitions to REVIEW', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdC}/request-review`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { priority: 'low' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/request-review (C)');
    expect(res.status()).toBe(200);
  });

  test('C: send-back with missing comment returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdC}/send-back`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { comment: '' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/send-back (missing comment)');
    expect(res.status()).toBe(400);
  });

  test('C: send-back with comment transitions to DRAFT', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tools/${toolIdC}/send-back`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { comment: 'Please revise' },
    });
    await assertNo5xx(res, 'POST /api/tools/:toolId/send-back (C)');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.status || '')).toBe('DRAFT');
  });
});
