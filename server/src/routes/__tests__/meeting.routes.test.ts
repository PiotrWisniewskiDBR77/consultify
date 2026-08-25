/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGet = vi.fn();

vi.mock('../../services/meetingService.js', () => ({
  ensureMeetingTables: vi.fn().mockResolvedValue(undefined),
  createMeeting: (...a: unknown[]) => mockCreate(...a),
  listMeetings: (...a: unknown[]) => mockList(...a),
  updateMeeting: (...a: unknown[]) => mockUpdate(...a),
  deleteMeeting: (...a: unknown[]) => mockDelete(...a),
  updateMeetingStatus: (...a: unknown[]) => mockUpdateStatus(...a),
  getMeeting: (...a: unknown[]) => mockGet(...a),
}));

// Auth mock reads an `x-test-role` header so a single app instance can simulate
// any membership role (defaults to admin so the existing destructive-op tests
// keep exercising the happy path after the L-04 role gate was added).
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    const role = String(req.headers['x-test-role'] || 'admin');
    req.user = { id: 'user-1', organizationId: 'org-1', role };
    req.userRole = role;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

// `closedBetaModuleGate` is real production middleware — it mirrors
// `MODULE_MEETING: 'closed'` in `betaAccess.ts` and correctly 403s EVERY
// non-admin-tier request to this whole router (by owner decision: a
// closed-beta module is invisible to regular users, not just its
// destructive routes — see `betaAccess.ts` MODULE_ECONOMICS comment for the
// same policy). That is a coarser, orthogonal gate from the L-04 role split
// this file tests (destructive ops require admin/owner/superadmin; read/
// create stay open to every member). Mocked to a pass-through here so this
// suite can exercise L-04's per-operation logic in isolation with a
// non-admin role — the real gate stays fully wired in meeting.routes.ts for
// actual traffic; nothing here weakens it.
vi.mock('../../middleware/betaGate.middleware.js', () => ({
  betaGate: (_req: any, _res: any, next: () => void) => next(),
  closedBetaModuleGate: (_req: any, _res: any, next: () => void) => next(),
  createBetaGate: () => (_req: any, _res: any, next: () => void) => next(),
}));

import meetingRoutes from '../meeting.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRoutes);
  return app;
}

const sampleMeeting = {
  id: 'meeting-1',
  organizationId: 'org-1',
  title: 'Kickoff',
  startAt: '2026-07-01T10:00:00.000Z',
  endAt: '2026-07-01T11:00:00.000Z',
  attendees: [],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'scheduled',
  createdBy: 'user-1',
};

describe('meeting routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(sampleMeeting);
  });

  it('GET / lists meetings for the org', async () => {
    mockList.mockResolvedValue([sampleMeeting]);
    const res = await request(createApp()).get('/api/meeting');
    expect(res.status).toBe(200);
    expect(res.body.meetings).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith({ organizationId: 'org-1', projectId: null });
  });

  it('GET /:id returns a single meeting shaped like a list row', async () => {
    mockGet.mockResolvedValue(sampleMeeting);
    const res = await request(createApp()).get('/api/meeting/meeting-1');
    expect(res.status).toBe(200);
    expect(res.body.meeting.id).toBe('meeting-1');
    expect(res.body.meeting.title).toBe('Kickoff');
    // Org scope comes from the token, never a client-supplied param.
    expect(mockGet).toHaveBeenCalledWith({ organizationId: 'org-1', meetingId: 'meeting-1' });
  });

  it('GET /:id returns 404 when the meeting does not exist', async () => {
    mockGet.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/meeting/missing');
    expect(res.status).toBe(404);
  });

  it('GET /:id returns 404 (not 200/leak) for a different organization\'s meeting id', async () => {
    // getMeeting's own `WHERE organization_id = ?` excludes rows outside the
    // caller's org — mockGet returning null here simulates exactly that,
    // regardless of what id was requested.
    mockGet.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/meeting/other-org-meeting');
    expect(res.status).toBe(404);
    expect(mockGet).toHaveBeenCalledWith({
      organizationId: 'org-1',
      meetingId: 'other-org-meeting',
    });
  });

  it('GET /:id returns 404 for a same-org meeting the requester cannot access (not creator/attendee/admin)', async () => {
    mockGet.mockResolvedValue({
      ...sampleMeeting,
      createdBy: 'someone-else',
      attendees: ['not-this-user@example.com'],
    });
    const res = await request(createApp())
      .get('/api/meeting/meeting-1')
      .set('x-test-role', 'team_member');
    expect(res.status).toBe(404);
  });

  it('GET /:id succeeds for a non-admin attendee of the meeting', async () => {
    mockGet.mockResolvedValue({ ...sampleMeeting, createdBy: 'someone-else', attendees: ['user-1'] });
    const res = await request(createApp())
      .get('/api/meeting/meeting-1')
      .set('x-test-role', 'team_member');
    expect(res.status).toBe(200);
    expect(res.body.meeting.id).toBe('meeting-1');
  });

  it('POST / creates a meeting', async () => {
    mockCreate.mockResolvedValue(sampleMeeting);
    const res = await request(createApp())
      .post('/api/meeting')
      .send({ title: 'Kickoff', startAt: '2026-07-01T10:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body.meeting.id).toBe('meeting-1');
  });

  it('POST / rejects missing title', async () => {
    const res = await request(createApp())
      .post('/api/meeting')
      .send({ startAt: '2026-07-01T10:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('POST / rejects embedded decisions instead of silently dropping them', async () => {
    const res = await request(createApp()).post('/api/meeting').send({
      title: 'Kickoff',
      startAt: '2026-07-01T10:00:00.000Z',
      decisions: ['Ship'],
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MEETING_PROPOSAL_REQUIRED');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('PUT /:id updates core fields', async () => {
    mockUpdate.mockResolvedValue({ ...sampleMeeting, title: 'Renamed' });
    const res = await request(createApp())
      .put('/api/meeting/meeting-1')
      .send({ title: 'Renamed', location: 'Office' });
    expect(res.status).toBe(200);
    expect(res.body.meeting.title).toBe('Renamed');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        meetingId: 'meeting-1',
        title: 'Renamed',
        location: 'Office',
      })
    );
  });

  it('PUT /:id rejects an empty title', async () => {
    const res = await request(createApp()).put('/api/meeting/meeting-1').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('PUT /:id rejects embedded follow-ups instead of silently dropping them', async () => {
    const res = await request(createApp())
      .put('/api/meeting/meeting-1')
      .send({ followUps: [{ title: 'Bypass' }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MEETING_PROPOSAL_REQUIRED');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('PUT /:id returns 404 when the meeting is missing', async () => {
    mockGet.mockResolvedValue(null);
    const res = await request(createApp()).put('/api/meeting/missing').send({ title: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes a meeting', async () => {
    mockDelete.mockResolvedValue(true);
    const res = await request(createApp()).delete('/api/meeting/meeting-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({
      organizationId: 'org-1',
      meetingId: 'meeting-1',
    });
  });

  it('DELETE /:id returns 404 when nothing was deleted', async () => {
    mockDelete.mockResolvedValue(false);
    const res = await request(createApp()).delete('/api/meeting/missing');
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/status validates the status value', async () => {
    const res = await request(createApp())
      .patch('/api/meeting/meeting-1/status')
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status updates status', async () => {
    mockUpdateStatus.mockResolvedValue({ ...sampleMeeting, status: 'completed' });
    const res = await request(createApp())
      .patch('/api/meeting/meeting-1/status')
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.meeting.status).toBe('completed');
  });

  it('POST /:id/decisions retires the direct writer', async () => {
    const res = await request(createApp())
      .post('/api/meeting/meeting-1/decisions')
      .send({ decision: 'Ship' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('MEETING_PROPOSAL_REQUIRED');
  });

  it('POST /:id/follow-ups retires the direct writer', async () => {
    const res = await request(createApp())
      .post('/api/meeting/meeting-1/follow-ups')
      .send({ title: 'Recap', owner: 'Bob' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('MEETING_PROPOSAL_REQUIRED');
  });

  // L-04: role gate on destructive/administrative operations. Org-scope alone
  // let any member DELETE / change status; now DELETE requires admin/owner/
  // superadmin, and status (relaxed by FIX-M-3, DEC-58 sceptyk 2026-08-25)
  // requires admin/owner/superadmin OR the meeting's own creator — mirroring
  // the admin-or-creator check PUT /:id already used before this fix.
  describe('L-04 role gate', () => {
    it('DELETE /:id returns 403 for a non-admin member', async () => {
      const res = await request(createApp())
        .delete('/api/meeting/meeting-1')
        .set('x-test-role', 'team_member');
      expect(res.status).toBe(403);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('DELETE /:id is allowed for an admin', async () => {
      mockDelete.mockResolvedValue(true);
      const res = await request(createApp())
        .delete('/api/meeting/meeting-1')
        .set('x-test-role', 'admin');
      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith({
        organizationId: 'org-1',
        meetingId: 'meeting-1',
      });
    });

    it('DELETE /:id is allowed for an owner', async () => {
      mockDelete.mockResolvedValue(true);
      const res = await request(createApp())
        .delete('/api/meeting/meeting-1')
        .set('x-test-role', 'owner');
      expect(res.status).toBe(200);
    });

    it('PATCH /:id/status returns 404 for a non-admin member who is not the creator', async () => {
      mockGet.mockResolvedValue({ ...sampleMeeting, createdBy: 'someone-else' });
      const res = await request(createApp())
        .patch('/api/meeting/meeting-1/status')
        .set('x-test-role', 'team_member')
        .send({ status: 'completed' });
      // denyMeetingAccess deliberately answers 404 (not 403) to avoid
      // revealing a same-tenant meeting's existence to a non-participant —
      // same status code PUT /:id already uses for this exact check.
      expect(res.status).toBe(404);
      expect(mockUpdateStatus).not.toHaveBeenCalled();
    });

    it('PATCH /:id/status is allowed for an admin', async () => {
      mockUpdateStatus.mockResolvedValue({ ...sampleMeeting, status: 'completed' });
      const res = await request(createApp())
        .patch('/api/meeting/meeting-1/status')
        .set('x-test-role', 'admin')
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.meeting.status).toBe('completed');
    });

    it('PATCH /:id/status is allowed for the meeting creator without an admin role (FIX-M-3)', async () => {
      mockGet.mockResolvedValue({ ...sampleMeeting, createdBy: 'user-1' });
      mockUpdateStatus.mockResolvedValue({ ...sampleMeeting, status: 'completed' });
      const res = await request(createApp())
        .patch('/api/meeting/meeting-1/status')
        .set('x-test-role', 'team_member')
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.meeting.status).toBe('completed');
    });

    it('read (GET) and create (POST) stay open to non-admin members', async () => {
      mockList.mockResolvedValue([sampleMeeting]);
      mockCreate.mockResolvedValue(sampleMeeting);
      const listRes = await request(createApp())
        .get('/api/meeting')
        .set('x-test-role', 'team_member');
      expect(listRes.status).toBe(200);
      const createRes = await request(createApp())
        .post('/api/meeting')
        .set('x-test-role', 'team_member')
        .send({ title: 'Kickoff', startAt: '2026-07-01T10:00:00.000Z' });
      expect(createRes.status).toBe(201);
    });
  });
});
