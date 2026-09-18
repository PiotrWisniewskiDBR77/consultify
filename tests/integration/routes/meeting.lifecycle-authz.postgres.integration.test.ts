/** @vitest-environment node */
/**
 * MTG-1 v2 (KANAL Wpis 80 pkt 2 / DEC-596) — server-side authorization on the
 * meeting lifecycle transition endpoint.
 *
 * `PATCH /api/meeting/:id/lifecycle` moves a meeting through its lifecycle
 * (scheduled -> in_progress -> ...). Before this guard ANY participant who could
 * view the meeting (loadAccessibleMeetingForAgenda lets every attendee in) could
 * also move it. The transition is an ORGANIZER action: the chair/creator or an
 * org OWNER/ADMIN may run it (200); a plain attendee gets 403 with code
 * `MEETING_LIFECYCLE_FORBIDDEN` and the lifecycle is NOT changed. A foreign
 * tenant stays on the 404 hide-path with zero mutation.
 *
 * Same shape as ST-2 (`initiativeCandidates.acceptAuthz`): privileged role OR
 * creator. RealPG (3+ roles) on the station-D container.
 *
 * MUTATION target: removing the `isMeetingAdmin(req) || isOrganizer` guard in
 * `meeting.routes.ts` (the `/:id/lifecycle` handler) turns the "plain attendee →
 * 403" test red (it would return 200 and persist in_progress).
 *
 * Run (pool D, container qoder-d-pg-1):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6630/consultify_qoder \
 *     npx vitest run tests/integration/routes/meeting.lifecycle-authz.postgres.integration.test.ts
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { sendMeetingInvitationsSpy } = vi.hoisted(() => ({
  sendMeetingInvitationsSpy: vi.fn(async () => []),
}));

vi.mock('../../../src/utils/betaAccess.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, BETA_MENU_STATUS: { ...actual.BETA_MENU_STATUS, MODULE_MEETING: 'open' } };
});
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userRole = req.headers['x-role'];
    req.user = {
      id: req.headers['x-user'],
      organizationId: req.headers['x-org'],
      role: req.userRole,
      email: `${req.headers['x-user']}@example.test`,
    };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/meeting/meetingInvitationService.js', () => ({
  sendMeetingInvitations: sendMeetingInvitationsSpy,
}));

const url = process.env.DATABASE_URL || '';
const prefix = `mtg1v2-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const foreign = `${prefix}-foreign`;
const creator = `${prefix}-creator`;
const chair = `${prefix}-chair`;
const attendee = `${prefix}-attendee`;
const admin = `${prefix}-admin`;
const owner = `${prefix}-owner`;
const foreignAdmin = `${prefix}-foreign-admin`;

const pool = new Pool({ connectionString: url });
const h = (user: string, role: string, tenant = org) => ({
  'x-user': user,
  'x-role': role,
  'x-org': tenant,
});

const dbTestsDemanded =
  process.env.RUN_DB_TESTS !== undefined &&
  !['', '0', 'false', 'no', 'off'].includes(String(process.env.RUN_DB_TESTS).trim().toLowerCase());
const inCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (inCi && !dbTestsDemanded) {
  throw new Error('RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL');
}
const guardIt = dbTestsDemanded ? it : it.skip;

describe('MTG-1 v2 — PATCH /api/meeting/:id/lifecycle organizer guard (real PG)', () => {
  let app: express.Express;
  let meetingId = '';

  const resetLifecycle = async (chairUser: string | null = null) => {
    await pool.query(
      `UPDATE meetings SET lifecycle_state = 'scheduled', chair_user_id = $2 WHERE id = $1`,
      [meetingId, chairUser]
    );
  };
  const readLifecycle = async () =>
    (await pool.query(`SELECT lifecycle_state FROM meetings WHERE id = $1`, [meetingId])).rows[0]
      .lifecycle_state;
  const patch = (user: string, role: string, tenant = org) =>
    request(app)
      .patch(`/api/meeting/${meetingId}/lifecycle`)
      .set(h(user, role, tenant))
      .send({ nextState: 'in_progress' });

  beforeAll(async () => {
    if (!dbTestsDemanded) return;
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);

    await pool.query(
      `INSERT INTO organizations (id, name, created_at) VALUES ($1,'MTG1 v2',now()),($2,'MTG1 v2 foreign',now())
       ON CONFLICT (id) DO NOTHING`,
      [org, foreign]
    );
    const seedMember = async (
      userId: string,
      tenant: string,
      role: string
    ) => {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
         VALUES ($1,$2,$3,'M','T',$4,'active') ON CONFLICT (id) DO NOTHING`,
        [userId, tenant, `${userId}@example.test`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         VALUES ($1,$2,$3,$4,'ACTIVE',now()) ON CONFLICT (id) DO NOTHING`,
        [`om-${userId}`, tenant, userId, role]
      );
    };
    await seedMember(creator, org, 'USER');
    await seedMember(chair, org, 'USER');
    await seedMember(attendee, org, 'USER');
    await seedMember(admin, org, 'ADMIN');
    await seedMember(owner, org, 'OWNER');
    await seedMember(foreignAdmin, foreign, 'ADMIN');

    const created = await request(app)
      .post('/api/meeting')
      .set(h(creator, 'ADMIN'))
      .send({
        title: 'MTG1 v2 lifecycle guard',
        startAt: '2026-10-01T09:00:00.000Z',
        attendees: [`${chair}@example.test`, `${attendee}@example.test`],
      });
    expect(created.status).toBe(201);
    meetingId = created.body.meeting.id as string;
    expect(meetingId).toBeTruthy();
  }, 120_000);

  afterAll(async () => {
    await pool
      .query(`DELETE FROM meeting_agenda_items WHERE organization_id IN ($1,$2)`, [org, foreign])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM meeting_participants WHERE organization_id IN ($1,$2)`, [org, foreign])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id IN ($1,$2)`, [
        org,
        foreign,
      ])
      .catch(() => undefined);
    await pool.query(`DELETE FROM meetings WHERE organization_id IN ($1,$2)`, [org, foreign]);
    await pool
      .query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [org, foreign])
      .catch(() => undefined);
    await pool.query(
      `DELETE FROM users WHERE id IN ($1,$2,$3,$4,$5,$6)`,
      [creator, chair, attendee, admin, owner, foreignAdmin]
    );
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, foreign]);
    await pool.end();
  }, 60_000);

  guardIt('creator (plain USER) may move the lifecycle → 200 and it persists', async () => {
    await resetLifecycle(null);
    const res = await patch(creator, 'USER');
    expect(res.status).toBe(200);
    expect(res.body.lifecycleState).toBe('in_progress');
    expect(await readLifecycle()).toBe('in_progress');
  });

  guardIt('chair (non-creator USER) may move the lifecycle → 200', async () => {
    await resetLifecycle(chair);
    const res = await patch(chair, 'USER');
    expect(res.status).toBe(200);
    expect(await readLifecycle()).toBe('in_progress');
  });

  guardIt('org ADMIN (non-creator) may move the lifecycle → 200', async () => {
    await resetLifecycle(null);
    const res = await patch(admin, 'ADMIN');
    expect(res.status).toBe(200);
    expect(await readLifecycle()).toBe('in_progress');
  });

  guardIt('org OWNER (non-creator) may move the lifecycle → 200', async () => {
    await resetLifecycle(null);
    const res = await patch(owner, 'OWNER');
    expect(res.status).toBe(200);
    expect(await readLifecycle()).toBe('in_progress');
  });

  guardIt('plain attendee (USER) may NOT move the lifecycle → 403 MEETING_LIFECYCLE_FORBIDDEN, zero change', async () => {
    // MUTATION: removing the organizer guard in meeting.routes.ts turns this red
    // (the attendee would reach setMeetingLifecycle → 200 + in_progress).
    await resetLifecycle(null);
    const res = await patch(attendee, 'USER');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MEETING_LIFECYCLE_FORBIDDEN');
    expect(await readLifecycle()).toBe('scheduled');
  });

  guardIt('foreign tenant stays on the 404 hide-path with zero mutation', async () => {
    await resetLifecycle(null);
    const res = await patch(foreignAdmin, 'ADMIN', foreign);
    expect(res.status).toBe(404);
    expect(await readLifecycle()).toBe('scheduled');
  });
});
