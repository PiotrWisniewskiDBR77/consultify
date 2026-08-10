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

const mockCreateOkrSet = vi.fn();
const mockUpdateOkrSetDraft = vi.fn();
const mockNarrowOkrSetVisibility = vi.fn();
const mockSubmitOkrSetForApproval = vi.fn();
const mockApproveOkrSet = vi.fn();
const mockRequestChangesOnOkrSet = vi.fn();
const mockRunOkrSetLifecycleTransition = vi.fn();
const mockRecordOkrSetMaterialChange = vi.fn();

const mockGetOkrSet = vi.fn();
const mockListOkrSets = vi.fn();
const mockListOkrSetApprovedSnapshots = vi.fn();
const mockGetOkrSetApprovedSnapshot = vi.fn();

// OKR-E003
const mockCreateObjective = vi.fn();
const mockUpdateObjective = vi.fn();
const mockCancelObjective = vi.fn();
const mockCreateKeyResult = vi.fn();
const mockUpdateKeyResult = vi.fn();
const mockCancelKeyResult = vi.fn();
const mockListObjectivesForSet = vi.fn();
const mockGetObjective = vi.fn();
const mockGetKeyResult = vi.fn();

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

vi.mock('../../../services/resultsVnext/okr/okrSetCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrSetCommands.js')>();
  return {
    ...actual,
    createOkrSet: (...args: unknown[]) => mockCreateOkrSet(...args),
    updateOkrSetDraft: (...args: unknown[]) => mockUpdateOkrSetDraft(...args),
    narrowOkrSetVisibility: (...args: unknown[]) => mockNarrowOkrSetVisibility(...args),
    submitOkrSetForApproval: (...args: unknown[]) => mockSubmitOkrSetForApproval(...args),
    approveOkrSet: (...args: unknown[]) => mockApproveOkrSet(...args),
    requestChangesOnOkrSet: (...args: unknown[]) => mockRequestChangesOnOkrSet(...args),
    runOkrSetLifecycleTransition: (...args: unknown[]) => mockRunOkrSetLifecycleTransition(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrSetMaterialChangeCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrSetMaterialChangeCommands.js')>();
  return {
    ...actual,
    recordOkrSetMaterialChange: (...args: unknown[]) => mockRecordOkrSetMaterialChange(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrSetRepository.js', () => ({
  getOkrSet: (...args: unknown[]) => mockGetOkrSet(...args),
  listOkrSets: (...args: unknown[]) => mockListOkrSets(...args),
  listOkrSetApprovedSnapshots: (...args: unknown[]) => mockListOkrSetApprovedSnapshots(...args),
  getOkrSetApprovedSnapshot: (...args: unknown[]) => mockGetOkrSetApprovedSnapshot(...args),
}));

// OKR-E003
vi.mock('../../../services/resultsVnext/okr/okrObjectiveCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrObjectiveCommands.js')>();
  return {
    ...actual,
    createObjective: (...args: unknown[]) => mockCreateObjective(...args),
    updateObjective: (...args: unknown[]) => mockUpdateObjective(...args),
    cancelObjective: (...args: unknown[]) => mockCancelObjective(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrKeyResultCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrKeyResultCommands.js')>();
  return {
    ...actual,
    createKeyResult: (...args: unknown[]) => mockCreateKeyResult(...args),
    updateKeyResult: (...args: unknown[]) => mockUpdateKeyResult(...args),
    cancelKeyResult: (...args: unknown[]) => mockCancelKeyResult(...args),
  };
});

vi.mock('../../../services/resultsVnext/okr/okrObjectiveRepository.js', () => ({
  listObjectivesForSet: (...args: unknown[]) => mockListObjectivesForSet(...args),
  getObjective: (...args: unknown[]) => mockGetObjective(...args),
  getKeyResult: (...args: unknown[]) => mockGetKeyResult(...args),
}));

const { OkrProgramValidationError } = await import('../../../services/resultsVnext/okr/okrProgramCommands.js');
const { OkrCycleProgramNotActiveError, OkrCycleValidationError } = await import(
  '../../../services/resultsVnext/okr/okrCycleCommands.js'
);
const {
  OkrSetNoActiveVisibilityPolicyError,
  OkrSetNotReadyForSubmissionError,
  OkrSetSelfApprovalDeniedError,
  OkrSetValidationError,
  OkrSetVisibilityWideningDeniedError,
} = await import('../../../services/resultsVnext/okr/okrSetCommands.js');
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } =
  await import('../../../services/resultsVnext/platform/atomicWrite.js');
const { OkrObjectiveNotFoundError, OkrObjectiveSetNotEditableError, OkrObjectiveValidationError } = await import(
  '../../../services/resultsVnext/okr/okrObjectiveCommands.js'
);
const { OkrKeyResultNotFoundError, OkrKeyResultValidationError } = await import(
  '../../../services/resultsVnext/okr/okrKeyResultCommands.js'
);

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

// ==========================================
// OKR-E002 — Materialized Set (design §6, 14 routes)
// ==========================================

const SET_ID = '44444444-4444-4444-8444-444444444444';
const SNAPSHOT_ID = '55555555-5555-4555-8555-555555555555';

function setFixture(overrides: Record<string, unknown> = {}) {
  return {
    setId: SET_ID,
    organizationId: 'org-1',
    programId: PROGRAM_ID,
    cycleId: CYCLE_ID,
    scopeType: 'individual',
    scopeId: 'user-owner',
    ownerUserId: 'user-owner',
    reviewerUserId: 'user-reviewer',
    title: 'Set title',
    status: 'draft',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function snapshotSummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: SNAPSHOT_ID,
    setId: SET_ID,
    sequenceNumber: 1,
    approvedBy: 'user-reviewer',
    approvedAt: '2026-01-03T00:00:00.000Z',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ==========================================
// create -> get roundtrip (Set)
// ==========================================

describe('POST /sets + GET /sets/:setId — create -> get roundtrip', () => {
  it('creates a Set (created:true -> 201) and the same id is fetchable via GET', async () => {
    const set = setFixture();
    mockCreateOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-set-1',
      resultingVersion: 1,
      result: { set, created: true },
    });
    mockGetOkrSet.mockResolvedValue(set);

    const createResponse = await request(createApp())
      .post('/api/vnext/results/okr/sets')
      .send({
        programId: PROGRAM_ID,
        cycleId: CYCLE_ID,
        scopeType: 'individual',
        scopeId: 'user-owner',
        ownerUserId: 'user-owner',
        title: 'Set title',
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.set.setId).toBe(SET_ID);
    expect(createResponse.body.created).toBe(true);
    expect(mockCreateOkrSet).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateOkrSet.mock.calls[0][0];
    expect(createArgs.organizationId).toBe('org-1');
    expect(createArgs.createdBy).toBe('user-1');
    expect(typeof createArgs.idempotencyKey).toBe('string');

    const getResponse = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.set.setId).toBe(SET_ID);
  });

  it('D3 found-existing branch (created:false) returns 200, not 201', async () => {
    mockCreateOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-set-2',
      resultingVersion: 1,
      result: { set: setFixture(), created: false },
    });
    const response = await request(createApp())
      .post('/api/vnext/results/okr/sets')
      .send({
        programId: PROGRAM_ID,
        cycleId: CYCLE_ID,
        scopeType: 'individual',
        scopeId: 'user-owner',
        ownerUserId: 'user-owner',
        title: 'Set title',
      });
    expect(response.status).toBe(200);
    expect(response.body.created).toBe(false);
  });

  it('404s GET for a Set the repository does not return', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp()).post('/api/vnext/results/okr/sets').send({});
    expect(response.status).toBe(400);
    expect(mockCreateOkrSet).not.toHaveBeenCalled();
  });

  it('maps OkrSetNoActiveVisibilityPolicyError to 409', async () => {
    mockCreateOkrSet.mockRejectedValue(new OkrSetNoActiveVisibilityPolicyError('org-1', 'okr'));
    const response = await request(createApp())
      .post('/api/vnext/results/okr/sets')
      .send({
        programId: PROGRAM_ID,
        cycleId: CYCLE_ID,
        scopeType: 'individual',
        scopeId: 'user-owner',
        ownerUserId: 'user-owner',
        title: 'Set title',
      });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NO_ACTIVE_VISIBILITY_POLICY');
  });
});

// ==========================================
// GET /sets — list
// ==========================================

describe('GET /sets — listOkrSets', () => {
  it('passes cycleId/scopeType/status/attentionState/limit/offset through to the repository', async () => {
    mockListOkrSets.mockResolvedValue([setFixture()]);
    const response = await request(createApp()).get(
      `/api/vnext/results/okr/sets?cycleId=${CYCLE_ID}&scopeType=individual&status=draft&attentionState=none&limit=10&offset=5`
    );
    expect(response.status).toBe(200);
    expect(response.body.sets).toHaveLength(1);
    expect(mockListOkrSets).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      cycleId: CYCLE_ID,
      scopeType: 'individual',
      status: 'draft',
      attentionState: 'none',
      limit: 10,
      offset: 5,
    });
  });
});

// ==========================================
// GET /company — listOkrSets filtered scope_type='company'
// ==========================================

describe('GET /company — listOkrSets pinned to scope_type company', () => {
  it('always passes scopeType:"company", regardless of query', async () => {
    mockListOkrSets.mockResolvedValue([setFixture({ scopeType: 'company' })]);
    const response = await request(createApp()).get('/api/vnext/results/okr/company');
    expect(response.status).toBe(200);
    expect(mockListOkrSets).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', scopeType: 'company' })
    );
  });
});

// ==========================================
// PATCH /sets/:setId/draft — updateOkrSetDraft
// ==========================================

describe('PATCH /sets/:setId/draft — updateOkrSetDraft', () => {
  it('404s when the Set does not exist, without calling the command', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/draft`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(404);
    expect(mockUpdateOkrSetDraft).not.toHaveBeenCalled();
  });

  it('edits and maps STALE_VERSION to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockUpdateOkrSetDraft.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 1,
      })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/draft`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('maps OkrSetValidationError (NOT_EDITABLE) to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    mockUpdateOkrSetDraft.mockRejectedValue(
      new OkrSetValidationError('not editable', 'NOT_EDITABLE', { setId: SET_ID })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/draft`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_EDITABLE');
  });
});

// ==========================================
// PATCH /sets/:setId/visibility — narrowOkrSetVisibility (D19)
// ==========================================

describe('PATCH /sets/:setId/visibility — narrowOkrSetVisibility', () => {
  it('narrows and returns the new visibilityMode', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockNarrowOkrSetVisibility.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-narrow-1',
      resultingVersion: 2,
      result: { set: setFixture({ rowVersion: 2 }), visibilityMode: 'RESTRICTED_ACL' },
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/visibility`)
      .send({ expectedVersion: 1, visibilityMode: 'RESTRICTED_ACL' });
    expect(response.status).toBe(200);
    expect(response.body.visibilityMode).toBe('RESTRICTED_ACL');
  });

  it('maps OkrSetVisibilityWideningDeniedError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockNarrowOkrSetVisibility.mockRejectedValue(
      new OkrSetVisibilityWideningDeniedError(SET_ID, 'OPEN_ORG', 'SCOPE')
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/visibility`)
      .send({ expectedVersion: 1, visibilityMode: 'OPEN_ORG' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('VISIBILITY_WIDENING_DENIED');
  });

  it('400s on an invalid visibilityMode (Zod enum)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/sets/${SET_ID}/visibility`)
      .send({ expectedVersion: 1, visibilityMode: 'NOT_A_REAL_MODE' });
    expect(response.status).toBe(400);
    expect(mockNarrowOkrSetVisibility).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST /sets/:setId/submit — submitOkrSetForApproval
// ==========================================

describe('POST /sets/:setId/submit — submitOkrSetForApproval', () => {
  it('submits: 200 on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockSubmitOkrSetForApproval.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-submit-1',
      resultingVersion: 2,
      result: setFixture({ status: 'submitted', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/submit`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('submitted');
  });

  it('maps OkrSetNotReadyForSubmissionError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockSubmitOkrSetForApproval.mockRejectedValue(
      new OkrSetNotReadyForSubmissionError(SET_ID, 'reviewer_not_assigned')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/submit`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_READY_FOR_SUBMISSION');
  });

  it('404s when the Set does not exist, without calling the command', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/submit`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockSubmitOkrSetForApproval).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST /sets/:setId/approve — approveOkrSet
// ==========================================

describe('POST /sets/:setId/approve — approveOkrSet', () => {
  it('approves and returns set + snapshot', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'submitted' }));
    mockApproveOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-approve-1',
      resultingVersion: 2,
      result: {
        set: setFixture({ status: 'approved', approvedVersion: 1, rowVersion: 2 }),
        snapshot: snapshotSummaryFixture(),
      },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/approve`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('approved');
    expect(response.body.snapshot.sequenceNumber).toBe(1);
  });

  it('maps OkrSetSelfApprovalDeniedError to 403', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'submitted' }));
    mockApproveOkrSet.mockRejectedValue(new OkrSetSelfApprovalDeniedError(SET_ID, 'user-1', 'submitted_by'));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/approve`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_APPROVAL_DENIED');
  });
});

// ==========================================
// POST /sets/:setId/request-changes — requestChangesOnOkrSet
// ==========================================

describe('POST /sets/:setId/request-changes — requestChangesOnOkrSet', () => {
  it('requests changes: 200 on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'submitted' }));
    mockRequestChangesOnOkrSet.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-changes-1',
      resultingVersion: 2,
      result: setFixture({ status: 'changes_requested', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/request-changes`)
      .send({ expectedVersion: 1, changeRequestNotes: 'please clarify' });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('changes_requested');
  });

  it('400s when changeRequestNotes is missing (Zod validation)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'submitted' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/request-changes`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(400);
    expect(mockRequestChangesOnOkrSet).not.toHaveBeenCalled();
  });
});

// ==========================================
// Set transitions — activate / cancel
// ==========================================

describe('POST /sets/:setId/{activate|cancel}', () => {
  it('activate: 200 on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'approved' }));
    mockRunOkrSetLifecycleTransition.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-activate-1',
      resultingVersion: 2,
      result: setFixture({ status: 'active', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.set.status).toBe('active');
  });

  it('cancel: maps OkrSetValidationError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'closed' }));
    mockRunOkrSetLifecycleTransition.mockRejectedValue(
      new OkrSetValidationError('cannot cancel a closed Set', 'INVALID_TRANSITION', { setId: SET_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_TRANSITION');
  });

  it('404s when the Set does not exist, without calling the command', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockRunOkrSetLifecycleTransition).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST /sets/:setId/request-revision — recordOkrSetMaterialChange
// ==========================================

describe('POST /sets/:setId/request-revision — recordOkrSetMaterialChange', () => {
  it('records a material change: 200 on success', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    mockRecordOkrSetMaterialChange.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-matchange-1',
      resultingVersion: 2,
      result: {
        set: setFixture({ status: 'active', currentVersion: 2, rowVersion: 2, title: 'Revised title' }),
        version: {
          versionId: '66666666-6666-4666-8666-666666666666',
          setId: SET_ID,
          organizationId: 'org-1',
          versionNumber: 2,
          fieldName: 'title',
          beforeValue: 'Set title',
          afterValue: 'Revised title',
          reason: 'feedback',
          requestedBy: 'user-1',
          requestedAt: '2026-01-05T00:00:00.000Z',
          reviewerUserId: null,
          recommitStatus: null,
          recommitBy: null,
          recommitAt: null,
          createdAt: '2026-01-05T00:00:00.000Z',
        },
      },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/request-revision`)
      .send({ expectedVersion: 1, fieldName: 'title', afterValue: 'Revised title', reason: 'feedback' });
    expect(response.status).toBe(200);
    expect(response.body.set.title).toBe('Revised title');
    expect(response.body.version.versionNumber).toBe(2);
  });

  it('maps OkrSetValidationError (NOT_ACTIVE) to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'draft' }));
    mockRecordOkrSetMaterialChange.mockRejectedValue(
      new OkrSetValidationError('not active', 'NOT_ACTIVE', { setId: SET_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/request-revision`)
      .send({ expectedVersion: 1, fieldName: 'title', afterValue: 'Revised title', reason: 'feedback' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_ACTIVE');
  });

  it('400s on an invalid fieldName (Zod enum)', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture({ status: 'active' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/request-revision`)
      .send({ expectedVersion: 1, fieldName: 'status', afterValue: 'cancelled', reason: 'feedback' });
    expect(response.status).toBe(400);
    expect(mockRecordOkrSetMaterialChange).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET /sets/:setId/approval-snapshots(/:snapshotId)
// ==========================================

describe('GET /sets/:setId/approval-snapshots(/:snapshotId)', () => {
  it('lists approval snapshots', async () => {
    mockListOkrSetApprovedSnapshots.mockResolvedValue([snapshotSummaryFixture()]);
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/approval-snapshots`);
    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(mockListOkrSetApprovedSnapshots).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      setId: SET_ID,
    });
  });

  it('gets a single approval snapshot', async () => {
    mockGetOkrSetApprovedSnapshot.mockResolvedValue({
      snapshotId: SNAPSHOT_ID,
      setId: SET_ID,
      sequenceNumber: 1,
      approvedBy: 'user-reviewer',
      approvedAt: '2026-01-03T00:00:00.000Z',
      contentHash: 'abc123',
      payload: { set: setFixture(), objectives: [] },
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    const response = await request(createApp()).get(
      `/api/vnext/results/okr/sets/${SET_ID}/approval-snapshots/${SNAPSHOT_ID}`
    );
    expect(response.status).toBe(200);
    expect(response.body.snapshot.snapshotId).toBe(SNAPSHOT_ID);
    expect(response.body.snapshot.payload.objectives).toEqual([]);
  });

  it('404s when the snapshot is not found/visible', async () => {
    mockGetOkrSetApprovedSnapshot.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/okr/sets/${SET_ID}/approval-snapshots/${SNAPSHOT_ID}`
    );
    expect(response.status).toBe(404);
  });
});

// ==========================================
// OKR-E003 — Objective & KeyResult (design §14, 9 routes)
// ==========================================

const OBJECTIVE_ID = '66666666-6666-4666-8666-666666666666';
const KEY_RESULT_ID = '77777777-7777-4777-8777-777777777777';

function objectiveFixture(overrides: Record<string, unknown> = {}) {
  return {
    objectiveId: OBJECTIVE_ID,
    setId: SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-owner',
    title: 'Objective title',
    description: null,
    rationale: null,
    ambitionType: 'standard',
    status: 'draft',
    progress: null,
    progressCalcPolicyVersionId: null,
    progressCalcReason: null,
    confidence: null,
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: null,
    confidenceCalcReason: null,
    sortOrder: 1,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    approvedAt: null,
    ...overrides,
  };
}

function keyResultFixture(overrides: Record<string, unknown> = {}) {
  return {
    keyResultId: KEY_RESULT_ID,
    objectiveId: OBJECTIVE_ID,
    setId: SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-owner',
    title: 'KeyResult title',
    description: null,
    measurementType: 'numeric',
    unit: null,
    currency: null,
    baselineValue: null,
    targetValue: '10',
    startValue: null,
    currentValue: '5',
    direction: 'reach',
    rangeMin: null,
    rangeMax: null,
    progress: '0.5',
    progressCalcPolicyVersionId: POLICY_VERSION_ID,
    progressCalcReason: 'reach: current_value / target_value',
    outOfRangeDistance: null,
    confidence: null,
    confidenceNumericValue: null,
    status: 'not_started',
    sourceType: 'manual',
    sourceReference: null,
    weight: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// POST /sets/:setId/objectives + GET /sets/:setId/objectives — createObjective / listObjectivesForSet
// ==========================================

describe('POST /sets/:setId/objectives + GET /sets/:setId/objectives — createObjective / listObjectivesForSet', () => {
  it('creates an Objective (201) when the Set exists', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    const objective = objectiveFixture();
    mockCreateObjective.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-obj-1',
      resultingVersion: 1,
      result: objective,
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/objectives`)
      .send({ ownerUserId: 'user-owner', title: 'Objective title' });
    expect(response.status).toBe(201);
    expect(response.body.objective.objectiveId).toBe(OBJECTIVE_ID);
    expect(mockCreateObjective).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateObjective.mock.calls[0][0];
    expect(createArgs.setId).toBe(SET_ID);
    expect(createArgs.organizationId).toBe('org-1');
    expect(createArgs.createdBy).toBe('user-1');
  });

  it('404s when the Set does not exist/is not visible, without calling the command', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/objectives`)
      .send({ ownerUserId: 'user-owner', title: 'Objective title' });
    expect(response.status).toBe(404);
    expect(mockCreateObjective).not.toHaveBeenCalled();
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp()).post(`/api/vnext/results/okr/sets/${SET_ID}/objectives`).send({});
    expect(response.status).toBe(400);
    expect(mockCreateObjective).not.toHaveBeenCalled();
  });

  it('maps AMBITION_TYPE_DISABLED (OkrObjectiveValidationError) to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockCreateObjective.mockRejectedValue(
      new OkrObjectiveValidationError('ambition_type disabled', 'AMBITION_TYPE_DISABLED', { ambitionType: 'committed' })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/objectives`)
      .send({ ownerUserId: 'user-owner', title: 'Objective title', ambitionType: 'committed' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('AMBITION_TYPE_DISABLED');
  });

  it('maps OkrObjectiveSetNotEditableError to 409', async () => {
    mockGetOkrSet.mockResolvedValue(setFixture());
    mockCreateObjective.mockRejectedValue(new OkrObjectiveSetNotEditableError(SET_ID, 'approved'));
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/sets/${SET_ID}/objectives`)
      .send({ ownerUserId: 'user-owner', title: 'Objective title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SET_NOT_EDITABLE');
  });

  it('lists Objectives with nested KeyResults for the Set', async () => {
    mockListObjectivesForSet.mockResolvedValue([{ ...objectiveFixture(), keyResults: [keyResultFixture()] }]);
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/objectives`);
    expect(response.status).toBe(200);
    expect(response.body.objectives).toHaveLength(1);
    expect(response.body.objectives[0].keyResults).toHaveLength(1);
    expect(mockListObjectivesForSet).toHaveBeenCalledWith({ userId: 'user-1', organizationId: 'org-1', setId: SET_ID });
  });
});

// ==========================================
// GET /objectives/:objectiveId + PATCH + cancel
// ==========================================

describe('GET /objectives/:objectiveId — getObjective', () => {
  it('returns the Objective with nested KeyResults', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [keyResultFixture()] });
    const response = await request(createApp()).get(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`);
    expect(response.status).toBe(200);
    expect(response.body.objective.objectiveId).toBe(OBJECTIVE_ID);
    expect(response.body.objective.keyResults).toHaveLength(1);
  });

  it('404s when not found/visible', async () => {
    mockGetObjective.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`);
    expect(response.status).toBe(404);
  });
});

describe('PATCH /objectives/:objectiveId — updateObjective', () => {
  it('404s when the Objective does not exist, without calling the command', async () => {
    mockGetObjective.mockResolvedValue(null);
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(404);
    expect(mockUpdateObjective).not.toHaveBeenCalled();
  });

  it('updates and returns the Objective', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    mockUpdateObjective.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-obj-2',
      resultingVersion: 2,
      result: objectiveFixture({ title: 'New title', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(200);
    expect(response.body.objective.title).toBe('New title');
  });

  it('maps CONFIDENCE_NOT_OWNER_EDITABLE (OkrObjectiveValidationError) to 409', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    mockUpdateObjective.mockRejectedValue(
      new OkrObjectiveValidationError('confidence not owner editable', 'CONFIDENCE_NOT_OWNER_EDITABLE', {})
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`)
      .send({ expectedVersion: 1, confidence: 'high' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFIDENCE_NOT_OWNER_EDITABLE');
  });

  it('maps STALE_VERSION to 409', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    mockUpdateObjective.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 2,
        expectedVersion: 1,
      })
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}`)
      .send({ expectedVersion: 1, title: 'New title' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });
});

describe('POST /objectives/:objectiveId/cancel — cancelObjective', () => {
  it('404s when the Objective does not exist, without calling the command', async () => {
    mockGetObjective.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockCancelObjective).not.toHaveBeenCalled();
  });

  it('cancels and returns the Objective', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    mockCancelObjective.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-obj-3',
      resultingVersion: 2,
      result: objectiveFixture({ status: 'cancelled', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.objective.status).toBe('cancelled');
  });
});

// ==========================================
// POST /objectives/:objectiveId/key-results — createKeyResult
// ==========================================

describe('POST /objectives/:objectiveId/key-results — createKeyResult', () => {
  it('creates a KeyResult (201) when the Objective exists', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    const keyResult = keyResultFixture();
    mockCreateKeyResult.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-kr-1',
      resultingVersion: 1,
      result: keyResult,
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/key-results`)
      .send({
        ownerUserId: 'user-owner',
        title: 'KeyResult title',
        measurementType: 'numeric',
        direction: 'reach',
        targetValue: 10,
        currentValue: 5,
      });
    expect(response.status).toBe(201);
    expect(response.body.keyResult.keyResultId).toBe(KEY_RESULT_ID);
    expect(mockCreateKeyResult).toHaveBeenCalledTimes(1);
    expect(mockCreateKeyResult.mock.calls[0][0].objectiveId).toBe(OBJECTIVE_ID);
  });

  it('404s when the Objective does not exist, without calling the command', async () => {
    mockGetObjective.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/key-results`)
      .send({ ownerUserId: 'user-owner', title: 'KR title', measurementType: 'numeric', direction: 'reach', targetValue: 10, currentValue: 5 });
    expect(response.status).toBe(404);
    expect(mockCreateKeyResult).not.toHaveBeenCalled();
  });

  it('400s when currency is missing for measurementType="currency" (Zod refine)', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/key-results`)
      .send({ ownerUserId: 'user-owner', title: 'KR title', measurementType: 'currency', direction: 'reach', targetValue: 10, currentValue: 5 });
    expect(response.status).toBe(400);
    expect(mockCreateKeyResult).not.toHaveBeenCalled();
  });

  it('400s when range_min/range_max are missing for direction="maintain_range" (Zod refine)', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/key-results`)
      .send({ ownerUserId: 'user-owner', title: 'KR title', measurementType: 'numeric', direction: 'maintain_range' });
    expect(response.status).toBe(400);
    expect(mockCreateKeyResult).not.toHaveBeenCalled();
  });

  it('maps MEASUREMENT_TYPE_NOT_IMPLEMENTED (OkrKeyResultValidationError) to 409', async () => {
    mockGetObjective.mockResolvedValue({ ...objectiveFixture(), keyResults: [] });
    mockCreateKeyResult.mockRejectedValue(
      new OkrKeyResultValidationError('not implemented', 'MEASUREMENT_TYPE_NOT_IMPLEMENTED', { measurementType: 'milestone' })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/objectives/${OBJECTIVE_ID}/key-results`)
      .send({ ownerUserId: 'user-owner', title: 'KR title', measurementType: 'milestone', direction: 'reach' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('MEASUREMENT_TYPE_NOT_IMPLEMENTED');
  });
});

// ==========================================
// GET /key-results/:keyResultId + PATCH + cancel
// ==========================================

describe('GET /key-results/:keyResultId — getKeyResult', () => {
  it('returns the KeyResult', async () => {
    mockGetKeyResult.mockResolvedValue(keyResultFixture());
    const response = await request(createApp()).get(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}`);
    expect(response.status).toBe(200);
    expect(response.body.keyResult.keyResultId).toBe(KEY_RESULT_ID);
  });

  it('404s when not found/visible', async () => {
    mockGetKeyResult.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}`);
    expect(response.status).toBe(404);
  });
});

describe('PATCH /key-results/:keyResultId — updateKeyResult', () => {
  it('404s when the KeyResult does not exist, without calling the command', async () => {
    mockGetKeyResult.mockResolvedValue(null);
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}`)
      .send({ expectedVersion: 1, currentValue: 7 });
    expect(response.status).toBe(404);
    expect(mockUpdateKeyResult).not.toHaveBeenCalled();
  });

  it('updates and returns the KeyResult', async () => {
    mockGetKeyResult.mockResolvedValue(keyResultFixture());
    mockUpdateKeyResult.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-kr-2',
      resultingVersion: 2,
      result: keyResultFixture({ currentValue: '7', progress: '0.7', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}`)
      .send({ expectedVersion: 1, currentValue: 7 });
    expect(response.status).toBe(200);
    expect(response.body.keyResult.currentValue).toBe('7');
  });

  it('rejects status="cancelled" via plain update (Zod excludes it — use the cancel route instead)', async () => {
    const response = await request(createApp())
      .patch(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}`)
      .send({ expectedVersion: 1, status: 'cancelled' });
    expect(response.status).toBe(400);
    expect(mockUpdateKeyResult).not.toHaveBeenCalled();
  });
});

describe('POST /key-results/:keyResultId/cancel — cancelKeyResult', () => {
  it('404s when the KeyResult does not exist, without calling the command', async () => {
    mockGetKeyResult.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
    expect(mockCancelKeyResult).not.toHaveBeenCalled();
  });

  it('cancels and returns the KeyResult', async () => {
    mockGetKeyResult.mockResolvedValue(keyResultFixture());
    mockCancelKeyResult.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-kr-3',
      resultingVersion: 2,
      result: keyResultFixture({ status: 'cancelled', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.keyResult.status).toBe('cancelled');
  });

  it('maps AtomicWriteAggregateNotFoundError to 404', async () => {
    mockGetKeyResult.mockResolvedValue(keyResultFixture());
    mockCancelKeyResult.mockRejectedValue(new AtomicWriteAggregateNotFoundError());
    const response = await request(createApp())
      .post(`/api/vnext/results/okr/key-results/${KEY_RESULT_ID}/cancel`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
  });
});

// ==========================================
// Mount-order sanity: /objectives/:objectiveId and /key-results/:keyResultId
// are single dynamic segments — a literal-path GET must not be swallowed.
// ==========================================

describe('Mount order — GET /objectives/:objectiveId and /key-results/:keyResultId are reachable without swallowing sibling routes', () => {
  it('GET /sets/:setId/objectives still resolves to the Set-scoped list route, not the single-Objective route', async () => {
    mockListObjectivesForSet.mockResolvedValue([]);
    const response = await request(createApp()).get(`/api/vnext/results/okr/sets/${SET_ID}/objectives`);
    expect(response.status).toBe(200);
    expect(mockListObjectivesForSet).toHaveBeenCalledTimes(1);
    expect(mockGetObjective).not.toHaveBeenCalled();
  });
});
