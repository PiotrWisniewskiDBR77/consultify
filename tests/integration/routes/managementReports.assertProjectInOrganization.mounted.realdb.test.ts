/**
 * FIX-212 partia 3 (pozycja 12 z 34) — mounted signed-JWT + real PostgreSQL
 * proof for server/src/services/managementReportsService.ts:156
 * assertProjectInOrganization.
 *
 * POST /api/management-reports/generate (managementReports.routes.ts) takes
 * `organizationId` ONLY from the verified JWT (`req.organizationId`, safe),
 * but `projectId` straight from the request body (attacker-controlled).
 * `generateReport()` calls `assertProjectInOrganization(projectId,
 * organizationId)` — `SELECT ... FROM projects WHERE id = ? AND
 * organization_id = ?` — BEFORE dispatching to any report-generation branch
 * (DEC-140, managementReportsService.ts:148-155): "A projectId that does not
 * resolve inside options.organizationId — foreign-tenant or nonexistent —
 * is rejected here, uniformly, as 404."
 *
 * Without the guard, an org A caller can generate a TEAM_MEETING report
 * naming ANOTHER org's real project. `generateTeamMeetingReport()` embeds
 * the victim project's name directly and unconditionally into the new
 * report's `title` (`${project.name} Team Meeting Report`,
 * managementReportsService.ts:499) even with zero related tasks/decisions —
 * so the leak needs no additional seed data to prove. The resulting report
 * row is saved under the ATTACKER's own organization_id, permanently
 * grafting org B's project identity into org A's report history.
 *
 * This test mounts the REAL managementReports.routes.ts router behind its
 * own router.use(verifyToken), against a REAL migrated PostgreSQL database
 * (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot generate a report against org B's real
 *      project — the request fails and no report referencing org B's
 *      project is created under org A,
 *  (2) an org B caller (the real project owner) CAN generate a report
 *      against their own project — 200, title carries the real project
 *      name,
 *  (3) MUTATION PROOF: with assertProjectInOrganization's organization_id
 *      predicate dropped (existence check only), the org A -> org B attempt
 *      from (1) succeeds — 200, and the returned report's title leaks org
 *      B's real project name into an org-A-owned report — proving this
 *      test is a real regression guard, not a false-positive failure.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/managementReports.assertProjectInOrganization.mounted.realdb.test.ts
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
  'mounted POST /api/management-reports/generate — assertProjectInOrganization cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `mrproj-${suffix}-a`;
    const orgB = `mrproj-${suffix}-b`;
    const userA = `mrproj-${suffix}-user-a`;
    const userB = `mrproj-${suffix}-user-b`;
    const projectBId = `mrproj-${suffix}-project-b`;
    const projectBName = `Org B confidential project ${suffix}`;
    let pool: pg.Pool;
    let app: Express;
    const createdReportIds: string[] = [];

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const countReportsForOrg = async (organizationId: string) => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM management_reports WHERE organization_id = $1`,
        [organizationId]
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
          `Mgmt Report Project ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Report','Proj',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing project belongs ONLY to org B.
      await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)`, [
        projectBId,
        orgB,
        projectBName,
      ]);

      const router = (await import('../../../server/src/routes/managementReports.routes.js'))
        .default;
      app = express();
      app.use(express.json());
      app.use('/api/management-reports', router);
    }, 60_000);

    afterAll(async () => {
      try {
        if (createdReportIds.length > 0) {
          await pool.query(`DELETE FROM management_report_comments WHERE report_id = ANY($1)`, [
            createdReportIds,
          ]);
          await pool.query(`DELETE FROM management_reports WHERE id = ANY($1)`, [
            createdReportIds,
          ]);
        }
        await pool.query(`DELETE FROM management_reports WHERE project_id = $1`, [projectBId]);
        await pool.query(`DELETE FROM projects WHERE id = $1`, [projectBId]);
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

    it("(1) org A caller cannot generate a report against org B's real project", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await countReportsForOrg(orgA);

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId: projectBId });

      expect(res.status).not.toBe(200);
      expect(await countReportsForOrg(orgA)).toBe(before);
    });

    it('(2) org B caller (real project owner) can generate a report against their own project — 200', async () => {
      const bearer = token(userB, orgB, 'ADMIN');

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId: projectBId });

      expect(res.status).toBe(200);
      expect(res.body?.report?.title).toContain(projectBName);
      if (res.body?.report?.id) createdReportIds.push(res.body.report.id);
    });
  }
);
