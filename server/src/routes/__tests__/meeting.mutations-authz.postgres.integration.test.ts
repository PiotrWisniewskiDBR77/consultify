/** @vitest-environment node */

/**
 * MTG-2b AUTHZ (DEC-607, Wpis 100 line 220 + D-98 Wpis 105) — RealPG matrix.
 *
 * Before this change every mutating meeting route group gated only on
 * `canAccessMeeting`, which lets ANY attendee write. The single shared guard
 * `requireMeetingOrganizer` (isMeetingAdmin || creator || chair) now runs on
 * all seven groups in the order 401 -> 404 (foreign tenant) -> 403 (participant,
 * not organizer) -> 400 (validation) -> mutation.
 *
 * This suite proves, against a real Postgres + the real router:
 *   - one 403 PARTICIPANT case per group (plain attendee, member role), with
 *     the per-group `MEETING_*_FORBIDDEN` code;
 *   - one 200/201 ORGANIZER case (the meeting creator) end-to-end;
 *   - one 404 FOREIGN-TENANT case (org B caller cannot even see org A's meeting);
 *   - D-98: a PARTICIPANT sending an INVALID `nextState` to /:id/lifecycle gets
 *     403 (organizer guard), NOT 400 (state validation) — the guard runs first.
 *
 * Collective mutation (run manually, see RECEIPT): neuter
 * `requireMeetingOrganizer` to `return true` -> all ten 403 cases go RED.
 *
 * NOTE on the beta gate: `closedBetaModuleGate` mirrors `MODULE_MEETING`, which
 * is `'open'` (betaMenuStatus.ts:50, owner decision D-1 2026-08-30), so it
 * passes every role through and the organizer guard below is the operative
 * control — a 'member' participant genuinely reaches the routes.
 *
 * Run (station D pool, container qoder-d-pg-3):
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6632/consultify_mtg2_fresh \
 *     npx vitest run server/src/routes/__tests__/meeting.mutations-authz.postgres.integration.test.ts
 */

import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Role-aware auth mock: a single app instance simulates organizer / participant
// / foreign-tenant callers purely from request headers.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    const role = String(req.headers['x-test-role'] || 'member');
    req.user = { id, organizationId, role, email: `${id}@example.invalid` };
    req.userRole = role;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

function localDatabaseUrl(): string {
  const value = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/.test(value)) {
    throw new Error('Local DATABASE_URL is required for the MTG-2b authz matrix');
  }
  return value;
}

const prefix = `mtg2b-${Date.now()}-${randomUUID().slice(0, 8)}`;
const ORG_A = `${prefix}-org-a`;
const ORG_B = `${prefix}-org-b`;
const ORGANIZER = `${prefix}-organizer`;
const PARTICIPANT = `${prefix}-participant`;
const FOREIGN = `${prefix}-foreign`;
const MEETING_A = `${prefix}-meeting-a`;

const asOrganizer = {
  'x-test-org-id': ORG_A,
  'x-test-user-id': ORGANIZER,
  'x-test-role': 'member',
};
const asParticipant = {
  'x-test-org-id': ORG_A,
  'x-test-user-id': PARTICIPANT,
  'x-test-role': 'member',
};
const asForeign = {
  'x-test-org-id': ORG_B,
  'x-test-user-id': FOREIGN,
  'x-test-role': 'member',
};

describe('MTG-2b meeting mutations authz matrix (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: localDatabaseUrl() });

    await pool.query(
      `INSERT INTO organizations (id, name, created_at) VALUES ($1,'MTG2B A',now()),($2,'MTG2B B',now())
       ON CONFLICT (id) DO NOTHING`,
      [ORG_A, ORG_B]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1,$2,$3,'Org','Anizer','member','active'),
              ($4,$2,$5,'Part','Icipant','member','active'),
              ($6,$7,$8,'For','Eign','member','active')
       ON CONFLICT (id) DO NOTHING`,
      [
        ORGANIZER,
        ORG_A,
        `${ORGANIZER}@example.invalid`,
        PARTICIPANT,
        `${PARTICIPANT}@example.invalid`,
        FOREIGN,
        ORG_B,
        `${FOREIGN}@example.invalid`,
      ]
    );
    // requireActiveMeetingMembership gates the whole router on an ACTIVE
    // organization_members row — without it every caller is 403'd before the
    // route logic, which would mask the guard under test.
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,'MEMBER','ACTIVE',now()),
              ($4,$2,$5,'MEMBER','ACTIVE',now()),
              ($6,$7,$8,'MEMBER','ACTIVE',now())
       ON CONFLICT (id) DO NOTHING`,
      [
        `${prefix}-om-org`,
        ORG_A,
        ORGANIZER,
        `${prefix}-om-part`,
        PARTICIPANT,
        `${prefix}-om-for`,
        ORG_B,
        FOREIGN,
      ]
    );
    // Meeting A: created by ORGANIZER, PARTICIPANT listed as an attendee so
    // `canAccessMeeting` passes and the participant reaches the 403 guard
    // instead of the 404 hide-path.
    await pool.query(
      `INSERT INTO meetings (id, organization_id, title, start_at, end_at, attendees_json, created_by, status, lifecycle_state)
       VALUES ($1,$2,'MTG2B authz meeting',now()::text,now()::text,$3,$4,'scheduled','scheduled')`,
      [MEETING_A, ORG_A, JSON.stringify([PARTICIPANT, ORGANIZER]), ORGANIZER]
    );

    const { default: meetingRoutes } = await import('../meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool
      .query(`DELETE FROM meeting_decisions WHERE organization_id = $1`, [ORG_A])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM meeting_follow_ups WHERE organization_id = $1`, [ORG_A])
      .catch(() => undefined);
    await pool.query(`DELETE FROM meetings WHERE organization_id = $1`, [ORG_A]).catch(() => undefined);
    await pool
      .query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool.end().catch(() => undefined);
  });

  // ---- one 403 PARTICIPANT case per group (with the per-group code) ----

  const participantForbidden: Array<{
    group: string;
    method: 'post' | 'patch' | 'delete';
    path: string;
    body?: unknown;
    code: string;
  }> = [
    {
      group: 'decision-records',
      method: 'post',
      path: `/${MEETING_A}/decision-records`,
      body: { statement: 'Participant should not write this' },
      code: 'MEETING_MUTATION_FORBIDDEN',
    },
    {
      group: 'follow-up-records',
      method: 'post',
      path: `/${MEETING_A}/follow-up-records`,
      body: { title: 'Participant should not write this' },
      code: 'MEETING_MUTATION_FORBIDDEN',
    },
    {
      group: 'decisions (retired)',
      method: 'post',
      path: `/${MEETING_A}/decisions`,
      body: {},
      code: 'MEETING_MUTATION_FORBIDDEN',
    },
    {
      group: 'generate-notes',
      method: 'post',
      path: `/${MEETING_A}/generate-notes`,
      body: { transcript: 'participant transcript' },
      code: 'MEETING_NOTE_FORBIDDEN',
    },
    {
      group: 'attachments',
      method: 'post',
      path: `/${MEETING_A}/attachments`,
      body: { artifactKind: 'note', artifactId: 'x' },
      code: 'MEETING_ATTACHMENT_FORBIDDEN',
    },
    {
      group: 'occurrence',
      method: 'delete',
      path: `/${MEETING_A}/occurrence`,
      body: { recurrenceId: '2026-09-20T09:00:00Z', scope: 'this' },
      code: 'MEETING_OCCURRENCE_FORBIDDEN',
    },
    {
      group: 'agenda',
      method: 'post',
      path: `/${MEETING_A}/agenda`,
      body: { title: 'Participant point' },
      code: 'MEETING_AGENDA_FORBIDDEN',
    },
    // MTG-2b NEW routes: the organizer guard runs BEFORE the record lookup, so
    // a participant is 403'd on these even with a non-existent child id.
    {
      group: 'follow-up→task (new)',
      method: 'post',
      path: `/${MEETING_A}/follow-up-records/does-not-exist/task`,
      body: {},
      code: 'MEETING_FOLLOW_UP_FORBIDDEN',
    },
    {
      group: 'decision→promote (new)',
      method: 'post',
      path: `/${MEETING_A}/decision-records/does-not-exist/promote`,
      body: {},
      code: 'MEETING_DECISION_FORBIDDEN',
    },
  ];

  for (const c of participantForbidden) {
    it(`403 participant — ${c.group}`, async () => {
      const res = await request(app)[c.method](`/api/meeting${c.path}`)
        .set(asParticipant)
        .send(c.body ?? {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(c.code);
    });
  }

  // ---- D-98: participant + INVALID nextState -> 403, not 400 ----
  it('403 participant on lifecycle with an invalid nextState (D-98: guard before validation)', async () => {
    const res = await request(app)
      .patch(`/api/meeting/${MEETING_A}/lifecycle`)
      .set(asParticipant)
      .send({ nextState: 'totally-bogus-state' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MEETING_LIFECYCLE_FORBIDDEN');
  });

  // ---- one 200/201 ORGANIZER case end-to-end ----
  it('201 organizer (creator) writes a decision record end-to-end', async () => {
    const res = await request(app)
      .post(`/api/meeting/${MEETING_A}/decision-records`)
      .set(asOrganizer)
      .send({
        statement: 'Approve the 2027 capital shortlist',
        rationale: 'Risk is controlled',
        decisionType: 'approval',
        impactText: 'Unlocks Q1 funding',
        rejectedAlternative: 'Defer to 2028',
      });
    expect(res.status).toBe(201);
    expect(res.body.decision.statement).toBe('Approve the 2027 capital shortlist');
    // W109c: the live writer fills the protocol columns, not just the backfill.
    expect(res.body.decision.decisionType).toBe('approval');
    expect(res.body.decision.impactText).toBe('Unlocks Q1 funding');
    expect(res.body.decision.rejectedAlternative).toBe('Defer to 2028');

    const row = await pool.query(
      `SELECT decision_type, impact_text, rejected_alternative FROM meeting_decisions WHERE id = $1`,
      [res.body.decision.id]
    );
    expect(row.rows[0].decision_type).toBe('approval');
    expect(row.rows[0].impact_text).toBe('Unlocks Q1 funding');
    expect(row.rows[0].rejected_alternative).toBe('Defer to 2028');
  });

  // ---- one 404 FOREIGN-TENANT case for the whole matrix ----
  it('404 foreign tenant cannot reach org A meeting mutation', async () => {
    const res = await request(app)
      .post(`/api/meeting/${MEETING_A}/decision-records`)
      .set(asForeign)
      .send({ statement: 'cross-tenant write' });
    expect(res.status).toBe(404);
  });
});
