/** @vitest-environment node */

/**
 * ROI-E002 API layer — route contract tests.
 *
 * Pattern precedent: `roi.routes.test.ts` (ROI-E001) — supertest against a
 * minimal Express app, middleware replaced with passthroughs, the DOMAIN
 * SERVICE layer mocked (not the whole DB). `roi.routes.ts` is ONE router
 * file carrying both E001's and E002's routes, so this file mocks every
 * module the router imports from — not just the ROI-E002 ones — the same
 * way `roi.routes.test.ts` itself would need to if E002 existed when it was
 * written.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- E001 mocks (the router also owns these routes) ----------
const mockCreateRoiCase = vi.fn();
const mockUpdateRoiCaseDetails = vi.fn();
const mockArchiveRoiCase = vi.fn();
const mockStartModeling = vi.fn();
const mockMarkReadyForReview = vi.fn();
const mockCaptureOrUpdateBaseline = vi.fn();
const mockGetRoiCase = vi.fn();
const mockListRoiCases = vi.fn();
const mockGetRoiBaseline = vi.fn();

// ---------- E002 command mocks ----------
const mockCaptureOrUpdateCalculationPolicy = vi.fn();
const mockAddAssumption = vi.fn();
const mockUpdateAssumption = vi.fn();
const mockRemoveAssumption = vi.fn();
const mockAddCostLine = vi.fn();
const mockUpdateCostLine = vi.fn();
const mockRemoveCostLine = vi.fn();
const mockAddBenefitLine = vi.fn();
const mockUpdateBenefitLine = vi.fn();
const mockRemoveBenefitLine = vi.fn();
const mockAddBenefitEvidenceLink = vi.fn();
const mockRemoveBenefitEvidenceLink = vi.fn();
const mockAddScenario = vi.fn();
const mockUpdateScenario = vi.fn();
const mockRemoveScenario = vi.fn();
const mockSetScenarioOverride = vi.fn();
const mockRemoveScenarioOverride = vi.fn();
const mockCreateRoiCalculationRun = vi.fn();

// ---------- E002 repository mocks ----------
const mockGetCalculationPolicy = vi.fn();
const mockGetAssumption = vi.fn();
const mockListAssumptions = vi.fn();
const mockGetCostLine = vi.fn();
const mockListCostLines = vi.fn();
const mockGetBenefitLine = vi.fn();
const mockListBenefitLines = vi.fn();
const mockListBenefitEvidenceLinks = vi.fn();
const mockGetScenario = vi.fn();
const mockListScenarios = vi.fn();
const mockListCalculationRuns = vi.fn();
const mockGetCalculationRun = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
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

vi.mock('../../../services/resultsVnext/roi/roiCaseCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCaseCommands.js')>();
  return {
    ...actual,
    createRoiCase: (...args: unknown[]) => mockCreateRoiCase(...args),
    updateRoiCaseDetails: (...args: unknown[]) => mockUpdateRoiCaseDetails(...args),
    archiveRoiCase: (...args: unknown[]) => mockArchiveRoiCase(...args),
    startModeling: (...args: unknown[]) => mockStartModeling(...args),
    markReadyForReview: (...args: unknown[]) => mockMarkReadyForReview(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiBaselineCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiBaselineCommands.js')>();
  return { ...actual, captureOrUpdateBaseline: (...args: unknown[]) => mockCaptureOrUpdateBaseline(...args) };
});
vi.mock('../../../services/resultsVnext/roi/roiRepository.js', () => ({
  getRoiCase: (...args: unknown[]) => mockGetRoiCase(...args),
  listRoiCases: (...args: unknown[]) => mockListRoiCases(...args),
  getRoiBaseline: (...args: unknown[]) => mockGetRoiBaseline(...args),
}));

vi.mock('../../../services/resultsVnext/roi/roiCalculationPolicyCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCalculationPolicyCommands.js')>();
  return { ...actual, captureOrUpdateCalculationPolicy: (...args: unknown[]) => mockCaptureOrUpdateCalculationPolicy(...args) };
});
vi.mock('../../../services/resultsVnext/roi/roiAssumptionCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiAssumptionCommands.js')>();
  return {
    ...actual,
    addAssumption: (...args: unknown[]) => mockAddAssumption(...args),
    updateAssumption: (...args: unknown[]) => mockUpdateAssumption(...args),
    removeAssumption: (...args: unknown[]) => mockRemoveAssumption(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiCostLineCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCostLineCommands.js')>();
  return {
    ...actual,
    addCostLine: (...args: unknown[]) => mockAddCostLine(...args),
    updateCostLine: (...args: unknown[]) => mockUpdateCostLine(...args),
    removeCostLine: (...args: unknown[]) => mockRemoveCostLine(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiBenefitLineCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiBenefitLineCommands.js')>();
  return {
    ...actual,
    addBenefitLine: (...args: unknown[]) => mockAddBenefitLine(...args),
    updateBenefitLine: (...args: unknown[]) => mockUpdateBenefitLine(...args),
    removeBenefitLine: (...args: unknown[]) => mockRemoveBenefitLine(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js')>();
  return {
    ...actual,
    addBenefitEvidenceLink: (...args: unknown[]) => mockAddBenefitEvidenceLink(...args),
    removeBenefitEvidenceLink: (...args: unknown[]) => mockRemoveBenefitEvidenceLink(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiScenarioCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiScenarioCommands.js')>();
  return {
    ...actual,
    addScenario: (...args: unknown[]) => mockAddScenario(...args),
    updateScenario: (...args: unknown[]) => mockUpdateScenario(...args),
    removeScenario: (...args: unknown[]) => mockRemoveScenario(...args),
    setScenarioOverride: (...args: unknown[]) => mockSetScenarioOverride(...args),
    removeScenarioOverride: (...args: unknown[]) => mockRemoveScenarioOverride(...args),
  };
});
vi.mock('../../../services/resultsVnext/roi/roiCalculationRunCommands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/resultsVnext/roi/roiCalculationRunCommands.js')>();
  return { ...actual, createRoiCalculationRun: (...args: unknown[]) => mockCreateRoiCalculationRun(...args) };
});
vi.mock('../../../services/resultsVnext/roi/roiEconomicModelRepository.js', () => ({
  getCalculationPolicy: (...args: unknown[]) => mockGetCalculationPolicy(...args),
  getAssumption: (...args: unknown[]) => mockGetAssumption(...args),
  listAssumptions: (...args: unknown[]) => mockListAssumptions(...args),
  getCostLine: (...args: unknown[]) => mockGetCostLine(...args),
  listCostLines: (...args: unknown[]) => mockListCostLines(...args),
  getBenefitLine: (...args: unknown[]) => mockGetBenefitLine(...args),
  listBenefitLines: (...args: unknown[]) => mockListBenefitLines(...args),
  listBenefitEvidenceLinks: (...args: unknown[]) => mockListBenefitEvidenceLinks(...args),
  getScenario: (...args: unknown[]) => mockGetScenario(...args),
  listScenarios: (...args: unknown[]) => mockListScenarios(...args),
  listCalculationRuns: (...args: unknown[]) => mockListCalculationRuns(...args),
  getCalculationRun: (...args: unknown[]) => mockGetCalculationRun(...args),
}));

const { RoiEconomicModelNotEditableError } = await import('../../../services/resultsVnext/roi/roiCalculationPolicyCommands.js');
const { RoiBenefitLineValidationError } = await import('../../../services/resultsVnext/roi/roiBenefitLineCommands.js');
const { RoiScenarioValidationError } = await import('../../../services/resultsVnext/roi/roiScenarioCommands.js');
const { RoiCalculationRunValidationError } = await import('../../../services/resultsVnext/roi/roiCalculationRunCommands.js');

const roiRoutes = (await import('../roi.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/roi', roiRoutes);
  return app;
}

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const ASSUMPTION_ID = '33333333-3333-4333-8333-333333333333';
const COST_LINE_ID = '44444444-4444-4444-8444-444444444444';
const BENEFIT_LINE_ID = '55555555-5555-4555-8555-555555555555';
const LINK_ID = '66666666-6666-4666-8666-666666666666';
const SCENARIO_ID = '77777777-7777-4777-8777-777777777777';
const OVERRIDE_ID = '88888888-8888-4888-8888-888888888888';
const RUN_ID = '99999999-9999-4999-8999-999999999999';

function caseFixture(overrides: Record<string, unknown> = {}) {
  return { caseId: CASE_ID, organizationId: 'org-1', status: 'draft', rowVersion: 1, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET/PUT /cases/:caseId/calculation-policy', () => {
  it('GET returns the policy, 404s when repository returns null', async () => {
    mockGetCalculationPolicy.mockResolvedValueOnce({ policyRowId: 'p-1', caseId: CASE_ID });
    const ok = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-policy`);
    expect(ok.status).toBe(200);
    expect(ok.body.calculationPolicy.policyRowId).toBe('p-1');

    mockGetCalculationPolicy.mockResolvedValueOnce(null);
    const notFound = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-policy`);
    expect(notFound.status).toBe(404);
  });

  it('PUT 404s when the case does not exist, else applies the update', async () => {
    mockGetRoiCase.mockResolvedValueOnce(null);
    const notFound = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-policy`)
      .send({ expectedVersion: 1, discountRatePct: 10 });
    expect(notFound.status).toBe(404);
    expect(mockCaptureOrUpdateCalculationPolicy).not.toHaveBeenCalled();

    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockCaptureOrUpdateCalculationPolicy.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 2,
      result: { policyRowId: 'p-1', discountRatePct: 10 },
    });
    const applied = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-policy`)
      .send({ expectedVersion: 1, discountRatePct: 10 });
    expect(applied.status).toBe(200);
    expect(applied.body.calculationPolicy.discountRatePct).toBe(10);
  });

  it('maps RoiEconomicModelNotEditableError to 409', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockCaptureOrUpdateCalculationPolicy.mockRejectedValueOnce(new RoiEconomicModelNotEditableError(CASE_ID, 'approved'));
    const response = await request(createApp())
      .put(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-policy`)
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOT_EDITABLE');
  });
});

describe('assumptions: GET (list+single)/POST/PATCH/DELETE', () => {
  it('lists and fetches a single assumption', async () => {
    mockListAssumptions.mockResolvedValueOnce([{ assumptionId: ASSUMPTION_ID }]);
    const list = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions`);
    expect(list.status).toBe(200);
    expect(list.body.assumptions).toHaveLength(1);

    mockGetAssumption.mockResolvedValueOnce({ assumptionId: ASSUMPTION_ID, label: 'Adoption' });
    const single = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions/${ASSUMPTION_ID}`);
    expect(single.status).toBe(200);
    expect(single.body.assumption.label).toBe('Adoption');
  });

  it('POST 400s on missing required fields, 201s on success', async () => {
    const badRequest = await request(createApp()).post(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions`).send({});
    expect(badRequest.status).toBe(400);
    expect(mockAddAssumption).not.toHaveBeenCalled();

    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddAssumption.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { assumptionId: ASSUMPTION_ID, category: 'adoption', label: 'Adoption rate' },
    });
    const created = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions`)
      .send({ category: 'adoption', label: 'Adoption rate' });
    expect(created.status).toBe(201);
    expect(created.body.assumption.assumptionId).toBe(ASSUMPTION_ID);
  });

  it('PATCH applies the update; DELETE (soft) applies the removal', async () => {
    mockUpdateAssumption.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: { assumptionId: ASSUMPTION_ID, label: 'Renamed' },
    });
    const patched = await request(createApp())
      .patch(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions/${ASSUMPTION_ID}`)
      .send({ expectedVersion: 1, label: 'Renamed' });
    expect(patched.status).toBe(200);
    expect(patched.body.assumption.label).toBe('Renamed');

    mockRemoveAssumption.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 3,
      result: { assumptionId: ASSUMPTION_ID, deletedAt: '2026-01-01T00:00:00.000Z' },
    });
    const removed = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/assumptions/${ASSUMPTION_ID}`)
      .send({ expectedVersion: 2 });
    expect(removed.status).toBe(200);
    expect(removed.body.assumption.deletedAt).not.toBeNull();
  });
});

describe('cost-lines: POST', () => {
  it('201s on success and forwards the typed body to addCostLine', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddCostLine.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { costLineId: COST_LINE_ID, amount: 1000 },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/cost-lines`)
      .send({ category: 'implementation', label: 'Setup', amount: 1000, currency: 'USD', timingType: 'one_time' });
    expect(response.status).toBe(201);
    expect(mockAddCostLine).toHaveBeenCalledTimes(1);
    expect(mockAddCostLine.mock.calls[0][0]).toMatchObject({ caseId: CASE_ID, amount: 1000, currency: 'USD' });
  });
});

describe('benefit-lines: POST + financial/non-financial validation error mapping', () => {
  it('201s on success', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddBenefitLine.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { benefitLineId: BENEFIT_LINE_ID, amount: 2000 },
    });
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines`)
      .send({ category: 'revenue', label: 'New revenue', amount: 2000, currency: 'USD', timingType: 'one_time', isFinancial: true });
    expect(response.status).toBe(201);
  });

  it('maps RoiBenefitLineValidationError (isFinancial/amount mismatch) to 409', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddBenefitLine.mockRejectedValueOnce(
      new RoiBenefitLineValidationError('A financial benefit line requires both amount and currency', 'FINANCIAL_BENEFIT_MISSING_AMOUNT')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines`)
      .send({ category: 'revenue', label: 'New revenue', timingType: 'one_time', isFinancial: true });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FINANCIAL_BENEFIT_MISSING_AMOUNT');
  });
});

describe('benefit-lines/:benefitLineId/kpi-evidence-links: GET/POST/DELETE', () => {
  it('GET lists links (with optional hydration flag), POST adds one, DELETE removes one', async () => {
    mockListBenefitEvidenceLinks.mockResolvedValueOnce([{ linkId: LINK_ID, kpiDetails: null }]);
    const list = await request(createApp()).get(
      `/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links?hydrateKpiDetails=true`
    );
    expect(list.status).toBe(200);
    expect(list.body.links).toHaveLength(1);
    expect(mockListBenefitEvidenceLinks).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: CASE_ID, benefitLineId: BENEFIT_LINE_ID, hydrateKpiDetails: true })
    );

    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddBenefitEvidenceLink.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { linkId: LINK_ID },
    });
    const created = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links`)
      .send({
        kpiId: '11111111-2222-4333-8444-555555555555',
        pinnedKpiDefinitionVersionId: '11111111-2222-4333-8444-555555555556',
        purpose: 'primary_evidence',
      });
    expect(created.status).toBe(201);

    mockRemoveBenefitEvidenceLink.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: { linkId: LINK_ID },
    });
    const removed = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/benefit-lines/${BENEFIT_LINE_ID}/kpi-evidence-links/${LINK_ID}`)
      .send({ expectedVersion: 1 });
    expect(removed.status).toBe(200);
    expect(removed.body.linkId).toBe(LINK_ID);
  });
});

describe('scenarios + overrides', () => {
  it('POST scenario, POST override, DELETE override — all applied', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockAddScenario.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { scenarioId: SCENARIO_ID, scenarioType: 'custom' },
    });
    const createdScenario = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/scenarios`)
      .send({ scenarioType: 'custom', label: 'Custom' });
    expect(createdScenario.status).toBe(201);

    mockSetScenarioOverride.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 2,
      result: { overrideId: OVERRIDE_ID },
    });
    const setOverride = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/scenarios/${SCENARIO_ID}/overrides`)
      .send({ expectedVersion: 1, targetType: 'cost_line', targetId: COST_LINE_ID, overrideAmount: 500 });
    expect(setOverride.status).toBe(200);
    expect(setOverride.body.override.overrideId).toBe(OVERRIDE_ID);

    mockRemoveScenarioOverride.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-3',
      resultingVersion: 3,
      result: { overrideId: OVERRIDE_ID },
    });
    const removeOverride = await request(createApp())
      .delete(`/api/vnext/results/roi/cases/${CASE_ID}/scenarios/${SCENARIO_ID}/overrides/${OVERRIDE_ID}`)
      .send({ expectedVersion: 2 });
    expect(removeOverride.status).toBe(200);
  });

  it('maps RoiScenarioValidationError (override on a non-custom scenario) to 409', async () => {
    mockSetScenarioOverride.mockRejectedValueOnce(
      new RoiScenarioValidationError('Scenario is "downside" — overrides may only be set on "custom" scenarios', 'SCENARIO_NOT_CUSTOM')
    );
    const response = await request(createApp())
      .post(`/api/vnext/results/roi/cases/${CASE_ID}/scenarios/${SCENARIO_ID}/overrides`)
      .send({ expectedVersion: 1, targetType: 'cost_line', targetId: COST_LINE_ID, overrideAmount: 500 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SCENARIO_NOT_CUSTOM');
  });
});

describe('calculation-runs: POST/GET', () => {
  it('POST creates a run (201), GET lists runs, GET fetches a single run', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockCreateRoiCalculationRun.mockResolvedValueOnce({
      outcome: 'applied',
      eventId: 'evt-1',
      resultingVersion: 1,
      result: { runId: RUN_ID, status: 'completed', npv: 1234 },
    });
    const created = await request(createApp()).post(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-runs`).send({});
    expect(created.status).toBe(201);
    expect(created.body.run.runId).toBe(RUN_ID);

    mockListCalculationRuns.mockResolvedValueOnce([{ runId: RUN_ID }]);
    const list = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-runs`);
    expect(list.status).toBe(200);
    expect(list.body.runs).toHaveLength(1);

    mockGetCalculationRun.mockResolvedValueOnce({ runId: RUN_ID, status: 'completed' });
    const single = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-runs/${RUN_ID}`);
    expect(single.status).toBe(200);
    expect(single.body.run.runId).toBe(RUN_ID);

    mockGetCalculationRun.mockResolvedValueOnce(null);
    const missing = await request(createApp()).get(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-runs/${RUN_ID}`);
    expect(missing.status).toBe(404);
  });

  it('maps RoiCalculationRunValidationError (case not runnable) to 409', async () => {
    mockGetRoiCase.mockResolvedValueOnce(caseFixture());
    mockCreateRoiCalculationRun.mockRejectedValueOnce(
      new RoiCalculationRunValidationError('ROI case is "approved" — a calculation run may only be created while modeling/ready_for_review', 'CASE_NOT_RUNNABLE')
    );
    const response = await request(createApp()).post(`/api/vnext/results/roi/cases/${CASE_ID}/calculation-runs`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CASE_NOT_RUNNABLE');
  });
});
