/**
 * HTTP-STATUS regression test for the finance-statements router
 * (POST /packs/:id/statements/:statementId/assign).
 *
 * M16 Finance — initiative-chain integrity sweep (wave-8 follow-up).
 *
 * Contract under test: the service assignStatementToExistingPack() ALREADY
 * enforces multi-tenant scope — it throws 'Statement pack not found' when the
 * pack id does not belong to the caller org, and 'Statement not found' when the
 * statement id does not belong to the caller org. The write is therefore already
 * blocked (no cross-org FK-injection). The defect this test pins is purely the
 * HTTP status: the route used to let that throw escape asyncHandler unhandled,
 * surfacing a misleading 500 instead of the correct 404.
 *
 * These tests pin: a cross-org pack id or statement id yields 404 (not 500),
 * the response carries the service's 'not found' message, and the success path
 * returns 200 with the recomputed pack detail. A NON-'not found' error must
 * still propagate (500) — the catch only narrows status for the known case.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAssign = vi.fn();
const mockGetPackDetail = vi.fn();

vi.mock('../../services/financialStatementPackService.js', () => ({
  assignStatementToExistingPack: (...a: unknown[]) => mockAssign(...a),
  getStatementPackDetail: (...a: unknown[]) => mockGetPackDetail(...a),
  // Other named exports the router imports — kept as no-op spies so the
  // module shape stays intact at import-eval time.
  detachStatementFromPack: vi.fn(),
  listStatementPacks: vi.fn(),
  recomputeStatementPackForOrganization: vi.fn(),
  syncStatementToPack: vi.fn(),
}));

// Auth middleware test double. verifyToken populates the validated org context;
// isAuthenticated is a pass-through here (the routes under test all read org via
// getOrgId(req) → req.organizationId).
let mockCtx: { userId?: string; reqOrg?: string } = {};

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockCtx.userId
      ? { id: mockCtx.userId, organizationId: mockCtx.reqOrg ?? '' }
      : undefined;
    req.userId = mockCtx.userId;
    req.organizationId = mockCtx.reqOrg ?? '';
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

import financeStatementsRoutes from '../finance-statements.routes.js';

const CALLER_ORG = 'org-legit-member';
const PACK_ID = 'pack-123';
const STATEMENT_ID = 'stmt-456';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/finance-statements', financeStatementsRoutes);
  return app;
}

describe('finance-statements routes — POST /packs/:id/statements/:statementId/assign status mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = { userId: 'user-legit', reqOrg: CALLER_ORG };
  });

  it('cross-org PACK (service throws "Statement pack not found") → 404, not 500', async () => {
    mockAssign.mockRejectedValue(new Error('Statement pack not found'));
    const res = await request(createApp()).post(
      `/api/finance-statements/packs/${PACK_ID}/statements/${STATEMENT_ID}/assign`
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Statement pack not found');
    // The mis-scoped write never produced a pack detail read.
    expect(mockGetPackDetail).not.toHaveBeenCalled();
  });

  it('cross-org STATEMENT (service throws "Statement not found") → 404, not 500', async () => {
    mockAssign.mockRejectedValue(new Error('Statement not found'));
    const res = await request(createApp()).post(
      `/api/finance-statements/packs/${PACK_ID}/statements/${STATEMENT_ID}/assign`
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Statement not found');
    expect(mockGetPackDetail).not.toHaveBeenCalled();
  });

  it('own-org assign succeeds → 200 with recomputed pack, service called with caller org', async () => {
    mockAssign.mockResolvedValue(undefined);
    mockGetPackDetail.mockResolvedValue({ id: PACK_ID, statements: [] });
    const res = await request(createApp()).post(
      `/api/finance-statements/packs/${PACK_ID}/statements/${STATEMENT_ID}/assign`
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, pack: { id: PACK_ID, statements: [] } });
    expect(mockAssign).toHaveBeenCalledWith({
      organizationId: CALLER_ORG,
      packId: PACK_ID,
      statementId: STATEMENT_ID,
    });
    expect(mockGetPackDetail).toHaveBeenCalledWith(CALLER_ORG, PACK_ID);
  });

  it('no validated org → 401, service NOT called', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).post(
      `/api/finance-statements/packs/${PACK_ID}/statements/${STATEMENT_ID}/assign`
    );
    expect(res.status).toBe(401);
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('non-"not found" service error still propagates (not masked as 404)', async () => {
    mockAssign.mockRejectedValue(new Error('database connection lost'));
    const res = await request(createApp()).post(
      `/api/finance-statements/packs/${PACK_ID}/statements/${STATEMENT_ID}/assign`
    );
    expect(res.status).not.toBe(404);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
