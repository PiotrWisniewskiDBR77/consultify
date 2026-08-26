/** @vitest-environment node */

/**
 * FIX-4 (day28 duty fix-round, P1-4 — instruction §F.3 point 7 ONLY).
 *
 * Scope, deliberately narrow: this covers ONLY the `captured` scenario
 * (§F.3 point 7 — "MEETING_INVITES_LIVE nieustawione -> trzy wiersze ze
 * statusem captured i zero wywołań mailera"). §F.3 points 4-6 (the LIVE
 * partial-failure and reverse-order scenarios, which require mocking
 * `emailService.send` to actually SUCCEED/THROW under a mocked
 * MEETING_INVITES_LIVE=true branch) are NOT attempted here and remain
 * STOP, per the nadzorca's explicit fix-round brief — not because the
 * regime in §F.2 couldn't in principle be satisfied, but because that
 * decision was made above this FIX's scope. Do not extend this file to
 * cover them without that decision being revisited.
 *
 * `meetingInvitationService.ts`, `emailService.ts`, and `icsBuilder.ts` are
 * READ-ONLY here — this file proves behavior, it does not change it (§F,
 * `git diff` on those three files must be empty — verified below the file,
 * not in-test).
 *
 * REQUIRES a real Postgres reachable via DATABASE_URL with
 * NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false.
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as emailService from '../../../server/src/services/emailService.js';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.userRole = req.headers['x-test-role'] || 'ADMIN';
    req.user = { id, organizationId, role: req.userRole, email: `${id}@example.test` };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PREFIX = `day28fix4-${randomUUID().slice(0, 8)}`;
const ORG = `${PREFIX}-org`;
const ORGANIZER = `${PREFIX}-organizer`;
const RECIPIENTS = [`${PREFIX}-r1`, `${PREFIX}-r2`, `${PREFIX}-r3`];
const headers = () => ({
  'x-test-org-id': ORG,
  'x-test-user-id': ORGANIZER,
  'x-test-role': 'ADMIN',
});

describe('Meetings day28-fixes FIX-4 — invitations, captured mode only (§F.3 pt 7)', () => {
  let app: express.Express;
  let pool: Pool;
  let meetingId = '';
  // FIX-6 pattern (meetingDay16.pg.test.ts): spy on the REAL emailService.send
  // — never replaced with a mock implementation — so "not called" is proof,
  // not inference from a status string this same code produced.
  const emailSendSpy = vi.spyOn(emailService, 'send');
  let previousLive: string | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.RUN_DB_TESTS !== '1')
      throw new Error('real local PG required');
    // §F.2 rule applies to every test that reaches sendMeetingInvitations
    // without a local mailer mock: run captured-only. Defensively clear
    // MEETING_INVITES_LIVE here (file:line of the ONLY place this test sets
    // it) rather than assume the ambient test env has it unset.
    previousLive = process.env.MEETING_INVITES_LIVE;
    delete process.env.MEETING_INVITES_LIVE;

    const { default: routes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at) VALUES ($1,$2,'enterprise','active',1,$3)`,
      [ORG, ORG, now]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
       VALUES ($1,$2,$3,'unused','ADMIN','active',$4)`,
      [ORGANIZER, ORG, `${ORGANIZER}@example.invalid`, now]
    );
    for (const recipientId of RECIPIENTS) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES ($1,$2,$3,'unused','USER','active',$4)`,
        [recipientId, ORG, `${recipientId}@example.invalid`, now]
      );
    }
    meetingId = `meeting-${PREFIX}`;
    await pool.query(
      `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by, created_at, updated_at, status)
       VALUES ($1,$2,'Captured-mode invitations',$3,$3,$4,$3,$3,'scheduled')`,
      [meetingId, ORG, now, ORGANIZER]
    );
    await pool.query(
      `INSERT INTO meeting_participants (
         id, organization_id, meeting_id, participant_kind, user_id, email, role,
         invitation_status, delivery_status, invited_by, created_at, updated_at
       ) VALUES ($1,$2,$3,'user',$4,$5,'organizer','accepted','pending',$4,$6,$6)`,
      [`${meetingId}-organizer`, ORG, meetingId, ORGANIZER, `${ORGANIZER}@example.invalid`, now]
    );
    for (const recipientId of RECIPIENTS) {
      await pool.query(
        `INSERT INTO meeting_participants (
           id, organization_id, meeting_id, participant_kind, user_id, email, role,
           invitation_status, delivery_status, invited_by, created_at, updated_at
         ) VALUES ($1,$2,$3,'user',$4,$5,'attendee','invited','pending',$6,$7,$7)`,
        [
          `${meetingId}-${recipientId}`,
          ORG,
          meetingId,
          recipientId,
          `${recipientId}@example.invalid`,
          ORGANIZER,
          now,
        ]
      );
    }
  });

  afterEach(() => {
    emailSendSpy.mockClear();
  });

  afterAll(async () => {
    if (previousLive === undefined) delete process.env.MEETING_INVITES_LIVE;
    else process.env.MEETING_INVITES_LIVE = previousLive;
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM meetings WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  });

  it('captured mode records three delivery rows and never calls the mailer', async () => {
    expect(process.env.MEETING_INVITES_LIVE).toBeUndefined();

    const response = await request(app)
      .post(`/api/meeting/${meetingId}/invitations/send`)
      .set(headers())
      .send({});
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.deliveries).toHaveLength(3);
    expect(response.body.deliveries.every((item: any) => item.status === 'captured')).toBe(true);
    expect(response.body.deliveries.every((item: any) => !item.error)).toBe(true);

    // Independent pool, per §F.3 point 5 — the sedno of the scenario is the
    // DATABASE state, not just the HTTP response shape.
    const rows = await pool.query(
      `SELECT participant_id, delivery_status, error, sequence
         FROM meeting_invitation_deliveries
        WHERE organization_id = $1 AND meeting_id = $2
        ORDER BY attempted_at`,
      [ORG, meetingId]
    );
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows.every((row) => row.delivery_status === 'captured')).toBe(true);
    expect(rows.rows.every((row) => row.error === null)).toBe(true);
    const sequences = new Set(rows.rows.map((row) => row.sequence));
    expect(sequences.size).toBe(1);

    const participants = await pool.query(
      `SELECT delivery_status FROM meeting_participants
        WHERE organization_id = $1 AND meeting_id = $2 AND role = 'attendee'`,
      [ORG, meetingId]
    );
    expect(participants.rows).toHaveLength(3);
    expect(participants.rows.every((row) => row.delivery_status === 'captured')).toBe(true);

    // §F.3 point 7's actual claim: zero mailer calls, proven by a spy on the
    // real implementation, not inferred from the 'captured' status string.
    expect(emailSendSpy).not.toHaveBeenCalled();
  });
});
