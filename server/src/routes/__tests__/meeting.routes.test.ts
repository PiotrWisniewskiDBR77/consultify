/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpdateStatus = vi.fn();
const mockAddDecision = vi.fn();
const mockAddFollowUp = vi.fn();
const mockUpdateFollowUpStatus = vi.fn();

vi.mock('../../services/meetingService.js', () => ({
  ensureMeetingTables: vi.fn().mockResolvedValue(undefined),
  createMeeting: (...a: unknown[]) => mockCreate(...a),
  listMeetings: (...a: unknown[]) => mockList(...a),
  updateMeeting: (...a: unknown[]) => mockUpdate(...a),
  deleteMeeting: (...a: unknown[]) => mockDelete(...a),
  updateMeetingStatus: (...a: unknown[]) => mockUpdateStatus(...a),
  addMeetingDecision: (...a: unknown[]) => mockAddDecision(...a),
  addMeetingFollowUp: (...a: unknown[]) => mockAddFollowUp(...a),
  updateMeetingFollowUpStatus: (...a: unknown[]) => mockUpdateFollowUpStatus(...a),
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

import meetingRoutes from '../meeting.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRoutes);
  return app;
}

// Reuse one Express instance for the complete file. Creating a fresh app for
// every Supertest request leaves overlapping ephemeral HTTP servers behind and
// makes later requests fail nondeterministically with ECONNRESET/socket hang up.
const app = createApp();

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
};

describe('meeting routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / lists meetings for the org', async () => {
    mockList.mockResolvedValue([sampleMeeting]);
    const res = await request(app).get('/api/meeting');
    expect(res.status).toBe(200);
    expect(res.body.meetings).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith({ organizationId: 'org-1', projectId: null });
  });

  it('POST / creates a meeting', async () => {
    mockCreate.mockResolvedValue(sampleMeeting);
    const res = await request(app)
      .post('/api/meeting')
      .send({ title: 'Kickoff', startAt: '2026-07-01T10:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body.meeting.id).toBe('meeting-1');
  });

  it('POST / rejects missing title', async () => {
    const res = await request(app)
      .post('/api/meeting')
      .send({ startAt: '2026-07-01T10:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('PUT /:id updates core fields', async () => {
    mockUpdate.mockResolvedValue({ ...sampleMeeting, title: 'Renamed' });
    const res = await request(app)
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
    const res = await request(app).put('/api/meeting/meeting-1').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('PUT /:id returns 404 when the meeting is missing', async () => {
    mockUpdate.mockResolvedValue(null);
    const res = await request(app).put('/api/meeting/missing').send({ title: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes a meeting', async () => {
    mockDelete.mockResolvedValue(true);
    const res = await request(app).delete('/api/meeting/meeting-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({
      organizationId: 'org-1',
      meetingId: 'meeting-1',
    });
  });

  it('DELETE /:id returns 404 when nothing was deleted', async () => {
    mockDelete.mockResolvedValue(false);
    const res = await request(app).delete('/api/meeting/missing');
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/status validates the status value', async () => {
    const res = await request(app)
      .patch('/api/meeting/meeting-1/status')
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status updates status', async () => {
    mockUpdateStatus.mockResolvedValue({ ...sampleMeeting, status: 'completed' });
    const res = await request(app)
      .patch('/api/meeting/meeting-1/status')
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.meeting.status).toBe('completed');
  });

  it('POST /:id/decisions appends a decision', async () => {
    mockAddDecision.mockResolvedValue({ ...sampleMeeting, decisions: ['Ship'] });
    const res = await request(app)
      .post('/api/meeting/meeting-1/decisions')
      .send({ decision: 'Ship' });
    expect(res.status).toBe(201);
    expect(res.body.meeting.decisions).toContain('Ship');
  });

  it('POST /:id/follow-ups adds a follow-up', async () => {
    mockAddFollowUp.mockResolvedValue({
      ...sampleMeeting,
      followUps: [{ id: 'fu-1', title: 'Recap', owner: 'Bob', status: 'open' }],
    });
    const res = await request(app)
      .post('/api/meeting/meeting-1/follow-ups')
      .send({ title: 'Recap', owner: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.meeting.followUps).toHaveLength(1);
  });

  // L-04: role gate on destructive/administrative operations. Org-scope alone
  // let any member DELETE / change status; now only admin/owner/superadmin may.
  describe('L-04 role gate', () => {
    it('DELETE /:id returns 403 for a non-admin member', async () => {
      const res = await request(app)
        .delete('/api/meeting/meeting-1')
        .set('x-test-role', 'team_member');
      expect(res.status).toBe(403);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('DELETE /:id is allowed for an admin', async () => {
      mockDelete.mockResolvedValue(true);
      const res = await request(app)
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
      const res = await request(app)
        .delete('/api/meeting/meeting-1')
        .set('x-test-role', 'owner');
      expect(res.status).toBe(200);
    });

    it('PATCH /:id/status returns 403 for a non-admin member', async () => {
      const res = await request(app)
        .patch('/api/meeting/meeting-1/status')
        .set('x-test-role', 'team_member')
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
      expect(mockUpdateStatus).not.toHaveBeenCalled();
    });

    it('PATCH /:id/status is allowed for an admin', async () => {
      mockUpdateStatus.mockResolvedValue({ ...sampleMeeting, status: 'completed' });
      const res = await request(app)
        .patch('/api/meeting/meeting-1/status')
        .set('x-test-role', 'admin')
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.meeting.status).toBe('completed');
    });

    it('read (GET) and create (POST) stay open to non-admin members', async () => {
      mockList.mockResolvedValue([sampleMeeting]);
      mockCreate.mockResolvedValue(sampleMeeting);
      const listRes = await request(app)
        .get('/api/meeting')
        .set('x-test-role', 'team_member');
      expect(listRes.status).toBe(200);
      const createRes = await request(app)
        .post('/api/meeting')
        .set('x-test-role', 'team_member')
        .send({ title: 'Kickoff', startAt: '2026-07-01T10:00:00.000Z' });
      expect(createRes.status).toBe(201);
    });
  });
});
