/** @vitest-environment node */

/**
 * ROI-E005 API layer — route contract tests for the 3 new Benefits
 * Realization endpoints on `roi.routes.ts` (design §4) plus the new
 * `roiPerspectives.routes.ts` `/org/benefits-realization` endpoint.
 *
 * Pattern precedent: `roiForecastActual.routes.test.ts` (ROI-E004) —
 * supertest against a minimal Express app, middleware replaced with
 * passthroughs, only the DOMAIN modules this epic touches are mocked (every
 * other module `roi.routes.ts` imports loads for real — harmless, no DB
 * touch at import time — same minimal-mock convention `roi.routes.test.ts`
 * itself uses).
 *
 * Both routers are mounted at the SAME prefix, matching Gateway.ts's real
 * mount order (`roiPerspectives.routes.ts` before `roi.routes.ts`) — this
 * doubles as a light mount-order regression guard: `GET /org/benefits-
 * realization` must resolve in `roiPerspectives.routes.ts`, never fall
 * through to `roi.routes.ts`'s dynamic `/cases/:caseId` family.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRoiCase = vi.fn();
const mockStartRoiCaseBenefitsRealization = vi.fn();
const mockCancelRoiCase = vi.fn();
const mockGetRoiCaseBenefitsRealizationView = vi.fn();
const mockListOrganizationRoiBenefitsRealization = vi.fn();

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

vi.mock('../../../services/resultsVnext/roi/roiBenefitsRealizationCommands.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../services/resultsVnext/roi/roiBenefitsRealizationCommands.js')
  >();
  return {
    ...actual,
    startRoiCaseBenefitsRealization: (...args: unknown[]) => mockStartRoiCaseBenefitsRealization(...args),
    cancelRoiCase: (...args: unknown[]) => mockCancelRoiCase(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiBenefitsRealizationRepository.js', () => ({
  getRoiCaseBenefitsRealizationView: (...args: unknown[]) => mockGetRoiCaseBenefitsRealizationView(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiOrgPerspectiveRepository.js', () => ({
  listOrganizationRoiBenefitsRealization: (...args: unknown[]) => mockListOrganizationRoiBenefitsRealization(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: vi.fn(),
  getRoiBaseline: vi.fn(),
}));

const { RoiCaseValidationError } = await import('../../../services/resultsVnext/roi/roiCaseCommands.js');
const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');

const roiRoutes = (await import('../roi.routes.js')).default;
const roiPerspectivesRoutes = (await import('../roiPerspectives.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  // Same mount order as Gateway.ts: perspectives router BEFORE the generic
  // roi.routes.ts router at the identical prefix.
  app.use('/api/vnext/results/roi', roiPerspectivesRoutes);
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';

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
// POST .../transitions/start-benefits-realization
// ==========================================

describe('POST .../transitions/start-benefits-realization', () => {
  it('200s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    mockStartRoiCaseBenefitsRealization.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-br-1',
      resultingVersion: 4,
      result: caseFixture({ status: 'benefits_realization', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-benefits-realization`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('benefits_realization');
    expect(mockStartRoiCaseBenefitsRealization).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, expectedVersion: 3, actorUserId: 'user-actor' })
    );
  });

  it('maps RoiCaseValidationError to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockStartRoiCaseBenefitsRealization.mockRejectedValue(
      new RoiCaseValidationError('not tracking', 'INVALID_ROI_CASE_STATUS_TRANSITION', { caseId: CASE_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-benefits-realization`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_ROI_CASE_STATUS_TRANSITION');
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-benefits-realization`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(404);
    expect(mockStartRoiCaseBenefitsRealization).not.toHaveBeenCalled();
  });

  it('maps AtomicWriteConflictError (stale version) to 409', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    mockStartRoiCaseBenefitsRealization.mockRejectedValue(
      new AtomicWriteConflictError('stale', 'STALE_VERSION')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/start-benefits-realization`)
      .send({ expectedVersion: 2 });
    expect(response.status).toBe(409);
  });
});

// ==========================================
// POST .../transitions/cancel
// ==========================================

describe('POST .../transitions/cancel', () => {
  it('200s on success with a reason', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    mockCancelRoiCase.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-cancel-1',
      resultingVersion: 4,
      result: caseFixture({ status: 'cancelled', rowVersion: 4 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/cancel`)
      .send({ expectedVersion: 3, reason: 'Program deprioritized' });
    expect(response.status).toBe(200);
    expect(response.body.case.status).toBe('cancelled');
    expect(mockCancelRoiCase).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, expectedVersion: 3, reason: 'Program deprioritized' })
    );
  });

  it('400s (validation) when reason is missing — mandatory field, Decision D8', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/cancel`)
      .send({ expectedVersion: 3 });
    expect(response.status).toBe(400);
    expect(mockCancelRoiCase).not.toHaveBeenCalled();
  });

  it('400s (validation) when reason is an empty string', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'tracking' }));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/cancel`)
      .send({ expectedVersion: 3, reason: '' });
    expect(response.status).toBe(400);
    expect(mockCancelRoiCase).not.toHaveBeenCalled();
  });

  it('maps RoiCaseValidationError to 409 (guard scope — Decision D7)', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture({ status: 'approved' }));
    mockCancelRoiCase.mockRejectedValue(
      new RoiCaseValidationError('not trackable', 'INVALID_ROI_CASE_STATUS_TRANSITION', { caseId: CASE_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/cancel`)
      .send({ expectedVersion: 3, reason: 'attempt from approved' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_ROI_CASE_STATUS_TRANSITION');
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/transitions/cancel`)
      .send({ expectedVersion: 3, reason: 'x' });
    expect(response.status).toBe(404);
    expect(mockCancelRoiCase).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET .../benefits-realization
// ==========================================

describe('GET .../benefits-realization', () => {
  it('200s with the view, 2-reason typed slot', async () => {
    mockGetRoiCaseBenefitsRealizationView.mockResolvedValue({
      caseId: CASE_ID,
      benefitsRealizationPct: { status: 'available', value: 75 },
      approvedFinancialBenefits: 5000,
      actualFinancialBenefits: 3750,
      asOfActualSnapshotId: 'actual-snap-1',
    });
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/benefits-realization`);
    expect(response.status).toBe(200);
    expect(response.body.benefitsRealization.benefitsRealizationPct).toEqual({ status: 'available', value: 75 });
    expect(response.body.benefitsRealization.approvedFinancialBenefits).toBe(5000);
  });

  it('200s with not_yet_approved when the view has no approved snapshot', async () => {
    mockGetRoiCaseBenefitsRealizationView.mockResolvedValue({
      caseId: CASE_ID,
      benefitsRealizationPct: { status: 'not_yet_available', reason: 'not_yet_approved' },
      approvedFinancialBenefits: null,
      actualFinancialBenefits: null,
      asOfActualSnapshotId: null,
    });
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/benefits-realization`);
    expect(response.status).toBe(200);
    expect(response.body.benefitsRealization.benefitsRealizationPct.reason).toBe('not_yet_approved');
  });

  it('404s when the case is not visible/does not exist', async () => {
    mockGetRoiCaseBenefitsRealizationView.mockResolvedValue(null);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/benefits-realization`);
    expect(response.status).toBe(404);
  });

  it('D14: no status restriction — readable regardless of the (mocked, not itself asserted) case status', async () => {
    mockGetRoiCaseBenefitsRealizationView.mockResolvedValue({
      caseId: CASE_ID,
      benefitsRealizationPct: { status: 'not_yet_available', reason: 'no_actual_recorded' },
      approvedFinancialBenefits: 1000,
      actualFinancialBenefits: null,
      asOfActualSnapshotId: null,
    });
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/benefits-realization`);
    expect(response.status).toBe(200);
  });
});

// ==========================================
// GET .../org/benefits-realization — mount-order regression guard
// ==========================================

describe('GET .../org/benefits-realization', () => {
  it('200s with the org rollup, and managerId is derived from auth.userId, never client-supplied', async () => {
    mockListOrganizationRoiBenefitsRealization.mockResolvedValue({
      cases: [
        {
          caseId: CASE_ID,
          initiativeId: 'initiative-1',
          title: 'Case title',
          status: 'tracking',
          approvedFinancialBenefits: 5000,
          actualFinancialBenefits: 3750,
          benefitsRealizationPct: 75,
        },
      ],
      portfolioTotals: {
        totalApprovedFinancialBenefits: 5000,
        totalActualFinancialBenefits: 3750,
        caseCountWithActual: 1,
        caseCountTotal: 1,
      },
    });
    const response = await request(createApp())
      .get('/api/vnext/results/roi/org/benefits-realization')
      .query({ managerId: 'someone-elses-id' }); // deliberately supplied — must be ignored
    expect(response.status).toBe(200);
    expect(response.body.attention.cases).toHaveLength(1);
    expect(response.body.attention.portfolioTotals.caseCountTotal).toBe(1);
    expect(mockListOrganizationRoiBenefitsRealization).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: 'user-actor', organizationId: 'org-1' })
    );
  });

  it('does NOT fall through to roi.routes.ts\'s /cases/:caseId family — mount-order regression guard', async () => {
    mockListOrganizationRoiBenefitsRealization.mockResolvedValue({
      cases: [],
      portfolioTotals: {
        totalApprovedFinancialBenefits: 0,
        totalActualFinancialBenefits: 0,
        caseCountWithActual: 0,
        caseCountTotal: 0,
      },
    });
    const response = await request(createApp()).get('/api/vnext/results/roi/org/benefits-realization');
    expect(response.status).toBe(200);
    // If this request had fallen through to roi.routes.ts's dynamic
    // /cases/:caseId family it would never reach here (that family requires
    // a literal "cases" first segment) — asserting 200 (not 404/400) with
    // the mocked repository actually called is the regression guard.
    expect(mockGetRoiCase).not.toHaveBeenCalled();
    expect(mockListOrganizationRoiBenefitsRealization).toHaveBeenCalledTimes(1);
  });
});
