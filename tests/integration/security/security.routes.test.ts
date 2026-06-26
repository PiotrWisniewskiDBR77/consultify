/**
 * L2: security.routes (honest router tests)
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-1';

// Current route persists security settings as a JSON blob in organization_settings
// (setting_key='security') and MFA on the organizations row; access is gated by
// requireOrgAdmin → organization_members.role.
const settingsStore = new Map<string, string>(); // orgId → setting_value JSON
const mfaStore = new Map<string, number>(); // orgId → mfa_required

const dbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/FROM organization_members/i.test(sql)) {
    return { role: 'ADMIN' }; // requesting user is an org admin
  }
  if (/FROM organizations\b/i.test(sql)) {
    const orgId = String(params[0] ?? '');
    return { mfa_required: mfaStore.get(orgId) ?? 0, mfa_grace_period_days: 0 };
  }
  if (/FROM organization_settings/i.test(sql)) {
    const orgId = String(params[0] ?? '');
    const value = settingsStore.get(orgId);
    return value ? { setting_value: value, updated_at: new Date().toISOString() } : null;
  }
  return null;
});

const dbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/UPDATE organizations SET mfa_required/i.test(sql)) {
    mfaStore.set(String(params[1] ?? ''), Number(params[0] ?? 0));
  }
  if (/INTO organization_settings/i.test(sql)) {
    // params: [orgId, settingValueJson]
    settingsStore.set(String(params[0] ?? ''), String(params[1] ?? '{}'));
  }
  return { success: true, changes: 1 };
});

const dbAll = vi.fn(async () => []);

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: ORG_ID, role: 'ADMIN' };
    next();
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
  all: (...args: any[]) => dbAll(...args),
}));

vi.mock('../../../server/src/routes/security/roles.routes.js', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

import securityRouter from '../../../server/src/routes/security.routes.js';

describe('security.routes', () => {
  let app: express.Express;

  beforeEach(() => {
    settingsStore.clear();
    mfaStore.clear();
    dbGet.mockClear();
    dbRun.mockClear();
    dbAll.mockClear();

    app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);
  });

  it('GET /api/security/settings returns defaults when none stored', async () => {
    const res = await request(app).get('/api/security/settings').expect(200);
    expect(res.body.organizationId).toBe(ORG_ID);
    expect(res.body.passwordMinLength).toBe(12); // route default
    expect(Array.isArray(res.body.ipWhitelist)).toBe(true);
  });

  it('PUT /api/security/settings upserts new values', async () => {
    await request(app)
      .put('/api/security/settings')
      .send({
        require2fa: true,
        passwordMinLength: 14,
        ipWhitelist: ['10.0.0.0/24'],
      })
      .expect(200);

    const res = await request(app).get('/api/security/settings').expect(200);
    expect(res.body.require2fa).toBe(true);
    expect(res.body.passwordMinLength).toBe(14);
    expect(res.body.ipWhitelist).toEqual(['10.0.0.0/24']);
  });
});
