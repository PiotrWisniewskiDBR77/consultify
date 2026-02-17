/**
 * L2: Security Policies router (honest runtime test)
 *
 * NOTE: This file lives under `tests/integration/` because `tests/e2e/**` is excluded by Vitest.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type PolicyRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  settings_json: string;
  enabled: number;
  last_updated: string;
};

const ORG_ID = 'org-test-1';

const policyKey = (orgId: string, id: string) => `${orgId}:${id}`;

const store = new Map<string, PolicyRow>();

const dbAll = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (!sql.includes('FROM security_policies')) return [];
  const orgId = String(params[0] ?? '');
  return Array.from(store.values()).filter((p) => p.organization_id === orgId);
});

const dbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('WHERE organization_id = ? LIMIT 1')) {
    const orgId = String(params[0] ?? '');
    return Array.from(store.values()).find((p) => p.organization_id === orgId) ? { id: 'x' } : null;
  }

  if (sql.includes('WHERE organization_id = ? AND id = ?')) {
    const orgId = String(params[0] ?? '');
    const id = String(params[1] ?? '');
    return store.get(policyKey(orgId, id)) || null;
  }

  return null;
});

const dbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('INSERT INTO security_policies')) {
    const [id, orgId, name, category, settingsJson, enabled, lastUpdated] = params as any[];
    store.set(policyKey(orgId, id), {
      id,
      organization_id: orgId,
      name,
      category,
      settings_json: settingsJson,
      enabled,
      last_updated: lastUpdated,
    });
  }

  if (sql.includes('UPDATE security_policies')) {
    const [name, category, settingsJson, enabled, lastUpdated, orgId, id] = params as any[];
    const existing = store.get(policyKey(orgId, id));
    if (existing) {
      store.set(policyKey(orgId, id), {
        ...existing,
        name,
        category,
        settings_json: settingsJson,
        enabled,
        last_updated: lastUpdated,
      });
    }
  }

  return { success: true, changes: 1 };
});

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: ORG_ID };
    next();
  },
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

import securityPoliciesRouter from '../../server/src/routes/securityPolicies.routes.js';

describe('securityPolicies.routes', () => {
  let app: express.Express;

  beforeEach(() => {
    store.clear();
    dbAll.mockClear();
    dbGet.mockClear();
    dbRun.mockClear();

    app = express();
    app.use(express.json());
    app.use('/api/security-policies', securityPoliciesRouter);
  });

  it('GET /api/security-policies returns defaults', async () => {
    const res = await request(app).get('/api/security-policies').expect(200);
    expect(Array.isArray(res.body.policies)).toBe(true);
    expect(res.body.policies.map((p: any) => p.id)).toEqual(
      expect.arrayContaining(['password-policy', 'session-timeout', 'mfa-required', 'ip-allowlist'])
    );
  });

  it('PUT /api/security-policies/:id updates an existing policy', async () => {
    await request(app).get('/api/security-policies').expect(200);

    await request(app)
      .put('/api/security-policies/password-policy')
      .send({ enabled: false, settings: { minLength: 8 } })
      .expect(200);

    const updated = store.get(policyKey(ORG_ID, 'password-policy'));
    expect(updated).toBeTruthy();
    expect(updated?.enabled).toBe(0);
    expect(JSON.parse(updated!.settings_json).minLength).toBe(8);
  });

  it('PUT returns 404 for unknown policy', async () => {
    await request(app).get('/api/security-policies').expect(200);
    await request(app)
      .put('/api/security-policies/does-not-exist')
      .send({ enabled: true })
      .expect(404);
  });
});
