/** @vitest-environment node */

/**
 * KPI-E003 Deviation Closed Loop — HTTP layer route contract tests.
 *
 * Pattern precedent: `kpi.routes.test.ts` (this file's sibling) — supertest
 * against a minimal Express app, middleware (auth/rbac/demo/rate-limit)
 * replaced with passthroughs, the DOMAIN COMMAND/REPOSITORY layer mocked
 * (not the whole DB). The command layer itself already has real-Postgres
 * evidence (EXECUTION_LEDGER.md §20: unit tests + a realdb concurrency
 * test) — this file's job is the HTTP boundary `kpiDeviation.routes.ts`
 * itself owns: request validation, error->HTTP mapping, the
 * caseId/actionId cross-check plumbing, and the mount-order fix (both
 * routers mounted here, deviation-cases FIRST, exactly like Gateway.ts —
 * see kpiDeviation.routes.ts's own "MOUNT-ORDER NOTE").
 *
 * Error CLASSES (`DeviationSelfApprovalDeniedError`/`KpiDeviationValidationError`/
 * `AtomicWriteConflictError`/`AtomicWriteAggregateNotFoundError`) are kept
 * REAL via `importOriginal` in the command-module mocks below — only the
 * exported FUNCTIONS are replaced — so this file's `instanceof` checks in
 * `handleDeviationRouteError` are exercised against the exact same
 * prototypes the production code throws.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRecordMeasurement = vi.fn();
const mockGetKpi = vi.fn();

const mockGetDeviationCase = vi.fn();
const mockListDeviationCases = vi.fn();

const mockAcknowledgeDeviationCase = vi.fn();
const mockSubmitRootCause = vi.fn();
const mockSubmitPlan = vi.fn();
const mockApprovePlan = vi.fn();
const mockRecordRecoveryObservation = vi.fn();
const mockSubmitEffectivenessVerification = vi.fn();
const mockCloseDeviationCase = vi.fn();
const mockEscalateDeviationCase = vi.fn();
const mockDeescalateDeviationCase = vi.fn();
const mockReopenDeviationCase = vi.fn();

const mockAddCorrectiveAction = vi.fn();
const mockUpdateCorrectiveAction = vi.fn();

const mockDbQuery = vi.fn();
const mockDbRelease = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
// The Results strict membership wall is mounted on this router (see
// `requireActiveMembership` in kpi.routes.ts). Stubbed pass-through here for the
// SAME reason `verifyToken` and `requireOrgAccess` above are: this suite proves
// route logic, not authorization, and its DB is mocked with no
// `organization_members` row — the real wall would (correctly) answer 403 to
// every request. The wall's own contract is proven in
// `server/src/middleware/__tests__/resultsStrictMembership.middleware.test.ts`
// and end-to-end against a real server + real Postgres, not here.
vi.mock('../../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: () => void) => next(),
  MEMBERSHIP_REVOKED_CODE: 'ORG_MEMBERSHIP_REVOKED',
  MEMBERSHIP_UNVERIFIABLE_CODE: 'ORG_MEMBERSHIP_UNVERIFIABLE',
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
vi.mock('../../../database/PostgresDatabase.js', () => ({
  acquirePgClient: async () => ({ query: mockDbQuery, release: mockDbRelease }),
}));
// RN-G5: every write route now resolves an access context via
// resolveEffectiveAccess before calling its command — that function reads
// through queryHelpers.js's getDatabase() singleton, a DIFFERENT DB access
// path than the acquirePgClient mock above, so it is mocked directly here
// (same pattern server/src/routes/security/__tests__/roles.routes.test.ts
// already established for the same function). Defaults to the wildcard so
// every existing scenario in this file — which is testing the HTTP
// boundary, not authorization — keeps passing; the guard's own DENY path
// has dedicated coverage elsewhere (commandCapabilityGuard.test.ts, the
// RN-G5 real-Postgres security tests).
vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'], platformRole: null })),
  hasEffectiveCapability: (access: { capabilities: string[] }, capability: string) =>
    access.capabilities.includes('*') || access.capabilities.includes(capability),
}));

// kpi.routes.ts's own dependencies — mocked the same way kpi.routes.test.ts
// does, so mounting that router alongside this one (to exercise the
// "record measurement -> get deviation case" roundtrip) doesn't require a
// real DB either.
vi.mock('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js')
    >();
  return {
    ...actual,
    createKpiDraft: vi.fn(),
    editDraft: vi.fn(),
    submitDefinition: vi.fn(),
    approveDefinitionVersion: vi.fn(),
    rejectDefinitionVersion: vi.fn(),
    activateKpi: vi.fn(),
    suspendKpi: vi.fn(),
    archiveKpi: vi.fn(),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiMeasurementCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiMeasurementCommands.js')
    >();
  return {
    ...actual,
    recordMeasurement: (...args: unknown[]) => mockRecordMeasurement(...args),
    correctMeasurement: vi.fn(),
    verifyMeasurement: vi.fn(),
    disputeMeasurement: vi.fn(),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiRepository.js', () => ({
  getKpi: (...args: unknown[]) => mockGetKpi(...args),
  listKpis: vi.fn(),
  listMeasurements: vi.fn(),
}));

vi.mock('../../../services/resultsVnext/kpi/kpiDeviationCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiDeviationCommands.js')
    >();
  return {
    ...actual,
    acknowledgeDeviationCase: (...args: unknown[]) => mockAcknowledgeDeviationCase(...args),
    submitRootCause: (...args: unknown[]) => mockSubmitRootCause(...args),
    submitPlan: (...args: unknown[]) => mockSubmitPlan(...args),
    approvePlan: (...args: unknown[]) => mockApprovePlan(...args),
    recordRecoveryObservation: (...args: unknown[]) => mockRecordRecoveryObservation(...args),
    submitEffectivenessVerification: (...args: unknown[]) =>
      mockSubmitEffectivenessVerification(...args),
    closeDeviationCase: (...args: unknown[]) => mockCloseDeviationCase(...args),
    escalateDeviationCase: (...args: unknown[]) => mockEscalateDeviationCase(...args),
    deescalateDeviationCase: (...args: unknown[]) => mockDeescalateDeviationCase(...args),
    reopenDeviationCase: (...args: unknown[]) => mockReopenDeviationCase(...args),
  };
});
vi.mock('../../../services/resultsVnext/kpi/kpiCorrectiveActionCommands.js', () => ({
  addCorrectiveAction: (...args: unknown[]) => mockAddCorrectiveAction(...args),
  updateCorrectiveAction: (...args: unknown[]) => mockUpdateCorrectiveAction(...args),
}));
vi.mock('../../../services/resultsVnext/kpi/kpiDeviationRepository.js', () => ({
  getDeviationCase: (...args: unknown[]) => mockGetDeviationCase(...args),
  listDeviationCases: (...args: unknown[]) => mockListDeviationCases(...args),
}));

const { DeviationSelfApprovalDeniedError, KpiDeviationValidationError } = await import(
  '../../../services/resultsVnext/kpi/kpiDeviationCommands.js'
);
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } = await import(
  '../../../services/resultsVnext/platform/atomicWrite.js'
);

const kpiRoutes = (await import('../kpi.routes.js')).default;
const kpiDeviationRoutes = (await import('../kpiDeviation.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  // Same order as Gateway.ts — deviation-cases (more specific prefix)
  // registered BEFORE the shorter /api/vnext/results/kpi mount.
  app.use('/api/vnext/results/kpi/deviation-cases', kpiDeviationRoutes);
  app.use('/api/vnext/results/kpi', kpiRoutes);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const KPI_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const MEASUREMENT_ID = '33333333-3333-4333-8333-333333333333';
const CASE_ID = '44444444-4444-4444-8444-444444444444';
const ACTION_ID = '55555555-5555-4555-8555-555555555555';
const VERIFICATION_ID = '66666666-6666-4666-8666-666666666666';
const RECOVERY_MEASUREMENT_ID = '77777777-7777-4777-8777-777777777777';

function kpiFixture(overrides: Record<string, unknown> = {}) {
  return {
    kpiId: KPI_ID,
    organizationId: 'org-1',
    kpiCode: 'NPS',
    status: 'active',
    currentDefinitionVersionId: VERSION_ID,
    primaryProcessId: null,
    responsePolicyId: null,
    ownerUserId: 'user-1',
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function definitionVersionRowFixture(overrides: Record<string, unknown> = {}) {
  return {
    definition_version_id: VERSION_ID,
    kpi_id: KPI_ID,
    organization_id: 'org-1',
    version_number: 1,
    name: 'Customer NPS',
    description: null,
    unit: null,
    target_geometry: 'threshold_min',
    target_value: '80',
    target_min: null,
    target_max: null,
    warning_low: '70',
    warning_high: null,
    critical_low: null,
    critical_high: null,
    binary_success_value: null,
    formula_text: null,
    approval_status: 'approved',
    effective_from: null,
    effective_to: null,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    submitted_by: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    row_version: 1,
    ...overrides,
  };
}

function measurementFixture(overrides: Record<string, unknown> = {}) {
  return {
    measurementId: MEASUREMENT_ID,
    kpiId: KPI_ID,
    definitionVersionId: VERSION_ID,
    organizationId: 'org-1',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-01-31T00:00:00.000Z',
    actualValue: 20,
    performanceStatus: 'critical',
    dataQualityStatus: 'unverified',
    correctionOfMeasurementId: null,
    correctionReason: null,
    source: 'manual',
    evidenceRefs: [],
    notes: null,
    recordedBy: 'user-1',
    recordedAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  };
}

function deviationCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    kpiId: KPI_ID,
    triggerMeasurementId: MEASUREMENT_ID,
    severity: 'critical',
    status: 'open',
    escalated: false,
    escalatedAt: null,
    escalatedReason: null,
    escalatedBy: null,
    ownerUserId: 'user-1',
    managerUserId: null,
    detectedAt: '2026-01-31T00:00:00.000Z',
    responseDueAt: '2026-02-02T00:00:00.000Z',
    rootCauseSummary: null,
    rootCauseCategory: null,
    recurrenceFlag: false,
    expectedRecoveryDate: null,
    expectedRecoveryValue: null,
    planSubmittedBy: null,
    planSubmittedAt: null,
    planApprovedBy: null,
    planApprovedAt: null,
    recoveryObservedBy: null,
    recoveryObservedAt: null,
    recoveryObservationMeasurementId: null,
    closedAt: null,
    closedBy: null,
    closeEffectivenessVerificationId: null,
    reopenedFromCaseId: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-31T00:00:00.000Z',
    updatedAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  };
}

function correctiveActionFixture(overrides: Record<string, unknown> = {}) {
  return {
    actionId: ACTION_ID,
    deviationCaseId: CASE_ID,
    organizationId: 'org-1',
    title: 'Retrain the pipeline',
    description: null,
    ownerUserId: 'user-2',
    dueDate: null,
    status: 'planned',
    expectedEffect: null,
    actualEffect: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-31T00:00:00.000Z',
    updatedAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  };
}

function correctiveActionRowFixture(overrides: Record<string, unknown> = {}) {
  return {
    action_id: ACTION_ID,
    deviation_case_id: CASE_ID,
    organization_id: 'org-1',
    title: 'Retrain the pipeline',
    description: null,
    owner_user_id: 'user-2',
    due_date: null,
    status: 'planned',
    expected_effect: null,
    actual_effect: null,
    row_version: 1,
    created_by: 'user-1',
    created_at: '2026-01-31T00:00:00.000Z',
    updated_at: '2026-01-31T00:00:00.000Z',
    ...overrides,
  };
}

function effectivenessVerificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    verificationId: VERIFICATION_ID,
    deviationCaseId: CASE_ID,
    organizationId: 'org-1',
    verificationWindowStart: '2026-02-01T00:00:00.000Z',
    verificationWindowEnd: '2026-02-15T00:00:00.000Z',
    status: 'effective',
    rationale: 'Recovered above target for two consecutive periods',
    verifiedBy: 'user-1',
    verifiedAt: '2026-02-16T00:00:00.000Z',
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-02-16T00:00:00.000Z',
    measurementIds: [],
    ...overrides,
  };
}

/** Wires `mockDbQuery` for kpi.routes.ts's own `loadDefinitionVersionRow`/
 * `loadMeasurementRow` AND kpiDeviation.routes.ts's own
 * `loadCorrectiveActionRow` — same dispatch-by-SQL-substring shape as
 * kpi.routes.test.ts's `configureDb`. */
function configureDb(options: {
  versionRow?: Record<string, unknown> | null;
  measurementRow?: Record<string, unknown> | null;
  correctiveActionRow?: Record<string, unknown> | null;
}): void {
  mockDbQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM rvn_kpi_definition_versions')) {
      return options.versionRow
        ? { rows: [options.versionRow], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM rvn_kpi_corrective_actions')) {
      return options.correctiveActionRow
        ? { rows: [options.correctiveActionRow], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM rvn_kpi_measurements')) {
      return options.measurementRow
        ? { rows: [options.measurementRow], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  configureDb({ versionRow: definitionVersionRowFixture(), measurementRow: null });
});

// ==========================================
// create case (via POST .../measurements side effect) -> get roundtrip
// ==========================================

describe('POST .../measurements (kpi.routes.ts) + GET .../deviation-cases/:caseId — roundtrip', () => {
  it('records a critical measurement, then the resulting case is fetchable by id', async () => {
    mockGetKpi.mockResolvedValue(kpiFixture());
    mockRecordMeasurement.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: measurementFixture(),
    });

    const measurementResponse = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements`)
      .send({
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        actualValue: 20,
        source: 'manual',
      });
    expect(measurementResponse.status).toBe(201);
    expect(mockRecordMeasurement).toHaveBeenCalledTimes(1);
    expect(mockRecordMeasurement.mock.calls[0][0].performanceStatus).toBe('critical');

    // openOrEscalateDeviationCase runs INSIDE recordMeasurement's own
    // transaction (design decision #3) — mocked away above, so this
    // fixture stands in for "the case that write would have opened".
    mockGetDeviationCase.mockResolvedValue(deviationCaseFixture());

    const caseResponse = await request(createApp()).get(
      `/api/vnext/results/kpi/deviation-cases/${CASE_ID}`
    );
    expect(caseResponse.status).toBe(200);
    expect(caseResponse.body.case.caseId).toBe(CASE_ID);
    expect(caseResponse.body.case.kpiId).toBe(KPI_ID);
    expect(caseResponse.body.case.status).toBe('open');
    expect(mockGetDeviationCase).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      caseId: CASE_ID,
    });
  });

  it('404s GET for a case the repository does not return (not found / not visible)', async () => {
    mockGetDeviationCase.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/kpi/deviation-cases/${CASE_ID}`
    );
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s GET for a non-UUID caseId (Zod validation) instead of falling through to kpi.routes.ts', async () => {
    const response = await request(createApp()).get(
      '/api/vnext/results/kpi/deviation-cases/not-a-uuid'
    );
    expect(response.status).toBe(400);
    expect(mockGetDeviationCase).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET (list) — mount-order regression guard
// ==========================================

describe('GET /api/vnext/results/kpi/deviation-cases — listDeviationCases', () => {
  it('resolves via THIS router, not kpi.routes.ts GET /:kpiId (mount-order fix)', async () => {
    mockListDeviationCases.mockResolvedValue([deviationCaseFixture()]);
    const response = await request(createApp()).get('/api/vnext/results/kpi/deviation-cases');
    expect(response.status).toBe(200);
    expect(response.body.cases).toHaveLength(1);
    expect(mockGetKpi).not.toHaveBeenCalled();
    expect(mockListDeviationCases).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1' })
    );
  });

  it('passes query filters through to the repository', async () => {
    mockListDeviationCases.mockResolvedValue([]);
    await request(createApp())
      .get('/api/vnext/results/kpi/deviation-cases')
      .query({ kpiId: KPI_ID, status: 'open', escalatedOnly: 'true', limit: '10', offset: '5' });
    expect(mockListDeviationCases).toHaveBeenCalledWith(
      expect.objectContaining({
        kpiId: KPI_ID,
        status: 'open',
        escalatedOnly: true,
        limit: 10,
        offset: 5,
      })
    );
  });
});

// ==========================================
// acknowledge -> root-cause -> corrective-action -> plan submit/approve
// (happy path)
// ==========================================

describe('acknowledge -> root-cause -> corrective-action -> plan submit/approve', () => {
  it('walks the full state machine to "approved"', async () => {
    mockAcknowledgeDeviationCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-ack',
      resultingVersion: 2,
      result: deviationCaseFixture({ status: 'analysis_required', rowVersion: 2 }),
    });
    const ackResponse = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/acknowledge`)
      .send({ expectedVersion: 1 });
    expect(ackResponse.status).toBe(200);
    expect(ackResponse.body.case.status).toBe('analysis_required');
    expect(mockAcknowledgeDeviationCase).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, expectedVersion: 1, actorUserId: 'user-1' })
    );

    mockSubmitRootCause.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-rc',
      resultingVersion: 3,
      result: deviationCaseFixture({
        status: 'plan_required',
        rowVersion: 3,
        rootCauseSummary: 'Upstream feed dropped rows',
        rootCauseCategory: 'data_quality',
      }),
    });
    const rootCauseResponse = await request(createApp())
      .put(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/root-cause`)
      .send({
        expectedVersion: 2,
        rootCauseSummary: 'Upstream feed dropped rows',
        rootCauseCategory: 'data_quality',
      });
    expect(rootCauseResponse.status).toBe(200);
    expect(rootCauseResponse.body.case.status).toBe('plan_required');
    expect(mockSubmitRootCause.mock.calls[0][0]).toMatchObject({
      caseId: CASE_ID,
      expectedVersion: 2,
      rootCauseSummary: 'Upstream feed dropped rows',
      rootCauseCategory: 'data_quality',
    });

    mockAddCorrectiveAction.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-action',
      resultingVersion: 1,
      result: correctiveActionFixture(),
    });
    const addActionResponse = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions`)
      .send({ title: 'Retrain the pipeline', ownerUserId: 'user-2' });
    expect(addActionResponse.status).toBe(201);
    expect(addActionResponse.body.action.actionId).toBe(ACTION_ID);
    expect(mockAddCorrectiveAction.mock.calls[0][0]).toMatchObject({
      deviationCaseId: CASE_ID,
      title: 'Retrain the pipeline',
      ownerUserId: 'user-2',
    });

    mockSubmitPlan.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-plan',
      resultingVersion: 4,
      result: deviationCaseFixture({ status: 'plan_submitted', rowVersion: 4 }),
    });
    const submitPlanResponse = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/plan/submit`)
      .send({ expectedVersion: 3 });
    expect(submitPlanResponse.status).toBe(200);
    expect(submitPlanResponse.body.case.status).toBe('plan_submitted');

    mockApprovePlan.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-approve',
      resultingVersion: 5,
      result: deviationCaseFixture({ status: 'approved', rowVersion: 5 }),
    });
    const approvePlanResponse = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/plan/approve`)
      .send({ expectedVersion: 4 });
    expect(approvePlanResponse.status).toBe(200);
    expect(approvePlanResponse.body.case.status).toBe('approved');
    expect(mockApprovePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: CASE_ID,
        expectedVersion: 4,
        approverId: 'user-1',
        actorUserId: 'user-1',
      })
    );
  });
});

// ==========================================
// PATCH corrective-actions/:actionId — cross-case check
// ==========================================

describe('PATCH .../corrective-actions/:actionId', () => {
  it('updates the action when it belongs to the case in the URL', async () => {
    configureDb({
      versionRow: definitionVersionRowFixture(),
      correctiveActionRow: correctiveActionRowFixture(),
    });
    mockUpdateCorrectiveAction.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-update-action',
      resultingVersion: 2,
      result: {
        action: correctiveActionFixture({ status: 'active', rowVersion: 2 }),
        caseAutoTransitionedToExecuting: true,
      },
    });

    const response = await request(createApp())
      .patch(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions/${ACTION_ID}`)
      .send({ expectedVersion: 1, status: 'active' });

    expect(response.status).toBe(200);
    expect(response.body.action.status).toBe('active');
    expect(response.body.caseAutoTransitionedToExecuting).toBe(true);
    expect(mockUpdateCorrectiveAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: ACTION_ID, expectedVersion: 1, status: 'active' })
    );
  });

  it('404s when the actionId does not belong to the caseId in the URL', async () => {
    configureDb({
      versionRow: definitionVersionRowFixture(),
      correctiveActionRow: correctiveActionRowFixture({ deviation_case_id: 'some-other-case' }),
    });

    const response = await request(createApp())
      .patch(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions/${ACTION_ID}`)
      .send({ expectedVersion: 1, status: 'active' });

    expect(response.status).toBe(404);
    expect(mockUpdateCorrectiveAction).not.toHaveBeenCalled();
  });
});

// ==========================================
// recovery-observation / effectiveness-verifications
// ==========================================

describe('POST .../recovery-observation and .../effectiveness-verifications', () => {
  it('records a recovery observation', async () => {
    mockRecordRecoveryObservation.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-recovery',
      resultingVersion: 6,
      result: deviationCaseFixture({
        status: 'recovery_observed',
        rowVersion: 6,
        recoveryObservationMeasurementId: RECOVERY_MEASUREMENT_ID,
      }),
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/recovery-observation`)
      .send({ expectedVersion: 5, recoveryObservationMeasurementId: RECOVERY_MEASUREMENT_ID });

    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('recovery_observed');
    expect(mockRecordRecoveryObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: CASE_ID,
        recoveryObservationMeasurementId: RECOVERY_MEASUREMENT_ID,
      })
    );
  });

  it('submits an effective verification and returns both case and verification', async () => {
    mockSubmitEffectivenessVerification.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-verify',
      resultingVersion: 7,
      result: {
        case: deviationCaseFixture({ status: 'verification', rowVersion: 7 }),
        verification: effectivenessVerificationFixture(),
      },
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/effectiveness-verifications`)
      .send({
        expectedVersion: 6,
        verificationWindowStart: '2026-02-01T00:00:00.000Z',
        verificationWindowEnd: '2026-02-15T00:00:00.000Z',
        outcome: 'effective',
      });

    expect(response.status).toBe(201);
    expect(response.body.case.status).toBe('verification');
    expect(response.body.verification.verificationId).toBe(VERIFICATION_ID);
  });
});

// ==========================================
// close bez effectiveness verification -> 409
// ==========================================

describe('POST .../close — effectiveness not verified', () => {
  it('returns 409 EFFECTIVENESS_NOT_VERIFIED when the command rejects the close', async () => {
    mockCloseDeviationCase.mockRejectedValue(
      new KpiDeviationValidationError(
        `Case ${CASE_ID} cannot close: no EffectivenessVerification with an accepted outcome`,
        'EFFECTIVENESS_NOT_VERIFIED',
        { caseId: CASE_ID, latestVerificationStatus: null }
      )
    );

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/close`)
      .send({ expectedVersion: 6 });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EFFECTIVENESS_NOT_VERIFIED');
    expect(mockCloseDeviationCase).toHaveBeenCalledTimes(1);
  });

  it('closes successfully once the command reports "verification" satisfied', async () => {
    mockCloseDeviationCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-close',
      resultingVersion: 8,
      result: deviationCaseFixture({ status: 'closed', rowVersion: 8 }),
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/close`)
      .send({ expectedVersion: 7 });

    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('closed');
  });
});

// ==========================================
// self-approval denial on plan approve -> 403
// ==========================================

describe('POST .../plan/approve — self-approval denial', () => {
  it('returns 403 with code SELF_APPROVAL_DENIED when the command rejects self-approval', async () => {
    mockApprovePlan.mockRejectedValue(
      new DeviationSelfApprovalDeniedError(CASE_ID, 'user-1', 'plan_submitted_by')
    );

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/plan/approve`)
      .send({ expectedVersion: 4 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_APPROVAL_DENIED');
    expect(mockApprovePlan).toHaveBeenCalledTimes(1);
  });
});

// ==========================================
// STALE_VERSION -> 409 / aggregate not found -> 404
// ==========================================

describe('optimistic-concurrency and not-found error mapping', () => {
  it('returns 409 STALE_VERSION when the command reports an optimistic-concurrency conflict', async () => {
    mockAcknowledgeDeviationCase.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 3,
        expectedVersion: 1,
      })
    );

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/acknowledge`)
      .send({ expectedVersion: 1 });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
    expect(response.body.currentVersion).toBe(3);
  });

  it('returns 404 when the command reports the aggregate does not exist', async () => {
    mockAcknowledgeDeviationCase.mockRejectedValue(new AtomicWriteAggregateNotFoundError());

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/acknowledge`)
      .send({ expectedVersion: 1 });

    expect(response.status).toBe(404);
  });
});

// ==========================================
// escalate / deescalate / reopen
// ==========================================

describe('POST .../escalate, .../deescalate, .../reopen', () => {
  it('escalates the overlay flag without changing case status', async () => {
    mockEscalateDeviationCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-escalate',
      resultingVersion: 2,
      result: deviationCaseFixture({ escalated: true, escalatedReason: 'SLA breach imminent' }),
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/escalate`)
      .send({ expectedVersion: 1, escalatedReason: 'SLA breach imminent' });

    expect(response.status).toBe(200);
    expect(response.body.case.escalated).toBe(true);
    expect(mockEscalateDeviationCase).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, escalatedReason: 'SLA breach imminent' })
    );
  });

  it('deescalates the overlay flag', async () => {
    mockDeescalateDeviationCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-deescalate',
      resultingVersion: 3,
      result: deviationCaseFixture({ escalated: false }),
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/deescalate`)
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(200);
    expect(response.body.case.escalated).toBe(false);
    expect(mockDeescalateDeviationCase).toHaveBeenCalledTimes(1);
  });

  it('reopens a closed case as a NEW row (executeAtomicCreate — no expectedVersion in the body)', async () => {
    const NEW_CASE_ID = '88888888-8888-4888-8888-888888888888';
    mockReopenDeviationCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-reopen',
      resultingVersion: 1,
      result: deviationCaseFixture({
        caseId: NEW_CASE_ID,
        status: 'open',
        rowVersion: 1,
        reopenedFromCaseId: CASE_ID,
      }),
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/reopen`)
      .send({ reason: 'Recurred within a week' });

    expect(response.status).toBe(201);
    expect(response.body.case.caseId).toBe(NEW_CASE_ID);
    expect(response.body.case.reopenedFromCaseId).toBe(CASE_ID);
    expect(mockReopenDeviationCase).toHaveBeenCalledWith(
      expect.objectContaining({ priorCaseId: CASE_ID })
    );
  });
});

// ==========================================
// Zod validation (400s before the command layer is ever called)
// ==========================================

describe('request-shape validation', () => {
  it('400s acknowledge when expectedVersion is missing', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/acknowledge`)
      .send({});
    expect(response.status).toBe(400);
    expect(mockAcknowledgeDeviationCase).not.toHaveBeenCalled();
  });

  it('400s addCorrectiveAction when required fields are missing', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions`)
      .send({ title: 'Missing owner' });
    expect(response.status).toBe(400);
    expect(mockAddCorrectiveAction).not.toHaveBeenCalled();
  });

  it('400s recovery-observation when recoveryObservationMeasurementId is not a UUID', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/deviation-cases/${CASE_ID}/recovery-observation`)
      .send({ expectedVersion: 5, recoveryObservationMeasurementId: 'not-a-uuid' });
    expect(response.status).toBe(400);
    expect(mockRecordRecoveryObservation).not.toHaveBeenCalled();
  });
});
