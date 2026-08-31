/**
 * FIX-212 partia 3 (pozycja 11 z 34) — mounted signed-JWT + real PostgreSQL
 * proof for server/src/services/managementReportsService.ts:1184
 * assertCommentInReportAndOrganization.
 *
 * PATCH/DELETE /api/management-reports/:id/comments/:commentId
 * (managementReports.routes.ts) take `commentId` and the report `:id`
 * straight off the URL. `assertCommentInReportAndOrganization(commentId,
 * reportId, organizationId)` — first checks the report belongs to the
 * caller's org (`assertReportInOrganization`), then that the comment
 * actually belongs to that report — is the only check standing between a
 * caller and another org's report COMMENT. The code comment at DEC-136
 * (managementReportsService.ts:1180-1183) documents exactly this: "a
 * comment used to be addressable by its id alone, with no link to the
 * report in the URL or to the caller's organization."
 *
 * Without the guard, an org A caller who learns (or guesses) a real
 * commentId belonging to org B's report could overwrite its text/resolved
 * state via PATCH, or delete it outright via DELETE — a write on another
 * org's governance artifact (a management report comment thread) with zero
 * consent from org B.
 *
 * This test mounts the REAL managementReports.routes.ts router behind its
 * own router.use(verifyToken), against a REAL migrated PostgreSQL database
 * (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot update org B's comment via PATCH — 404 (or
 *      equivalent failure), comment text unchanged,
 *  (2) an org A caller cannot delete org B's comment via DELETE — comment
 *      still present afterwards,
 *  (3) an org B caller (the real report owner) can update and delete their
 *      own comment,
 *  (4) MUTATION PROOF: with assertCommentInReportAndOrganization's report/
 *      organization predicate short-circuited to a no-op, the org A -> org B
 *      PATCH from (1) succeeds instead of failing — proving this test is a
 *      real regression guard, not a false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/managementReports.assertCommentInReportAndOrganization.mounted.realdb.test.ts
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
  'mounted PATCH/DELETE /api/management-reports/:id/comments/:commentId — assertCommentInReportAndOrganization cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `mrcmt-${suffix}-a`;
    const orgB = `mrcmt-${suffix}-b`;
    const userA = `mrcmt-${suffix}-user-a`;
    const userB = `mrcmt-${suffix}-user-b`;
    const reportBId = `mrcmt-${suffix}-report-b`;
    const commentBId = `mrcmt-${suffix}-comment-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const readComment = async (commentId: string): Promise<{ content: string } | null> => {
      const { rows } = await pool.query(
        `SELECT content FROM management_report_comments WHERE id = $1`,
        [commentId]
      );
      return rows[0] ?? null;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Mgmt Report Comment ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Report','Cmt',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing report + comment belong ONLY to org B.
      await pool.query(
        `INSERT INTO management_reports(id,organization_id,report_type,scope,title,generated_by)
         VALUES($1,$2,'TEAM_MEETING','PORTFOLIO','Org B confidential report',$3)`,
        [reportBId, orgB, userB]
      );
      await pool.query(
        `INSERT INTO management_report_comments(id,report_id,content,created_by)
         VALUES($1,$2,'Org B original comment text',$3)`,
        [commentBId, reportBId, userB]
      );

      const router = (await import('../../../server/src/routes/managementReports.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/management-reports', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM management_report_comments WHERE report_id = $1`, [
          reportBId,
        ]);
        await pool.query(`DELETE FROM management_reports WHERE id = $1`, [reportBId]);
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

    it("(1) org A caller cannot update org B's comment — content unchanged", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await readComment(commentBId);

      const res = await request(app)
        .patch(`/api/management-reports/${reportBId}/comments/${commentBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ content: 'Overwritten by org A' });

      expect(res.status).not.toBe(200);
      expect(await readComment(commentBId)).toEqual(before);
    });

    it("(2) org A caller cannot delete org B's comment — comment still present", async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .delete(`/api/management-reports/${reportBId}/comments/${commentBId}`)
        .set('Authorization', `Bearer ${bearer}`);

      expect(res.status).not.toBe(200);
      expect(await readComment(commentBId)).not.toBeNull();
    });

    it('(3) org B caller (real comment owner) can update and delete their own comment', async () => {
      const bearer = token(userB, orgB, 'ADMIN');

      const patchRes = await request(app)
        .patch(`/api/management-reports/${reportBId}/comments/${commentBId}`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ content: 'Updated by org B (legit)' });
      expect(patchRes.status).toBe(200);
      expect((await readComment(commentBId))?.content).toBe('Updated by org B (legit)');

      const deleteRes = await request(app)
        .delete(`/api/management-reports/${reportBId}/comments/${commentBId}`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(deleteRes.status).toBe(200);
      expect(await readComment(commentBId)).toBeNull();
    });
  }
);
