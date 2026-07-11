/**
 * HTTP wiring test for GET /api/initiatives/programs/:programId/rollup —
 * F5 "silnik→route" wiring (additive): `programRollupService.getProgramRollup`
 * existed with zero route callers before this endpoint.
 *
 * Pins: auth (401/403 without org), not-found (404), and success payload
 * (the rollup service result forwarded verbatim). Service is mocked — this
 * is route wiring, not rollup-arithmetic coverage (that's
 * server/src/services/pmo/__tests__/programRollupService.test.ts).
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

const mockGetProgramRollup = vi.fn();

vi.mock('../../../../server/src/controllers/InitiativeController.js', () => ({
  default: new Proxy(
    {},
    {
      get:
        () =>
        (_req: any, res: any) =>
          res.status(200).json({ ok: true }),
    }
  ),
}));

vi.mock('../../../../server/src/controllers/StaffingPlanController.js', () => ({
  StaffingPlanController: new Proxy(
    {},
    {
      get:
        () =>
        (_req: any, res: any) =>
          res.status(200).json({ ok: true }),
    }
  ),
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/blueprintService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn(),
}));

vi.mock('../../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiativeTemplateService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/pmo/programRollupService.js', () => ({
  getProgramRollup: (...a: unknown[]) => mockGetProgramRollup(...a),
  default: { getProgramRollup: (...a: unknown[]) => mockGetProgramRollup(...a) },
}));

vi.mock('../../../../server/src/services/workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn(),
  getInitiativeCapacity: vi.fn(),
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/validators/initiative.validators.js', () => ({
  CreateInitiativeSchema: {},
  QuickUpdateInitiativeSchema: {},
  UpdateInitiativeSchema: {},
  UpdateInitiativeStatusSchema: {},
  UpdateInitiativeTemplateSchema: {},
}));

const PROGRAM_ID = 'program-1';

async function createApp() {
  const { default: router } = await import(
    '../../../../server/src/routes/pmo/initiatives.routes.js'
  );
  const app = express();
  app.use('/initiatives', router);
  return app;
}

describe('GET /api/initiatives/programs/:programId/rollup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
  });

  it('no organization on token → 403 RBAC (blocked before the handler/service)', async () => {
    mockUser = { id: 'user-1', role: 'ADMIN', organizationId: '' };
    const app = await createApp();
    const res = await request(app).get(`/initiatives/programs/${PROGRAM_ID}/rollup`);
    expect(res.status).toBe(403);
    expect(mockGetProgramRollup).not.toHaveBeenCalled();
  });

  it('program not found in caller org → 404', async () => {
    mockGetProgramRollup.mockResolvedValue(null);
    const app = await createApp();
    const res = await request(app).get(`/initiatives/programs/${PROGRAM_ID}/rollup`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Program not found');
  });

  it('own-org read succeeds → 200 with the rollup, service called with (orgId, programId)', async () => {
    const rollup = {
      program: { id: PROGRAM_ID, name: 'Digitization' },
      projectCount: 2,
      initiativeCount: 5,
      currency: 'PLN',
      budget: { containerTotal: 100, initiativesBudgetPlanned: 80 },
      value: { total: 500 },
      benefits: { total: 200 },
      roi: { total: 3 },
      health: { green: 3, amber: 1, red: 1 },
      projects: [],
      childPrograms: [],
    };
    mockGetProgramRollup.mockResolvedValue(rollup);
    const app = await createApp();
    const res = await request(app).get(`/initiatives/programs/${PROGRAM_ID}/rollup`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rollup);
    expect(mockGetProgramRollup).toHaveBeenCalledWith('org-1', PROGRAM_ID);
  });

  it('service throws → 500, error mapped via failInitiative500', async () => {
    mockGetProgramRollup.mockRejectedValue(new Error('db down'));
    const app = await createApp();
    const res = await request(app).get(`/initiatives/programs/${PROGRAM_ID}/rollup`);
    expect(res.status).toBe(500);
  });
});
