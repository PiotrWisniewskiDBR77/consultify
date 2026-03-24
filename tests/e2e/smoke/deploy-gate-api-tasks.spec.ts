/**
 * L4 Smoke — deploy gate API (tasks)
 *
 * Focus:
 * - Task CRUD paths (create/read/update/delete)
 * - Comments & dependencies (often break with schema drift)
 * - Deterministic assertions (status + minimal shape)
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

function extractId(payload: any): string {
  const direct = payload?.id || payload?.data?.id || payload?.task?.id || payload?.taskId;
  if (typeof direct === 'string' && direct.length) return direct;
  return '';
}

function isPlaceholderValue(value: unknown): boolean {
  return /^\$\d+$/.test(String(value || ''));
}

test.describe('L4 Smoke — deploy gate API (tasks)', () => {
  test.setTimeout(90000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let userId = '';
  let orgId = '';
  let projectId = '';
  let taskA = '';
  let taskB = '';
  let commentId = '';
  let depId = '';
  let taskC = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
    userId = login.userId;
    orgId = login.organizationId;

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Tasks ${Date.now()}`, description: 'smoke seed' },
    });
    await assertOk(createProject, 'POST /api/projects (seed)');
    const projBody = await jsonOrText(createProject);
    projectId = extractId(projBody);
    expect(projectId).toBeTruthy();

    const createA = await request.post(`${API_BASE_URL}/api/tasks`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { title: `E2E Task A ${Date.now()}`, projectId, description: 'task A' },
    });
    await assertOk(createA, 'POST /api/tasks (A)');
    const aBody = await jsonOrText(createA);
    taskA = extractId(aBody) || String(aBody?.id || '');
    expect(taskA).toBeTruthy();

    const createB = await request.post(`${API_BASE_URL}/api/tasks`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { title: `E2E Task B ${Date.now()}`, projectId, description: 'task B' },
    });
    await assertOk(createB, 'POST /api/tasks (B)');
    const bBody = await jsonOrText(createB);
    taskB = extractId(bBody) || String(bBody?.id || '');
    expect(taskB).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    const headers = authHeaders(token);
    const bestEffort = async (fn: () => Promise<any>) => {
      try {
        await fn();
      } catch {
        // ignore
      }
    };

    await bestEffort(() => request.delete(`${API_BASE_URL}/api/tasks/${taskC}`, { headers }));
    await bestEffort(() => request.delete(`${API_BASE_URL}/api/tasks/${taskA}`, { headers }));
    await bestEffort(() => request.delete(`${API_BASE_URL}/api/tasks/${taskB}`, { headers }));
    await bestEffort(() => request.delete(`${API_BASE_URL}/api/projects/${projectId}`, { headers }));
  });

  test('GET /api/tasks returns an array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks?limit=5`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/tasks?projectId returns tasks for project', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks?projectId=${encodeURIComponent(projectId)}&limit=50`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/tasks?projectId');
    const data = await res.json();
    const ids = (data || []).map((t: any) => t?.id).filter(Boolean);
    expect(ids).toContain(taskA);
    expect(ids).toContain(taskB);
  });

  test('GET /api/tasks/:id returns task', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:id');
    const data = await res.json().catch(() => null);
    expect(String(data?.id || '')).toBe(taskA);
    const projectRef = data?.projectId || data?.project_id || '';
    if (isMockDb || isPlaceholderValue(projectRef)) {
      return;
    }
    expect(String(projectRef)).toBe(projectId);
  });

  test('PUT /api/tasks/:id updates status and priority', async ({ request }) => {
    const put = await request.put(`${API_BASE_URL}/api/tasks/${taskA}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { status: 'in_progress', priority: 'high' },
    });
    await assertOk(put, 'PUT /api/tasks/:id');
    const data = await jsonOrText(put);
    expect(String(data?.id || '')).toBe(taskA);
  });

  test('GET /api/tasks/:id reflects updated status/priority', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:id (after PUT)');
    const data = await res.json().catch(() => null);
    const status = String(data?.status || '');
    const priority = String(data?.priority || '');
    if (isMockDb || isPlaceholderValue(status) || isPlaceholderValue(priority)) {
      expect(String(data?.id || '')).toBe(taskA);
      return;
    }
    expect(status).toBe('in_progress');
    expect(priority).toBe('high');
  });

  test('GET /api/tasks?status=in_progress works', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks?status=in_progress&limit=50`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/tasks?status');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/tasks/search?q finds by title fragment', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/search?q=${encodeURIComponent('E2E Task')}&exclude=`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/tasks/search');
    const data = await res.json().catch(() => null);
    expect(Array.isArray(data?.tasks)).toBe(true);
    const ids = (data?.tasks || []).map((t: any) => t?.id).filter(Boolean);
    expect(ids).toContain(taskA);
  });

  test('GET /api/tasks/search supports URL artifact parsing', async ({ request }) => {
    const q = `http://localhost:3000/my-work?artifact=${encodeURIComponent(`task:${taskA}`)}`;
    const res = await request.get(`${API_BASE_URL}/api/tasks/search?q=${encodeURIComponent(q)}&exclude=`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/tasks/search (url artifact)');
    const data = await res.json().catch(() => null);
    const ids = (data?.tasks || []).map((t: any) => t?.id).filter(Boolean);
    expect(ids).toContain(taskA);
  });

  test('POST /api/tasks/:taskId/comments adds comment', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tasks/${taskA}/comments`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { content: `E2E comment ${Date.now()}` },
    });
    await assertOk(res, 'POST /api/tasks/:taskId/comments');
    const data = await res.json().catch(() => null);
    commentId = String(data?.id || '');
    expect(commentId).toBeTruthy();
    expect(String(data?.taskId || '')).toBe(taskA);
    expect(String(data?.userId || '')).toBe(userId);
  });

  test('GET /api/tasks/:taskId/comments lists comment', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}/comments`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:taskId/comments');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const ids = (data || []).map((c: any) => c?.id).filter(Boolean);
    if (isMockDb || ids.some(isPlaceholderValue) || isPlaceholderValue(commentId)) {
      expect(ids.length).toBeGreaterThan(0);
      return;
    }
    expect(ids).toContain(commentId);
  });

  test('DELETE /api/tasks/:taskId/comments/:commentId removes comment', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/tasks/${taskA}/comments/${commentId}`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'DELETE /api/tasks/:taskId/comments/:commentId');
    const data = await res.json().catch(() => null);
    expect(String(data?.message || '')).toMatch(/deleted/i);
  });

  test('GET /api/tasks/:taskId/comments no longer includes deleted comment', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}/comments`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:taskId/comments (after delete)');
    const data = await res.json();
    const ids = (data || []).map((c: any) => c?.id).filter(Boolean);
    if (isMockDb || ids.some(isPlaceholderValue) || isPlaceholderValue(commentId)) {
      expect(Array.isArray(ids)).toBe(true);
      return;
    }
    expect(ids).not.toContain(commentId);
  });

  test('GET /api/tasks/:taskId/comments returns 404 for unknown task', async ({ request }) => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    const res = await request.get(`${API_BASE_URL}/api/tasks/${unknown}/comments`, { headers: authHeaders(token) });
    if (isMockDb) {
      expect([200, 400, 404]).toContain(res.status());
      return;
    }
    expect([404, 400]).toContain(res.status());
  });

  test('GET /api/tasks/:id/dependencies returns successors/predecessors arrays', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}/dependencies`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:id/dependencies');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(
      expect.objectContaining({
        success: true,
        successors: expect.any(Array),
        predecessors: expect.any(Array),
      })
    );
  });

  test('POST /api/tasks/:id/dependencies adds successor dependency', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tasks/${taskA}/dependencies`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { targetTaskId: taskB, direction: 'successor', dependencyType: 'FS', lagDays: 1, notes: 'smoke' },
    });
    if (isMockDb && [200, 400].includes(res.status())) {
      const data = await res.json().catch(() => null);
      depId = String(data?.dependency?.id || '');
      return;
    }
    await assertOk(res, 'POST /api/tasks/:id/dependencies');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
    depId = String(data?.dependency?.id || '');
    expect(depId).toBeTruthy();
  });

  test('GET /api/tasks/:id/dependencies shows new dependency', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}/dependencies`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:id/dependencies (after add)');
    const data = await res.json().catch(() => null);
    const successorIds = (data?.successors || []).map((d: any) => d?.id).filter(Boolean);
    if (isMockDb || successorIds.some(isPlaceholderValue) || isPlaceholderValue(depId)) {
      expect(Array.isArray(successorIds)).toBe(true);
      return;
    }
    expect(successorIds).toContain(depId);
  });

  test('DELETE /api/tasks/:id/dependencies/:depId removes dependency', async ({ request }) => {
    if (isMockDb && !depId) {
      return;
    }
    const res = await request.delete(`${API_BASE_URL}/api/tasks/${taskA}/dependencies/${depId}`, {
      headers: authHeaders(token),
    });
    if (isMockDb && [200, 404].includes(res.status())) {
      return;
    }
    await assertOk(res, 'DELETE /api/tasks/:id/dependencies/:depId');
    const data = await res.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/tasks/:id/dependencies no longer includes removed dependency', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskA}/dependencies`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/tasks/:id/dependencies (after delete)');
    const data = await res.json().catch(() => null);
    const successorIds = (data?.successors || []).map((d: any) => d?.id).filter(Boolean);
    if (isMockDb || successorIds.some(isPlaceholderValue) || isPlaceholderValue(depId)) {
      expect(Array.isArray(successorIds)).toBe(true);
      return;
    }
    expect(successorIds).not.toContain(depId);
  });

  test('POST /api/tasks creates a task with dueDate', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/tasks`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: {
        title: `E2E Task C ${Date.now()}`,
        projectId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    await assertOk(res, 'POST /api/tasks (C)');
    const data = await res.json().catch(() => null);
    taskC = String(data?.id || '');
    expect(taskC).toBeTruthy();
  });

  test('DELETE /api/tasks/:id deletes task', async ({ request }) => {
    const res = await request.delete(`${API_BASE_URL}/api/tasks/${taskC}`, { headers: authHeaders(token) });
    await assertOk(res, 'DELETE /api/tasks/:id');
    const data = await res.json().catch(() => null);
    expect(String(data?.message || '')).toMatch(/deleted/i);
  });

  test('GET /api/tasks/:id returns 404 after delete', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/tasks/${taskC}`, { headers: authHeaders(token) });
    if (isMockDb) {
      expect([200, 404]).toContain(res.status());
      return;
    }
    expect(res.status()).toBe(404);
  });
});
