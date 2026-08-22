/** @vitest-environment node */

/**
 * ROI-E007 API layer — route contract tests for the 5 new Finance/KPI-seam
 * endpoints on `roi.routes.ts` (design §6).
 *
 * Pattern precedent: `roiPir.routes.test.ts` (ROI-E006) — supertest against
 * a minimal Express app, middleware replaced with passthroughs, only the
 * DOMAIN modules this epic touches are mocked (every other roi.routes.ts
 * import loads for real — none of it executes in these tests).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRoiCase = vi.fn();
const mockCreateRoiFinanceLink = vi.fn();
const mockRemoveRoiFinanceLink = vi.fn();
const mockListRoiFinanceLinks = vi.fn();
const mockListRoiFinanceReconciliations = vi.fn();
const mockOpenRoiFinanceReconciliation = vi.fn();
const mockUpdateRoiFinanceReconciliationStatus = vi.fn();
const mockRecordFinanceOwnerGrantEvent = vi.fn();
const mockFlagEvidenceLinkFreshnessCheck = vi.fn();
const mockPublishRoiGovernedVisibilityPolicy = vi.fn();
const mockResolveRoiGovernedVisibility = vi.fn().mockResolvedValue({ allow: true, reason: 'OWNER' });

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

vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: vi.fn(),
  getRoiBaseline: vi.fn(),
}));
vi.mock('../../../services/resultsVnext/roi/roiFinanceLinkCommands.js', () => ({
  createRoiFinanceLink: (...args: unknown[]) => mockCreateRoiFinanceLink(...args),
  removeRoiFinanceLink: (...args: unknown[]) => mockRemoveRoiFinanceLink(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiFinanceLinkRepository.js', () => ({
  listRoiFinanceLinks: (...args: unknown[]) => mockListRoiFinanceLinks(...args),
  listRoiFinanceReconciliations: (...args: unknown[]) => mockListRoiFinanceReconciliations(...args),
}));
vi.mock('../../../services/resultsVnext/roi/roiFinanceReconciliationCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiFinanceReconciliationCommands.js')>();
  return {
    ...actual,
    openRoiFinanceReconciliation: (...args: unknown[]) => mockOpenRoiFinanceReconciliation(...args),
    updateRoiFinanceReconciliationStatus: (...args: unknown[]) => mockUpdateRoiFinanceReconciliationStatus(...args),
    recordFinanceOwnerGrantEvent: (...args: unknown[]) => mockRecordFinanceOwnerGrantEvent(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js')>();
  return {
    ...actual,
    flagEvidenceLinkFreshnessCheck: (...args: unknown[]) => mockFlagEvidenceLinkFreshnessCheck(...args),
  };
});
vi.mock('../../../services/resultsVnext/platform/visibilityResolver.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/platform/visibilityResolver.js')>();
  return {
    ...actual,
    publishRoiGovernedVisibilityPolicy: (...args: unknown[]) => mockPublishRoiGovernedVisibilityPolicy(...args),
    resolveRoiGovernedVisibility: (...args: unknown[]) => mockResolveRoiGovernedVisibility(...args),
  };
});

const { AtomicWriteConflictError } = await import('../../../services/resultsVnext/platform/atomicWrite.js');
const {
  ROI_GOVERNED_VISIBILITY_POLICY,
  RoiGovernedVisibilityPolicyMismatchError,
  RoiVisibilityGovernanceActorNotAuthorizedError,
  RoiGovernedVisibilityPolicyCollisionError,
} = await import('../../../services/resultsVnext/platform/visibilityResolver.js');
const { RoiFinanceLinkNotFoundError, RoiFinanceReconciliationNotFoundError, RoiFinanceReconciliationValidationError } =
  await import('../../../services/resultsVnext/roi/roiFinanceReconciliationCommands.js');
const { RoiBenefitEvidenceLinkValidationError } = await import(
  '../../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js'
);

const roiRoutes = (await import('../roi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const BENEFIT_LINE_ID = '33333333-3333-4333-8333-333333333333';
const LINK_ID = '22222222-2222-4222-8222-222222222222';
const RECONCILIATION_ID = '44444444-4444-4444-8444-444444444444';
const RESULTS_ACTUAL_SNAPSHOT_ID = '55555555-5555-4555-8555-555555555555';

function caseFixture(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    initiativeId: 'initiative-1',
    title: 'Case title',
    ownerUserId: 'user-1',
    status: 'modeling',
    currency: 'USD',
    rowVersion: 3,
    ...overrides,
  };
}

function financeLinkFixture(overrides: Record<string, unknown> = {}) {
  return {
    linkId: LINK_ID,
    caseId: CASE_ID,
    organizationId: 'org-1',
    financeArtifactType: 'financial_roi_link',
    financeArtifactId: 'fin-artifact-1',
    financeVersionId: 'fin-version-1',
    mappingVersion: 1,
    source: 'finance_enterprise_service',
    asOf: '2026-06-01T00:00:00.000Z',
    semanticUnit: 'USD_NPV',
    currency: 'USD',
    linkPurpose: 'npv_reference',
    linkedBy: 'user-actor',
    linkedAt: '2026-06-01T00:00:00.000Z',
    rowVersion: 1,
    createdBy: 'user-actor',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function reconciliationFixture(overrides: Record<string, unknown> = {}) {
  return {
    reconciliationId: RECONCILIATION_ID,
    caseId: CASE_ID,
    organizationId: 'org-1',
    financeLinkId: LINK_ID,
    roiValue: 1000,
    financeValue: 900,
    divergenceReason: null,
    status: 'open',
    openedBy: 'user-actor',
    openedAt: '2026-06-01T00:00:00.000Z',
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    rowVersion: 1,
    ...overrides,
  };
}

function evidenceLinkFixture(overrides: Record<string, unknown> = {}) {
  return {
    linkId: LINK_ID,
    benefitLineId: BENEFIT_LINE_ID,
    caseId: CASE_ID,
    organizationId: 'org-1',
    kpiId: 'kpi-1',
    pinnedKpiDefinitionVersionId: 'kpi-version-1',
    expectedUnit: null,
    purpose: 'primary_evidence',
    linkedBy: 'user-1',
    linkedAt: '2026-06-01T00:00:00.000Z',
    freshnessCheckedAt: '2026-07-01T00:00:00.000Z',
    disputeStatus: 'none',
    notes: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /finance-owner-grants', () => {
  it('derives tenant and governor from auth and returns applied/replayed receipts', async () => {
    mockRecordFinanceOwnerGrantEvent
      .mockResolvedValueOnce({ receiptId: 'receipt-1', grantVersion: 1, action: 'granted', outcome: 'applied' })
      .mockResolvedValueOnce({ receiptId: 'receipt-1', grantVersion: 1, action: 'granted', outcome: 'replayed' });
    const body = { userId: 'user-grantee', action: 'granted', idempotencyKey: 'grant-key-1' };
    const first = await request(createApp()).post('/api/vnext/results/roi/finance-owner-grants').send(body);
    const replay = await request(createApp()).post('/api/vnext/results/roi/finance-owner-grants').send(body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(mockRecordFinanceOwnerGrantEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      organizationId: 'org-1', actorUserId: 'user-actor', userId: 'user-grantee', action: 'granted', idempotencyKey: 'grant-key-1',
    }));
  });

  it('rejects missing idempotency and unknown fields before the service', async () => {
    expect((await request(createApp()).post('/api/vnext/results/roi/finance-owner-grants').send({ userId: 'u', action: 'granted' })).status).toBe(400);
    expect((await request(createApp()).post('/api/vnext/results/roi/finance-owner-grants').send({ userId: 'u', action: 'granted', idempotencyKey: 'k', organizationId: 'foreign' })).status).toBe(400);
    expect(mockRecordFinanceOwnerGrantEvent).not.toHaveBeenCalled();
  });
});

// ==========================================
// GET/POST .../finance-links ; DELETE .../finance-links/:linkId
// ==========================================

describe('GET .../finance-links', () => {
  it('200s with the list', async () => {
    mockListRoiFinanceLinks.mockResolvedValue([financeLinkFixture()]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links`);
    expect(response.status).toBe(200);
    expect(response.body.financeLinks).toHaveLength(1);
    expect(mockListRoiFinanceLinks).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, organizationId: 'org-1' })
    );
  });
});

describe('POST .../finance-links', () => {
  it('201s on success — full pinned envelope forwarded', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockCreateRoiFinanceLink.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: financeLinkFixture(),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links`)
      .send({
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: 'fin-artifact-1',
        financeVersionId: 'fin-version-1',
        source: 'finance_enterprise_service',
        asOf: '2026-06-01T00:00:00.000Z',
        semanticUnit: 'USD_NPV',
        currency: 'USD',
        linkPurpose: 'npv_reference',
      });
    expect(response.status).toBe(201);
    expect(response.body.financeLink.financeArtifactId).toBe('fin-artifact-1');
    expect(mockCreateRoiFinanceLink).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: CASE_ID,
        organizationId: 'org-1',
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: 'fin-artifact-1',
        financeVersionId: 'fin-version-1',
      })
    );
  });

  it('404s when the case does not exist', async () => {
    mockGetRoiCase.mockResolvedValue(null);
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links`)
      .send({
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: 'fin-artifact-1',
        financeVersionId: 'fin-version-1',
        source: 'finance_enterprise_service',
        asOf: '2026-06-01T00:00:00.000Z',
        linkPurpose: 'npv_reference',
      });
    expect(response.status).toBe(404);
    expect(mockCreateRoiFinanceLink).not.toHaveBeenCalled();
  });

  it('400s when a required field is missing', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links`)
      .send({ financeArtifactType: 'financial_roi_link' });
    expect(response.status).toBe(400);
    expect(mockCreateRoiFinanceLink).not.toHaveBeenCalled();
  });

  it("maps RoiEconomicModelNotEditableError to 409 (case in a NON_EDITABLE_STATUSES status)", async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    const { RoiEconomicModelNotEditableError } = await import(
      '../../../services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    mockCreateRoiFinanceLink.mockRejectedValue(new RoiEconomicModelNotEditableError(CASE_ID, 'approved'));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links`)
      .send({
        financeArtifactType: 'financial_roi_link',
        financeArtifactId: 'fin-artifact-1',
        financeVersionId: 'fin-version-1',
        source: 'finance_enterprise_service',
        asOf: '2026-06-01T00:00:00.000Z',
        linkPurpose: 'npv_reference',
      });
    expect(response.status).toBe(409);
  });
});

describe('DELETE .../finance-links/:linkId', () => {
  it('200s on success', async () => {
    mockRemoveRoiFinanceLink.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: { linkId: LINK_ID },
    });
    const response = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links/${LINK_ID}`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.financeLink.linkId).toBe(LINK_ID);
    expect(mockRemoveRoiFinanceLink).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: LINK_ID, caseId: CASE_ID, expectedVersion: 1 })
    );
  });

  it('maps AtomicWriteConflictError to 409', async () => {
    mockRemoveRoiFinanceLink.mockRejectedValue(new AtomicWriteConflictError('stale', 'STALE_VERSION'));
    const response = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/finance-links/${LINK_ID}`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
  });
});

// ==========================================
// GET/POST .../finance-reconciliations ; PATCH .../finance-reconciliations/:reconciliationId
// ==========================================

describe('GET .../finance-reconciliations', () => {
  it('200s with the list', async () => {
    mockListRoiFinanceReconciliations.mockResolvedValue([reconciliationFixture()]);
    const response = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations`);
    expect(response.status).toBe(200);
    expect(response.body.financeReconciliations).toHaveLength(1);
  });
});

describe('POST .../finance-reconciliations', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockOpenRoiFinanceReconciliation.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 1,
      result: reconciliationFixture(),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations`)
      .send({
        financeLinkId: LINK_ID,
        resultsActualSnapshotId: RESULTS_ACTUAL_SNAPSHOT_ID,
        resultsActualMetric: 'npv',
        roiValue: 1000,
        financeValue: 900,
        divergenceReason: 'Timing difference',
      });
    expect(response.status).toBe(201);
    expect(response.body.financeReconciliation.status).toBe('open');
    expect(mockOpenRoiFinanceReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: CASE_ID,
        financeLinkId: LINK_ID,
        resultsActualSnapshotId: RESULTS_ACTUAL_SNAPSHOT_ID,
        resultsActualMetric: 'npv',
        roiValue: 1000,
        financeValue: 900,
      })
    );
  });

  it('maps RoiFinanceLinkNotFoundError to 404', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    mockOpenRoiFinanceReconciliation.mockRejectedValue(new RoiFinanceLinkNotFoundError(LINK_ID, CASE_ID));
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations`)
      .send({
        financeLinkId: LINK_ID,
        resultsActualSnapshotId: RESULTS_ACTUAL_SNAPSHOT_ID,
        resultsActualMetric: 'npv',
        roiValue: 1000,
        financeValue: 900,
      });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('FINANCE_LINK_NOT_FOUND');
  });

  it('400s when roiValue/financeValue are missing', async () => {
    mockGetRoiCase.mockResolvedValue(caseFixture());
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations`)
      .send({ financeLinkId: LINK_ID });
    expect(response.status).toBe(400);
    expect(mockOpenRoiFinanceReconciliation).not.toHaveBeenCalled();
  });
});

describe('PATCH .../finance-reconciliations/:reconciliationId', () => {
  it('200s on success — Decision D1', async () => {
    mockUpdateRoiFinanceReconciliationStatus.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-4',
      resultingVersion: 2,
      result: reconciliationFixture({ status: 'investigating', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations/${RECONCILIATION_ID}`)
      .send({ expectedVersion: 1, status: 'investigating' });
    expect(response.status).toBe(200);
    expect(response.body.financeReconciliation.status).toBe('investigating');
    expect(mockUpdateRoiFinanceReconciliationStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reconciliationId: RECONCILIATION_ID, caseId: CASE_ID, expectedVersion: 1, status: 'investigating' })
    );
  });

  it('maps RoiFinanceReconciliationNotFoundError to 404', async () => {
    mockUpdateRoiFinanceReconciliationStatus.mockRejectedValue(
      new RoiFinanceReconciliationNotFoundError(RECONCILIATION_ID, 'org-1')
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations/${RECONCILIATION_ID}`)
      .send({ expectedVersion: 1, status: 'resolved' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('FINANCE_RECONCILIATION_NOT_FOUND');
  });

  it('maps RoiFinanceReconciliationValidationError to 409', async () => {
    mockUpdateRoiFinanceReconciliationStatus.mockRejectedValue(
      new RoiFinanceReconciliationValidationError('bad transition', 'INVALID_STATUS')
    );
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations/${RECONCILIATION_ID}`)
      .send({ expectedVersion: 1, status: 'resolved' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_STATUS');
  });

  it('400s for an invalid status enum value', async () => {
    const response = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/finance-reconciliations/${RECONCILIATION_ID}`)
      .send({ expectedVersion: 1, status: 'not_a_real_status' });
    expect(response.status).toBe(400);
    expect(mockUpdateRoiFinanceReconciliationStatus).not.toHaveBeenCalled();
  });
});

// ==========================================
// POST .../kpi-evidence-links/:linkId/freshness-check
// ==========================================

describe('POST .../kpi-evidence-links/:linkId/freshness-check', () => {
  it('200s on success — empty body accepted', async () => {
    mockFlagEvidenceLinkFreshnessCheck.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-5',
      resultingVersion: 2,
      result: evidenceLinkFixture({ freshnessCheckedAt: '2026-08-01T00:00:00.000Z', rowVersion: 2 }),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links/${LINK_ID}/freshness-check`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.link.freshnessCheckedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(mockFlagEvidenceLinkFreshnessCheck).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: LINK_ID, caseId: CASE_ID })
    );
  });

  it('maps RoiBenefitEvidenceLinkValidationError to 409', async () => {
    mockFlagEvidenceLinkFreshnessCheck.mockRejectedValue(
      new RoiBenefitEvidenceLinkValidationError('not found', 'BENEFIT_EVIDENCE_LINK_NOT_FOUND', { linkId: LINK_ID })
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links/${LINK_ID}/freshness-check`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('BENEFIT_EVIDENCE_LINK_NOT_FOUND');
  });

  it('accepts an optional reason and forwards it', async () => {
    mockFlagEvidenceLinkFreshnessCheck.mockResolvedValue({
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: 2,
      result: evidenceLinkFixture(),
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links/${LINK_ID}/freshness-check`)
      .send({ reason: 'Quarterly review acknowledgment' });
    expect(response.status).toBe(200);
    expect(mockFlagEvidenceLinkFreshnessCheck).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Quarterly review acknowledgment' })
    );
  });
});

// ==========================================================================
// AMD-FLOW-ROI-VISIBILITY-002 — POST /visibility-policy
// ==========================================================================

describe('POST /visibility-policy', () => {
  it('derives org/actor from auth and always publishes the one pinned canonical policy (never client-supplied)', async () => {
    mockPublishRoiGovernedVisibilityPolicy.mockResolvedValueOnce({
      outcome: 'applied',
      publication: { organizationId: 'org-1', publishedBy: 'user-actor', publishedAt: '2026-08-18T00:00:00.000Z', policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key },
    });
    const response = await request(createApp())
      .post('/api/vnext/results/roi/visibility-policy')
      .send({ idempotencyKey: 'publish-key-1' });
    expect(response.status).toBe(201);
    expect(response.body.outcome).toBe('applied');
    expect(mockPublishRoiGovernedVisibilityPolicy).toHaveBeenCalledWith({
      organizationId: 'org-1',
      actorUserId: 'user-actor',
      policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
      policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
      idempotencyKey: 'publish-key-1',
    });
  });

  it('200s (not 201) on a replayed outcome', async () => {
    mockPublishRoiGovernedVisibilityPolicy.mockResolvedValueOnce({
      outcome: 'replayed',
      publication: { organizationId: 'org-1', publishedBy: 'user-actor', publishedAt: '2026-08-18T00:00:00.000Z', policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key },
    });
    const response = await request(createApp()).post('/api/vnext/results/roi/visibility-policy').send({});
    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe('replayed');
  });

  it('maps RoiVisibilityGovernanceActorNotAuthorizedError to 403', async () => {
    mockPublishRoiGovernedVisibilityPolicy.mockRejectedValueOnce(new RoiVisibilityGovernanceActorNotAuthorizedError());
    const response = await request(createApp()).post('/api/vnext/results/roi/visibility-policy').send({});
    expect(response.status).toBe(403);
  });

  it('maps RoiGovernedVisibilityPolicyCollisionError to 409', async () => {
    mockPublishRoiGovernedVisibilityPolicy.mockRejectedValueOnce(new RoiGovernedVisibilityPolicyCollisionError('org-1'));
    const response = await request(createApp()).post('/api/vnext/results/roi/visibility-policy').send({});
    expect(response.status).toBe(409);
  });

  it('maps RoiGovernedVisibilityPolicyMismatchError to 400 (defense in depth — the route never actually sends a mismatched policy)', async () => {
    mockPublishRoiGovernedVisibilityPolicy.mockRejectedValueOnce(new RoiGovernedVisibilityPolicyMismatchError());
    const response = await request(createApp()).post('/api/vnext/results/roi/visibility-policy').send({});
    expect(response.status).toBe(400);
  });

  it('400s on an unknown body field (idempotencyKey is the only accepted field)', async () => {
    const response = await request(createApp())
      .post('/api/vnext/results/roi/visibility-policy')
      .send({ idempotencyKey: 'k', mode: 'OPEN_ORG' });
    expect(response.status).toBe(400);
    expect(mockPublishRoiGovernedVisibilityPolicy).not.toHaveBeenCalled();
  });
});
