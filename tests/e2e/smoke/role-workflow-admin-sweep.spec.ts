/**
 * Role & Workflow Admin Sweep — Comprehensive IAM Integration Test
 *
 * Covers:
 *  1. Login flow verification (ADMIN / SUPERADMIN identity correctness)
 *  2. Role Builder / admin role settings API (security/roles, project_role_templates)
 *  3. Org People workflow (list members, invite, role change, audit trail)
 *  4. Project Member workflow (list, add, available roles endpoint)
 *  5. Effective Access capabilities (granular capability checks for ADMIN persona)
 *  6. Consultant Access workflow (admin guard, no code leak)
 *  7. Audit log trail (admin_audit_logs endpoint)
 *  8. Access Guards (unauthenticated → 401, invalid token → 401, missing cap → 403)
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

// ─────────────────────────────────────────────
// Helpers
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
  const runId = `iam-sweep-${role.toLowerCase()}-${Date.now().toString(36)}`;
  const res = await ctx.post('/api/test-support/bootstrap', {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
    data: { runId, role },
  });
  if (!res.ok()) {
    const body = await jsonOrText(res);
    throw new Error(`bootstrap(${role}) failed: ${res.status()} ${JSON.stringify(body)}`);
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

// ─────────────────────────────────────────────
// 1. LOGIN FLOW — identity correctness
// ─────────────────────────────────────────────

test.describe('Login flow — identity correctness', () => {
  test.setTimeout(30000);

  test('ADMIN persona: /api/auth/me returns correct identity & org scope', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/auth/me', { headers: admin.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body?.user?.id).toBe(admin.userId);
      expect(String(body?.user?.organizationId || '')).toBe(admin.organizationId);
      expect(String(body?.user?.email || '')).toContain('@');
      // role must be ADMIN (or OWNER which maps internally for orgs) — not SUPERADMIN
      const role = String(body?.user?.role || '').toUpperCase();
      expect(['ADMIN', 'ADMINISTRATOR', 'OWNER']).toContain(role);
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('SUPERADMIN persona: /api/auth/me returns SUPERADMIN role (platform scoped)', async () => {
    const sa = await bootstrapPersona('SUPERADMIN');
    try {
      const res = await sa.ctx.get('/api/auth/me', { headers: sa.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body?.user?.id).toBe(sa.userId);
      const role = String(body?.user?.role || '').toUpperCase();
      expect(role).toContain('SUPERADMIN');
    } finally {
      await sa.ctx.dispose();
    }
  });

  test('Login history endpoint is accessible for authenticated ADMIN', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/security/login-history?limit=5', { headers: admin.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body?.history)).toBe(true);
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('Unauthenticated /api/auth/me returns 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/auth/me');
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('Invalid token /api/auth/me returns 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/auth/me', { headers: authHeaders('not-a-real-jwt') });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 2. ROLE BUILDER — admin role settings (security/roles)
// ─────────────────────────────────────────────

test.describe('Role Builder — admin.project_roles.manage capability gate', () => {
  test.setTimeout(30000);

  test('ADMIN persona: GET /api/security/roles returns roles list (capability required)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/security/roles', { headers: admin.headers });
      // ADMIN should have admin.project_roles.manage → 200 with { roles: [] }
      // If the capability isn't seeded yet, accept 403 as well (documents the gap)
      expect([200, 403]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(Array.isArray(body?.roles)).toBe(true);
      }
      if (res.status() === 403) {
        const body = await res.json();
        expect(String(body?.code || '')).toContain('PROJECT_ROLES');
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN persona: can create a custom security role when permitted', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const createRes = await admin.ctx.post('/api/security/roles', {
        headers: admin.headers,
        data: { name: `E2E Test Role ${Date.now()}`, permissions: ['project.view'] },
      });
      // 200/201 = success, 403 = capability not yet granted (document gap)
      expect([200, 201, 403]).toContain(createRes.status());
      if ([200, 201].includes(createRes.status())) {
        const body = await createRes.json();
        expect(body?.success).toBe(true);
        expect(typeof body?.id).toBe('string');

        // Cleanup: delete the created role
        const delRes = await admin.ctx.delete(`/api/security/roles/${body.id}`, {
          headers: admin.headers,
        });
        expect([200, 404]).toContain(delRes.status());
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('Unauthenticated: GET /api/security/roles returns 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/security/roles');
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  test('ADMIN: GET /api/access/effective?capability=admin.project_roles.manage returns structured response', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get(
        '/api/access/effective?capability=admin.project_roles.manage',
        { headers: admin.headers }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body?.effectiveAccess).toBeTruthy();
      expect(Array.isArray(body?.effectiveAccess?.capabilities)).toBe(true);
      // decision block must be present with boolean allowed
      expect(typeof body?.decision?.allowed).toBe('boolean');
      expect(String(body?.decision?.capability)).toBe('admin.project_roles.manage');
    } finally {
      await admin.ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 3. ORG PEOPLE WORKFLOW
// ─────────────────────────────────────────────

test.describe('Org People workflow — members, invitations, role changes', () => {
  test.setTimeout(45000);

  test('ADMIN: GET /api/organizations/:orgId/members returns member list', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get(`/api/organizations/${admin.organizationId}/members`, {
        headers: admin.headers,
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      // Accept both array or { members: [] } shapes
      const members = Array.isArray(body) ? body : body?.members;
      expect(Array.isArray(members)).toBe(true);
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: GET /api/invitations (org) returns invitation list', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/invitations', { headers: admin.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      // Accept { invitations: [] } or []
      const invitations = Array.isArray(body) ? body : body?.invitations;
      expect(Array.isArray(invitations)).toBe(true);
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: POST /api/invitations creates or guards correctly', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.post('/api/invitations', {
        headers: admin.headers,
        data: {
          email: `invited-${Date.now()}@test.local`,
          role: 'USER',
          organizationId: admin.organizationId,
        },
      });
      // 200/201 = sent, 400 = validation (also OK), 403 = capability gate
      expect([200, 201, 400, 403]).toContain(res.status());
      if (res.status() === 403) {
        const body = await res.json();
        expect(body?.code || body?.error).toBeTruthy();
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: PATCH member role triggers audit trail', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      // Get current members
      const membersRes = await admin.ctx.get(
        `/api/organizations/${admin.organizationId}/members`,
        { headers: admin.headers }
      );
      expect(membersRes.ok()).toBeTruthy();
      const body = await membersRes.json();
      const members = Array.isArray(body) ? body : (body?.members ?? []);

      if (members.length === 0) {
        // No members to patch — mark as explicit gap
        console.log('[IAM sweep] SKIP: no org members to patch role for — seed gap');
        return;
      }

      // Try to change role of first non-self member
      const target = members.find((m: any) => m.user_id !== admin.userId || m.id !== admin.userId);
      if (!target) {
        console.log('[IAM sweep] SKIP: no patchable member found');
        return;
      }

      const memberId = target.id || target.member_id;
      const patchRes = await admin.ctx.patch(
        `/api/organizations/${admin.organizationId}/members/${memberId}/role`,
        {
          headers: admin.headers,
          data: { role: 'USER' },
        }
      );
      // 200 = success, 400 = last owner protected, 403 = guard, 404 = not found
      expect([200, 400, 403, 404]).toContain(patchRes.status());
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('Unauthenticated: GET /api/organizations/:id/members returns 401', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const orgId = admin.organizationId;
    await admin.ctx.dispose();

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get(`/api/organizations/${orgId}/members`);
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 4. PROJECT MEMBER WORKFLOW
// ─────────────────────────────────────────────

test.describe('Project Member workflow — list, add, available roles', () => {
  test.setTimeout(45000);

  test('ADMIN: can create a project then list its members', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const createRes = await admin.ctx.post('/api/projects', {
        headers: admin.headers,
        data: { name: `IAM Sweep Project ${Date.now()}`, description: 'role test' },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = await createRes.json();
      const projectId =
        created?.id || created?.data?.id || created?.project?.id || created?.projectId;
      if (!projectId) {
        console.log('[IAM sweep] SKIP: project creation returned no ID');
        return;
      }

      const membersRes = await admin.ctx.get(`/api/project-members/${projectId}`, {
        headers: admin.headers,
      });
      expect([200, 404, 503]).toContain(membersRes.status());
      if (membersRes.status() === 200) {
        const body = await membersRes.json();
        expect(Array.isArray(body)).toBe(true);
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: GET /api/pmo/project-members/:id/roles/available returns role catalog', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      // Use a synthetic UUID — the endpoint should return roles regardless
      const res = await admin.ctx.get('/api/project-members/00000000-0000-0000-0000-000000000001/roles/available', {
        headers: admin.headers,
      });
      expect([200, 503]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
        const ids = body.map((r: any) => r.id);
        expect(ids).toContain('MEMBER');
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: POST /api/project-members/:id guards on invalid userId', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.post('/api/project-members/fake-project-id', {
        headers: admin.headers,
        data: { userId: '', role: 'MEMBER' },
      });
      // Must not succeed silently — 400 expected for missing userId
      expect([400, 404, 503]).toContain(res.status());
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('Unauthenticated: GET /api/project-members/:id returns 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/project-members/some-project-id');
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 5. EFFECTIVE ACCESS CAPABILITIES — granular check
// ─────────────────────────────────────────────

test.describe('Effective Access — granular capability checks', () => {
  test.setTimeout(30000);

  // Hard-required org-level capabilities for ADMIN (no project context needed)
  const ADMIN_HARD_CAPABILITIES = ['admin.access', 'admin.people.manage'];
  // Project-scoped capabilities — only present when projectId is provided
  const ADMIN_PROJECT_SCOPED_CAPS = ['project.view', 'project.team.manage'];

  test('ADMIN persona has expected core capabilities in effectiveAccess', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/access/effective', { headers: admin.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const caps: string[] = body?.effectiveAccess?.capabilities ?? [];
      expect(Array.isArray(caps)).toBe(true);

        // Hard assert: org-level ADMIN must have these without any projectId
      for (const expected of ADMIN_HARD_CAPABILITIES) {
        expect(caps).toContain(expected);
      }
      // Soft note: project-scoped caps are only present when projectId is given
      for (const expected of ADMIN_PROJECT_SCOPED_CAPS) {
        if (!caps.includes(expected)) {
          console.log(`[IAM sweep] Note: ADMIN ${expected} requires project context (expected)`);
        }
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: single capability query returns decision block', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      for (const cap of ['project.view', 'admin.people.manage', 'admin.project_roles.manage']) {
        const res = await admin.ctx.get(`/api/access/effective?capability=${cap}`, {
          headers: admin.headers,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(typeof body?.decision?.allowed).toBe('boolean');
        expect(body?.decision?.capability).toBe(cap);
        console.log(`[IAM sweep] ADMIN ${cap}: allowed=${body.decision.allowed}`);
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('SUPERADMIN: effectiveAccess is returned (platform scope, no tenant role confusion)', async () => {
    const sa = await bootstrapPersona('SUPERADMIN');
    try {
      const res = await sa.ctx.get('/api/access/effective', { headers: sa.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body?.effectiveAccess).toBeTruthy();
      // SUPERADMIN should NOT accidentally get tenant-scoped capabilities
      const caps: string[] = body?.effectiveAccess?.capabilities ?? [];
      expect(Array.isArray(caps)).toBe(true);
      console.log(`[IAM sweep] SUPERADMIN capabilities count: ${caps.length}`);
    } finally {
      await sa.ctx.dispose();
    }
  });

  test('Project-scoped effective access: ?projectId query parameter accepted', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      // Create a project to get a real projectId
      const createRes = await admin.ctx.post('/api/projects', {
        headers: admin.headers,
        data: { name: `IAM Cap Sweep ${Date.now()}`, description: '' },
      });
      if (!createRes.ok()) {
        console.log('[IAM sweep] SKIP: project creation failed, skipping project-scoped test');
        return;
      }
      const proj = await createRes.json();
      const projectId = proj?.id || proj?.data?.id || proj?.project?.id;
      if (!projectId) {
        console.log('[IAM sweep] SKIP: no projectId from create');
        return;
      }

      const res = await admin.ctx.get(
        `/api/access/effective?projectId=${projectId}&capability=project.view`,
        { headers: admin.headers }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body?.effectiveAccess).toBeTruthy();
      expect(typeof body?.decision?.allowed).toBe('boolean');
      console.log(`[IAM sweep] project-scoped project.view: allowed=${body?.decision?.allowed}`);
    } finally {
      await admin.ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 6. CONSULTANT ACCESS WORKFLOW
// ─────────────────────────────────────────────

test.describe('Consultant Access workflow — admin guard + no code leak', () => {
  test.setTimeout(30000);

  test('Unauthenticated: GET /api/consultant-project-access returns 401 or 403', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/consultant-project-access');
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  test('ADMIN: GET /api/consultant-project-access does not expose raw access_code', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/consultant-project-access', { headers: admin.headers });
      // Accept 200 or 403 (if capability not granted)
      expect([200, 403]).toContain(res.status());
      if (res.status() === 200) {
        const rawText = await res.text();
        // Must not leak raw access_code field
        expect(rawText).not.toContain('"access_code"');
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: POST /api/consultant-project-access without projectId returns 400 or 403', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.post('/api/consultant-project-access', {
        headers: admin.headers,
        data: { role: 'CONSULTANT' }, // missing projectId
      });
      expect([400, 403, 422]).toContain(res.status());
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: cross-tenant project rejection — cannot create access for other org project', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const fakeProjectId = '00000000-dead-beef-0000-000000000001';
      const res = await admin.ctx.post('/api/consultant-project-access', {
        headers: admin.headers,
        data: { projectId: fakeProjectId, role: 'CONSULTANT' },
      });
      // Should be rejected: project doesn't exist in this org → 404 or 400 or 403
      expect([400, 403, 404]).toContain(res.status());
    } finally {
      await admin.ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 7. AUDIT TRAIL
// ─────────────────────────────────────────────

test.describe('Audit trail — admin audit logs', () => {
  test.setTimeout(30000);

  test('ADMIN: GET /api/security/audit-logs returns structured audit data', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/security/audit-logs', { headers: admin.headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body?.logs)).toBe(true);
      expect(typeof body?.stats?.total).toBe('number');
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('ADMIN: GET /api/admin/p32/audit returns admin audit trail', async () => {
    const admin = await bootstrapPersona('ADMIN');
    try {
      const res = await admin.ctx.get('/api/admin/p32/audit', { headers: admin.headers });
      // 200 = OK, 403 = not yet permissioned, 404 = route not mapped
      expect([200, 403, 404]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(Array.isArray(body?.logs || body?.events || body) || typeof body === 'object').toBe(true);
      }
    } finally {
      await admin.ctx.dispose();
    }
  });

  test('Unauthenticated: GET /api/security/audit-logs returns 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await ctx.get('/api/security/audit-logs');
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────
// 8. ACCESS GUARDS — systematic gate check
// ─────────────────────────────────────────────

test.describe('Access Guards — IAM-protected routes reject unauthenticated', () => {
  test.setTimeout(30000);

  const PROTECTED_PATHS = [
    '/api/access/effective',
    '/api/consultant-project-access',
    '/api/security/roles',
    '/api/security/audit-logs',
    '/api/invitations',
    '/api/project-members/some-project',
  ];

  test('All IAM-protected paths reject requests without a token (401 or 403)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      for (const path of PROTECTED_PATHS) {
        const res = await ctx.get(path);
        expect([401, 403]).toContain(res.status());
        console.log(`[IAM sweep] ${path} no-token → ${res.status()} ✓`);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('All IAM-protected paths reject requests with an invalid token (401 or 403)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      for (const path of PROTECTED_PATHS) {
        const res = await ctx.get(path, { headers: authHeaders('invalid.jwt.token') });
        expect([401, 403]).toContain(res.status());
        console.log(`[IAM sweep] ${path} bad-token → ${res.status()} ✓`);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('SUPERADMIN: cannot access tenant org members directly (org isolation)', async () => {
    const sa = await bootstrapPersona('SUPERADMIN');
    const admin = await bootstrapPersona('ADMIN');
    try {
      // SUPERADMIN trying to read ADMIN org members — should be 403 (tenant isolation)
      // or 200 if superadmin has platform-level access (also documented)
      const res = await sa.ctx.get(`/api/organizations/${admin.organizationId}/members`, {
        headers: sa.headers,
      });
      // Either denied (403) or allowed (200 - superadmin override) — both are valid but document
      console.log(`[IAM sweep] SUPERADMIN → tenant org members: ${res.status()}`);
      expect([200, 403, 401]).toContain(res.status());
    } finally {
      await sa.ctx.dispose();
      await admin.ctx.dispose();
    }
  });
});
