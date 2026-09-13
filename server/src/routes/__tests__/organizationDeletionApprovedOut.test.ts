/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ authenticated: true }));
const calls = vi.hoisted(() => ({
  acquirePgClient: vi.fn(),
  deleteOrganizationDataInTransaction: vi.fn(),
  emitAuditEvent: vi.fn(),
  requireNoLegalHold: vi.fn(),
  deleteConfirmation: vi.fn(),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!state.authenticated) return res.status(401).json({ code: 'UNAUTHORIZED' });
    req.user = { id: 'superadmin-1', organizationId: 'platform-org', role: 'SUPERADMIN' };
    next();
  },
}));
vi.mock('../../middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/superadminAuditMonitor.middleware.js', () => ({
  superadminAuditMonitor: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/confirmAction.middleware.js', () => ({
  requireConfirmation: (action: string) => (req: any, _res: any, next: () => void) => {
    if (action === 'delete_organization') calls.deleteConfirmation(req.body);
    next();
  },
}));
vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = calls.emitAuditEvent;
    next();
  },
}));
vi.mock('../../services/OrgPoliciesService.js', () => ({
  OrgPoliciesError: class OrgPoliciesError extends Error {},
  getAllOrgPolicies: vi.fn(),
  getOrgPolicy: vi.fn(),
  requireNoLegalHold: calls.requireNoLegalHold,
  upsertOrgPolicy: vi.fn(),
}));
vi.mock('../../services/organizationLifecycleService.js', () => ({
  RESERVED_ORGANIZATION_IDS: ['*', '__system__', '__global__', ''],
  deleteOrganizationDataInTransaction: calls.deleteOrganizationDataInTransaction,
  exportOrganizationData: vi.fn(),
  organizationExportToCsv: vi.fn(),
}));
vi.mock('../../database/PostgresDatabase.js', () => ({
  acquirePgClient: calls.acquirePgClient,
}));

async function app() {
  const { default: router } = await import('../superadmin.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/superadmin', router);
  return instance;
}

describe('SET-MVP-DELETE-001 mounted superadmin deletion boundary', () => {
  beforeEach(() => {
    state.authenticated = true;
    vi.clearAllMocks();
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith('SELECT id, name FROM organizations')) {
          return { rowCount: 1, rows: [{ id: 'target-org', name: 'Target Org' }] };
        }
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    calls.acquirePgClient.mockResolvedValue(client);
    calls.deleteOrganizationDataInTransaction.mockResolvedValue({
      organizationId: 'target-org',
      organizationName: 'Target Org',
      deletedCounts: { organizations: 1 },
      passes: 1,
    });
  });

  it('returns the same approved-out refusal twice before confirmation, policy, client, deletion, or audit', async () => {
    const instance = await app();
    const invoke = () =>
      request(instance).delete('/api/superadmin/organizations/target-org').send({
        confirmation: true,
        reason: 'must never reach a destructive engine',
        organizationName: 'Target Org',
      });

    const first = await invoke();
    const second = await invoke();

    for (const response of [first, second]) {
      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        success: false,
        code: 'SET_DELETE_APPROVED_OUT',
        destructiveExecution: false,
      });
    }
    expect(calls.deleteConfirmation).not.toHaveBeenCalled();
    expect(calls.requireNoLegalHold).not.toHaveBeenCalled();
    expect(calls.acquirePgClient).not.toHaveBeenCalled();
    expect(calls.deleteOrganizationDataInTransaction).not.toHaveBeenCalled();
    expect(calls.emitAuditEvent).not.toHaveBeenCalled();
  });

  it('keeps authentication ahead of the approved-out response and every downstream operation', async () => {
    state.authenticated = false;
    const response = await request(await app())
      .delete('/api/superadmin/organizations/foreign-org')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
    expect(calls.deleteConfirmation).not.toHaveBeenCalled();
    expect(calls.requireNoLegalHold).not.toHaveBeenCalled();
    expect(calls.acquirePgClient).not.toHaveBeenCalled();
    expect(calls.deleteOrganizationDataInTransaction).not.toHaveBeenCalled();
    expect(calls.emitAuditEvent).not.toHaveBeenCalled();
  });
});
