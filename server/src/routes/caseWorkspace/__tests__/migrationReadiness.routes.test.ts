import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireOrgMember = vi.fn();
const mockRequireOrgRole = vi.fn();
const mockRegisterFlagDefinition = vi.fn();
const mockGetFlagDefinition = vi.fn();
const mockSetOrgFlagState = vi.fn();
const mockGetQuarantinedLegacyRecord = vi.fn();
const mockListQuarantinedLegacyRecordsForRehearsalRun = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return {
    ...actual,
    requireOrgMember: (...args: unknown[]) => mockRequireOrgMember(...args),
    requireOrgRole: (...args: unknown[]) => mockRequireOrgRole(...args),
  };
});

vi.mock('../../../services/caseWorkspace/migrationReadinessService.js', () => ({
  registerFlagDefinition: (...args: unknown[]) => mockRegisterFlagDefinition(...args),
  getFlagDefinition: (...args: unknown[]) => mockGetFlagDefinition(...args),
  listFlagChildren: vi.fn(),
  listFlagDescendants: vi.fn(),
  setOrgFlagState: (...args: unknown[]) => mockSetOrgFlagState(...args),
  getCurrentOrgFlagState: vi.fn(),
  listCurrentOrgFlags: vi.fn(),
  findSmallestEnabledDescendant: vi.fn(),
  rollbackFlag: vi.fn(),
  recordQuarantinedLegacyRecord: vi.fn(),
  getQuarantinedLegacyRecord: (...args: unknown[]) => mockGetQuarantinedLegacyRecord(...args),
  listQuarantinedLegacyRecordsForRehearsalRun: (...args: unknown[]) =>
    mockListQuarantinedLegacyRecordsForRehearsalRun(...args),
  listQuarantinedLegacyRecordsForSource: vi.fn(),
  countQuarantinedByReasonCode: vi.fn(),
}));

import migrationReadinessRoutes from '../migrationReadiness.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', migrationReadinessRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace migration-readiness (flags/legacy-quarantine) routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireOrgMember.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
    mockRequireOrgRole.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a register-flag-definition body missing description with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/flags/definitions')
      .send({ flagKey: 'my.flag' });
    expect(res.status).toBe(400);
    expect(mockRegisterFlagDefinition).not.toHaveBeenCalled();
  });

  it('gates flag-definition registration behind ADMIN org-role', async () => {
    mockRegisterFlagDefinition.mockResolvedValue({ flagKey: 'my.flag' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/flags/definitions')
      .send({ flagKey: 'my.flag', description: 'test flag' });
    expect(res.status).toBe(201);
    expect(mockRequireOrgRole).toHaveBeenCalledWith(USER, ORG, 'ADMIN');
  });

  it('maps flag_definition_cycle_detected to 422', async () => {
    mockRegisterFlagDefinition.mockRejectedValue(new Error('flag_definition_cycle_detected'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/flags/definitions')
      .send({ flagKey: 'my.flag', parentFlagKey: 'my.flag.child', description: 'test flag' });
    expect(res.status).toBe(422);
  });

  it('always forces organizationId to the authenticated actor org on setOrgFlagState', async () => {
    mockSetOrgFlagState.mockResolvedValue({ flagId: 'cwff-1', organizationId: ORG });
    const res = await request(createApp())
      .put('/api/v8/case-workspace/flags/org-state/my.flag')
      .send({ enabled: true, organizationId: 'attacker-org' });
    expect(res.status).toBe(200);
    expect(mockSetOrgFlagState).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG }));
  });

  it('rejects a rolloutPercentage outside [0,100] with 400', async () => {
    const res = await request(createApp())
      .put('/api/v8/case-workspace/flags/org-state/my.flag')
      .send({ enabled: true, rolloutPercentage: 150 });
    expect(res.status).toBe(400);
    expect(mockSetOrgFlagState).not.toHaveBeenCalled();
  });

  it('404s a quarantine record belonging to a different organization (enumeration-safe gap mitigation)', async () => {
    mockGetQuarantinedLegacyRecord.mockResolvedValue({ quarantineId: 'cwlq-1', organizationId: 'other-org' });
    const res = await request(createApp()).get('/api/v8/case-workspace/legacy-quarantine/cwlq-1');
    expect(res.status).toBe(404);
  });

  it('post-filters listQuarantinedLegacyRecordsForRehearsalRun results to the actor org (known-gap stopgap)', async () => {
    mockListQuarantinedLegacyRecordsForRehearsalRun.mockResolvedValue([
      { quarantineId: 'cwlq-1', organizationId: ORG },
      { quarantineId: 'cwlq-2', organizationId: 'other-org' },
    ]);
    const res = await request(createApp()).get('/api/v8/case-workspace/legacy-quarantine/rehearsal-runs/run-1');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ quarantineId: 'cwlq-1', organizationId: ORG }]);
    expect(mockRequireOrgRole).toHaveBeenCalledWith(USER, ORG, 'ADMIN');
  });
});
