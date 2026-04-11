import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual('../../../server/src/middleware/auth.middleware.js')) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      const organizationId = String(req.headers['x-test-org'] || 'org-1');
      const role = String(req.headers['x-test-role'] || 'owner');
      const isSuperAdmin = req.headers['x-test-superadmin'] === 'true';
      req.user = { id: 'user-1', organizationId, role, isSuperAdmin };
      req.userId = 'user-1';
      req.userRole = role;
      req.organizationId = organizationId;
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

const { default: brandingRouter } = await import('../../../server/src/routes/organization/branding.routes.ts');

describe('branding.routes auth boundaries', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/branding', brandingRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ changes: 1, success: true });
    dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('organization_members')) {
        return { role: 'OWNER' };
      }
      if (sql.includes('SELECT id FROM organization_branding')) {
        return { id: 'branding-1' };
      }
      if (sql.includes('SELECT * FROM organization_branding WHERE organization_id')) {
        return {
          id: 'branding-1',
          organization_id: 'org-1',
          primary_color: '#111111',
          secondary_color: '#222222',
          accent_color: '#333333',
          background_color: '#ffffff',
          text_color: '#000000',
          dark_primary_color: '#444444',
          dark_secondary_color: '#555555',
          dark_background_color: '#111111',
          dark_text_color: '#f8fafc',
          font_family: 'Inter',
          heading_font_family: 'Inter',
          custom_domain_verified: 0,
          hide_powered_by: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        };
      }
      return null;
    });
  });

  it('blocks tenant admins from updating another organization branding', async () => {
    const res = await request(makeApp())
      .patch('/api/branding/org-2')
      .set('x-test-org', 'org-1')
      .set('x-test-role', 'owner')
      .send({ primaryColor: '#abcdef' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('allows same-org admins to update branding', async () => {
    const res = await request(makeApp())
      .patch('/api/branding/org-1')
      .set('x-test-org', 'org-1')
      .set('x-test-role', 'admin')
      .send({ primaryColor: '#abcdef' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(dbGet).toHaveBeenCalledWith(
      expect.stringContaining('organization_members'),
      ['org-1', 'user-1'],
      { fallback: true }
    );
  });

  it('allows platform superadmins to update another organization branding', async () => {
    const res = await request(makeApp())
      .patch('/api/branding/org-2')
      .set('x-test-org', 'org-1')
      .set('x-test-role', 'superadmin')
      .set('x-test-superadmin', 'true')
      .send({ primaryColor: '#fedcba' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
