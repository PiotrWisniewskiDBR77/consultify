/** @vitest-environment node */

/**
 * D.4/D.5 (day 10 UI wiring, 2026-08-25) — behavioural coverage for the two
 * resources the day-10 backend shipped but the UI never called until this
 * change: `/:id/decision-records` and `/:id/follow-up-records`
 * (server/src/routes/meeting.routes.ts). The existing M12 golden-flow suite
 * (meeting.m12-golden-flows.postgres.integration.test.ts, group E) only
 * covers the RETIRED legacy `/decisions` and `/follow-ups` writers (410 Gone)
 * — nothing there exercises these dedicated resources at all.
 *
 * Same discipline as that suite: boots the real router against a real
 * Postgres, verifies every "saved" claim with an independent SQL read-back
 * (never trusts the API envelope alone), and proves the specific claim this
 * task brief asked for — that `MeetingHub.tsx`'s follow-up column/chip and
 * the `meeting.followUps` count read from the SAME `meeting_follow_ups` row
 * this resource writes to, so wiring the UI to it is sufficient without a
 * separate aggregate endpoint.
 *
 * REQUIRES a real Postgres reachable via `DATABASE_URL` with
 * `NODE_ENV=test RUN_DB_TESTS=1`. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:55712/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run tests/integration/routes/meeting.decision-follow-up-records.postgres.integration.test.ts
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (req.headers['x-test-unauth'] === '1' || !orgId || !userId) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.userRole = req.headers['x-test-role'] || 'member';
    req.user = { id: userId, organizationId: orgId, role: req.headers['x-test-role'] || 'member' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ORG_A = `org-d4d5-a-${uuidv4().slice(0, 8)}`;
const ORG_B = `org-d4d5-b-${uuidv4().slice(0, 8)}`;
const USER_A = `user-d4d5-a-${uuidv4().slice(0, 8)}`;
const USER_B = `user-d4d5-b-${uuidv4().slice(0, 8)}`;

/** Creator/admin for org A — module beta gate requires `administrator`
 * (distinct from the route-level `admin`/`owner`/`superadmin` role gate). */
const betaAdmin = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'administrator',
});

describe('D.4/D.5 Meeting decision-records + follow-up-records (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let meetingId: string;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real Postgres.'
      );
    }
    const { default: meetingRoutes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const res = await request(app)
      .post('/api/meeting')
      .set(betaAdmin())
      .send({ title: 'Decision & follow-up wiring', startAt: '2026-11-01T09:00:00.000Z' });
    meetingId = res.body.meeting.id;
  });

  afterAll(async () => {
    // Probes clean up after themselves (CLAUDE.md — zero test records left).
    await pool.query(`DELETE FROM meeting_decisions WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(
      `DELETE FROM meeting_follow_ups WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id = ANY($1))`,
      [[ORG_A, ORG_B]]
    );
    await pool.query(`DELETE FROM meetings WHERE organization_id = ANY($1)`, [[ORG_A, ORG_B]]);
    await pool.end();
  });

  const decisionRows = async (id: string) => {
    const { rows } = await pool.query(
      `SELECT * FROM meeting_decisions WHERE meeting_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return rows;
  };
  const followUpRows = async (id: string) => {
    const { rows } = await pool.query(
      `SELECT * FROM meeting_follow_ups WHERE meeting_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return rows;
  };

  // ── GROUP A — decision records: add → readback ─────────────────────────
  describe('decision records', () => {
    let decisionId: string;

    it('DR-01 create persists a row a separate SQL read-back can see', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin())
        .send({ statement: 'Ship the D.4/D.5 wiring', rationale: 'Backend already existed' });
      expect(res.status).toBe(201);
      expect(res.body.decision.statement).toBe('Ship the D.4/D.5 wiring');
      decisionId = res.body.decision.id;

      const rows = await decisionRows(meetingId);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(decisionId);
      expect(rows[0].statement).toBe('Ship the D.4/D.5 wiring');
      expect(rows[0].status).toBe('recorded');
    });

    it('DR-02 GET readback (the exact call MeetingObjectPage.tsx makes) shows the created decision', async () => {
      const res = await request(app)
        .get(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin());
      expect(res.status).toBe(200);
      expect(res.body.decisions.map((d: any) => d.id)).toContain(decisionId);
    });

    it('DR-03 an empty statement is rejected before it reaches the writer', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin())
        .send({ statement: '   ' });
      expect(res.status).toBe(400);
      expect(await decisionRows(meetingId)).toHaveLength(1);
    });

    it('DR-04 PATCH updates the statement and status, verified via SQL', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${meetingId}/decision-records/${decisionId}`)
        .set(betaAdmin())
        .send({ statement: 'Ship it, revised', status: 'superseded' });
      expect(res.status).toBe(200);
      expect(res.body.decision.status).toBe('superseded');

      const rows = await decisionRows(meetingId);
      expect(rows[0].statement).toBe('Ship it, revised');
      expect(rows[0].status).toBe('superseded');
    });

    it('DR-05 DELETE removes the row for real', async () => {
      const res = await request(app)
        .delete(`/api/meeting/${meetingId}/decision-records/${decisionId}`)
        .set(betaAdmin());
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(await decisionRows(meetingId)).toHaveLength(0);
    });

    it('DR-06 a decision id that does not exist reports 404, not a false success', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${meetingId}/decision-records/does-not-exist`)
        .set(betaAdmin())
        .send({ statement: 'x' });
      expect(res.status).toBe(404);
    });
  });

  // ── GROUP B — follow-up records: add, status toggle, list-count source ──
  describe('follow-up records', () => {
    let followUpId: string;

    it('FU-01 create persists a row a separate SQL read-back can see', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/follow-up-records`)
        .set(betaAdmin())
        .send({ title: 'Publish the demo screenshots', owner: 'Piotr' });
      expect(res.status).toBe(201);
      followUpId = res.body.followUp.id;
      expect(res.body.followUp.status).toBe('open');

      const rows = await followUpRows(meetingId);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(followUpId);
      expect(rows[0].status).toBe('open');
    });

    it(
      'FU-02 the meeting LIST endpoint (GET /api/meeting, what MeetingHub.tsx reads for its ' +
        '"Follow-ups" column and "Needs follow-up" chip) embeds this exact row — no separate ' +
        'aggregate is required',
      async () => {
        const res = await request(app).get('/api/meeting').set(betaAdmin());
        const row = res.body.meetings.find((m: any) => m.id === meetingId);
        expect(row).toBeTruthy();
        expect(row.followUps.map((f: any) => f.id)).toContain(followUpId);
        expect(row.followUps.find((f: any) => f.id === followUpId).status).toBe('open');
      }
    );

    it('FU-03 toggling status to done is what the column/chip count must react to', async () => {
      const patchRes = await request(app)
        .patch(`/api/meeting/${meetingId}/follow-up-records/${followUpId}`)
        .set(betaAdmin())
        .send({ status: 'done' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.followUp.status).toBe('done');

      const rows = await followUpRows(meetingId);
      expect(rows[0].status).toBe('done');

      // Same list call MeetingHub.tsx's `counts.followUp` / row `followUps`
      // column derive from — done follow-ups must no longer count as open.
      const listRes = await request(app).get('/api/meeting').set(betaAdmin());
      const row = listRes.body.meetings.find((m: any) => m.id === meetingId);
      const openCount = row.followUps.filter((f: any) => f.status === 'open').length;
      expect(openCount).toBe(0);
      expect(row.followUps.find((f: any) => f.id === followUpId).status).toBe('done');
    });

    it('FU-04 DELETE removes the row for real', async () => {
      const res = await request(app)
        .delete(`/api/meeting/${meetingId}/follow-up-records/${followUpId}`)
        .set(betaAdmin());
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(await followUpRows(meetingId)).toHaveLength(0);
    });

    it('FU-05 an empty title is rejected before it reaches the writer', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/follow-up-records`)
        .set(betaAdmin())
        .send({ title: '   ' });
      expect(res.status).toBe(400);
    });
  });

  // ── GROUP C — tenant isolation ───────────────────────────────────────────
  describe('tenant isolation', () => {
    it('TI-01 org B cannot list org A decision-records (404, not an empty leak)', async () => {
      const res = await request(app)
        .get(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin(ORG_B, USER_B));
      expect(res.status).toBe(404);
    });

    it('TI-02 org B cannot create a decision-record on an org A meeting', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin(ORG_B, USER_B))
        .send({ statement: 'Cross-tenant decision' });
      expect(res.status).toBe(404);
      expect(await decisionRows(meetingId)).toHaveLength(0);
    });

    it('TI-03 org B cannot list org A follow-up-records (404, not an empty leak)', async () => {
      const res = await request(app)
        .get(`/api/meeting/${meetingId}/follow-up-records`)
        .set(betaAdmin(ORG_B, USER_B));
      expect(res.status).toBe(404);
    });

    it('TI-04 org B cannot create a follow-up-record on an org A meeting', async () => {
      const res = await request(app)
        .post(`/api/meeting/${meetingId}/follow-up-records`)
        .set(betaAdmin(ORG_B, USER_B))
        .send({ title: 'Cross-tenant follow-up' });
      expect(res.status).toBe(404);
      expect(await followUpRows(meetingId)).toHaveLength(0);
    });

    it('TI-05 org B cannot update or delete an org A decision/follow-up record it cannot even list', async () => {
      // Create a real decision + follow-up as org A first so there is
      // something for org B to (fail to) target.
      const decisionRes = await request(app)
        .post(`/api/meeting/${meetingId}/decision-records`)
        .set(betaAdmin())
        .send({ statement: 'Org A only' });
      const followUpRes = await request(app)
        .post(`/api/meeting/${meetingId}/follow-up-records`)
        .set(betaAdmin())
        .send({ title: 'Org A only follow-up' });
      const decisionId = decisionRes.body.decision.id;
      const fuId = followUpRes.body.followUp.id;

      const patchDecision = await request(app)
        .patch(`/api/meeting/${meetingId}/decision-records/${decisionId}`)
        .set(betaAdmin(ORG_B, USER_B))
        .send({ statement: 'Hijacked' });
      const deleteFollowUp = await request(app)
        .delete(`/api/meeting/${meetingId}/follow-up-records/${fuId}`)
        .set(betaAdmin(ORG_B, USER_B));

      expect(patchDecision.status).toBe(404);
      expect(deleteFollowUp.status).toBe(404);

      const decisions = await decisionRows(meetingId);
      const followUps = await followUpRows(meetingId);
      expect(decisions.find((d) => d.id === decisionId)?.statement).toBe('Org A only');
      expect(followUps.find((f) => f.id === fuId)).toBeTruthy();
    });
  });
});
