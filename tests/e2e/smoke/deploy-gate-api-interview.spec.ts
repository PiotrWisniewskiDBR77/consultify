/**
 * L4 Smoke — deploy gate API (interview)
 *
 * Focus:
 * - Session + questions CRUD paths used by /discovery
 * - Permission-gated endpoints must fail with 403 (not 5xx) when user lacks access
 * - Deterministic assertions (status + minimal shape)
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const isMockDb = process.env.MOCK_DB === 'true' || process.env.E2E_MOCK_DB === 'true';

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

function idFrom(payload: any): string {
  const direct = payload?.id || payload?.data?.id || payload?.session?.id;
  return typeof direct === 'string' ? direct : '';
}

test.describe('L4 Smoke — deploy gate API (interview)', () => {
  test.setTimeout(120000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let projectId = '';
  let sessionId = '';
  let firstQuestionId = '';
  let customQuestionId = '';
  let templateId = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Interview ${Date.now()}`, description: 'smoke seed' },
    });
    await assertOk(createProject, 'POST /api/projects (seed)');
    const projBody = await jsonOrText(createProject);
    projectId = idFrom(projBody);
    expect(projectId).toBeTruthy();
  });

  test('GET /api/interview/sessions returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/interview/sessions');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /api/interview/sessions without projectId is rejected or auto-resolved (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/interview/sessions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: 'E2E Interview Session (bad)' },
    });
    const status = res.status();
    expect(status).toBeLessThan(500);
    expect([201, 400, 422]).toContain(status);
    if (status === 201) {
      const data = await res.json().catch(() => null);
      expect(String(data?.id || '')).toBeTruthy();
    }
  });

  test('POST /api/interview/sessions creates a session for project', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/interview/sessions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Discovery ${Date.now()}`, projectId },
    });
    await assertOk(res, 'POST /api/interview/sessions');
    const data = await res.json().catch(() => null);
    sessionId = String(data?.id || '');
    expect(sessionId).toBeTruthy();
    expect(String(data?.projectId || data?.project_id || '')).toBe(projectId);
  });

  test('GET /api/interview/sessions/:id returns session', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions/${sessionId}`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/interview/sessions/:id');
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(sessionId);
  });

  test('PATCH /api/interview/sessions/:id updates name', async ({ request }) => {
    const newName = `E2E Discovery Renamed ${Date.now()}`;
    const res = await request.patch(`${API_BASE_URL}/api/interview/sessions/${sessionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: newName },
    });
    await assertOk(res, 'PATCH /api/interview/sessions/:id');
    const data = await res.json().catch(() => null);
    expect(String(data?.name || '')).toBe(newName);
  });

  test('PATCH /api/interview/sessions/:id invalid status returns 400', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/interview/sessions/${sessionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { status: 'nope' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/interview/sessions?status=in_progress returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions?status=in_progress`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/interview/sessions?status=in_progress');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
    const ids = (data || []).map((s: any) => s?.id).filter(Boolean);
    expect(ids).toContain(sessionId);
  });

  test('GET /api/interview/sessions/:sessionId/questions returns questions array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions/${sessionId}/questions`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/interview/sessions/:sessionId/questions');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
    firstQuestionId = String(data?.[0]?.id || '');
    if (isMockDb && !firstQuestionId) {
      return;
    }
    expect(firstQuestionId).toBeTruthy();
  });

  test('PATCH /api/interview/questions/:questionId without updates returns 400', async ({ request }) => {
    if (!firstQuestionId) {
      return;
    }
    const res = await request.patch(`${API_BASE_URL}/api/interview/questions/${firstQuestionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PATCH /api/interview/questions/:questionId updates answer + status', async ({ request }) => {
    if (!firstQuestionId) {
      return;
    }
    const res = await request.patch(`${API_BASE_URL}/api/interview/questions/${firstQuestionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { answerText: 'smoke answer', status: 'answered', confidenceScore: 4, tags: ['smoke'] },
    });
    await assertOk(res, 'PATCH /api/interview/questions/:questionId');
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(firstQuestionId);
    expect(String(data?.status || '')).toBe('answered');
  });

  test('GET /api/interview/sessions/:sessionId/questions reflects updated status', async ({ request }) => {
    if (!firstQuestionId) {
      return;
    }
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions/${sessionId}/questions`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/interview/sessions/:sessionId/questions (after update)');
    const data = await res.json().catch(() => null);
    const q = (data || []).find((x: any) => String(x?.id || '') === firstQuestionId);
    expect(String(q?.status || '')).toBe('answered');
  });

  test('POST /api/interview/sessions/:sessionId/questions invalid category returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/interview/sessions/${sessionId}/questions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { category: 'nope', questionText: 'bad' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/interview/sessions/:sessionId/questions adds custom question', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/interview/sessions/${sessionId}/questions`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { category: 'strategy', questionText: `Custom Q ${Date.now()}` },
    });
    await assertOk(res, 'POST /api/interview/sessions/:sessionId/questions');
    const data = await res.json().catch(() => null);
    customQuestionId = String(data?.id || '');
    expect(customQuestionId).toBeTruthy();
  });

  test('PATCH /api/interview/questions/:questionId updates custom question status', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/interview/questions/${customQuestionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { status: 'in_progress' },
    });
    if (res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.error || data?.code || '')).toMatch(/forbidden|permission_denied/i);
      return;
    }
    await assertOk(res, 'PATCH /api/interview/questions/:questionId (custom)');
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(customQuestionId);
    expect(String(data?.status || '')).toBe('in_progress');
  });

  test('GET /api/interview/assignments/my returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/assignments/my`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/interview/assignments/my');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/interview/assignments/counts returns counts object', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/assignments/counts`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/interview/assignments/counts');
    const data = await res.json().catch(() => null);
    expect(typeof data).toBe('object');
  });

  test('GET /api/interview/templates is either accessible or 403 (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/templates`, { headers: authHeaders(token) });
    if (res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.code || '')).toBe('PERMISSION_DENIED');
      return;
    }
    await assertOk(res, 'GET /api/interview/templates');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
    templateId = String(data?.[0]?.id || '');
  });

  test('GET /api/interview/templates/:id returns 200 or 403 (no 5xx)', async ({ request }) => {
    const id = templateId || '00000000-0000-0000-0000-000000000000';
    const res = await request.get(`${API_BASE_URL}/api/interview/templates/${id}`, { headers: authHeaders(token) });
    if (res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.code || '')).toBe('PERMISSION_DENIED');
      return;
    }
    expect([200, 404]).toContain(res.status());
  });

  test('PATCH /api/interview/sessions/:id can mark session completed', async ({ request }) => {
    const res = await request.patch(`${API_BASE_URL}/api/interview/sessions/${sessionId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { status: 'completed' },
    });
    await assertOk(res, 'PATCH /api/interview/sessions/:id (completed)');
    const data = await res.json().catch(() => null);
    expect(String(data?.status || '')).toBe('completed');
  });

  test('GET /api/interview/sessions/completed returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/interview/sessions/completed`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/interview/sessions/completed');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data)).toBe(true);
  });
});
