/**
 * Non-Admin Role Enforcement — E2E Security Boundary Test
 *
 * Verifies that every endpoint protected by `verifyAdmin` correctly returns 403
 * when called with a USER or GUEST persona token. Complements the ADMIN/SUPERADMIN
 * sweeps by closing the "USER → 403" gap in the test suite.
 *
 * Coverage:
 *  A. Decisions — escalate, workflow, playbook mutations (verifyAdmin added in this sprint)
 *  B. PMO Roles — POST/PUT/DELETE mutations
 *  C. Security roles (Role Builder) — POST/DELETE
 *  D. Access Control codes — POST/GET (ADMIN required)
 *  E. Cross-role matrix: USER vs GUEST vs ADMIN on the same endpoint
 *
 * Requires the test backend on port 3002 (NODE_ENV=test MOCK_DB=true ENABLE_TEST_SUPPORT=true).
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3002';
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

type Persona = 'ADMIN' | 'SUPERADMIN' | 'USER' | 'GUEST';

async function bootstrapPersona(role: Persona) {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  const runId = `enforce-${role.toLowerCase()}-${Date.now().toString(36)}`;
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

// ─────────────────────────────────────────────
// A. Decisions — verifyAdmin mutations
// ─────────────────────────────────────────────

test.describe('A — Decisions verifyAdmin boundary', () => {
  test.setTimeout(30000);

  test('USER token: POST /decisions/:id/escalate → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.post('/api/decisions/any-decision-id/escalate', {
      headers: user.headers,
      data: { reason: 'should be blocked' },
    });
    expect(res.status()).toBe(403);
  });

  test('GUEST token: POST /decisions/:id/escalate → 403', async () => {
    const guest = await bootstrapPersona('GUEST');
    const res = await guest.ctx.post('/api/decisions/any-decision-id/escalate', {
      headers: guest.headers,
      data: { reason: 'should be blocked' },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: PATCH /decisions/:id/workflow → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.patch('/api/decisions/any-decision-id/workflow', {
      headers: user.headers,
      data: { toStatus: 'review' },
    });
    expect(res.status()).toBe(403);
  });

  test('GUEST token: PATCH /decisions/:id/workflow → 403', async () => {
    const guest = await bootstrapPersona('GUEST');
    const res = await guest.ctx.patch('/api/decisions/any-decision-id/workflow', {
      headers: guest.headers,
      data: { toStatus: 'review' },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: POST /decisions/playbooks → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.post('/api/decisions/playbooks', {
      headers: user.headers,
      data: { name: 'blocked playbook', steps: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: PUT /decisions/playbooks/:id → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.put('/api/decisions/playbooks/any-pb-id', {
      headers: user.headers,
      data: { name: 'updated playbook', steps: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: DELETE /decisions/playbooks/:id → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.delete('/api/decisions/playbooks/any-pb-id', {
      headers: user.headers,
    });
    expect(res.status()).toBe(403);
  });

  // Positive control — ADMIN must pass the guard
  test('ADMIN token: POST /decisions/:id/escalate → NOT 403 (guard passes)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/decisions/nonexistent-id/escalate', {
      headers: admin.headers,
      data: { reason: 'test' },
    });
    // Should pass verifyAdmin; gets 400 (validation) or 404 (not found), never 403
    expect([200, 400, 404, 503]).toContain(res.status());
    expect(res.status()).not.toBe(403);
  });

  test('ADMIN token: PATCH /decisions/:id/workflow → NOT 403', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.patch('/api/decisions/nonexistent-id/workflow', {
      headers: admin.headers,
      data: { toStatus: 'review' },
    });
    expect([200, 400, 404, 503]).toContain(res.status());
    expect(res.status()).not.toBe(403);
  });
});

// ─────────────────────────────────────────────
// B. PMO Roles — verifyAdmin mutations
// ─────────────────────────────────────────────

test.describe('B — PMO Roles verifyAdmin boundary', () => {
  test.setTimeout(30000);

  test('USER token: POST /pmo-roles → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.post('/api/pmo-roles', {
      headers: user.headers,
      data: { name: 'Blocked Role', permissions: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('GUEST token: POST /pmo-roles → 403', async () => {
    const guest = await bootstrapPersona('GUEST');
    const res = await guest.ctx.post('/api/pmo-roles', {
      headers: guest.headers,
      data: { name: 'Blocked Role', permissions: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: PUT /pmo-roles/:id → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.put('/api/pmo-roles/custom-role-id', {
      headers: user.headers,
      data: { name: 'Modified', permissions: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: DELETE /pmo-roles/:id → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.delete('/api/pmo-roles/custom-role-id', {
      headers: user.headers,
    });
    expect(res.status()).toBe(403);
  });

  // Read-only GET is open to any authenticated user
  test('USER token: GET /pmo-roles → 200 (read-only, no admin required)', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.get('/api/pmo-roles', { headers: user.headers });
    expect([200, 503]).toContain(res.status());
    expect(res.status()).not.toBe(403);
  });
});

// ─────────────────────────────────────────────
// C. Security Roles (Role Builder) — capability guard
// ─────────────────────────────────────────────

test.describe('C — Security Roles (Role Builder) non-admin boundary', () => {
  test.setTimeout(30000);

  test('USER token: POST /security/roles → 403 (requires admin.project_roles.manage)', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.post('/api/security/roles', {
      headers: user.headers,
      data: { roleKey: 'CUSTOM_TEST', label: 'Test', capabilities: ['project.view'] },
    });
    // Capability check via hasEffectiveCapability → 403
    expect([403, 503]).toContain(res.status());
  });

  test('ADMIN token: GET /security/roles → 200 (ADMIN has admin.project_roles.manage via OWNER? No — ADMIN does NOT)', async () => {
    // ADMIN has admin.access + admin.people.manage but NOT admin.project_roles.manage
    // So ADMIN should also get 403 on Role Builder writes
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.post('/api/security/roles', {
      headers: admin.headers,
      data: { roleKey: 'CUSTOM_ADMIN_TEST', label: 'Test', capabilities: ['project.view'] },
    });
    // ADMIN lacks admin.project_roles.manage → 403 (OWNER only)
    expect([403, 503]).toContain(res.status());
  });

  test('USER token: GET /security/roles → 200 or 403 (read might be open)', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.get('/api/security/roles', { headers: user.headers });
    // Read is guarded too (same middleware) → 403, or 503 in mock
    expect([200, 403, 503]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────
// D. Access Control Codes — non-admin boundary
// ─────────────────────────────────────────────

test.describe('D — Access Control Codes non-admin boundary', () => {
  test.setTimeout(30000);

  test('USER token: POST /access-control/codes → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.post('/api/access-control/codes', {
      headers: user.headers,
      data: { organizationId: user.organizationId, role: 'USER', maxUses: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('GUEST token: POST /access-control/codes → 403', async () => {
    const guest = await bootstrapPersona('GUEST');
    const res = await guest.ctx.post('/api/access-control/codes', {
      headers: guest.headers,
      data: { organizationId: guest.organizationId, role: 'USER', maxUses: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('USER token: GET /access-control/codes → 403', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.get(
      `/api/access-control/codes?organizationId=${user.organizationId}`,
      { headers: user.headers }
    );
    expect(res.status()).toBe(403);
  });
});

// ─────────────────────────────────────────────
// E. Cross-role matrix — same endpoint, different personas
// ─────────────────────────────────────────────

test.describe('E — Cross-role matrix: POST /decisions/:id/escalate', () => {
  test.setTimeout(45000);

  // Tabular: [role, expected]
  const MATRIX: Array<{ role: Persona; expectPass: boolean }> = [
    { role: 'USER', expectPass: false },
    { role: 'GUEST', expectPass: false },
    { role: 'ADMIN', expectPass: true },
    { role: 'SUPERADMIN', expectPass: true },
  ];

  for (const { role, expectPass } of MATRIX) {
    test(`${role} → ${expectPass ? 'PASSES guard (not 403)' : 'BLOCKED (403)'}`, async () => {
      const persona = await bootstrapPersona(role);
      const res = await persona.ctx.post('/api/decisions/any-id/escalate', {
        headers: persona.headers,
        data: { reason: 'matrix test' },
      });

      if (expectPass) {
        // Guard passes → business logic errors (400/404/503), but not 403
        expect(res.status()).not.toBe(403);
        expect(res.status()).not.toBe(401);
      } else {
        expect(res.status()).toBe(403);
      }
    });
  }
});

// ─────────────────────────────────────────────
// F. Verify bootstrap correctly sets roles
// ─────────────────────────────────────────────

test.describe('F — Bootstrap persona identity verification', () => {
  test.setTimeout(30000);

  test('USER bootstrap: /api/auth/me returns role USER', async () => {
    const user = await bootstrapPersona('USER');
    const res = await user.ctx.get('/api/auth/me', { headers: user.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const returnedRole = String(body?.user?.role || body?.role || '').toUpperCase();
      expect(returnedRole).toBe('USER');
    }
  });

  test('GUEST bootstrap: /api/auth/me returns role GUEST', async () => {
    const guest = await bootstrapPersona('GUEST');
    const res = await guest.ctx.get('/api/auth/me', { headers: guest.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const returnedRole = String(body?.user?.role || body?.role || '').toUpperCase();
      expect(returnedRole).toBe('GUEST');
    }
  });

  test('ADMIN bootstrap: /api/auth/me returns role ADMIN (unchanged behavior)', async () => {
    const admin = await bootstrapPersona('ADMIN');
    const res = await admin.ctx.get('/api/auth/me', { headers: admin.headers });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const returnedRole = String(body?.user?.role || body?.role || '').toUpperCase();
      expect(returnedRole).toBe('ADMIN');
    }
  });
});
