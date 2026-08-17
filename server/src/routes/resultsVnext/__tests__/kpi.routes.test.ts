/** @vitest-environment node */

/**
 * KPI-E001/E002 API layer — route contract tests.
 *
 * Pattern precedent: `server/src/routes/__tests__/workbook-commands.routes.test.ts`
 * — supertest against a minimal Express app, middleware (auth/rbac/demo/
 * rate-limit) replaced with passthroughs, the DOMAIN SERVICE layer mocked
 * (not the whole DB). This file follows the same division: the command/
 * repository functions in `kpiDefinitionCommands.ts`/`kpiMeasurementCommands.ts`/
 * `kpiRepository.ts` already have their own real-Postgres evidence
 * (EXECUTION_LEDGER.md §15/§17) and command-level unit coverage
 * (`tests/resultsVnext/kpi/approveDefinitionVersion.test.ts`) — this file's
 * job is the HTTP boundary this task added: request validation, error->HTTP
 * mapping, and the kpiId->definitionVersionId / performanceStatus-evaluation
 * plumbing `kpi.routes.ts` itself owns. Error CLASSES
 * (`SelfApprovalDeniedError`/`AtomicWriteConflictError`/etc.) are kept REAL
 * via `importOriginal` in the command-module mocks below — only the
 * functions are replaced — so this file's `instanceof` checks in
 * `handleKpiRouteError` are exercised against the exact same prototypes the
 * production code throws, not a parallel fake.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateKpiDraft = vi.fn();
const mockEditDraft = vi.fn();
const mockSubmitDefinition = vi.fn();
const mockApproveDefinitionVersion = vi.fn();
const mockRejectDefinitionVersion = vi.fn();
const mockActivateKpi = vi.fn();
const mockSuspendKpi = vi.fn();
const mockArchiveKpi = vi.fn();

const mockRecordMeasurement = vi.fn();
const mockCorrectMeasurement = vi.fn();
const mockVerifyMeasurement = vi.fn();
const mockDisputeMeasurement = vi.fn();

const mockGetKpi = vi.fn();
const mockGetKpiCurrentDefinitionVersion = vi.fn();
const mockListKpis = vi.fn();
const mockListMeasurements = vi.fn();

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
// RN-G5: see kpiDeviation.routes.test.ts's identical mock for the full
// rationale — resolveEffectiveAccess reads through a different DB access
// path (queryHelpers.js's getDatabase()) than the acquirePgClient mock
// above, so it needs its own mock. Defaults to the wildcard so every
// existing HTTP-boundary scenario in this file keeps passing.
vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'], platformRole: null })),
  hasEffectiveCapability: (access: { capabilities: string[] }, capability: string) =>
    access.capabilities.includes('*') || access.capabilities.includes(capability),
}));

vi.mock('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js')
    >();
  return {
    ...actual,
    createKpiDraft: (...args: unknown[]) => mockCreateKpiDraft(...args),
    editDraft: (...args: unknown[]) => mockEditDraft(...args),
    submitDefinition: (...args: unknown[]) => mockSubmitDefinition(...args),
    approveDefinitionVersion: (...args: unknown[]) => mockApproveDefinitionVersion(...args),
    rejectDefinitionVersion: (...args: unknown[]) => mockRejectDefinitionVersion(...args),
    activateKpi: (...args: unknown[]) => mockActivateKpi(...args),
    suspendKpi: (...args: unknown[]) => mockSuspendKpi(...args),
    archiveKpi: (...args: unknown[]) => mockArchiveKpi(...args),
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
    correctMeasurement: (...args: unknown[]) => mockCorrectMeasurement(...args),
    verifyMeasurement: (...args: unknown[]) => mockVerifyMeasurement(...args),
    disputeMeasurement: (...args: unknown[]) => mockDisputeMeasurement(...args),
  };
});

vi.mock('../../../services/resultsVnext/kpi/kpiRepository.js', () => ({
  getKpi: (...args: unknown[]) => mockGetKpi(...args),
  getKpiCurrentDefinitionVersion: (...args: unknown[]) => mockGetKpiCurrentDefinitionVersion(...args),
  listKpis: (...args: unknown[]) => mockListKpis(...args),
  listMeasurements: (...args: unknown[]) => mockListMeasurements(...args),
}));

const { SelfApprovalDeniedError, KpiDefinitionValidationError } =
  await import('../../../services/resultsVnext/kpi/kpiDefinitionCommands.js');
const { AtomicWriteConflictError, AtomicWriteAggregateNotFoundError } =
  await import('../../../services/resultsVnext/platform/atomicWrite.js');

const kpiRoutes = (await import('../kpi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/kpi', kpiRoutes);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const KPI_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const MEASUREMENT_ID = '33333333-3333-4333-8333-333333333333';

function kpiFixture(overrides: Record<string, unknown> = {}) {
  return {
    kpiId: KPI_ID,
    organizationId: 'org-1',
    kpiCode: 'NPS',
    status: 'draft',
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
    approval_status: 'draft',
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
    actualValue: 85,
    performanceStatus: 'on_target',
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

/** Wires `mockDbQuery` for the routes file's own `loadDefinitionVersionRow`/
 * `loadMeasurementRow` helpers (approve/reject/measurements endpoints). */
function configureDb(options: {
  versionRow?: Record<string, unknown> | null;
  measurementRow?: Record<string, unknown> | null;
}): void {
  mockDbQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM rvn_kpi_definition_versions')) {
      return options.versionRow
        ? { rows: [options.versionRow], rowCount: 1 }
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
// create -> get roundtrip
// ==========================================

describe('POST /api/vnext/results/kpi + GET /:kpiId — create -> get roundtrip', () => {
  it('creates a KPI draft and the same id is fetchable via GET', async () => {
    const kpi = kpiFixture();
    const definitionVersion = {
      definitionVersionId: VERSION_ID,
      kpiId: KPI_ID,
      name: 'Customer NPS',
    };
    mockCreateKpiDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { kpi, definitionVersion },
    });
    mockGetKpi.mockResolvedValue(kpi);

    const createResponse = await request(createApp()).post('/api/vnext/results/kpi').send({
      kpiCode: 'NPS',
      name: 'Customer NPS',
      targetGeometry: 'threshold_min',
      targetValue: 80,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.kpi.kpiId).toBe(KPI_ID);
    expect(mockCreateKpiDraft).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateKpiDraft.mock.calls[0][0];
    expect(createArgs.organizationId).toBe('org-1');
    expect(createArgs.createdBy).toBe('user-1');
    // Server-generated idempotency key (task requirement #4) — none was
    // supplied in the request body above.
    expect(typeof createArgs.idempotencyKey).toBe('string');
    expect(createArgs.idempotencyKey.length).toBeGreaterThan(0);

    const getResponse = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.kpi.kpiId).toBe(KPI_ID);
    expect(mockGetKpi).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      kpiId: KPI_ID,
    });
  });

  it('honors a client-supplied idempotencyKey instead of generating one', async () => {
    mockCreateKpiDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { kpi: kpiFixture(), definitionVersion: {} },
    });

    await request(createApp()).post('/api/vnext/results/kpi').send({
      kpiCode: 'NPS',
      name: 'Customer NPS',
      targetGeometry: 'threshold_min',
      targetValue: 80,
      idempotencyKey: 'client-key-1',
    });

    expect(mockCreateKpiDraft.mock.calls[0][0].idempotencyKey).toBe('client-key-1');
  });

  it('404s GET for a KPI the repository does not return (not found / not visible)', async () => {
    mockGetKpi.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('400s create when required fields are missing (Zod validation)', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/kpi')
      .send({ kpiCode: 'NPS' });
    expect(response.status).toBe(400);
    expect(mockCreateKpiDraft).not.toHaveBeenCalled();
  });
});

// ==========================================
// RN-G6 P0 fix (F1B) — GET /:kpiId/version (maker-checker unblock)
// ==========================================

describe('GET /api/vnext/results/kpi/:kpiId/version — getKpiCurrentDefinitionVersion (F1B)', () => {
  it('returns the current definition version for a visible KPI (the read a second reviewer needs)', async () => {
    const version = {
      definitionVersionId: VERSION_ID,
      kpiId: KPI_ID,
      name: 'Customer NPS',
      unit: null,
      targetGeometry: 'threshold_min',
      approvalStatus: 'submitted',
      rowVersion: 2,
    };
    mockGetKpiCurrentDefinitionVersion.mockResolvedValue(version);

    const response = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}/version`);

    expect(response.status).toBe(200);
    expect(response.body.definitionVersion).toEqual(version);
    expect(mockGetKpiCurrentDefinitionVersion).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      kpiId: KPI_ID,
    });
  });

  it('returns a GENERIC 404 (D06) when the repository returns null — covers BOTH "does not exist" and "not visible to this actor", indistinguishably', async () => {
    mockGetKpiCurrentDefinitionVersion.mockResolvedValue(null);

    const response = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}/version`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    // The denial must not leak WHY — no distinct "forbidden" vs "not found"
    // signal, same contract GET /:kpiId already has (see the roundtrip
    // describe block above).
    expect(response.body.error).not.toMatch(/forbidden|denied|visib/i);
  });

  it('propagates a repository error through the same error mapper as every other KPI route (no bespoke handling)', async () => {
    mockGetKpiCurrentDefinitionVersion.mockRejectedValue(new Error('db exploded'));

    const response = await request(createApp()).get(`/api/vnext/results/kpi/${KPI_ID}/version`);

    expect(response.status).toBe(500);
  });
});

// ==========================================
// RN-G6 P0 fix (F1) — X-Correlation-ID validation
// ==========================================
//
// Root cause: the OLD client generator produced a non-UUID token that used
// to flow straight through to the command layer and on into a Postgres
// `UUID NOT NULL` column, crashing every write with a 500. `getCorrelationId`
// (server/src/routes/resultsVnext/correlationId.ts) now validates UUID shape
// and resolves to `undefined` for anything else, letting the EXISTING
// `correlationId ?? randomUUID()` fallback already inside every resultsVnext
// command function (e.g. kpiDefinitionCommands.ts) mint a fresh one instead
// — this file tests the boundary (what the command function RECEIVES), not
// that downstream fallback itself (that's covered by the command's own
// existing tests).

describe('X-Correlation-ID validation (RN-G6 P0 fix — F1)', () => {
  beforeEach(() => {
    mockCreateKpiDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { kpi: kpiFixture(), definitionVersion: {} },
    });
  });

  const createBody = {
    kpiCode: 'NPS',
    name: 'Customer NPS',
    targetGeometry: 'threshold_min',
    targetValue: 80,
  };

  it('rejects a non-UUID X-Correlation-ID header — the command layer receives undefined, NEVER the malformed value (this is the exact shape the old client bug produced)', async () => {
    const oldBuggyValue =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    await request(createApp())
      .post('/api/vnext/results/kpi')
      .set('X-Correlation-ID', oldBuggyValue)
      .send(createBody);

    expect(mockCreateKpiDraft).toHaveBeenCalledTimes(1);
    const args = mockCreateKpiDraft.mock.calls[0][0];
    expect(args.correlationId).toBeUndefined();
  });

  it('passes through a well-formed UUID header unchanged', async () => {
    const validUuid = '4d60dfca-1111-4aaa-8bbb-000000000001';

    await request(createApp())
      .post('/api/vnext/results/kpi')
      .set('X-Correlation-ID', validUuid)
      .send(createBody);

    expect(mockCreateKpiDraft.mock.calls[0][0].correlationId).toBe(validUuid);
  });

  it('resolves to undefined (letting the command layer mint its own) when no header is sent at all', async () => {
    await request(createApp()).post('/api/vnext/results/kpi').send(createBody);

    expect(mockCreateKpiDraft.mock.calls[0][0].correlationId).toBeUndefined();
  });

  it('rejects an empty-string header the same way as a malformed one', async () => {
    await request(createApp())
      .post('/api/vnext/results/kpi')
      .set('X-Correlation-ID', '')
      .send(createBody);

    expect(mockCreateKpiDraft.mock.calls[0][0].correlationId).toBeUndefined();
  });

  it('rejects a header that is merely alphanumeric-safe but not UUID-shaped (the apiLoggingMiddleware sanitizer alone would accept this — this route must not)', async () => {
    // Matches apiLogging.middleware.ts's SAFE_CORRELATION_ID
    // (`/^[A-Za-z0-9._~-]+$/`) — proves this route's validation is a STRICTER,
    // independent check, not a rename of that sanitizer.
    await request(createApp())
      .post('/api/vnext/results/kpi')
      .set('X-Correlation-ID', 'safe-but-not-a-uuid-123')
      .send(createBody);

    expect(mockCreateKpiDraft.mock.calls[0][0].correlationId).toBeUndefined();
  });
});

// ==========================================
// self-approval denial -> 403
// ==========================================

describe('POST .../definition-versions/:versionId/approve — self-approval denial', () => {
  it('returns 403 with code SELF_APPROVAL_DENIED when the command rejects self-approval', async () => {
    mockApproveDefinitionVersion.mockRejectedValue(
      new SelfApprovalDeniedError(VERSION_ID, 'user-1', 'submitted_by')
    );

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/definition-versions/${VERSION_ID}/approve`)
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_APPROVAL_DENIED');
    expect(mockApproveDefinitionVersion).toHaveBeenCalledTimes(1);
  });

  it('404s when the versionId in the URL does not belong to the kpiId in the URL', async () => {
    configureDb({ versionRow: definitionVersionRowFixture({ kpi_id: 'some-other-kpi' }) });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/definition-versions/${VERSION_ID}/approve`)
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(404);
    expect(mockApproveDefinitionVersion).not.toHaveBeenCalled();
  });
});

// ==========================================
// STALE_VERSION -> 409
// ==========================================

describe('POST .../activate — STALE_VERSION conflict', () => {
  it('returns 409 with code STALE_VERSION when the command reports an optimistic-concurrency conflict', async () => {
    mockActivateKpi.mockRejectedValue(
      new AtomicWriteConflictError(
        'Aggregate was modified since it was last read',
        'STALE_VERSION',
        {
          currentVersion: 3,
          expectedVersion: 1,
        }
      )
    );

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/activate`)
      .send({ expectedVersion: 1 });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
    expect(response.body.currentVersion).toBe(3);
  });

  it('returns 404 when the command reports the aggregate does not exist', async () => {
    mockActivateKpi.mockRejectedValue(new AtomicWriteAggregateNotFoundError());
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(404);
  });

  it('maps an invalid-transition domain error to 409 (DEVIATION note: no DefinitionVersionNotSubmittedError exists)', async () => {
    mockActivateKpi.mockRejectedValue(
      new KpiDefinitionValidationError('no approved version', 'NO_APPROVED_VERSION', {
        kpiId: KPI_ID,
      })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/activate`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NO_APPROVED_VERSION');
  });
});

// ==========================================
// measurement record -> list roundtrip
// ==========================================

describe('POST .../measurements + GET .../measurements — record -> list roundtrip', () => {
  it('evaluates performanceStatus server-side from the definition version bounds and records the measurement', async () => {
    mockGetKpi.mockResolvedValue(kpiFixture());
    configureDb({ versionRow: definitionVersionRowFixture(), measurementRow: null });
    const recorded = measurementFixture({ actualValue: 85, performanceStatus: 'on_target' });
    mockRecordMeasurement.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 1,
      result: recorded,
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements`)
      .send({
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        actualValue: 85,
        source: 'manual',
      });

    expect(response.status).toBe(201);
    expect(mockRecordMeasurement).toHaveBeenCalledTimes(1);
    const recordArgs = mockRecordMeasurement.mock.calls[0][0];
    // threshold_min geometry, targetValue=80, actualValue=85 -> on_target
    // (evaluatePerformanceStatus, computed by the route, not the client).
    expect(recordArgs.performanceStatus).toBe('on_target');
    expect(recordArgs.kpiId).toBe(KPI_ID);
    expect(recordArgs.definitionVersionId).toBe(VERSION_ID);

    mockListMeasurements.mockResolvedValue([recorded]);
    const listResponse = await request(createApp()).get(
      `/api/vnext/results/kpi/${KPI_ID}/measurements`
    );
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.measurements).toHaveLength(1);
    expect(listResponse.body.measurements[0].measurementId).toBe(MEASUREMENT_ID);
    expect(mockListMeasurements).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', organizationId: 'org-1', kpiId: KPI_ID })
    );
  });

  it('evaluates a below-warning-band actual value as critical (threshold_min, no warning match)', async () => {
    mockGetKpi.mockResolvedValue(kpiFixture());
    configureDb({ versionRow: definitionVersionRowFixture(), measurementRow: null });
    mockRecordMeasurement.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 1,
      result: measurementFixture({ actualValue: 50, performanceStatus: 'critical' }),
    });

    await request(createApp()).post(`/api/vnext/results/kpi/${KPI_ID}/measurements`).send({
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T00:00:00.000Z',
      actualValue: 50, // below warningLow=70 -> critical
      source: 'manual',
    });

    expect(mockRecordMeasurement.mock.calls[0][0].performanceStatus).toBe('critical');
  });

  it('404s when the KPI has no current definition version and none is supplied', async () => {
    mockGetKpi.mockResolvedValue(kpiFixture({ currentDefinitionVersionId: null }));

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements`)
      .send({
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        actualValue: 85,
        source: 'manual',
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NO_CURRENT_VERSION');
    expect(mockRecordMeasurement).not.toHaveBeenCalled();
  });
});

// ==========================================
// correct / verify / dispute — kpiId/measurementId cross-check
// ==========================================

describe('POST .../measurements/:measurementId/{corrections,verify,dispute}', () => {
  it('correctMeasurement re-evaluates performanceStatus against the original measurement definition version', async () => {
    configureDb({
      versionRow: definitionVersionRowFixture(),
      measurementRow: {
        measurement_id: MEASUREMENT_ID,
        kpi_id: KPI_ID,
        definition_version_id: VERSION_ID,
        organization_id: 'org-1',
      },
    });
    mockCorrectMeasurement.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 1,
      result: {
        original: measurementFixture({ actualValue: 85, performanceStatus: 'on_target' }),
        superseding: measurementFixture({ actualValue: 60, performanceStatus: 'critical' }),
      },
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements/${MEASUREMENT_ID}/corrections`)
      .send({ actualValue: 60, correctionReason: 'sensor glitch' });

    expect(response.status).toBe(201);
    expect(mockCorrectMeasurement.mock.calls[0][0].performanceStatus).toBe('critical');
    expect(response.body.measurement.performanceStatus).toBe('critical');
  });

  it('404s correction when the measurement does not belong to the kpiId in the URL', async () => {
    configureDb({
      versionRow: definitionVersionRowFixture(),
      measurementRow: {
        measurement_id: MEASUREMENT_ID,
        kpi_id: 'some-other-kpi',
        definition_version_id: VERSION_ID,
        organization_id: 'org-1',
      },
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements/${MEASUREMENT_ID}/corrections`)
      .send({ actualValue: 60, correctionReason: 'sensor glitch' });

    expect(response.status).toBe(404);
    expect(mockCorrectMeasurement).not.toHaveBeenCalled();
  });

  it('verifyMeasurement sets data quality without touching actualValue', async () => {
    configureDb({
      versionRow: definitionVersionRowFixture(),
      measurementRow: {
        measurement_id: MEASUREMENT_ID,
        kpi_id: KPI_ID,
        definition_version_id: VERSION_ID,
        organization_id: 'org-1',
      },
    });
    mockVerifyMeasurement.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 1,
      result: {
        original: measurementFixture({ dataQualityStatus: 'unverified' }),
        superseding: measurementFixture({ dataQualityStatus: 'verified' }),
      },
    });

    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements/${MEASUREMENT_ID}/verify`)
      .send({ notes: 'checked against source system' });

    expect(response.status).toBe(201);
    expect(response.body.measurement.dataQualityStatus).toBe('verified');
    expect(mockVerifyMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ measurementId: MEASUREMENT_ID, verifiedBy: 'user-1' })
    );
  });

  it('disputeMeasurement requires a non-empty disputeReason (Zod 400, command never called)', async () => {
    const response = await request(createApp())
      .post(`/api/vnext/results/kpi/${KPI_ID}/measurements/${MEASUREMENT_ID}/dispute`)
      .send({});
    expect(response.status).toBe(400);
    expect(mockDisputeMeasurement).not.toHaveBeenCalled();
  });
});
