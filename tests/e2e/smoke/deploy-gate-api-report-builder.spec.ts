/**
 * L4 Smoke — deploy gate API (report builder + public report)
 *
 * Focus:
 * - Reports Builder module must not 5xx on public deploy
 * - Cover template + block-type library endpoints + safe negative cases for report CRUD
 * - Public report endpoints must return 404 (not 5xx) for invalid tokens
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

test.describe('L4 Smoke — deploy gate API (report builder + public report)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let templateId = '';
  let blockTypeId = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
  });

  test('GET /api/report-builder/profiles returns profiles array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/profiles`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/profiles');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.profiles)).toBe(true);
  });

  test('GET /api/report-builder/profiles/:profileId returns profile', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/profiles/assessment_full`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/profiles/:profileId');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.profile?.id || '')).toBe('assessment_full');
  });

  test('GET /api/report-builder/profiles/for-source/ASSESSMENT returns profiles', async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE_URL}/api/report-builder/profiles/for-source/ASSESSMENT`,
      { headers: authHeaders(token) }
    );
    await assertNo5xx(res, 'GET /api/report-builder/profiles/for-source/ASSESSMENT');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.profiles)).toBe(true);
  });

  test('GET /api/report-builder/templates returns templates array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/templates`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/templates');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.templates)).toBe(true);
  });

  test('POST /api/report-builder/templates without sections returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder/templates`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: 'E2E tpl', sourceType: 'ASSESSMENT' },
    });
    await assertNo5xx(res, 'POST /api/report-builder/templates (missing sections)');
    expect(res.status()).toBe(400);
  });

  test('POST /api/report-builder/templates creates org template', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder/templates`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        name: `E2E Template ${Date.now()}`,
        description: 'E2E',
        sourceType: 'ASSESSMENT',
        reportType: 'ASSESSMENT_DRD',
        sections: [
          { key: 'executive_summary', type: 'summary', title: 'Exec', required: true, order: 0 },
        ],
        defaultOptions: { length: 'short', language: 'business' },
        isPublic: false,
      },
    });
    await assertNo5xx(res, 'POST /api/report-builder/templates');
    expect(res.status()).toBe(201);
    const data = await res.json().catch(() => null);
    templateId = String(data?.template?.id || '');
    expect(templateId.length).toBeGreaterThan(8);
  });

  test('GET /api/report-builder/templates/:templateId/details returns parsed sections', async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE_URL}/api/report-builder/templates/${templateId}/details`,
      { headers: authHeaders(token) }
    );
    await assertNo5xx(res, 'GET /api/report-builder/templates/:id/details');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.template?.id || '')).toBe(templateId);
    expect(Array.isArray(data?.template?.sections)).toBe(true);
  });

  test('GET /api/report-builder/templates/:templateId/export returns JSON', async ({ request }) => {
    const res = await request.get(
      `${API_BASE_URL}/api/report-builder/templates/${templateId}/export`,
      { headers: authHeaders(token) }
    );
    await assertNo5xx(res, 'GET /api/report-builder/templates/:id/export');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(String(data?.name || '')).toContain('E2E');
    expect(Array.isArray(data?.sections)).toBe(true);
  });

  test('PUT /api/report-builder/templates/:templateId updates template', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/report-builder/templates/${templateId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Template Renamed ${Date.now()}` },
    });
    await assertNo5xx(res, 'PUT /api/report-builder/templates/:id');
    expect([200, 404]).toContain(res.status());
  });

  test('DELETE /api/report-builder/templates/:templateId deletes template', async ({ request }) => {
    const res = await request.delete(
      `${API_BASE_URL}/api/report-builder/templates/${templateId}`,
      { headers: authHeaders(token) }
    );
    await assertNo5xx(res, 'DELETE /api/report-builder/templates/:id');
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/report-builder/block-types returns blocks array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/block-types`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/block-types');
    expect(res.status()).toBe(200);
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.blocks)).toBe(true);
  });

  test('POST /api/report-builder/block-types missing name returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder/block-types`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { renderKind: 'markdown' },
    });
    await assertNo5xx(res, 'POST /api/report-builder/block-types (missing name)');
    expect(res.status()).toBe(400);
  });

  test('POST /api/report-builder/block-types creates block type', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder/block-types`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        name: `E2E Block ${Date.now()}`,
        description: 'E2E',
        sourceTypes: ['ASSESSMENT'],
        renderKind: 'markdown',
        promptTemplate: 'Write summary',
      },
    });
    await assertNo5xx(res, 'POST /api/report-builder/block-types');
    expect(res.status()).toBe(201);
    const data = await res.json().catch(() => null);
    blockTypeId = String(data?.block?.id || '');
    expect(blockTypeId.length).toBeGreaterThan(8);
  });

  test('PUT /api/report-builder/block-types/:id updates block type', async ({ request }) => {
    const res = await request.put(`${API_BASE_URL}/api/report-builder/block-types/${blockTypeId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { description: 'Updated' },
    });
    await assertNo5xx(res, 'PUT /api/report-builder/block-types/:id');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('DELETE /api/report-builder/block-types/:id deactivates block type', async ({ request }) => {
    const res = await request.delete(
      `${API_BASE_URL}/api/report-builder/block-types/${blockTypeId}`,
      { headers: authHeaders(token) }
    );
    await assertNo5xx(res, 'DELETE /api/report-builder/block-types/:id');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('POST /api/report-builder missing fields returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { title: 'E2E' },
    });
    await assertNo5xx(res, 'POST /api/report-builder (missing fields)');
    expect(res.status()).toBe(400);
  });

  test('POST /api/report-builder with invalid assessment source returns 400 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/report-builder`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        sourceType: 'ASSESSMENT',
        sourceId: 'assessment-does-not-exist',
        title: 'E2E Report',
      },
    });
    await assertNo5xx(res, 'POST /api/report-builder (invalid source)');
    expect([400, 404]).toContain(res.status());
  });

  test('GET /api/report-builder/does-not-exist returns 404 (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/does-not-exist`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/:id (missing)');
    expect(res.status()).toBe(404);
  });

  test('GET /api/public/report/:token invalid token returns 404 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/public/report/not-a-token`);
    await assertNo5xx(res, 'GET /api/public/report/:token (invalid)');
    expect(res.status()).toBe(404);
  });

  test('GET /api/public/report/:token/pdf invalid token returns 404 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/public/report/not-a-token/pdf`);
    await assertNo5xx(res, 'GET /api/public/report/:token/pdf (invalid)');
    expect(res.status()).toBe(404);
  });
});
