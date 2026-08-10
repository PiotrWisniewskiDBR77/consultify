/** @vitest-environment node */

/**
 * ROI-E004 API layer — route contract tests for the new Forecast & Actual
 * endpoints (design §6).
 *
 * Pattern precedent: `roiCaseApproval.routes.test.ts` (ROI-E003) — supertest
 * against a minimal Express app, middleware (auth/rbac/demo/rate-limit)
 * replaced with passthroughs, the DOMAIN SERVICE layer mocked (not the whole
 * DB). This file's job is the HTTP boundary `roi.routes.ts` itself owns for
 * the NEW routes: request validation, error->HTTP mapping (including the
 * NEW `RoiActualSelfVerificationDeniedError -> 403` branch, D10, checked
 * ahead of the generic 409 branch; `RoiActualEntryNotFoundError`/
 * `RoiVarianceNotFoundError -> 404`), and the existing-case 404 guard every
 * write route in this router already follows.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRoiCase = vi.fn();

const mockStartRoiCaseTracking = vi.fn();
const mockCreateRoiForecastVersion = vi.fn();
const mockListRoiForecastVersions = vi.fn();
const mockGetRoiForecastVersion = vi.fn();
const mockGetRoiCaseCompareView = vi.fn();
const mockRecordActualEntry = vi.fn();
const mockListActualEntries = vi.fn();
const mockGetActualEntry = vi.fn();
const mockCorrectActualEntry = vi.fn();
const mockVerifyActualEntry = vi.fn();
const mockDisputeActualEntry = vi.fn();
const mockPublishRoiActualSnapshot = vi.fn();
const mockListRoiActualSnapshots = vi.fn();
const mockGetRoiActualSnapshot = vi.fn();
const mockRecordVariance = vi.fn();
const mockListVariances = vi.fn();
const mockGetVariance = vi.fn();
const mockUpdateVarianceStatus = vi.fn();
const mockAddVarianceCause = vi.fn();
const mockRemoveVarianceCause = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-actor', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
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

vi.mock('../../../services/resultsVnext/roi/roiTrackingCommands.js', () => ({
  startRoiCaseTracking: (...args: unknown[]) => mockStartRoiCaseTracking(...args),
}));

vi.mock('../../../services/resultsVnext/roi/roiForecastVersionCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiForecastVersionCommands.js')>();
  return { ...actual, createRoiForecastVersion: (...args: unknown[]) => mockCreateRoiForecastVersion(...args) };
});
vi.mock('../../../services/resultsVnext/roi/roiForecastVersionRepository.js', () => ({
  listRoiForecastVersions: (...args: unknown[]) => mockListRoiForecastVersions(...args),
  getRoiForecastVersion: (...args: unknown[]) => mockGetRoiForecastVersion(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiCompareRepository.js', () => ({
  getRoiCaseCompareView: (...args: unknown[]) => mockGetRoiCaseCompareView(...args),
  ROI_COMPARE_METRICS: ['npv', 'simpleRoi', 'totalCosts', 'totalFinancialBenefits', 'paybackPeriods'],
}));
vi.mock('../../../services/resultsVnext/roi/roiActualEntryCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiActualEntryCommands.js')>();
  return {
    ...actual,
    recordActualEntry: (...args: unknown[]) => mockRecordActualEntry(...args),
    correctActualEntry: (...args: unknown[]) => mockCorrectActualEntry(...args),
    verifyActualEntry: (...args: unknown[]) => mockVerifyActualEntry(...args),
    disputeActualEntry: (...args: unknown[]) => mockDisputeActualEntry(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiActualEntryRepository.js', () => ({
  listActualEntries: (...args: unknown[]) => mockListActualEntries(...args),
  getActualEntry: (...args: unknown[]) => mockGetActualEntry(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiActualSnapshotCommands.js', () => ({
  publishRoiActualSnapshot: (...args: unknown[]) => mockPublishRoiActualSnapshot(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiActualSnapshotRepository.js', () => ({
  listRoiActualSnapshots: (...args: unknown[]) => mockListRoiActualSnapshots(...args),
  getRoiActualSnapshot: (...args: unknown[]) => mockGetRoiActualSnapshot(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiVarianceCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiVarianceCommands.js')>();
  return {
    ...actual,
    recordVariance: (...args: unknown[]) => mockRecordVariance(...args),
    updateVarianceStatus: (...args: unknown[]) => mockUpdateVarianceStatus(...args),
    addVarianceCause: (...args: unknown[]) => mockAddVarianceCause(...args),
    removeVarianceCause: (...args: unknown[]) => mockRemoveVarianceCause(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiVarianceRepository.js', () => ({
  listVariances: (...args: unknown[]) => mockListVariances(...args),
  getVariance: (...args: unknown[]) => mockGetVariance(...args),
}));

vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: vi.fn(),
  getRoiBaseline: vi.fn(),
}));

const { RoiActualEntryNotFoundError, RoiActualEntryValidationError, RoiActualSelfVerificationDeniedError } = await import(
  '../../../services/resultsVnext/roi/roiActualEntryCommands.js'
);
const { RoiForecastVersionValidationError } = await import('../../../services/resultsVnext/roi/roiForecastVersionCommands.js');
const { RoiVarianceNotFoundError, RoiVarianceValidationError } = await import(
  '../../../services/resultsVnext/roi/roiVarianceCommands.js'
);
const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');

const roiRoutes = (await import('../roi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const FORECAST_VERSION_ID = '22222222-2222-4222-8222-222222222222';
const ENTRY_ID = '33333333-3333-4333-8333-333333333333';
const ACTUAL_SNAPSHOT_ID = '44444444-4444-4444-8444-444444444444';
const VARIANCE_ID = '55555555-5555-4555-8555-555555555555';
const CAUSE_ID = '66666666-6666-4666-8666-666666666666';

function caseFixture(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    initiativeId: 'initiative-1',
    title: 'Case title',
    ownerUserId: 'user-1',
    status: 'tracking',
    currency: 'USD',
    granularity: 'monthly',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    originalApprovedSnapshotId: 'snap-1',
    latestApprovedSnapshotId: 'snap-1',
    currentForecastVersionId: null,
    currentActualSnapshotId: null,
    rowVersion: 3,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// POST .../transitions/start-tracking
// ==========================================

describe('POST .../transitions/start-tracking', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockStartRoiCaseTracking.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 4,
      result: caseFixture({ status: 'tracking', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-tracking`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('tracking');
  });
});

// ==========================================
// POST/GET .../forecast-versions[/:forecastVersionId]
// ==========================================

describe('POST .../forecast-versions', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockCreateRoiForecastVersion.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 4,
      result: { forecastVersionId: FORECAST_VERSION_ID, sequenceNumber: 1, status: 'completed', totalCosts: 1000 },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/forecast-versions`)
      .send({ expectedVersion: 3, reason: 'Q2 reforecast' });
    expect(response.status).toBe(201);
    expect(response.body.forecastVersion.forecastVersionId).toBe(FORECAST_VERSION_ID);
  });

  it('maps RoiForecastVersionValidationError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockCreateRoiForecastVersion.mockRejectedValue(
      new RoiForecastVersionValidationError('not trackable', 'CASE_NOT_TRACKABLE')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/forecast-versions`)
      .send({ expectedVersion: 3, reason: 'x' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CASE_NOT_TRACKABLE');
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/forecast-versions`)
      .send({ expectedVersion: 3, reason: 'x' });
    expect(response.status).toBe(404);
    expect(mockCreateRoiForecastVersion).not.toHaveBeenCalled();
  });
});

describe('GET .../forecast-versions', () => {
  it('200s with a list', async () => {
    mockListRoiForecastVersions.mockResolvedValue([{ forecastVersionId: FORECAST_VERSION_ID, sequenceNumber: 1 }]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/forecast-versions`);
    expect(response.status).toBe(200);
    expect(response.body.forecastVersions).toHaveLength(1);
  });
});

describe('GET .../forecast-versions/:forecastVersionId', () => {
  it('404s when not found', async () => {
    mockGetRoiForecastVersion.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/forecast-versions/${FORECAST_VERSION_ID}`
    );
    expect(response.status).toBe(404);
  });
});

// ==========================================
// GET .../compare (AC-04)
// ==========================================

describe('GET .../compare', () => {
  it('200s with the 3-slot compare view', async () => {
    mockGetRoiCaseCompareView.mockResolvedValue({
      caseId: CASE_ID,
      metrics: [{ metric: 'npv', approved: { status: 'available', value: 100 }, forecast: { status: 'not_yet_available', reason: 'no_forecast_published' }, actual: { status: 'not_yet_available', reason: 'no_actual_recorded' } }],
    });
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/compare`);
    expect(response.status).toBe(200);
    expect(response.body.compare.metrics[0].approved.status).toBe('available');
    expect(response.body.compare.metrics[0].forecast.reason).toBe('no_forecast_published');
  });

  it('404s when the case is not visible/does not exist', async () => {
    mockGetRoiCaseCompareView.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/compare`);
    expect(response.status).toBe(404);
  });
});

// ==========================================
// GET/POST .../actuals ; GET .../actuals/:entryId
// ==========================================

describe('POST .../actuals', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockRecordActualEntry.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 1,
      result: { actualEntryId: ENTRY_ID, dataQualityStatus: 'unverified' },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals`)
      .send({ entryType: 'observation', periodStart: '2026-01-01', periodEnd: '2026-01-31', source: 'manual' });
    expect(response.status).toBe(201);
    expect(response.body.actualEntry.actualEntryId).toBe(ENTRY_ID);
  });

  it('maps RoiActualEntryValidationError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockRecordActualEntry.mockRejectedValue(new RoiActualEntryValidationError('bad line ref', 'INVALID_LINE_REFERENCE'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals`)
      .send({ entryType: 'cost', periodStart: '2026-01-01', periodEnd: '2026-01-31', source: 'manual' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_LINE_REFERENCE');
  });
});

describe('GET .../actuals', () => {
  it('200s with a list', async () => {
    mockListActualEntries.mockResolvedValue([{ actualEntryId: ENTRY_ID }]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/actuals`);
    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(1);
  });
});

describe('GET .../actuals/:entryId', () => {
  it('404s when not found', async () => {
    mockGetActualEntry.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}`);
    expect(response.status).toBe(404);
  });
});

// ==========================================
// POST .../actuals/:entryId/corrections | /verify | /dispute
// ==========================================

describe('POST .../actuals/:entryId/corrections', () => {
  it('201s on success', async () => {
    mockCorrectActualEntry.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 1,
      result: { original: { actualEntryId: ENTRY_ID }, superseding: { actualEntryId: 'new-entry', amount: 1000 } },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}/corrections`)
      .send({ amount: 1000, correctionReason: 'fix' });
    expect(response.status).toBe(201);
    expect(response.body.actualEntry.actualEntryId).toBe('new-entry');
  });

  it('maps RoiActualEntryNotFoundError to 404', async () => {
    mockCorrectActualEntry.mockRejectedValue(new RoiActualEntryNotFoundError(ENTRY_ID, 'org-1'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}/corrections`)
      .send({ amount: 1000, correctionReason: 'fix' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ACTUAL_ENTRY_NOT_FOUND');
  });
});

describe('POST .../actuals/:entryId/verify — Decision D10', () => {
  it('201s on success', async () => {
    mockVerifyActualEntry.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 1,
      result: { original: { actualEntryId: ENTRY_ID }, superseding: { actualEntryId: 'verified-entry', dataQualityStatus: 'verified' } },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}/verify`)
      .send({});
    expect(response.status).toBe(201);
    expect(response.body.actualEntry.dataQualityStatus).toBe('verified');
  });

  it('maps RoiActualSelfVerificationDeniedError to 403 (D10) — checked ahead of the generic 409 branch', async () => {
    mockVerifyActualEntry.mockRejectedValue(
      new RoiActualSelfVerificationDeniedError(ENTRY_ID, 'user-actor', 'user-actor')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}/verify`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('SELF_VERIFICATION_DENIED');
  });
});

describe('POST .../actuals/:entryId/dispute', () => {
  it('201s on success', async () => {
    mockDisputeActualEntry.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: 1,
      result: { original: { actualEntryId: ENTRY_ID }, superseding: { actualEntryId: 'disputed-entry', dataQualityStatus: 'disputed' } },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actuals/${ENTRY_ID}/dispute`)
      .send({ disputeReason: 'wrong amount' });
    expect(response.status).toBe(201);
    expect(response.body.actualEntry.dataQualityStatus).toBe('disputed');
  });
});

// ==========================================
// POST/GET .../actual-snapshots[/:actualSnapshotId]
// ==========================================

describe('POST .../actual-snapshots', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockPublishRoiActualSnapshot.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-7',
      resultingVersion: 4,
      result: { actualSnapshotId: ACTUAL_SNAPSHOT_ID, sequenceNumber: 1 },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/actual-snapshots`)
      .send({ expectedVersion: 3, asOfPeriodEnd: '2026-01-31' });
    expect(response.status).toBe(201);
    expect(response.body.actualSnapshot.actualSnapshotId).toBe(ACTUAL_SNAPSHOT_ID);
  });
});

describe('GET .../actual-snapshots/:actualSnapshotId', () => {
  it('404s when not found', async () => {
    mockGetRoiActualSnapshot.mockResolvedValue(null);
    const response = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/actual-snapshots/${ACTUAL_SNAPSHOT_ID}`
    );
    expect(response.status).toBe(404);
  });
});

// ==========================================
// GET/POST .../variances ; GET/PATCH .../variances/:varianceId
// ==========================================

describe('POST .../variances', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockRecordVariance.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-8',
      resultingVersion: 1,
      result: { varianceId: VARIANCE_ID, baselineValue: 1000, comparisonValue: 1500, varianceAmount: 500, variancePct: 50 },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/variances`)
      .send({
        comparisonType: 'approved_vs_forecast',
        metric: 'totalCosts',
        referenceApprovalSnapshotId: '77777777-7777-4777-8777-777777777777',
        referenceForecastVersionId: FORECAST_VERSION_ID,
      });
    expect(response.status).toBe(201);
    expect(response.body.variance.varianceId).toBe(VARIANCE_ID);
  });

  it('maps RoiVarianceValidationError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockRecordVariance.mockRejectedValue(new RoiVarianceValidationError('missing reference', 'MISSING_REFERENCE'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/variances`)
      .send({ comparisonType: 'approved_vs_forecast', metric: 'totalCosts' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('MISSING_REFERENCE');
  });
});

describe('GET .../variances/:varianceId', () => {
  it('maps RoiVarianceNotFoundError-shaped 404 via a null repository result', async () => {
    mockGetVariance.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}`);
    expect(response.status).toBe(404);
  });
});

describe('PATCH .../variances/:varianceId', () => {
  it('200s on success (CAS on the variance\'s own row_version)', async () => {
    mockUpdateVarianceStatus.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-9',
      resultingVersion: 2,
      result: { varianceId: VARIANCE_ID, status: 'explained', rowVersion: 2 },
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}`)
      .send({ expectedVersion: 1, status: 'explained' });
    expect(response.status).toBe(200);
    expect(response.body.variance.status).toBe('explained');
  });

  it('maps AtomicWriteConflictError to 409 on a stale expectedVersion', async () => {
    mockUpdateVarianceStatus.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION')
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}`)
      .send({ expectedVersion: 1, status: 'explained' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });

  it('maps RoiVarianceNotFoundError to 404', async () => {
    mockUpdateVarianceStatus.mockRejectedValue(new RoiVarianceNotFoundError(VARIANCE_ID, 'org-1'));
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}`)
      .send({ expectedVersion: 1, status: 'explained' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('VARIANCE_NOT_FOUND');
  });
});

// ==========================================
// POST .../variances/:varianceId/causes ; DELETE .../causes/:causeId
// ==========================================

describe('POST .../variances/:varianceId/causes', () => {
  it('201s on success', async () => {
    mockAddVarianceCause.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-10',
      resultingVersion: 1,
      result: { causeId: CAUSE_ID, varianceId: VARIANCE_ID },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}/causes`)
      .send({ causeCategory: 'vendor_price_change', narrative: 'Vendor increased price' });
    expect(response.status).toBe(201);
    expect(response.body.varianceCause.causeId).toBe(CAUSE_ID);
  });
});

describe('DELETE .../variances/:varianceId/causes/:causeId', () => {
  it('200s on success', async () => {
    mockRemoveVarianceCause.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-11',
      resultingVersion: 1,
      result: { causeId: CAUSE_ID },
    });
    const response = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/variances/${VARIANCE_ID}/causes/${CAUSE_ID}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.causeId).toBe(CAUSE_ID);
  });
});
