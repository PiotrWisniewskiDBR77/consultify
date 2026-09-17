/**
 * ST-2 (DEC-540 / U-09, Wpis 75 P1#2) — server-side authorization on the
 * candidate accept endpoint.
 *
 * Accepting a candidate materializes a DRAFT initiative, so the SERVER (source
 * of truth, not the client) must restrict `POST /candidates/:id/accept` to the
 * candidate's author or an org ADMIN/OWNER. Any other member → 403 with code
 * `candidate_approve_forbidden` and the accept service is NOT invoked.
 *
 * MUTATION target: removing the `isCandidateApprover` guard in
 * `initiativeCandidates.routes.ts` turns the "other member → 403" test red.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-st2-1';
const AUTHOR = 'u-author';
const OTHER = 'u-other';
const CAND_ID = 'cand-1';

let currentUser: { id: string; organizationId: string; role: string } = {
  id: AUTHOR,
  organizationId: ORG,
  role: 'MEMBER',
};

const mockGetCandidateById = vi.fn();
const mockAcceptCandidate = vi.fn();

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/auth.middleware.js', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth.middleware.js')>(
    '../../middleware/auth.middleware.js'
  );
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      req.userRole = currentUser.role;
      next();
    },
    validateOrgMembership: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../services/initiative/initiativeCandidateService.js', () => ({
  getCandidateById: (...a: unknown[]) => mockGetCandidateById(...a),
  acceptCandidate: (...a: unknown[]) => mockAcceptCandidate(...a),
  listCandidates: vi.fn(async () => []),
  dismissCandidate: vi.fn(async () => true),
  scanForCandidates: vi.fn(async () => []),
}));

vi.mock('../../services/flowTransform/flowTransformLineageService.js', () => ({
  certifyFlowTransformLineage: vi.fn(),
  FlowTransformLineageError: class extends Error {},
}));

vi.mock('../../middleware/appErrorMapper.js', () => ({
  mapAppErrorResponse: vi.fn(() => ({ error: 'mapped' })),
}));

import initiativeCandidatesRouter from '../initiativeCandidates.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativeCandidatesRouter);
  return app;
}

const CANDIDATE = {
  id: CAND_ID,
  organizationId: ORG,
  sourceType: 'interview_insight_finding',
  title: 'Packing line changeover',
  rationale: 'from interview',
  status: 'pending',
  createdBy: AUTHOR,
};

describe('POST /api/initiatives/candidates/:id/accept — server-side author/admin guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: AUTHOR, organizationId: ORG, role: 'MEMBER' };
    mockGetCandidateById.mockResolvedValue({ ...CANDIDATE });
    mockAcceptCandidate.mockResolvedValue({
      receiptPersisted: true,
      initiativeId: 'init-1',
      filled: true,
    });
  });

  it('author (MEMBER) may accept → 200 and the accept service runs', async () => {
    currentUser = { id: AUTHOR, organizationId: ORG, role: 'MEMBER' };
    const res = await request(buildApp())
      .post(`/api/initiatives/candidates/${CAND_ID}/accept`)
      .send({ fill: true });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);
    expect(mockAcceptCandidate).toHaveBeenCalledTimes(1);
  });

  it('org ADMIN may accept another user candidate → 200', async () => {
    currentUser = { id: OTHER, organizationId: ORG, role: 'ADMIN' };
    const res = await request(buildApp())
      .post(`/api/initiatives/candidates/${CAND_ID}/accept`)
      .send({});
    expect(res.status).toBe(200);
    expect(mockAcceptCandidate).toHaveBeenCalledTimes(1);
  });

  it('org OWNER may accept another user candidate → 200', async () => {
    currentUser = { id: OTHER, organizationId: ORG, role: 'OWNER' };
    const res = await request(buildApp())
      .post(`/api/initiatives/candidates/${CAND_ID}/accept`)
      .send({});
    expect(res.status).toBe(200);
    expect(mockAcceptCandidate).toHaveBeenCalledTimes(1);
  });

  it('another MEMBER may NOT accept → 403 candidate_approve_forbidden and service NOT run', async () => {
    // MUTATION: removing the isCandidateApprover guard in the route turns this red.
    currentUser = { id: OTHER, organizationId: ORG, role: 'MEMBER' };
    const res = await request(buildApp())
      .post(`/api/initiatives/candidates/${CAND_ID}/accept`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('candidate_approve_forbidden');
    expect(mockAcceptCandidate).not.toHaveBeenCalled();
  });

  it('absent candidate → 404 and service NOT run', async () => {
    mockGetCandidateById.mockResolvedValue(null);
    const res = await request(buildApp())
      .post(`/api/initiatives/candidates/${CAND_ID}/accept`)
      .send({});
    expect(res.status).toBe(404);
    expect(mockAcceptCandidate).not.toHaveBeenCalled();
  });
});
