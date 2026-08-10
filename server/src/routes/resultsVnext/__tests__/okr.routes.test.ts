/** @vitest-environment node */

/**
 * OKR-E001 API layer — route contract tests.
 *
 * Pattern precedent: `roi.routes.test.ts` — supertest against a minimal
 * Express app, middleware (auth/rbac/demo/rate-limit) replaced with
 * passthroughs, the DOMAIN SERVICE layer mocked (not the whole DB). This
 * file's job is the HTTP boundary `okr.routes.ts` itself owns: request
 * validation, error->HTTP mapping, and the "load the resource first to
 * 404 before invoking the command" plumbing. RBAC itself (403 on
 * non-admin) is covered separately in `tests/resultsVnext/okr/
 * okrRbacGuard.test.ts` against the REAL middleware — mocked to a
 * passthrough here so this file can focus purely on the parts `okr.routes.ts`
 * itself owns.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateProgram = vi.fn();
const mockEditProgramDraft = vi.fn();
const mockPublishProgram = vi.fn();
const mockCreateCycle = vi.fn();
const mockRunOkrCycleLifecycleTransition = vi.fn();

const mockGetProgram = vi.fn();
const mockListPrograms = vi.fn();
const mockGetCycle = vi.fn();
const mockListCycles = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: (..._roles: string[]) => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/resultsVnext/okr/okrProgramCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrProgramCommands.js')>();
  return {
    ...actual,
    createProgram: (...args: unknown[]) => mockCreateProgram(...args),
    editProgramDraft: (...args: unknown[]) => mockEditProgramDraft(...args),
    publishProgram: (...args: unknown[]) => mockPublishProgram(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrCycleCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrCycleCommands.js')>();
  return {
    ...actual,
    createCycle: (...args: unknown[]) => mockCreateCycle(...args),
    runOkrCycleLifecycleTransition: (...args: unknown[]) => mockRunOkrCycleLifecycleTransition(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrRepository.js', () => ({
  getProgram: (...args: unknown[]) => mockGetProgram(...args),
  listPrograms: (...args: unknown[]) => mockListPrograms(...args),
  getCycle: (...args: unknown[]) => mockGetCycle(...args),
  listCycles: (...args: unknown[]) => mockListCycles(...args),
}));

const { OkrProgramValidationError } = await import('../../../services/resultsVnext/okr/okrProgramCommands.js');
const { OkrCycleProgramNotActiveError, OkrCycleValidationError } = await import(
  '../../../services/resultsVnext/okr/okrCycleCommands.js'
);
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } =
  await import('../../../services/resultsVnext/platform/atomicWrite.js');

const okrRoutes = (await import('../okr.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/okr', okrRoutes);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const CYCLE_ID = '22222222-2222-4222-8222-222222222222';
const POLICY_VERSION_ID = '33333333-3333-4333-8333-333333333333';

function programFixture(overrides: Record<string, unknown> = {}) {
  return {
    programId: PROGRAM_ID,
    organizationId: 'org-1',
    name: 'Program name',
    status: 'draft',
    cycleModel: 'quarterly',
    annualDirectionEnabled: false,
    objectiveMinRecommended: null,
    objectiveMaxRecommended: null,
    krMinRequired: 2,
    krMaxRecommended: null,
    checkinFrequency: 'biweekly',
    approvalRequired: true,
    scoringModel: 'zero_to_one',
    objectiveRollupModel: 'none',
    confidenceEnabled: true,
    confidenceModel: 'high_medium_low',
    objectiveConfidenceModel: 'lowest_kr',
    visibilityDefault: 'OPEN_ORG',
    committedVsAspirationalEnabled: true,
    managerReviewRequired: true,
    selfReviewRequired: false,
    reflectionRequiredForClose: false,
    recognitionEnabled: true,
    activePolicyVersionId: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function cycleFixture(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: CYCLE_ID,
    organizationId: 'org-1',
    programId: PROGRAM_ID,
    name: 'Cycle name',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    approvalDueAt: null,
    activeStartAt: '2026-01-01T00:00:00.000Z',
    midcycleReviewAt: null,
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    managerReviewDueAt: null,
    closeAt: '2026-03-31T00:00:00.000Z',
    status: 'planned',
    policyVersionId: POLICY_VERSION_ID,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function cycleCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    programId: PROGRAM_ID,
    name: 'Cycle name',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// create -> get roundtrip (Program)
// ==========================================

describe('POST /programs + GET /programs/:programId — create -> get roundtrip', () => {
  it('creates a Program and the same id is fetchable via GET', async () => {
    const program = programFixture();
    mockCreateProgram.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: program,
    });
    mockGetProgram.mockResolvedValue(program);

    const createResponse = await request(createApp())
      .post('/api/vnext/results/okr/programs')
      .send({ name: 'Program name' });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.program.programId).toBe(PROGRAM_ID);
    expect(mockCreateProgram).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateProgram.mock.calls[0][0];
    expect(createArgs.organizationId).toBe('org-1');
    expect(createArgs.createdBy).toBe('user-1');
    expect(typeof createArgs.idempotencyKey).toBe('string');

    const getResponse = await request(createApp()).get(`/api/vnext/results/okr/programs/${PROGRAM_ID}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.program.programId).toBe(PROGRAM_ID);
  });

  it('404s GET for a program the repository does not return', async () => {
    mockGetProgram.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/okr/programs/${PROGRAM_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp()).post('/api/vnext/results/okr/programs').send({});
    expect(response.status).toBe(400);
    expect(mockCreateProgram).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET /programs — list
// ==========================================

describe('GET /programs — listPrograms', () => {
  it('passes status/limit/offset through to the repository', async () => {
    mockListPrograms.mockResolvedValue([programFixture()]);
    const response = await request(createApp()).get('/api/vnext/results/okr/programs?status=active&limit=10&offset=5');
    expect(response.status).toBe(200);
    expect(response.body.programs).toHaveLength(1);
    expect(mockListPrograms).toHaveBeenCalledWith({
      organizationId: 'org-1',
      status: 'active',
      limit: 10,
      offset: 5,
    });
  });
});

// ==========================================
// PATCH /programs/:programId/draft — editProgramDraft
// ==========================================

describe('PATCH /programs/:programId/draft — editProgramDraft', () => {
  it('404s when the program does not exist, without calling the command', async () => {
    mockGetProgram.mockResolvedValue(null);
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/programs/${PROGRAM_ID}/draft`)
      .send({ expectedVersion: 1, name: 'New name' });
    expect(response.status).toBe(404);
    expect(mockEditProgramDraft).not.toHaveBeenCalled();
  });

  it('edits and maps STALE_VERSION to 409', async () => {
    mockGetProgram.mockResolvedValue(programFixture());
    mockEditProgramDraft.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 1,
      })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/programs/${PROGRAM_ID}/draft`)
      .send({ expectedVersion: 1, name: 'New name' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('maps OkrProgramValidationError (NOT_EDITABLE) to 409', async () => {
    mockGetProgram.mockResolvedValue(programFixture({ status: 'retired' }));
    mockEditProgramDraft.mockRejectedValue(
      new OkrProgramValidationError('not editable', 'NOT_EDITABLE', { programId: PROGRAM_ID })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/programs/${PROGRAM_ID}/draft`)
      .send({ expectedVersion: 1, name: 'New name' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_EDITABLE');
  });
});

// ==========================================
// POST /programs/:programId/publish — publishProgram
// ==========================================

describe('POST /programs/:programId/publish — publishProgram', () => {
  it('publishes and returns program + policyVersion', async () => {
    mockGetProgram.mockResolvedValue(programFixture());
    mockPublishProgram.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: {
        program: programFixture({ status: 'active', activePolicyVersionId: POLICY_VERSION_ID, rowVersion: 2 }),
        policyVersion: {
          policyVersionId: POLICY_VERSION_ID,
          programId: PROGRAM_ID,
          organizationId: 'org-1',
          versionNumber: 1,
          snapshot: { krMinRequired: 2 },
          publishedBy: 'user-1',
          publishedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/programs/${PROGRAM_ID}/publish`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.program.status).toBe('active');
    expect(response.body.policyVersion.versionNumber).toBe(1);
  });

  it('404s when the program does not exist, without calling the command', async () => {
    mockGetProgram.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/programs/${PROGRAM_ID}/publish`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockPublishProgram).not.toHaveBeenCalled();
  });
});

// ==========================================
// create -> get roundtrip (Cycle)
// ==========================================

describe('POST /cycles + GET /cycles/:cycleId — create -> get roundtrip', () => {
  it('creates a Cycle and the same id is fetchable via GET', async () => {
    const cycle = cycleFixture();
    mockCreateCycle.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 1,
      result: cycle,
    });
    mockGetCycle.mockResolvedValue(cycle);

    const createResponse = await request(createApp()).post('/api/vnext/results/okr/cycles').send(cycleCreateBody());
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.cycle.cycleId).toBe(CYCLE_ID);
    expect(mockCreateCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateCycle.mock.calls[0][0].programId).toBe(PROGRAM_ID);

    const getResponse = await request(createApp()).get(`/api/vnext/results/okr/cycles/${CYCLE_ID}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.cycle.cycleId).toBe(CYCLE_ID);
  });

  it('maps OkrCycleProgramNotActiveError to 409', async () => {
    mockCreateCycle.mockRejectedValue(new OkrCycleProgramNotActiveError(PROGRAM_ID, 'draft'));
    const response = await request(createApp()).post('/api/vnext/results/okr/cycles').send(cycleCreateBody());
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PROGRAM_NOT_ACTIVE');
  });

  it('maps AtomicWriteAggregateNotFoundError to 404 (referenced Program does not exist)', async () => {
    mockCreateCycle.mockRejectedValue(new AtomicWriteAggregateNotFoundError('OKR Program not found'));
    const response = await request(createApp()).post('/api/vnext/results/okr/cycles').send(cycleCreateBody());
    expect(response.status).toBe(404);
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/okr/cycles')
      .send({ programId: PROGRAM_ID });
    expect(response.status).toBe(400);
    expect(mockCreateCycle).not.toHaveBeenCalled();
  });

  it('404s GET for a cycle the repository does not return', async () => {
    mockGetCycle.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/okr/cycles/${CYCLE_ID}`);
    expect(response.status).toBe(404);
  });
});

// ==========================================
// GET /cycles — list
// ==========================================

describe('GET /cycles — listCycles', () => {
  it('passes programId/status/limit/offset through to the repository', async () => {
    mockListCycles.mockResolvedValue([cycleFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/okr/cycles?programId=${PROGRAM_ID}&status=planned&limit=10&offset=5`
    );
    expect(response.status).toBe(200);
    expect(response.body.cycles).toHaveLength(1);
    expect(mockListCycles).toHaveBeenCalledWith({
      organizationId: 'org-1',
      programId: PROGRAM_ID,
      status: 'planned',
      limit: 10,
      offset: 5,
    });
  });
});

// ==========================================
// Cycle transitions
// ==========================================

describe('POST /cycles/:cycleId/{open-drafting|activate|open-review|close|cancel}', () => {
  it('open-drafting: 200 on success', async () => {
    mockGetCycle.mockResolvedValue(cycleFixture());
    mockRunOkrCycleLifecycleTransition.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 2,
      result: cycleFixture({ status: 'drafting', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/cycles/${CYCLE_ID}/open-drafting`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.cycle.status).toBe('drafting');
  });

  it('cancel: maps OkrCycleValidationError to 409', async () => {
    mockGetCycle.mockResolvedValue(cycleFixture({ status: 'closed' }));
    mockRunOkrCycleLifecycleTransition.mockRejectedValue(
      new OkrCycleValidationError('cannot cancel a closed cycle', 'INVALID_TRANSITION', { cycleId: CYCLE_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/cycles/${CYCLE_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_TRANSITION');
  });

  it('404s when the cycle does not exist, without calling the command', async () => {
    mockGetCycle.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/cycles/${CYCLE_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockRunOkrCycleLifecycleTransition).not.toHaveBeenCalled();
  });
});
