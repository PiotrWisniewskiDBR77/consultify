import { describe, expect, it, vi } from 'vitest';

import SuperAdminController from '../../controllers/SuperAdminController.js';

const invokeUpdate = async (beforeStatus: string, audit: ReturnType<typeof vi.fn>) => {
  const db = {
    get: vi.fn((_sql: string, _params: unknown[], callback: Function) =>
      callback(null, { status: beforeStatus })
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
    body: { status: 'active' },
    user: { id: 'super-1' },
    emitAuditEvent: audit,
  };
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const res: any = {
      locals: {},
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
};

describe('Day 15 organization reactivation audit', () => {
  it.each(['suspended', 'blocked', 'cancelled'])(
    'audits %s -> active without requiring confirmation',
    async (beforeStatus) => {
      const audit = vi.fn().mockResolvedValue('audit-reactivate');
      const response = await invokeUpdate(beforeStatus, audit);
      expect(response.status).toBe(200);
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'organization.status_changed',
          before: { status: beforeStatus },
          after: { status: 'active' },
        })
      );
    }
  );

  it.each(['active', 'pending', 'trial'])(
    'does not emit a reactivation audit for %s -> active',
    async (beforeStatus) => {
      const audit = vi.fn();
      await invokeUpdate(beforeStatus, audit);
      expect(audit).not.toHaveBeenCalled();
    }
  );
});
