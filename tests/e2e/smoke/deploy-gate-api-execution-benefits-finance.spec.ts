/**
 * L4 Smoke — deploy gate API (Execution / Benefits / Finance)
 *
 * Focus:
 * - Core endpoints used by Execution/Benefits/Economics views
 * - No 5xx + minimal contract assertions
 * - Deterministic: seed project + initiative + KPI in SQLite
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

async function assertNo5xx(res: any, label: string) {
  const status = res.status?.() ?? 0;
  if (status < 500) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} failed: ${status} ${res.statusText?.() || ''} body=${JSON.stringify(body)}`);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function extractId(payload: any): string {
  const direct = payload?.id || payload?.data?.id || payload?.projectId || payload?.initiativeId;
  return typeof direct === 'string' ? direct : '';
}

test.describe('L4 Smoke — deploy gate API (Execution / Benefits / Finance)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let userId = '';
  let projectId = '';
  let initiativeId = '';
  let kpiId = '';
  let kpiTsId = '';
  let mappingId = '';
  let budgetId = '';

  test.beforeAll(async ({ request }) => {
    const auth = readTestSupportState();
    token = auth.token;
    userId = auth.userId;
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();

    const headers = { ...authHeaders(token), 'content-type': 'application/json' };

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers,
      data: { name: `E2E WS4 ${Date.now()}`, description: 'smoke seed' },
    });
    await assertNo5xx(createProject, 'POST /api/projects (seed)');
    const projBody = await jsonOrText(createProject);
    projectId = extractId(projBody);
    expect(projectId).toBeTruthy();

    const createIni = await request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: `E2E WS4 Initiative ${Date.now()}`,
        summary: 'smoke seed',
        status: 'PLANNING',
        projectId,
        ownerBusinessId: userId,
        ownerExecutionId: userId,
      },
    });
    await assertNo5xx(createIni, 'POST /api/initiatives (seed)');
    const iniBody = await jsonOrText(createIni);
    initiativeId = extractId(iniBody) || String(iniBody?.id || '');
    expect(initiativeId).toBeTruthy();

    const createKpi = await request.post(`${API_BASE_URL}/api/initiatives/${initiativeId}/kpis`, {
      headers,
      data: {
        name: `E2E KPI ${Date.now()}`,
        category: 'Finance',
        unit: '%',
        targetValue: 42,
        measurementFrequency: 'monthly',
      },
    });
    await assertNo5xx(createKpi, 'POST /api/initiatives/:id/kpis (seed)');
    const kpiBody = await jsonOrText(createKpi);
    kpiId =
      extractId(kpiBody) ||
      String(kpiBody?.kpi?.id || kpiBody?.kpiId || kpiBody?.data?.id || '');
    expect(kpiId).toBeTruthy();
  });

  test('GET /api/execution/stats returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/stats`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/execution/stats');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('GET /api/execution/escalations returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/escalations`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/execution/escalations');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('GET /api/execution/calendar returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/calendar`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/execution/calendar');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('GET /api/execution/:projectId/summary returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/${projectId}/summary`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/execution/:projectId/summary');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('GET /api/execution/:projectId/blockers returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/${projectId}/blockers`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/execution/:projectId/blockers');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('GET /api/execution/:projectId/health returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/execution/${projectId}/health`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/execution/:projectId/health');
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const data = await res.json().catch(() => null);
      expect(data).not.toBeNull();
    }
  });

  test('POST /api/execution/:projectId/gate-check rejects/accepts (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/execution/${projectId}/gate-check`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { initiativeId },
    });
    await assertNo5xx(res, 'POST /api/execution/:projectId/gate-check');
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/initiatives/:id/kpis returns {kpis: []} (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/initiatives/${initiativeId}/kpis`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/initiatives/:id/kpis');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ kpis: expect.any(Array) }));
  });

  test('GET /api/benefits/kpis/:kpiId/time-series returns {success,data[]} (no 5xx)', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/benefits/kpis/${kpiId}/time-series`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/benefits/kpis/:kpiId/time-series');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true, data: expect.any(Array) }));
  });

  test('POST /api/benefits/kpis/:kpiId/time-series creates a row (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/benefits/kpis/${kpiId}/time-series`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { value: 10, periodStart: new Date().toISOString().slice(0, 10), source: 'e2e' },
    });
    await assertNo5xx(res, 'POST /api/benefits/kpis/:kpiId/time-series');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true, data: expect.any(Object) }));
    kpiTsId = String(body?.data?.id || '');
    expect(kpiTsId).toBeTruthy();
  });

  test('DELETE /api/benefits/kpis/:kpiId/time-series/:tsId returns success (no 5xx)', async ({
    request,
  }) => {
    const res = await request.delete(`${API_BASE_URL}/api/benefits/kpis/${kpiId}/time-series/${kpiTsId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'DELETE /api/benefits/kpis/:kpiId/time-series/:tsId');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('PUT /api/benefits/roi/:initiativeId/assumptions upserts (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/benefits/roi/${initiativeId}/assumptions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        currency: 'USD',
        discountRate: 0.1,
        analysisHorizonMonths: 12,
        notes: 'e2e smoke',
      },
    });
    await assertNo5xx(res, 'PUT /api/benefits/roi/:initiativeId/assumptions');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/benefits/roi/:initiativeId/assumptions returns payload (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/benefits/roi/${initiativeId}/assumptions`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/benefits/roi/:initiativeId/assumptions');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('POST /api/benefits/kpi-mappings creates mapping (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/benefits/kpi-mappings`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { initiativeId, kpiId, impactWeight: 1.0, impactDirection: 'increase', lagDays: 0 },
    });
    await assertNo5xx(res, 'POST /api/benefits/kpi-mappings');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true, data: expect.any(Object) }));
    mappingId = String(body?.data?.id || '');
    expect(mappingId).toBeTruthy();
  });

  test('GET /api/benefits/kpi-mappings?initiativeId=... returns array (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/benefits/kpi-mappings?initiativeId=${initiativeId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/benefits/kpi-mappings?initiativeId=...');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true, data: expect.any(Array) }));
  });

  test('DELETE /api/benefits/kpi-mappings/:id deletes mapping (no 5xx)', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/benefits/kpi-mappings/${mappingId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'DELETE /api/benefits/kpi-mappings/:id');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/budget/summary returns totals (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/budget/summary`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/budget/summary');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ budget_count: expect.any(Number) }));
    expect(Object.prototype.hasOwnProperty.call(body || {}, 'total_planned')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body || {}, 'total_actual')).toBe(true);
    if (body?.total_planned != null) expect(typeof body.total_planned).toBe('number');
    if (body?.total_actual != null) expect(typeof body.total_actual).toBe('number');
  });

  test('POST /api/budget creates budget (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/budget`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        projectId,
        category: 'e2e_smoke',
        plannedAmount: 100,
        currency: 'USD',
        periodStart: new Date().toISOString().slice(0, 10),
        periodEnd: new Date().toISOString().slice(0, 10),
      },
    });
    await assertNo5xx(res, 'POST /api/budget');
    expect([200, 201]).toContain(res.status());
    const body = await jsonOrText(res);
    budgetId = String(body?.id || '');
    expect(body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    expect(budgetId).toBeTruthy();
  });

  test('GET /api/budget?projectId=... returns array (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/budget?projectId=${projectId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/budget?projectId=...');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(Array.isArray(body)).toBe(true);
  });

  test('PUT /api/budget/:id updates budget (no 5xx)', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/budget/${budgetId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { plannedAmount: 120, actualAmount: 10 },
    });
    await assertNo5xx(res, 'PUT /api/budget/:id');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('DELETE /api/budget/:id deletes budget (no 5xx)', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/budget/${budgetId}`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'DELETE /api/budget/:id');
    expect(res.ok()).toBeTruthy();
    const body = await jsonOrText(res);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });
});
