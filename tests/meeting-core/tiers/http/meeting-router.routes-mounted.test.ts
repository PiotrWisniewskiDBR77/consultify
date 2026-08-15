/**
 * meeting-router.routes-mounted.test.ts — TIER 2b (HTTP contract, routing
 * table, authenticated).
 *
 * ============================================================================
 * WHAT THIS PROVES: with the auth gate satisfied (mocked — see below), the
 * REAL `server/src/routes/meeting.routes.ts` Express Router, mounted on a
 * REAL Express app and hit with REAL HTTP requests via supertest, actually
 * dispatches every documented method+path to a distinct handler — i.e. the
 * routing TABLE is wired correctly, not just the auth gate in front of it
 * (that half is TIER 2a: meeting-router.auth-gate.test.ts). It also proves
 * the router's own role gate (`requireMeetingAdmin`) — genuinely part of
 * this router file, not the domain service — rejects a non-privileged role
 * with 403 on the three routes that declare it (PUT/DELETE/PATCH-status),
 * and that an undeclared path/method still 404s even once auth is no
 * longer the reason for failure.
 *
 * WHAT THIS DOES NOT PROVE — read this before citing this file as evidence
 * of anything else:
 *   - It does NOT prove the Meeting domain logic is correct. Every function
 *     from `meetingService.js` and `meetingCore/index.js` that the route
 *     handlers call is replaced with a `vi.fn()` returning a canned value.
 *     A 200/201 here means "the router called the mocked function and
 *     serialized whatever it returned" — nothing about lifecycle rules,
 *     persistence, tenant isolation, or validation inside those services
 *     was exercised. For that, see TIER 3 (tests/meeting-core/domain/,
 *     real PostgreSQL).
 *   - It does NOT prove real authentication works. `verifyToken` /
 *     `isAuthenticated` are replaced with a stub that unconditionally
 *     attaches a fake `req.user`. Real JWT verification + DB user lookup
 *     is exercised nowhere in this file (TIER 2a covers the *rejection*
 *     path with the real middleware; nothing in this repo currently
 *     exercises the real *acceptance* path without a live database, and
 *     this file does not claim to).
 *   - `ensureMeetingTables` (the schema-bootstrap call the legacy router
 *     runs on every request) is mocked to a no-op — no DDL, no DB
 *     connection, ever, in this file.
 * ============================================================================
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mutable auth identity (read by the auth.middleware.js mock) ────
const authState = vi.hoisted(() => ({ role: 'owner' as string }));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'test-user-1', organizationId: 'test-org-1', role: authState.role };
    req.userRole = authState.role;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ── Fakes returned by the mocked service layer ──────────────────────────────
const fakeMeeting = { id: 'm1', title: 'Fake meeting', organizationId: 'test-org-1' };
const fakeParticipant = { id: 'p1', userId: 'u2', role: 'participant' };
const fakeNote = { id: 'n1', entryType: 'discussion', content: 'x' };
const fakeOutput = { id: 'o1', outputKind: 'task' };
const fakeAggregate = { meeting: fakeMeeting, participants: [], notes: [], outputs: [] };

vi.mock('../../../../server/src/services/meetingService.js', () => ({
  ensureMeetingTables: vi.fn().mockResolvedValue(undefined),
  listMeetings: vi.fn().mockResolvedValue([fakeMeeting]),
  createMeeting: vi.fn().mockResolvedValue(fakeMeeting),
  updateMeeting: vi.fn().mockResolvedValue(fakeMeeting),
  deleteMeeting: vi.fn().mockResolvedValue(true),
  getMeeting: vi.fn().mockResolvedValue(fakeMeeting),
  updateMeetingStatus: vi.fn().mockResolvedValue(fakeMeeting),
  addMeetingDecision: vi.fn().mockResolvedValue(fakeMeeting),
  addMeetingFollowUp: vi.fn().mockResolvedValue(fakeMeeting),
  updateMeetingFollowUpStatus: vi.fn().mockResolvedValue(fakeMeeting),
}));

vi.mock('../../../../server/src/services/ai/meetingIntelligenceService.js', () => ({
  meetingIntelligenceService: {
    generateMeetingNotes: vi.fn().mockResolvedValue({ decisions: [], actionItems: [] }),
  },
}));

// Keep the real error classes + MEETING_TRANSITION_NAMES (imported/used by
// meeting.routes.ts for instanceof checks and input validation) but replace
// every async service call with a vi.fn(). createProductionMaterializer is
// left real — it is a pure factory, and its returned closures are never
// invoked because the mocked `materializeOutput` never calls them.
vi.mock('../../../../server/src/services/meetingCore/index.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../server/src/services/meetingCore/index.ts')>();
  return {
    ...actual,
    createMeetingCore: vi.fn().mockResolvedValue(fakeMeeting),
    getMeetingAggregate: vi.fn().mockResolvedValue(fakeAggregate),
    updateMeetingPrep: vi.fn().mockResolvedValue(fakeMeeting),
    addParticipant: vi.fn().mockResolvedValue(fakeParticipant),
    listParticipants: vi.fn().mockResolvedValue([fakeParticipant]),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    transitionMeeting: vi.fn().mockResolvedValue(fakeMeeting),
    closeMeeting: vi.fn().mockResolvedValue({ meeting: fakeMeeting }),
    addNoteEntry: vi.fn().mockResolvedValue(fakeNote),
    listNoteEntries: vi.fn().mockResolvedValue([fakeNote]),
    proposeOutput: vi.fn().mockResolvedValue(fakeOutput),
    approveOutput: vi.fn().mockResolvedValue(fakeOutput),
    rejectOutput: vi.fn().mockResolvedValue(fakeOutput),
    materializeOutput: vi.fn().mockResolvedValue(fakeOutput),
  };
});

const meetingRoutesModule = await import('../../../../server/src/routes/meeting.routes.ts');
const meetingRoutes = meetingRoutesModule.default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRoutes);
  return app;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

// [method, path, body] — every documented route, run as 'owner' (privileged)
// so the router's own role gate never intercepts these. 404 is the only
// status that would falsify "this route is mounted"; everything else
// (200/201/400/403/409...) means Express matched a real handler.
const DOCUMENTED_ROUTES: Array<[Method, string, Record<string, unknown>?]> = [
  ['get', '/api/meeting'],
  ['post', '/api/meeting', { title: 't', startAt: '2026-08-01T10:00:00Z' }],
  ['put', '/api/meeting/m1', { title: 't2' }],
  ['delete', '/api/meeting/m1'],
  ['patch', '/api/meeting/m1/status', { status: 'completed' }],
  ['post', '/api/meeting/m1/decisions', { decision: 'd' }],
  ['post', '/api/meeting/m1/follow-ups', { title: 'f' }],
  ['patch', '/api/meeting/m1/follow-ups/f1', { status: 'done' }],
  ['post', '/api/meeting/m1/generate-notes', { transcript: 'hello' }],
  ['post', '/api/meeting/core', { title: 't', startAt: '2026-08-01T10:00:00Z' }],
  ['get', '/api/meeting/core/m1'],
  ['patch', '/api/meeting/core/m1/prep', { purpose: 'p' }],
  ['post', '/api/meeting/core/m1/participants', { userId: 'u2', role: 'participant' }],
  ['get', '/api/meeting/core/m1/participants'],
  ['delete', '/api/meeting/core/m1/participants/u2'],
  ['post', '/api/meeting/core/m1/transitions/START_PREPARING'],
  ['post', '/api/meeting/core/m1/close'],
  ['post', '/api/meeting/core/m1/notes', { entryType: 'discussion', content: 'x' }],
  ['get', '/api/meeting/core/m1/notes'],
  ['post', '/api/meeting/core/m1/outputs', { outputKind: 'task', payload: {} }],
  ['post', '/api/meeting/core/m1/outputs/o1/approve'],
  ['post', '/api/meeting/core/m1/outputs/o1/reject'],
  ['post', '/api/meeting/core/m1/outputs/o1/materialize'],
];

describe('meeting.routes.ts — routing table, auth mocked to "owner" (proves mounting, not domain correctness)', () => {
  beforeEach(() => {
    authState.role = 'owner';
  });

  const app = buildApp();

  it.each(DOCUMENTED_ROUTES)(
    '%s %s -> matches a real handler (status !== 404)',
    async (method, path, body) => {
      const res = await request(app)
        [method](path)
        .send(body ?? {});
      expect(res.status, `body: ${JSON.stringify(res.body)}`).not.toBe(404);
    }
  );

  it('CONTROL: an undeclared path under /api/meeting -> 404 once auth is no longer the blocker', async () => {
    const res = await request(app).get('/api/meeting/this-path-does-not-exist-anywhere');
    expect(res.status).toBe(404);
  });

  it('CONTROL: an undeclared method on a real path -> 404 (Express has no handler for it)', async () => {
    // meeting.routes.ts never declares PATCH /api/meeting (only GET, POST).
    const res = await request(app).patch('/api/meeting').send({});
    expect(res.status).toBe(404);
  });

  it('requires Idempotency-Key for proposal and materialization HTTP mutations', async () => {
    const proposalWithoutKey = await request(app)
      .post('/api/meeting/core/m1/outputs')
      .send({ outputKind: 'task', payload: { title: 'Follow up' } });
    expect(proposalWithoutKey.status).toBe(400);
    expect(proposalWithoutKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const proposalWithKey = await request(app)
      .post('/api/meeting/core/m1/outputs')
      .set('Idempotency-Key', 'meeting-proposal-http-0001')
      .send({ outputKind: 'task', payload: { title: 'Follow up' } });
    expect(proposalWithKey.status).toBe(201);

    const materializeWithoutKey = await request(app)
      .post('/api/meeting/core/m1/outputs/o1/materialize')
      .send({});
    expect(materializeWithoutKey.status).toBe(400);

    const materializeWithKey = await request(app)
      .post('/api/meeting/core/m1/outputs/o1/materialize')
      .set('Idempotency-Key', 'meeting-output:test-org-1:m1:o1')
      .send({});
    expect(materializeWithKey.status).toBe(200);
  });

  describe("router's own role gate (requireMeetingAdmin) — real code in meeting.routes.ts, not mocked", () => {
    beforeEach(() => {
      authState.role = 'member';
    });

    it('PUT /api/meeting/:id -> 403 for a non-admin role', async () => {
      const res = await request(app).put('/api/meeting/m1').send({ title: 'x' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/meeting/:id -> 403 for a non-admin role', async () => {
      const res = await request(app).delete('/api/meeting/m1');
      expect(res.status).toBe(403);
    });

    it('PATCH /api/meeting/:id/status -> 403 for a non-admin role', async () => {
      const res = await request(app).patch('/api/meeting/m1/status').send({ status: 'completed' });
      expect(res.status).toBe(403);
    });
  });
});
