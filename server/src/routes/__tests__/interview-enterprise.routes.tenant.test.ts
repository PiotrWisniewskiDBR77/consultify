/**
 * Cross-org tenant regression test for the interview-enterprise router
 * (`/api/interview-v4`).
 *
 * Two contracts are pinned here, both at the REQUEST layer — the tests speak
 * HTTP and never call the service directly, because the hole being closed was
 * that a request could *choose* the tenant the service was then handed.
 *
 * 1. `requireUser()` derives the caller org ONLY from the auth-middleware-
 *    VALIDATED context (`req.user.organizationId` / `req.organizationId`).
 *    It must NOT fall back to the raw `x-organization-id` header or the
 *    `?organizationId` query param. With the old fallback, `verifyToken` admits
 *    a token with no resolvable ACTIVE org (`req.organizationId === ''`), and
 *    the caller could then assert ANY org id — at which point
 *    interviewEnterpriseService faithfully scoped every read and write to that
 *    victim org: its findings, its evidence access log, minting and revoking
 *    invite tokens for its sessions, promoting its findings onto initiatives,
 *    signing off its company-context versions. Re-filtering by
 *    `organization_id` in SQL does not help when the filter value is the
 *    attacker's own input.
 *
 * 2. The authenticated half of the router is gated CENTRALLY (`verifyToken` +
 *    `requireOrgAccess()`), the way `routes/audits/index.ts` gates its
 *    sub-routers — so a route added later inherits the gate instead of having
 *    to remember it. The three public token routes stay reachable below/above
 *    that gate, since the respondent has no account.
 *
 * The auth middleware is a test double so the "validated context" can be set
 * exactly; `requireOrgAccess` is the REAL middleware under test.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Service double
// ---------------------------------------------------------------------------
const mockGetFindings = vi.fn();
const mockGetSegments = vi.fn();
const mockGetEvidenceAccessLog = vi.fn();
const mockCreateDistribution = vi.fn();
const mockRevokeDistribution = vi.fn();
const mockPromoteFinding = vi.fn();
const mockSignOffContextVersion = vi.fn();
const mockGetContextVersions = vi.fn();
const mockResolveActiveDistributionByToken = vi.fn();

vi.mock('../../services/interviewEnterpriseService.js', () => ({
  // Declared inside the factory: `vi.mock` is hoisted above every top-level
  // binding in this file, so a class defined outside would be in its TDZ here.
  InterviewDistributionError: class extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number
    ) {
      super(message);
      this.name = 'InterviewDistributionError';
    }
  },
  interviewEnterpriseService: {
    getFindings: (...a: unknown[]) => mockGetFindings(...a),
    getSegments: (...a: unknown[]) => mockGetSegments(...a),
    getEvidenceAccessLog: (...a: unknown[]) => mockGetEvidenceAccessLog(...a),
    createDistribution: (...a: unknown[]) => mockCreateDistribution(...a),
    revokeDistribution: (...a: unknown[]) => mockRevokeDistribution(...a),
    promoteFindingToInitiative: (...a: unknown[]) => mockPromoteFinding(...a),
    signOffContextVersion: (...a: unknown[]) => mockSignOffContextVersion(...a),
    getContextVersions: (...a: unknown[]) => mockGetContextVersions(...a),
    resolveActiveDistributionByToken: (...a: unknown[]) =>
      mockResolveActiveDistributionByToken(...a),
    // Remaining methods kept as no-op spies so the module shape stays intact.
    createSegment: vi.fn(),
    createQuota: vi.fn(),
    getQuotas: vi.fn(),
    getDistributions: vi.fn(),
    getDistributionStats: vi.fn(),
    markDistributionSent: vi.fn(),
    createReminderSchedule: vi.fn(),
    createDiagnosticsSnapshot: vi.fn(),
    getDiagnosticsSnapshots: vi.fn(),
    createFinding: vi.fn(),
    updateFindingStatus: vi.fn(),
    checkCohortSize: vi.fn(),
    checkExportGating: vi.fn(),
    createContextVersion: vi.fn(),
    getContextVersion: vi.fn(),
    diffContextVersions: vi.fn(),
  },
}));

const mockReadPublicQuestionSnapshot = vi.fn();
vi.mock('../../services/interviewPublicAnswerService.js', () => ({
  PUBLIC_ANSWER_STATUS: { CONFLICT: 409, NOT_FOUND: 404 },
  completeDistributionByToken: vi.fn(),
  readPublicQuestionSnapshot: (...a: unknown[]) => mockReadPublicQuestionSnapshot(...a),
  savePublicAnswer: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Middleware doubles. `requireOrgAccess` is deliberately NOT mocked.
// ---------------------------------------------------------------------------
let mockCtx: { userId?: string; userOrg?: string; reqOrg?: string } = {};

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

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

// Pass-through limiters that record that they ran, so the wiring (which limiter
// guards which route) is pinned without having to exhaust a real bucket.
const apiAuthLimiterCalls = vi.fn();
const publicAnswerLimiterCalls = vi.fn();
const publicLookupLimiterCalls = vi.fn();
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => {
    apiAuthLimiterCalls();
    next();
  },
  interviewPublicAnswerRateLimiter: (_req: any, _res: any, next: () => void) => {
    publicAnswerLimiterCalls();
    next();
  },
  interviewPublicDistributionLookupRateLimiter: (_req: any, _res: any, next: () => void) => {
    publicLookupLimiterCalls();
    next();
  },
}));

import interviewEnterpriseRoutes from '../interview-enterprise.routes.js';

const VICTIM_ORG = 'org-victim-confidential';
const VALID_ORG = 'org-legit-member';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/interview-v4', interviewEnterpriseRoutes);
  return app;
}

describe('interview-v4 routes — tenant resolution is token-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFindings.mockResolvedValue([]);
    mockGetSegments.mockResolvedValue([]);
    mockGetEvidenceAccessLog.mockResolvedValue([]);
    mockGetContextVersions.mockResolvedValue([]);
    mockCreateDistribution.mockResolvedValue({ id: 'dist-1' });
    mockRevokeDistribution.mockResolvedValue(true);
    mockPromoteFinding.mockResolvedValue(true);
    mockSignOffContextVersion.mockResolvedValue(true);
  });

  // -------------------------------------------------------------------------
  // Negative: an orgless token cannot name a tenant from the request.
  // -------------------------------------------------------------------------
  describe('no validated org — an asserted org in header/query is refused', () => {
    beforeEach(() => {
      mockCtx = { userId: 'user-orgless', userOrg: '', reqOrg: '' };
    });

    it('GET findings + x-organization-id header → 403, victim findings never read', async () => {
      const res = await request(createApp())
        .get('/api/interview-v4/sessions/sess-1/findings')
        .set('x-organization-id', VICTIM_ORG);
      expect(res.status).toBe(403);
      expect(mockGetFindings).not.toHaveBeenCalled();
    });

    it('GET findings + ?organizationId query → 403, victim findings never read', async () => {
      const res = await request(createApp()).get(
        `/api/interview-v4/sessions/sess-1/findings?organizationId=${VICTIM_ORG}`
      );
      expect(res.status).toBe(403);
      expect(mockGetFindings).not.toHaveBeenCalled();
    });

    it('GET evidence access-log + asserted header → 403, victim audit trail never read', async () => {
      const res = await request(createApp())
        .get('/api/interview-v4/evidence/ev-1/access-log')
        .set('x-organization-id', VICTIM_ORG);
      expect(res.status).toBe(403);
      expect(mockGetEvidenceAccessLog).not.toHaveBeenCalled();
    });

    it('POST distributions (invite-token MINT) + asserted header → 403, no token minted', async () => {
      const res = await request(createApp())
        .post('/api/interview-v4/sessions/sess-1/distributions')
        .set('x-organization-id', VICTIM_ORG)
        .send({ channel: 'link' });
      expect(res.status).toBe(403);
      expect(mockCreateDistribution).not.toHaveBeenCalled();
    });

    it('POST revoke (invite-token REVOKE) + asserted header → 403, nothing revoked', async () => {
      const res = await request(createApp())
        .post('/api/interview-v4/distributions/dist-1/revoke')
        .set('x-organization-id', VICTIM_ORG);
      expect(res.status).toBe(403);
      expect(mockRevokeDistribution).not.toHaveBeenCalled();
    });

    it('POST findings/:id/promote + asserted header → 403, no promotion written', async () => {
      const res = await request(createApp())
        .post('/api/interview-v4/findings/find-1/promote')
        .set('x-organization-id', VICTIM_ORG)
        .send({ initiativeId: 'init-1' });
      expect(res.status).toBe(403);
      expect(mockPromoteFinding).not.toHaveBeenCalled();
    });

    it('POST context sign-off + asserted header → 403, no sign-off written', async () => {
      const res = await request(createApp())
        .post('/api/interview-v4/context/versions/v-1/sign-off')
        .set('x-organization-id', VICTIM_ORG);
      expect(res.status).toBe(403);
      expect(mockSignOffContextVersion).not.toHaveBeenCalled();
    });

    it('refuses with no body at all — the gate does not depend on request shape', async () => {
      const res = await request(createApp()).get('/api/interview-v4/context/versions');
      expect(res.status).toBe(403);
      expect(mockGetContextVersions).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Positive: a legitimate caller works, and their header cannot widen reach.
  // -------------------------------------------------------------------------
  describe('validated org present', () => {
    it('scopes reads to the VALIDATED org and ignores an attacker-supplied header org', async () => {
      mockCtx = { userId: 'user-legit', userOrg: VALID_ORG, reqOrg: VALID_ORG };
      const res = await request(createApp())
        .get('/api/interview-v4/sessions/sess-1/findings')
        .set('x-organization-id', VICTIM_ORG);
      expect(res.status).toBe(200);
      expect(mockGetFindings).toHaveBeenCalledWith(VALID_ORG, 'sess-1', undefined);
      expect(mockGetFindings).not.toHaveBeenCalledWith(
        VICTIM_ORG,
        expect.anything(),
        expect.anything()
      );
    });

    it('a query-param org cannot redirect a WRITE away from the validated org', async () => {
      mockCtx = { userId: 'user-legit', userOrg: VALID_ORG, reqOrg: VALID_ORG };
      const res = await request(createApp())
        .post(`/api/interview-v4/sessions/sess-1/distributions?organizationId=${VICTIM_ORG}`)
        .send({ channel: 'link' });
      expect(res.status).toBe(201);
      expect(mockCreateDistribution).toHaveBeenCalledWith(VALID_ORG, 'sess-1', {
        channel: 'link',
      });
    });

    it('falls back to req.organizationId (validated) when req.user.organizationId is empty', async () => {
      mockCtx = { userId: 'user-legit', userOrg: '', reqOrg: VALID_ORG };
      const res = await request(createApp()).get('/api/interview-v4/sessions/sess-1/segments');
      expect(res.status).toBe(200);
      expect(mockGetSegments).toHaveBeenCalledWith(VALID_ORG, 'sess-1');
    });
  });

  // -------------------------------------------------------------------------
  // The central gate itself.
  // -------------------------------------------------------------------------
  describe('central gating', () => {
    it('the authenticated half runs the api rate limiter before the handler', async () => {
      mockCtx = { userId: 'user-legit', userOrg: VALID_ORG, reqOrg: VALID_ORG };
      await request(createApp()).get('/api/interview-v4/sessions/sess-1/findings');
      expect(apiAuthLimiterCalls).toHaveBeenCalled();
    });

    it('the public invite LOOKUP is rate-limited and needs no auth context', async () => {
      mockCtx = {};
      mockResolveActiveDistributionByToken.mockResolvedValue({
        id: 'dist-1',
        sessionId: 'sess-1',
        status: 'pending',
        anonymityMode: 'identified',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
      mockReadPublicQuestionSnapshot.mockResolvedValue({
        questions: [],
        templateId: 't-1',
        templateVersion: 1,
      });
      const res = await request(createApp()).get('/api/interview-v4/public/distributions/tok-1');
      expect(res.status).toBe(200);
      expect(publicLookupLimiterCalls).toHaveBeenCalled();
      // The public half must never be pulled behind the authenticated gate.
      expect(apiAuthLimiterCalls).not.toHaveBeenCalled();
    });

    it('the public lookup response carries no tenant identifier', async () => {
      mockCtx = {};
      mockResolveActiveDistributionByToken.mockResolvedValue({
        id: 'dist-1',
        sessionId: 'sess-1',
        status: 'pending',
        anonymityMode: 'anonymous',
        expiresAt: '2099-01-01T00:00:00.000Z',
        organizationId: VICTIM_ORG,
      });
      mockReadPublicQuestionSnapshot.mockResolvedValue({
        questions: [],
        templateId: 't-1',
        templateVersion: 1,
      });
      const res = await request(createApp()).get('/api/interview-v4/public/distributions/tok-1');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(VICTIM_ORG);
    });
  });
});
