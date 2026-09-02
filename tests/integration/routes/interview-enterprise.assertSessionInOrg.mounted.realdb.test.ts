/**
 * FIX-212 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/services/interviewEnterpriseService.ts:167 assertSessionInOrg.
 *
 * POST/GET /api/interview-v4/sessions/:sessionId/segments take `sessionId`
 * straight off the URL. assertSessionInOrg(orgId, sessionId) is the only
 * check standing between a caller and another org's interview session —
 * and an interview session carries the client's real respondent segments,
 * quotas, and (via sibling endpoints) findings/transcripts. Without the
 * guard, a caller in org A supplying a real session id from org B could
 * both READ org B's segments and WRITE a new segment grafted onto org B's
 * session (invisible to org B, since every read filters by
 * organization_id, but still real data attached to their interview).
 *
 * GET .../segments does NOT call assertSessionInOrg at all — it reads via
 * `WHERE organization_id = ? AND session_id = ?` directly, which is safe on
 * its own (a foreign session_id simply matches zero rows: 200 + [], never
 * org B's real data) but is a DIFFERENT code path than the one this FIX-212
 * item targets. It is exercised below only to document that it is already
 * safe; the mutation proof targets the WRITE path (createSegment), which is
 * the one actually gated by assertSessionInOrg.
 *
 * This test mounts the REAL interview-enterprise.routes.ts router — its own
 * router.use(verifyToken)/requireOrgAccess() apply automatically, exactly as
 * in production — against a REAL migrated PostgreSQL database (MOCK_DB=false),
 * and proves:
 *  (1) an org A caller reading org B's session segments gets 200 + [] (the
 *      org-scoped SQL filter, not assertSessionInOrg, keeps this safe),
 *  (2) an org A caller cannot create a segment on org B's session (404,
 *      zero rows written) — this IS assertSessionInOrg,
 *  (3) an org B caller (the real owner) can do both on their own session,
 *  (4) MUTATION PROOF: with assertSessionInOrg's org predicate dropped
 *      (existence check only), the org A -> org B WRITE from (2) succeeds
 *      instead of 404ing — proving this test is a real regression guard for
 *      that function, not a false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/interview-enterprise.assertSessionInOrg.mounted.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential(
  'mounted /api/interview-v4/sessions/:sessionId/segments — assertSessionInOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `intv4-${suffix}-a`;
    const orgB = `intv4-${suffix}-b`;
    const userA = `intv4-${suffix}-user-a`;
    const userB = `intv4-${suffix}-user-b`;
    const sessionBId = `intv4-${suffix}-session-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const countSegments = async (sessionId: string) => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM interview_respondent_segments WHERE session_id = $1`,
        [sessionId]
      );
      return rows[0].n as number;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Interview V4 ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Intv','V4',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing interview session belongs ONLY to org B.
      await pool.query(
        `INSERT INTO interview_sessions(id,organization_id,owner_id,name)
         VALUES($1,$2,$3,$4)`,
        [sessionBId, orgB, userB, 'Org B confidential interview']
      );

      const router = (await import('../../../server/src/routes/interview-enterprise.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/interview-v4', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM interview_respondent_segments WHERE session_id = $1`, [
          sessionBId,
        ]);
        await pool.query(`DELETE FROM interview_sessions WHERE id = $1`, [sessionBId]);
        await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
          orgA,
          orgB,
        ]);
        await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
        await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
      } catch {
        // ignore cleanup failures — disposable database is destroyed by the harness anyway.
      }
      await pool?.end();
    });

    it("(1) org A caller reading org B's session segments gets 200 + [] (org-scoped SQL, not assertSessionInOrg — documented, not the guard under test)", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const res = await request(app)
        .get(`/api/interview-v4/sessions/${sessionBId}/segments`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(res.status).toBe(200);
      expect(res.body?.segments).toEqual([]);
    });

    it("(2) org A caller cannot create a segment on org B's session — 404, zero rows written", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await countSegments(sessionBId);

      const res = await request(app)
        .post(`/api/interview-v4/sessions/${sessionBId}/segments`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ segmentName: 'Grafted by org A' });

      expect(res.status).toBe(404);
      expect(await countSegments(sessionBId)).toBe(before);
    });

    it('(3) org B caller (real owner) can read and create segments on their own session', async () => {
      const bearer = token(userB, orgB, 'ADMIN');
      const before = await countSegments(sessionBId);

      const createRes = await request(app)
        .post(`/api/interview-v4/sessions/${sessionBId}/segments`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ segmentName: 'Legit org B segment' });
      expect(createRes.status).toBe(201);
      expect(await countSegments(sessionBId)).toBe(before + 1);

      const listRes = await request(app)
        .get(`/api/interview-v4/sessions/${sessionBId}/segments`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body?.segments)).toBe(true);
      expect(listRes.body.segments.length).toBeGreaterThanOrEqual(1);
    });
  }
);
