import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SuperAdminController from '../../controllers/SuperAdminController.js';
import { conditionalOrganizationConfirmation } from '../superadmin.routes.js';

const dbRunPromise = vi.fn();
vi.mock('../../utils/DbPromise.js', async (importOriginal) => {
  const original = await importOriginal<any>();
  return { ...original, run: (...args: any[]) => dbRunPromise(...args) };
});

const criticalApp = () => {
  const app = express();
  app.use(express.json());
  app.put(
    '/organizations/:id',
    (req: any, _res, next) => {
      req.user = { id: 'super-1', organizationId: 'platform', role: 'SUPERADMIN' };
      next();
    },
    conditionalOrganizationConfirmation,
    (_req, res) => res.json({ ok: true })
  );
  return app;
};

describe('TRI-MUST-12 organization status confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRunPromise.mockResolvedValue({ changes: 1 });
  });

  it('allows a name-only update without confirmation', async () => {
    expect(
      (await request(criticalApp()).put('/organizations/org-1').send({ name: 'New name' })).status
    ).toBe(200);
    expect(dbRunPromise).not.toHaveBeenCalled();
  });

  it('returns 428 for suspended without confirmation', async () => {
    const response = await request(criticalApp())
      .put('/organizations/org-1')
      .send({ status: 'suspended' });
    expect(response.status).toBe(428);
    expect(response.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('updates confirmed suspended status and emits before/after audit', async () => {
    const audit = vi.fn().mockResolvedValue('audit-1');
    const db = {
      get: vi.fn((_sql: string, _params: unknown[], callback: Function) =>
        callback(null, { status: 'active' })
      ),
      run: vi.fn((_sql: string, _params: unknown[], callback: Function) =>
        callback.call({ changes: 1 }, null)
      ),
    };
    SuperAdminController.setDependencies({
      db: db as any,
      ActivityService: { log: vi.fn() } as any,
    });
    const req: any = {
      params: { id: 'org-1' },
      body: { status: 'suspended' },
      user: { id: 'super-1' },
      emitAuditEvent: audit,
    };
    const completed = new Promise<{ status: number; body: any }>((resolve, reject) => {
      const res: any = {
        locals: { organizationStatusChangeReason: 'Security incident' },
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(body: any) {
          resolve({ status: this.statusCode, body });
          return this;
        },
      };
      void SuperAdminController.updateOrganization(req, res, reject);
    });
    expect(await completed).toEqual({ status: 200, body: { message: 'Organization updated' } });
    expect(audit).toHaveBeenCalledWith({
      action: 'organization.status_changed',
      resourceType: 'organization',
      resourceId: 'org-1',
      before: { status: 'active' },
      after: { status: 'suspended' },
      metadata: { reason: 'Security incident', via: 'superadmin.update_organization' },
    });
  });
});
