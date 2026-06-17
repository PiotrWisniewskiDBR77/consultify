/**
 * AUTH-CONTEXT regression test for the finance-enterprise router
 * (/api/finance-v4, also re-exported under the V8 surface).
 *
 * RESPONSE-LEAK / AUTH-COVERAGE sweep — M16 Finance.
 *
 * Contract under test: requireUser() must derive the caller org ONLY from the
 * auth-middleware-VALIDATED context (req.user.organizationId / req.organizationId).
 * It must NOT fall back to the raw `x-organization-id` request header or the
 * `?organizationId` query param.
 *
 * Why this matters: verifyToken admits a token with no resolvable ACTIVE org
 * (req.organizationId === ''). With the old unvalidated fallback, such a caller
 * could assert ANY org id via the header/query, and financeEnterpriseService would
 * faithfully filter every read/write by that asserted *victim* org — leaking that
 * org's confidential model versions / budgets / valuations / connectors. The
 * service re-filtering by org does NOT help when the filter value is attacker-
 * controlled.
 *
 * These tests pin: when the validated context has NO org, an asserted header/query
 * org yields 401 and the downstream service is NEVER invoked. When the validated
 * context DOES carry an org, the request proceeds with the validated org (and any
 * attacker-supplied header/query org is ignored).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetModelVersions = vi.fn();
const mockGetDimensions = vi.fn();
const mockGetConnectors = vi.fn();

vi.mock('../../services/financeEnterpriseService.js', () => ({
  financeEnterpriseService: {
    getModelVersions: (...a: unknown[]) => mockGetModelVersions(...a),
    getDimensions: (...a: unknown[]) => mockGetDimensions(...a),
    getConnectors: (...a: unknown[]) => mockGetConnectors(...a),
    // Unused-by-these-tests methods kept as no-op spies so the module shape is intact.
    createModelVersion: vi.fn(),
    compareVersions: vi.fn(),
    mergeVersion: vi.fn(),
    createDimension: vi.fn(),
    createAllocation: vi.fn(),
    getAllocations: vi.fn(),
    createConsolidation: vi.fn(),
    getConsolidations: vi.fn(),
    createBudgetVersion: vi.fn(),
    getBudgetVersions: vi.fn(),
    updateBudgetActuals: vi.fn(),
    approveBudget: vi.fn(),
    createForecastCycle: vi.fn(),
    getVarianceAlerts: vi.fn(),
    createConnector: vi.fn(),
    logSync: vi.fn(),
    getSyncLog: vi.fn(),
    createValuationSnapshot: vi.fn(),
    getValuationSnapshots: vi.fn(),
    getValuationAudit: vi.fn(),
    createAIAssumption: vi.fn(),
    getAIAssumptions: vi.fn(),
    acceptAIAssumption: vi.fn(),
    createROILink: vi.fn(),
    getROILinks: vi.fn(),
    captureRealizedValue: vi.fn(),
  },
}));

// Auth middleware test double. We control exactly what the "validated" context
// carries via mockCtx — mirroring verifyToken populating req.user / req.organizationId.
let mockCtx: {
  userId?: string;
  userOrg?: string;
  reqOrg?: string;
} = {};

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockCtx.userId
      ? { id: mockCtx.userId, organizationId: mockCtx.userOrg ?? '' }
      : undefined;
    req.userId = mockCtx.userId;
    // verifyToken always sets req.organizationId; '' when no ACTIVE org resolves.
    req.organizationId = mockCtx.reqOrg ?? '';
    next();
  },
}));

import financeEnterpriseRoutes from '../finance-enterprise.routes.js';

const VICTIM_ORG = 'org-victim-confidential';
const VALID_ORG = 'org-legit-member';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/finance-v4', financeEnterpriseRoutes);
  return app;
}

describe('finance-enterprise routes — auth-context org resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelVersions.mockResolvedValue([]);
    mockGetDimensions.mockResolvedValue([]);
    mockGetConnectors.mockResolvedValue([]);
  });

  it('GET /dimensions with NO validated org but an x-organization-id header → 401, service NOT called', async () => {
    mockCtx = { userId: 'user-orgless', userOrg: '', reqOrg: '' };
    const res = await request(createApp())
      .get('/api/finance-v4/dimensions')
      .set('x-organization-id', VICTIM_ORG);
    expect(res.status).toBe(401);
    expect(mockGetDimensions).not.toHaveBeenCalled();
  });

  it('GET /dimensions with NO validated org but a ?organizationId query → 401, service NOT called', async () => {
    mockCtx = { userId: 'user-orgless', userOrg: '', reqOrg: '' };
    const res = await request(createApp()).get(
      `/api/finance-v4/dimensions?organizationId=${VICTIM_ORG}`
    );
    expect(res.status).toBe(401);
    expect(mockGetDimensions).not.toHaveBeenCalled();
  });

  it('GET /connectors with NO validated org + asserted header → 401, never reads victim connectors', async () => {
    mockCtx = { userId: 'user-orgless', userOrg: '', reqOrg: '' };
    const res = await request(createApp())
      .get('/api/finance-v4/connectors')
      .set('x-organization-id', VICTIM_ORG);
    expect(res.status).toBe(401);
    expect(mockGetConnectors).not.toHaveBeenCalled();
  });

  it('GET /models/:id/versions with NO validated org + asserted header → 401, never reads victim versions', async () => {
    mockCtx = { userId: 'user-orgless', userOrg: '', reqOrg: '' };
    const res = await request(createApp())
      .get('/api/finance-v4/models/some-model/versions')
      .set('x-organization-id', VICTIM_ORG);
    expect(res.status).toBe(401);
    expect(mockGetModelVersions).not.toHaveBeenCalled();
  });

  it('uses the VALIDATED org from req.user and ignores an attacker-supplied header org', async () => {
    mockCtx = { userId: 'user-legit', userOrg: VALID_ORG, reqOrg: VALID_ORG };
    const res = await request(createApp())
      .get('/api/finance-v4/dimensions')
      .set('x-organization-id', VICTIM_ORG);
    expect(res.status).toBe(200);
    // Service is scoped to the VALIDATED org, never to the asserted header org.
    expect(mockGetDimensions).toHaveBeenCalledWith(VALID_ORG);
    expect(mockGetDimensions).not.toHaveBeenCalledWith(VICTIM_ORG);
  });

  it('falls back to req.organizationId (validated) when req.user.organizationId is empty', async () => {
    // verifyToken can leave req.user.organizationId === '' while still resolving
    // req.organizationId to a validated active org. That validated value is trusted.
    mockCtx = { userId: 'user-legit', userOrg: '', reqOrg: VALID_ORG };
    const res = await request(createApp()).get('/api/finance-v4/dimensions');
    expect(res.status).toBe(200);
    expect(mockGetDimensions).toHaveBeenCalledWith(VALID_ORG);
  });
});
