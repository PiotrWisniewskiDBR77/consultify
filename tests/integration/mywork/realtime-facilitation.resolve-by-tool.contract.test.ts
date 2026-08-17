/**
 * B1 (M09) — GET /realtime-v4/facilitation/sessions/by-tool/:toolSessionId
 *
 * Read-only resolve of the ACTIVE shared facilitation session for a tool_session_id
 * (e.g. `whiteboard:<ideaId>`) WITHOUT creating one. Used on board-open to resolve the
 * caller's role and enforce observer read-only while keeping facilitation lazy.
 *   - active session present → 200 { session: {...} }
 *   - none active           → 200 { session: null }  (NOT 404 — absence == "no facilitation")
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetActiveByTool = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
  validateOrgMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/realtimePlatformService.js', () => ({
  realtimePlatformService: {
    getActiveFacilitationSessionByTool: (...args: unknown[]) => mockGetActiveByTool(...args),
    // Unused by these tests but referenced by other routes in the module.
    createFacilitationSession: vi.fn(),
    getFacilitationSession: vi.fn(),
    updateTimerState: vi.fn(),
    updatePhase: vi.fn(),
    endFacilitationSession: vi.fn(),
    castVote: vi.fn(),
    getVotes: vi.fn(),
    getVoteSummary: vi.fn(),
    assignRole: vi.fn(),
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

describe('B1 (M09) — facilitation resolve-by-tool (read-only)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('active session present → 200 with { session }', async () => {
    mockGetActiveByTool.mockResolvedValueOnce({
      id: 'fac-1',
      tool_session_id: 'whiteboard:idea-1',
      facilitator_id: 'owner-9',
      status: 'active',
    });

    const res = await request(createApp()).get(
      `/api/realtime-v4/facilitation/sessions/by-tool/${encodeURIComponent('whiteboard:idea-1')}`
    );

    expect(res.status).toBe(200);
    expect(res.body.session?.id).toBe('fac-1');
    // Org scope is enforced in the service; route passes org-1 through.
    expect(mockGetActiveByTool).toHaveBeenCalledWith('org-1', 'whiteboard:idea-1');
  });

  it('no active session → 200 with { session: null } (not 404)', async () => {
    mockGetActiveByTool.mockResolvedValueOnce(null);

    const res = await request(createApp()).get(
      `/api/realtime-v4/facilitation/sessions/by-tool/${encodeURIComponent('whiteboard:idea-none')}`
    );

    expect(res.status).toBe(200);
    expect(res.body.session).toBeNull();
  });
});
