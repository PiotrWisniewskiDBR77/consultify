/**
 * L2: security.routes (honest router tests)
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SecuritySettingsRow = {
  organization_id: string;
  require_2fa: number;
  password_min_length: number;
  password_require_uppercase: number;
  password_require_number: number;
  password_require_special: number;
  password_expiry_days: number;
  session_timeout_minutes: number;
  max_sessions_per_user: number;
  ip_whitelist: string | null;
  updated_at?: string | null;
};

const ORG_ID = 'org-1';

const settingsStore = new Map<string, SecuritySettingsRow>();

const dbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('FROM security_settings WHERE organization_id = ?')) {
    const orgId = String(params[0] ?? '');
    return settingsStore.get(orgId) || null;
  }
  return null;
});

const dbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith('INSERT INTO security_settings')) {
    const orgId = String(params[0] ?? '');
    settingsStore.set(orgId, {
      organization_id: orgId,
      require_2fa: Number(params[1] ?? 0),
      password_min_length: Number(params[2] ?? 8),
      password_require_uppercase: Number(params[3] ?? 0),
      password_require_number: Number(params[4] ?? 0),
      password_require_special: Number(params[5] ?? 0),
      password_expiry_days: Number(params[6] ?? 0),
      session_timeout_minutes: Number(params[7] ?? 30),
      max_sessions_per_user: Number(params[8] ?? 5),
      ip_whitelist: String(params[9] ?? '[]'),
      updated_at: new Date().toISOString(),
    });
  }
  return { success: true, changes: 1 };
});

const dbAll = vi.fn(async () => []);

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: ORG_ID };
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
    dbGet.mockClear();
    dbRun.mockClear();
    dbAll.mockClear();

    app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);
  });

  it('GET /api/security/settings seeds defaults when missing', async () => {
    const res = await request(app).get('/api/security/settings').expect(200);
    expect(res.body.organizationId).toBe(ORG_ID);
    expect(res.body.passwordMinLength).toBe(8);
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
