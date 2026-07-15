/**
 * SECURITY FIX — POST /realtime-v4/facilitation/sessions/:sessionId/roles
 *
 * Bug (audit-confirmed): assigning a facilitation role (e.g. `facilitator`, which
 * grants timer/voting/follow control over an M09 whiteboard session) required only
 * `verifyToken` (any authenticated user), with `userId` taken verbatim from the
 * request body. Any authenticated org member could hand themselves — or anyone
 * else — the facilitator role on someone else's whiteboard session.
 *
 * Fix: server/src/routes/realtime-platform.routes.ts now gates the mutation —
 * allowed only if the requester is (a) the session creator/owner
 * (tool_facilitation_sessions.facilitator_id), (b) already holds the
 * 'facilitator' role in THIS session (tool_facilitation_roles), or (c) an org
 * admin/owner/superadmin. Everyone else → 403. Org-scope (cross-org 404) was
 * already enforced via getFacilitationSession(orgId, sessionId) and is re-asserted
 * here.
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
const mockAssignRole = vi.fn();

vi.mock('../../../server/src/services/realtimePlatformService.js', () => ({
  realtimePlatformService: {
    getFacilitationSession: (...args: unknown[]) => mockGetFacilitationSession(...args),
    getRoleForUser: (...args: unknown[]) => mockGetRoleForUser(...args),
    assignRole: (...args: unknown[]) => mockAssignRole(...args),
    // Unused by these tests but referenced by other routes in the module.
    createFacilitationSession: vi.fn(),
    getActiveFacilitationSessionByTool: vi.fn(),
    updateTimerState: vi.fn(),
    updatePhase: vi.fn(),
    endFacilitationSession: vi.fn(),
    castVote: vi.fn(),
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

describe('SECURITY: POST facilitation/sessions/:sessionId/roles — authz gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'member',
      isSuperAdmin: false,
    };
  });

  it('cross-org session → 404 (org-scope re-asserted, no role check leaks existence)', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(null); // service already scopes by orgId

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'user-1', roleName: 'facilitator' });

    expect(res.status).toBe(404);
    expect(mockAssignRole).not.toHaveBeenCalled();
    expect(mockGetFacilitationSession).toHaveBeenCalledWith('org-1', 'fac-1');
  });

  it('unauthorized bystander (not owner, not facilitator, not admin) → 403, no assignment happens', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION); // owner is 'owner-9', requester is 'user-1'
    mockGetRoleForUser.mockResolvedValueOnce(null); // requester holds no role in this session

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'user-1', roleName: 'facilitator', permissions: ['timer', 'voting', 'follow'] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REALTIME_FACILITATION_ROLE_FORBIDDEN');
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it('unauthorized bystander trying to grant a role to SOMEONE ELSE → 403', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
    mockGetRoleForUser.mockResolvedValueOnce(null);

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'victim-42', roleName: 'facilitator' });

    expect(res.status).toBe(403);
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it('session creator/owner → 200, assignment proceeds', async () => {
    mockUser.current.id = 'owner-9'; // matches SESSION.facilitator_id
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
    mockAssignRole.mockResolvedValueOnce({ id: 'role-1' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'participant-2', roleName: 'observer' });

    expect(res.status).toBe(201);
    expect(mockAssignRole).toHaveBeenCalledWith('fac-1', {
      userId: 'participant-2',
      roleName: 'observer',
      permissions: undefined,
    });
    // Owner path never needs to look up an existing role for itself.
    expect(mockGetRoleForUser).not.toHaveBeenCalled();
  });

  it('existing facilitator (per tool_facilitation_roles) → 200, can assign others', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION); // requester 'user-1' is not the owner
    mockGetRoleForUser.mockResolvedValueOnce({ role_name: 'facilitator' });
    mockAssignRole.mockResolvedValueOnce({ id: 'role-2' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'participant-3', roleName: 'facilitator' });

    expect(res.status).toBe(201);
    expect(mockAssignRole).toHaveBeenCalled();
    expect(mockGetRoleForUser).toHaveBeenCalledWith('org-1', 'fac-1', 'user-1');
  });

  it('org admin (req.user.role=owner) → 200, can assign without holding a session role', async () => {
    mockUser.current.role = 'owner';
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
    mockAssignRole.mockResolvedValueOnce({ id: 'role-3' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'participant-4', roleName: 'facilitator' });

    expect(res.status).toBe(201);
    expect(mockAssignRole).toHaveBeenCalled();
    // Admin path is a short-circuit before the per-session role lookup.
    expect(mockGetRoleForUser).not.toHaveBeenCalled();
  });

  it('superadmin flag → 200, treated as org admin', async () => {
    mockUser.current.role = 'member';
    mockUser.current.isSuperAdmin = true;
    mockGetFacilitationSession.mockResolvedValueOnce(SESSION);
    mockAssignRole.mockResolvedValueOnce({ id: 'role-4' });

    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'participant-5', roleName: 'facilitator' });

    expect(res.status).toBe(201);
    expect(mockAssignRole).toHaveBeenCalled();
  });
});
