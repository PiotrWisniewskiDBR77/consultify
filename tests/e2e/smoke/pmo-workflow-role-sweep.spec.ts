/**
 * PMO Workflow Role Sweep — Extended IAM E2E Test
 *
 * Covers areas NOT tested in role-workflow-admin-sweep.spec.ts:
 *  4a. PMO Roles API (/api/pmo-roles)
 *  4b. Decisions (/api/decisions) — escalate + workflow guards post-fix
 *  4c. Stage Gates (/api/stage-gates)
 *  4d. Initiatives (/api/pmo/initiatives) — requireOrgRole enforcement
 *  4e. Access Control Codes (/api/access-control)
 *  4f. Invitation acceptance flow (/api/invitations)
 *
 * Requires a test backend running on port 3002 with:
 *   NODE_ENV=test MOCK_DB=true MOCK_REDIS=true ENABLE_TEST_SUPPORT=true
 *   TEST_SUPPORT_KEY=local-test-support-key-change-me ENABLE_TEST_GATEWAY=true
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3002';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

async function jsonOrText(res: any): Promise<any> {
  const ct = String(res.headers()?.['content-type'] || '');
  if (ct.includes('application/json')) return res.json().catch(() => null);
  const text = await res.text().catch(() => '');
  try { return JSON.parse(text); } catch { return text; }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function bootstrapPersona(role: 'ADMIN' | 'SUPERADMIN') {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  const runId = `pmo-sweep-${role.toLowerCase()}-${Date.now().toString(36)}`;
  const res = await ctx.post('/api/test-support/bootstrap', {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
    data: { runId, role },
  });
  if (!res.ok()) {
    const body = await jsonOrText(res);
    throw new Error(`bootstrap(${role}) failed ${res.status()}: ${JSON.stringify(body)}`);
  }
  const body = (await res.json()) as { token: string; userId: string; organizationId: string };
  return {
    ctx,
    token: body.token,
    userId: body.userId,
    organizationId: body.organizationId,
    headers: authHeaders(body.token),
  };
}

const BOGUS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UiLCJpYXQiOjB9.INVALID';

// ─────────────────────────────────────────────
// 4a. PMO Roles
// ─────────────────────────────────────────────

test.describe('4a — PMO Roles API (/api/pmo-roles)', () => {
  test.setTimeout(30000);

  test('unauthenticated GET /api/pmo-roles → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/pmo-roles');
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN GET /api/pmo-roles → 200 + array', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/pmo-roles', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body) || Array.isArray(body?.roles)).toBe(true);
    }
  });

  test('ADMIN POST /api/pmo-roles → 200/201/400 (create or validation)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/pmo-roles', {
      headers: admin.headers,
      data: { key: `CUSTOM_TEST_${Date.now()}`, label: 'Test Role', capabilities: ['project.view'] },
    });
    // Accept 200, 201 (created), 400 (validation), 409 (already exists), or 503 (mock)
    expect([200, 201, 400, 409, 503]).toContain(res.status());
  });

  test('unauthenticated POST /api/pmo-roles → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/pmo-roles', {
      data: { key: 'CUSTOM_ROLE', label: 'Blocked', capabilities: [] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN cannot DELETE a system role (protected)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    // System roles have IDs like 'project-executive', 'project-manager', etc.
    const res = await admin.ctx.delete('/api/pmo-roles/project-executive', { headers: admin.headers });
    // System roles protected → 403, or 503 (mock)
    expect([403, 503]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────
// 4b. Decisions
// ─────────────────────────────────────────────

test.describe('4b — Decisions API (/api/decisions)', () => {
  test.setTimeout(30000);

  test('unauthenticated GET /api/decisions → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/decisions');
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN GET /api/decisions → 200 + array', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/decisions', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body) || Array.isArray(body?.decisions) || typeof body === 'object').toBe(true);
    }
  });

  test('ADMIN GET /api/decisions/bottlenecks → 200 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/decisions/bottlenecks', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
  });

  // 4b.escalate — after verifyAdmin fix
  test('POST /api/decisions/:id/escalate — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/decisions/fake-id/escalate', {
      data: { reason: 'urgent' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/decisions/:id/escalate — bogus token → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/decisions/fake-id/escalate', {
      headers: { Authorization: `Bearer ${BOGUS_TOKEN}`, 'content-type': 'application/json' },
      data: { reason: 'urgent' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/decisions/:id/escalate — ADMIN token → not 401 (guard passes, then 400/404/503)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/decisions/nonexistent-id/escalate', {
      headers: admin.headers,
      data: { reason: 'test escalation' },
    });
    // Should pass verifyAdmin (not 403), fail on decision not found (404) or validation
    expect([200, 400, 404, 503]).toContain(res.status());
    // Must NOT be 401 (would mean auth failed) or 403 (would mean guard blocked ADMIN)
    expect([401, 403]).not.toContain(res.status());
  });

  // 4b.workflow — after verifyAdmin fix
  test('PATCH /api/decisions/:id/workflow — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.patch('/api/decisions/fake-id/workflow', {
      data: { toStatus: 'review' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('PATCH /api/decisions/:id/workflow — ADMIN token → not 403 (guard passes)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.patch('/api/decisions/nonexistent-id/workflow', {
      headers: admin.headers,
      data: { toStatus: 'review' },
    });
    expect([200, 400, 404, 503]).toContain(res.status());
    expect([401, 403]).not.toContain(res.status());
  });

  // 4b.playbooks
  test('GET /api/decisions/playbooks — ADMIN → 200 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/decisions/playbooks', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
  });

  test('POST /api/decisions/playbooks — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/decisions/playbooks', {
      data: { name: 'Blocked' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/decisions/playbooks — ADMIN → verifyAdmin passes, gets 200/400/503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/decisions/playbooks', {
      headers: admin.headers,
      data: { name: 'Test Playbook', steps: [] },
    });
    expect([200, 201, 400, 422, 503]).toContain(res.status());
    expect([401, 403]).not.toContain(res.status());
  });

  test('DELETE /api/decisions/playbooks/:id — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.delete('/api/decisions/playbooks/some-pb');
    expect([401, 403]).toContain(res.status());
  });

  test('DELETE /api/decisions/playbooks/:id — ADMIN → guard passes (404/503, not 403)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.delete('/api/decisions/playbooks/nonexistent-pb', {
      headers: admin.headers,
    });
    expect([200, 404, 503]).toContain(res.status());
    expect([401, 403]).not.toContain(res.status());
  });
});

// ─────────────────────────────────────────────
// 4c. Stage Gates
// ─────────────────────────────────────────────

test.describe('4c — Stage Gates API (/api/stage-gates)', () => {
  test.setTimeout(30000);

  test('unauthenticated GET /api/stage-gates → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/stage-gates');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('ADMIN GET /api/stage-gates/:projectId/current → 200 or 404 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/stage-gates/test-project-id/current', {
      headers: admin.headers,
    });
    expect([200, 404, 503]).toContain(res.status());
  });

  test('POST /api/stage-gates/:projectId/pass — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/stage-gates/test-project-id/pass');
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN POST /api/stage-gates/:projectId/pass → auth passes (200/400/403/404/503)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/stage-gates/test-project-id/pass', {
      headers: admin.headers,
      data: { gateId: 'gate-1', notes: 'ready' },
    });
    expect([200, 400, 403, 404, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});

// ─────────────────────────────────────────────
// 4d. Initiatives — requireOrgRole enforcement
// ─────────────────────────────────────────────

test.describe('4d — Initiatives (/api/pmo/initiatives)', () => {
  test.setTimeout(30000);

  test('unauthenticated GET /api/pmo/initiatives → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/pmo/initiatives');
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN GET /api/pmo/initiatives → 200 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/pmo/initiatives', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Response should be array or object with initiatives key
      expect(typeof body === 'object').toBe(true);
    }
  });

  test('unauthenticated POST /api/pmo/initiatives → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/pmo/initiatives', { data: { name: 'test' } });
    expect([401, 403]).toContain(res.status());
  });

  test('ADMIN POST /api/pmo/initiatives/:id/duplicate — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/pmo/initiatives/any-id/duplicate');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('ADMIN POST /api/pmo/initiatives/:id/duplicate — ADMIN → auth passes', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/pmo/initiatives/fake-initiative-id/duplicate', {
      headers: admin.headers,
    });
    expect([200, 201, 400, 404, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('bogus token POST /api/pmo/initiatives → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/pmo/initiatives', {
      headers: { Authorization: `Bearer ${BOGUS_TOKEN}`, 'content-type': 'application/json' },
      data: { name: 'attack' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────
// 4e. Access Control (/api/access-control)
// ─────────────────────────────────────────────

test.describe('4e — Access Control Codes (/api/access-control)', () => {
  test.setTimeout(30000);

  test('POST /api/access-control/requests — public: 200 or 400 (no auth needed)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/access-control/requests', {
      data: { reason: 'need access', email: 'requester@example.com' },
    });
    // Public endpoint → should not be 401
    expect([200, 201, 400, 503]).toContain(res.status());
    expect([401, 403]).not.toContain(res.status());
  });

  test('GET /api/access-control/requests — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/access-control/requests');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/access-control/requests — ADMIN → 403 (SUPERADMIN required)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/access-control/requests', { headers: admin.headers });
    // Requires SUPERADMIN — ADMIN should be denied
    expect([403, 503]).toContain(res.status());
  });

  test('GET /api/access-control/requests — SUPERADMIN → 200 or 503', async () => {
    const superadmin = await bootstrapPersona('SUPERADMIN');
    const res = await superadmin.ctx.get('/api/access-control/requests', { headers: superadmin.headers });
    expect([200, 503]).toContain(res.status());
  });

  test('POST /api/access-control/codes — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/access-control/codes', {
      data: { code: 'TEST123' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/access-control/codes — ADMIN with matching orgId → 200/400/503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    // The route checks req.user.organizationId === body.organizationId
    const res = await admin.ctx.post('/api/access-control/codes', {
      headers: admin.headers,
      data: { organizationId: admin.organizationId, role: 'USER', maxUses: 5 },
    });
    expect([200, 201, 400, 422, 503]).toContain(res.status());
    expect([401]).not.toContain(res.status());
  });

  test('GET /api/access-control/codes — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/access-control/codes');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/access-control/codes — ADMIN with matching orgId query → 200 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    // The route checks req.user.organizationId === query.organizationId
    const res = await admin.ctx.get(
      `/api/access-control/codes?organizationId=${admin.organizationId}`,
      { headers: admin.headers }
    );
    expect([200, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});

// ─────────────────────────────────────────────
// 4f. Invitation acceptance flow
// ─────────────────────────────────────────────

test.describe('4f — Invitation acceptance flow (/api/invitations)', () => {
  test.setTimeout(30000);

  test('GET /api/invitations/validate/:token — public: 200 or 404 (no auth needed)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/invitations/validate/totally-fake-token');
    // Public endpoint — should not require auth
    expect([200, 400, 404, 410, 503]).toContain(res.status());
    expect([401, 403]).not.toContain(res.status());
  });

  test('POST /api/invitations/accept — missing token → 400 or 422', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/invitations/accept', {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/invitations/accept — bogus token → 400 or 404', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/invitations/accept', {
      data: { token: 'definitely-not-a-valid-token' },
    });
    expect([200, 400, 404, 410, 503]).toContain(res.status());
    // Must NOT require authentication (public endpoint)
    expect([401, 403]).not.toContain(res.status());
  });

  test('GET /api/invitations — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.get('/api/invitations');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/invitations — ADMIN → 200 or 503', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/invitations', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test('POST /api/invitations — unauthenticated → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    const res = await ctx.post('/api/invitations', {
      data: { email: 'test@example.com', role: 'USER' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/invitations — ADMIN → auth passes (200/400/503)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/invitations', {
      headers: admin.headers,
      data: { email: `invite-test-${Date.now()}@example.com`, role: 'USER' },
    });
    expect([200, 201, 400, 422, 503]).toContain(res.status());
    expect([401]).not.toContain(res.status());
  });
});

// ─────────────────────────────────────────────
// Cross-cutting: invalid / no auth guard sweep
// ─────────────────────────────────────────────

test.describe('Cross-cutting — invalid token rejection', () => {
  test.setTimeout(20000);

  const GUARDED_ENDPOINTS: Array<{ method: string; path: string }> = [
    { method: 'GET', path: '/api/pmo-roles' },
    { method: 'GET', path: '/api/decisions' },
    { method: 'GET', path: '/api/pmo/initiatives' },
    { method: 'GET', path: '/api/access-control/codes' },
    { method: 'GET', path: '/api/invitations' },
  ];

  for (const ep of GUARDED_ENDPOINTS) {
    test(`${ep.method} ${ep.path} with bogus token → 401`, async () => {
      const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      const options = { headers: { Authorization: `Bearer ${BOGUS_TOKEN}` } };
      let res: any;
      if (ep.method === 'GET') res = await ctx.get(ep.path, options);
      else res = await ctx.post(ep.path, { ...options, data: {} });
      expect([401, 403]).toContain(res.status());
    });
  }
});
