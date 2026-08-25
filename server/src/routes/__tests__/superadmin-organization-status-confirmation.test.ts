import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SuperAdminController from '../../controllers/SuperAdminController.js';
import { conditionalOrganizationConfirmation } from '../superadmin.routes.js';

const dbRunPromise = vi.fn();
const dbGetPromise = vi.fn();
vi.mock('../../utils/DbPromise.js', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    run: (...args: any[]) => dbRunPromise(...args),
    get: (...args: any[]) => dbGetPromise(...args),
  };
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
    // Default: organization is currently active, so any critical-status
    // submission is a genuine transition unless a test says otherwise.
    dbGetPromise.mockResolvedValue({ status: 'active' });
  });

  it('allows a name-only update without confirmation', async () => {
    expect(
      (await request(criticalApp()).put('/organizations/org-1').send({ name: 'New name' })).status
    ).toBe(200);
    expect(dbRunPromise).not.toHaveBeenCalled();
    expect(dbGetPromise).not.toHaveBeenCalled();
  });

  it('returns 428 for suspended without confirmation (active -> suspended transition)', async () => {
    dbGetPromise.mockResolvedValueOnce({ status: 'active' });
    const response = await request(criticalApp())
      .put('/organizations/org-1')
      .send({ status: 'suspended' });
    expect(response.status).toBe(428);
    expect(response.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('allows a plan-only edit of an already-suspended organization without confirmation', async () => {
    // Forms resubmit the org's CURRENT status alongside unrelated field
    // edits. Gating on presence of a critical value alone would 428 every
    // edit of an already-suspended/blocked/cancelled org — the gate must
    // key off an actual TRANSITION (submitted status differs from the
    // status already in the database).
    dbGetPromise.mockResolvedValueOnce({ status: 'suspended' });
    const response = await request(criticalApp())
      .put('/organizations/org-1')
      .send({ status: 'suspended', plan: 'enterprise' });
    expect(response.status).toBe(200);
    expect(dbGetPromise).toHaveBeenCalledWith('SELECT status FROM organizations WHERE id = $1', [
      'org-1',
    ]);
  });

  it('still requires confirmation for an active -> suspended transition even with other fields changing', async () => {
    dbGetPromise.mockResolvedValueOnce({ status: 'active' });
    const response = await request(criticalApp())
      .put('/organizations/org-1')
      .send({ status: 'suspended', plan: 'enterprise' });
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
