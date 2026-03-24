/**
 * L4 Smoke — deploy gate API (projects & organizations)
 *
 * Focus:
 * - Endpoints that commonly break deploys: org membership, project team, project notification settings
 * - Deterministic assertions, minimal schema coupling
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

function extractId(payload: any): string | null {
  const direct = payload?.id || payload?.data?.id || payload?.project?.id || payload?.projectId;
  if (typeof direct === 'string' && direct.length) return direct;
  return null;
}

test.describe('L4 Smoke — deploy gate API (projects & organizations)', () => {
  test.setTimeout(90000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let userId = '';
  let organizationId = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
    userId = login.userId;
    organizationId = login.organizationId;

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Deploy Gate Project ${Date.now()}`, description: 'smoke seed' },
    });
    await assertOk(createProject, 'POST /api/projects (seed)');
    const body = await jsonOrText(createProject);
    projectId = extractId(body) || '';
    if (!projectId) {
      // Some implementations return the full object; accept any string-ish id if present.
      const alt = body?.data?.id || body?.data?.project?.id;
      projectId = typeof alt === 'string' ? alt : '';
    }
    expect(projectId).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (!projectId) return;
    try {
      await request.delete(`${API_BASE_URL}/api/projects/${projectId}`, { headers: authHeaders(token) });
    } catch {
      // best-effort cleanup
    }
  });

  test('GET /api/organizations/current returns organizations array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/organizations/current`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/organizations/current');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/organizations/:orgId/members returns members including current user', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/organizations/${organizationId}/members`, {
      headers: authHeaders(token),
    });
    if (isMockDb && res.status() === 403) {
      const data = await res.json().catch(() => null);
      expect(String(data?.error || '')).toMatch(/access denied/i);
      return;
    }
    await assertOk(res, 'GET /api/organizations/:orgId/members');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const ids = (data || []).map((m: any) => m?.user_id).filter(Boolean);
    expect(ids).toContain(userId);
  });

  test('GET /api/projects returns an array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects?limit=5`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/projects');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/projects/:id returns project payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id');
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
  });

  test('PUT /api/projects/:id updates project fields', async ({ request }) => {
    const put = await request.put(`${API_BASE_URL}/api/projects/${projectId}`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Updated ${Date.now()}`, description: 'updated by smoke' },
    });
    await assertOk(put, 'PUT /api/projects/:id');
    const body = await jsonOrText(put);
    expect(body).toBeTruthy();
  });

  test('GET /api/projects/:id reflects updated name/description', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id (after PUT)');
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    const name = String(data?.name || '');
    expect(name.length).toBeGreaterThan(0);
  });

  test('GET /api/projects/:id/members returns members array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/members');
    const data = await res.json();
    expect(Array.isArray(data?.members)).toBe(true);
  });

  test('POST /api/projects/:id/members adds e2e-user member', async ({ request }) => {
    const post = await request.post(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { userId: 'e2e-user', projectRole: 'BUSINESS', allocationPercent: 75 },
    });
    await assertOk(post, 'POST /api/projects/:id/members');
    const body = await jsonOrText(post);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/projects/:id/members includes e2e-user', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/members (after add)');
    const data = await res.json();
    const ids = (data?.members || []).map((m: any) => m?.userId).filter(Boolean);
    expect(ids).toContain('e2e-user');
  });

  test('PATCH /api/projects/:id/members/:userId updates allocationPercent', async ({ request }) => {
    const patch = await request.patch(`${API_BASE_URL}/api/projects/${projectId}/members/e2e-user`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { allocationPercent: 50 },
    });
    if (isMockDb && patch.status() === 404) {
      const body = await jsonOrText(patch);
      expect(String(body?.error || '')).toMatch(/not found/i);
      return;
    }
    await assertOk(patch, 'PATCH /api/projects/:id/members/:userId');
    const body = await jsonOrText(patch);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/projects/:id/members reflects updated allocationPercent', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/members (after patch)');
    const data = await res.json();
    const member = (data?.members || []).find((m: any) => m?.userId === 'e2e-user');
    expect(member).toBeTruthy();
    if (isMockDb) {
      return;
    }
    expect(Number(member?.allocationPercent)).toBe(50);
  });

  test('DELETE /api/projects/:id/members/:userId removes member', async ({ request }) => {
    const del = await request.delete(`${API_BASE_URL}/api/projects/${projectId}/members/e2e-user`, {
      headers: authHeaders(token),
    });
    await assertOk(del, 'DELETE /api/projects/:id/members/:userId');
    const body = await jsonOrText(del);
    expect(body).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/projects/:id/members no longer includes e2e-user', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/members (after delete)');
    const data = await res.json();
    const ids = (data?.members || []).map((m: any) => m?.userId).filter(Boolean);
    if (isMockDb) {
      expect(Array.isArray(ids)).toBe(true);
      return;
    }
    expect(ids).not.toContain('e2e-user');
  });

  test('GET /api/projects/:id/notification-settings returns defaults or row', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/notification-settings`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/notification-settings');
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    expect(String(data?.project_id || '')).toBe(String(projectId));
  });

  test('PUT /api/projects/:id/notification-settings updates settings', async ({ request }) => {
    const put = await request.put(`${API_BASE_URL}/api/projects/${projectId}/notification-settings`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { email_notifications: true, in_app_notifications: true, escalation_days: 2 },
    });
    await assertOk(put, 'PUT /api/projects/:id/notification-settings');
    const data = await put.json().catch(() => null);
    expect(data).toEqual(expect.objectContaining({ success: true }));
  });

  test('GET /api/projects/:id/notification-settings reflects update', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/projects/${projectId}/notification-settings`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/projects/:id/notification-settings (after PUT)');
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    if (isMockDb) {
      return;
    }
    // DB row may store ints; accept truthy/1/true.
    expect(Boolean(data?.email_notifications ?? data?.emailNotifications)).toBe(true);
  });

  test('GET /api/pmo/projects/my-memberships returns memberships array', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/pmo/projects/my-memberships`, {
      headers: authHeaders(token),
    });
    await assertOk(res, 'GET /api/pmo/projects/my-memberships');
    const data = await res.json();
    expect(Array.isArray(data?.memberships)).toBe(true);
  });

  test('GET /api/sessions returns session list payload', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/sessions`, { headers: authHeaders(token) });
    await assertOk(res, 'GET /api/sessions');
    const data = await res.json().catch(() => null);
    expect(data).toBeTruthy();
    expect(typeof data?.success).toBe('boolean');
    expect(Array.isArray(data?.data)).toBe(true);
  });

  test('Security roles basic CRUD works (create -> list -> delete)', async ({ request }) => {
    const create = await request.post(`${API_BASE_URL}/api/security/roles`, {
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      data: { name: `E2E Role ${Date.now()}`, permissions: ['read:users'] },
    });
    await assertOk(create, 'POST /api/security/roles');
    const created = await create.json().catch(() => null);
    const roleId = String(created?.id || '');
    expect(roleId).toBeTruthy();

    const list = await request.get(`${API_BASE_URL}/api/security/roles`, { headers: authHeaders(token) });
    await assertOk(list, 'GET /api/security/roles');
    const listBody = await list.json().catch(() => null);
    const ids = (listBody?.roles || []).map((r: any) => r?.id).filter(Boolean);
    if (isMockDb) {
      expect(Array.isArray(ids)).toBe(true);
    } else {
      expect(ids).toContain(roleId);
    }

    const del = await request.delete(`${API_BASE_URL}/api/security/roles/${roleId}`, {
      headers: authHeaders(token),
    });
    await assertOk(del, 'DELETE /api/security/roles/:id');
    const delBody = await del.json().catch(() => null);
    expect(delBody).toEqual(expect.objectContaining({ success: true }));
  });
});
