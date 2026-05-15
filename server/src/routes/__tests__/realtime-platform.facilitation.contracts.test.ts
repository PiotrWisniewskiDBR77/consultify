/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateFacilitationSession = vi.fn();
const mockGetFacilitationSession = vi.fn();
const mockUpdateTimerState = vi.fn();
const mockCastVote = vi.fn();
const mockAssignRole = vi.fn();
const mockCreateOutcome = vi.fn();
const mockExportOutcome = vi.fn();

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../services/realtimePlatformService.js', () => ({
  realtimePlatformService: {
    createFacilitationSession: (...args: unknown[]) => mockCreateFacilitationSession(...args),
    getFacilitationSession: (...args: unknown[]) => mockGetFacilitationSession(...args),
    updateTimerState: (...args: unknown[]) => mockUpdateTimerState(...args),
    castVote: (...args: unknown[]) => mockCastVote(...args),
    assignRole: (...args: unknown[]) => mockAssignRole(...args),
    createOutcome: (...args: unknown[]) => mockCreateOutcome(...args),
    exportOutcome: (...args: unknown[]) => mockExportOutcome(...args),
    updatePhase: vi.fn(),
    endFacilitationSession: vi.fn(),
    getVotes: vi.fn(),
    getVoteSummary: vi.fn(),
    getRoles: vi.fn(),
    getOutcomes: vi.fn(),
  },
}));

import realtimePlatformRoutes from '../realtime-platform.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

describe('Realtime facilitation contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFacilitationSession.mockResolvedValue({ id: 'fac-1' });
    mockGetFacilitationSession.mockResolvedValue({ id: 'fac-1' });
    mockUpdateTimerState.mockResolvedValue({ ok: true });
    mockCastVote.mockResolvedValue({ id: 'vote-1' });
    mockAssignRole.mockResolvedValue({ id: 'role-1' });
    mockCreateOutcome.mockResolvedValue({ id: 'outcome-1' });
    mockExportOutcome.mockResolvedValue({ ok: true });
  });

  it('returns coded 400 for facilitation create payload validation failures', async () => {
    const res = await request(createApp()).post('/api/realtime-v4/facilitation/sessions').send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_SESSION_CREATE_PAYLOAD_INVALID');
    expect(mockCreateFacilitationSession).not.toHaveBeenCalled();
  });

  it('returns coded 404 when facilitation session is missing for mutators', async () => {
    mockGetFacilitationSession.mockResolvedValueOnce(null);

    const res = await request(createApp())
      .put('/api/realtime-v4/facilitation/sessions/fac-missing/timer')
      .send({ timerState: { remainingSeconds: 30 } });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REALTIME_FACILITATION_SESSION_NOT_FOUND');
    expect(mockUpdateTimerState).not.toHaveBeenCalled();
  });

  it('returns coded 400 for facilitation timer payload validation failures', async () => {
    const res = await request(createApp())
      .put('/api/realtime-v4/facilitation/sessions/fac-1/timer')
      .send({ timerState: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_TIMER_PAYLOAD_INVALID');
  });

  it('returns coded 400 for facilitation vote payload validation failures', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/votes')
      .send({ voteTargetId: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_VOTE_PAYLOAD_INVALID');
    expect(mockCastVote).not.toHaveBeenCalled();
  });

  it('returns coded 400 for facilitation role payload validation failures', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/roles')
      .send({ userId: 'user-2' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_ROLE_PAYLOAD_INVALID');
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it('returns coded 400 for facilitation outcome payload validation failures', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/facilitation/sessions/fac-1/outcomes')
      .send({ description: 'missing title' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_OUTCOME_PAYLOAD_INVALID');
    expect(mockCreateOutcome).not.toHaveBeenCalled();
  });

  it('returns coded 400 for facilitation export payload validation failures', async () => {
    const res = await request(createApp())
      .put('/api/realtime-v4/facilitation/outcomes/outcome-1/export')
      .send({ exportType: 'initiative' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_EXPORT_PAYLOAD_INVALID');
    expect(mockExportOutcome).not.toHaveBeenCalled();
  });

  it('returns coded 503 when facilitation substrate is unavailable', async () => {
    mockGetFacilitationSession.mockRejectedValueOnce(new Error('database timeout'));

    const res = await request(createApp()).get('/api/realtime-v4/facilitation/sessions/fac-1');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_FACILITATION_SUBSTRATE_UNAVAILABLE');
  });
});
