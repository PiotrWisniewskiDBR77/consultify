/**
 * SECURITY FIX — facilitation session *control* endpoints (M09 whiteboard)
 *
 *   PUT  /realtime-v4/facilitation/sessions/:sessionId/timer
 *   PUT  /realtime-v4/facilitation/sessions/:sessionId/phase
 *   POST /realtime-v4/facilitation/sessions/:sessionId/end
 *
 * Bug (audit-confirmed, sibling of the POST .../roles fix): each of these required
 * only `verifyToken` (any authenticated user) plus an org-scoped existence check.
 * Zero verification that the requester is actually running the session — so any
 * authenticated org member could end someone else's whiteboard session, flip its
 * phase (e.g. force everyone into 'voting'), or hijack the shared timer.
 *
 * Fix: server/src/routes/realtime-platform.routes.ts now runs the same
 * `ensureFacilitatorControl` gate used by POST .../roles — allowed only if the
 * requester is (a) the session creator/owner (tool_facilitation_sessions.facilitator_id),
 * (b) already holds the 'facilitator' role in THIS session (tool_facilitation_roles), or
 * (c) an org admin/owner/superadmin. Everyone else → 403
 * REALTIME_FACILITATION_CONTROL_FORBIDDEN. Org-scope (cross-org 404) was already
 * enforced via getFacilitationSession(orgId, sessionId) and is re-asserted here.
 *
 * The sibling POST .../votes endpoint is deliberately NOT gated (casting a vote is
 * ordinary participation; voterId is server-derived, never from the body) and is
 * asserted to remain open to plain members here.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = vi.hoisted(() => ({
  current: { id: 'user-1', organizationId: 'org-1', role: 'member', isSuperAdmin: false } as {
    id: string;
    organizationId: string;
    role?: string;
    isSuperAdmin?: boolean;
  },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = mockUser.current;
    req.userId = mockUser.current.id;
    req.organizationId = mockUser.current.organizationId;
    req.userRole = mockUser.current.role;
    next();
  },
}));

const mockGetFacilitationSession = vi.fn();
const mockGetRoleForUser = vi.fn();
const mockUpdateTimerState = vi.fn();
const mockUpdatePhase = vi.fn();
const mockEndFacilitationSession = vi.fn();
const mockCastVote = vi.fn();

vi.mock('../../../server/src/services/realtimePlatformService.js', () => ({
  realtimePlatformService: {
    getFacilitationSession: (...args: unknown[]) => mockGetFacilitationSession(...args),
    getRoleForUser: (...args: unknown[]) => mockGetRoleForUser(...args),
    updateTimerState: (...args: unknown[]) => mockUpdateTimerState(...args),
    updatePhase: (...args: unknown[]) => mockUpdatePhase(...args),
    endFacilitationSession: (...args: unknown[]) => mockEndFacilitationSession(...args),
    castVote: (...args: unknown[]) => mockCastVote(...args),
    // Unused by these tests but referenced by other routes in the module.
    createFacilitationSession: vi.fn(),
    getActiveFacilitationSessionByTool: vi.fn(),
    assignRole: vi.fn(),
    getVotes: vi.fn(),
    getVoteSummary: vi.fn(),
    getRoles: vi.fn(),
    createOutcome: vi.fn(),
    getOutcomes: vi.fn(),
    exportOutcome: vi.fn(),
  },
}));

import realtimePlatformRoutes from '../../../server/src/routes/realtime-platform.routes.ts';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

const SESSION = {
  id: 'fac-1',
  organization_id: 'org-1',
  tool_session_id: 'whiteboard:idea-1',
  facilitator_id: 'owner-9',
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.current = { id: 'user-1', organizationId: 'org-1', role: 'member', isSuperAdmin: false };
});

// The three control endpoints share the exact same gate; run the full matrix against
// each so a regression in any single handler is caught. `invoke` fires the request,
// `mutation` is the service method that must (not) run, `okStatus` is the success code.
const CONTROL_ENDPOINTS = [
  {
    name: 'PUT .../timer',
    okStatus: 200,
    mutation: () => mockUpdateTimerState,
    okReturn: { ok: true },
    invoke: () =>
      request(createApp())
        .put('/api/realtime-v4/facilitation/sessions/fac-1/timer')
        .send({ timerState: { running: true, remainingMs: 60000 } }),
  },
  {
    name: 'PUT .../phase',
    okStatus: 200,
    mutation: () => mockUpdatePhase,
    okReturn: { phase: 'voting' },
    invoke: () =>
      request(createApp())
        .put('/api/realtime-v4/facilitation/sessions/fac-1/phase')
        .send({ phase: 'voting' }),
  },
  {
    name: 'POST .../end',
    okStatus: 200,
    mutation: () => mockEndFacilitationSession,
    okReturn: { status: 'ended' },
    invoke: () =>
      request(createApp()).post('/api/realtime-v4/facilitation/sessions/fac-1/end').send({}),
  },
] as const;

describe.each(CONTROL_ENDPOINTS)(
  'SECURITY: facilitation control $name — authz gate',
  ({ okStatus, mutation, okReturn, invoke }) => {
    it('cross-org / missing session → 404 (org-scope re-asserted), no mutation', async () => {
      mockGetFacilitationSession.mockResolvedValueOnce(null); // service scopes by orgId

      const res = await invoke();

      expect(res.status).toBe(404);
      expect(mutation()).not.toHaveBeenCalled();
      expect(mockGetFacilitationSession).toHaveBeenCalledWith('org-1', 'fac-1');
    });

    it('unauthorized bystander (not owner, not facilitator, not admin) → 403, no mutation', async () => {
      mockGetFacilitationSession.mockResolvedValueOnce(SESSION); // owner is 'owner-9'
      mockGetRoleForUser.mockResolvedValueOnce(null); // requester holds no role here

      const res = await invoke();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('REALTIME_FACILITATION_CONTROL_FORBIDDEN');
      expect(mutation()).not.toHaveBeenCalled();
      expect(mockGetRoleForUser).toHaveBeenCalledWith('org-1', 'fac-1', 'user-1');
    });

    it('session creator/owner → success, mutation runs, no self-role lookup', async () => {
      mockUser.current.id = 'owner-9'; // matches SESSION.facilitator_id
      mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
      mutation().mockResolvedValueOnce(okReturn);

      const res = await invoke();

      expect(res.status).toBe(okStatus);
      expect(mutation()).toHaveBeenCalled();
      expect(mockGetRoleForUser).not.toHaveBeenCalled();
    });

    it('existing facilitator (per tool_facilitation_roles) → success', async () => {
      mockGetFacilitationSession.mockResolvedValueOnce(SESSION); // requester is not the owner
      mockGetRoleForUser.mockResolvedValueOnce({ role_name: 'facilitator' });
      mutation().mockResolvedValueOnce(okReturn);

      const res = await invoke();

      expect(res.status).toBe(okStatus);
      expect(mutation()).toHaveBeenCalled();
      expect(mockGetRoleForUser).toHaveBeenCalledWith('org-1', 'fac-1', 'user-1');
    });

    it('org admin (role=owner) → success without holding a session role', async () => {
      mockUser.current.role = 'owner';
      mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
      mutation().mockResolvedValueOnce(okReturn);

      const res = await invoke();

      expect(res.status).toBe(okStatus);
      expect(mutation()).toHaveBeenCalled();
      expect(mockGetRoleForUser).not.toHaveBeenCalled(); // admin short-circuits the lookup
    });

    it('superadmin flag → success, treated as org admin', async () => {
      mockUser.current.isSuperAdmin = true;
      mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
      mutation().mockResolvedValueOnce(okReturn);

      const res = await invoke();

      expect(res.status).toBe(okStatus);
      expect(mutation()).toHaveBeenCalled();
      expect(mockGetRoleForUser).not.toHaveBeenCalled();
    });
  }
);

describe('facilitation control — non-facilitator role names do NOT unlock control', () => {
  it('holding a non-facilitator session role (e.g. observer) → 403', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
    mockGetRoleForUser.mockResolvedValueOnce({ role_name: 'observer' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/end')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REALTIME_FACILITATION_CONTROL_FORBIDDEN');
    expect(mockEndFacilitationSession).not.toHaveBeenCalled();
  });
});

describe('facilitation votes — deliberately NOT gated (ordinary participation)', () => {
  it('plain org member can cast a vote as themselves → 201', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION); // requester 'user-1' is a bystander
    mockCastVote.mockResolvedValueOnce({ id: 'vote-1' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/votes')
      .send({ voteTargetId: 'idea-7', voteType: 'dot', voteValue: 1 });

    expect(res.status).toBe(201);
    // voterId is server-derived (the authenticated user), never taken from the body.
    expect(mockCastVote).toHaveBeenCalledWith(
      'fac-1',
      expect.objectContaining({ voterId: 'user-1', voteTargetId: 'idea-7' })
    );
    // No facilitator gate → the per-session role lookup is never consulted.
    expect(mockGetRoleForUser).not.toHaveBeenCalled();
  });
});
