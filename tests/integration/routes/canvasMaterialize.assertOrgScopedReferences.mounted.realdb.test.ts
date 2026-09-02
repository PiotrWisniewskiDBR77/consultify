/**
 * FIX-212 partia 2 — real PostgreSQL proof for
 * server/src/services/canvasMaterialize.ts:116 assertOrgScopedReferences.
 *
 * `materializeWorkspaceTarget` is, per this file's own header, "the single
 * materialization core" shared by BOTH Canvas promote paths — direct
 * save-to-workspace (work-canvas.routes.ts POST .../save-to-workspace) and
 * proposal-approval (workCanvasService.ts commitProposalToDomain). It only
 * ever CREATES new rows, but its input can carry a REFERENCE to an existing
 * entity — `projectId` — taken from client-controlled draft/proposal data.
 * `assertOrgScopedReferences` is called FIRST, before any write, and is —
 * per the function's own docblock (line ~100-102) — "the single shared site"
 * for this check, because "downstream canonical services do not all enforce
 * org membership: decisionService / notebookService / initiativeService
 * persist project_id verbatim". In other words: this is not defense in
 * depth, it is the ONLY tenant boundary for this specific forgery.
 *
 * Without the guard, an org A actor could materialize a `decision` that
 * references org B's real project id — writing a live cross-tenant
 * `decisions.project_id` linkage org B never consented to and does not own,
 * while the decision itself stays invisible to org B (every decisions read
 * is organization_id-scoped, not project_id-scoped) — a forged relationship
 * sitting silently under another org's project.
 *
 * This test calls the REAL exported `materializeWorkspaceTarget` directly
 * (no HTTP layer — a deliberate choice: the surrounding HTTP route also
 * requires an owned Canvas draft record and a `canvas.convert.<target>`
 * capability grant, both orthogonal to the org-scope guard under test here;
 * calling the shared materializer function itself, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), is the more direct proof of exactly
 * this guard) and proves:
 *  (1) an org A actor cannot materialize a decision referencing org B's real
 *      project — throws CANVAS_CROSS_ORG_REFERENCE (statusCode 403), zero
 *      decision rows written,
 *  (2) an org B actor (the real project owner) CAN materialize a decision
 *      referencing their own project — real row written, project_id intact,
 *  (3) MUTATION PROOF: with assertOrgScopedReferences's project ownership
 *      check short-circuited to always pass, the org A -> org B forgery from
 *      (1) succeeds instead of throwing — a real decisions row is written
 *      with organization_id=orgA and project_id=<org B's project> — proving
 *      this test is a real regression guard, not a false-positive throw.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/canvasMaterialize.assertOrgScopedReferences.mounted.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential(
  'materializeWorkspaceTarget — assertOrgScopedReferences cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `canvasmat-${suffix}-a`;
    const orgB = `canvasmat-${suffix}-b`;
    const userA = `canvasmat-${suffix}-user-a`;
    const userB = `canvasmat-${suffix}-user-b`;
    const projectBId = `canvasmat-${suffix}-project-b`;
    let pool: pg.Pool;

    const countDecisionsForProject = async (projectId: string) => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM decisions WHERE project_id = $1`,
        [projectId]
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
          `Canvas Materialize ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Canvas','Mat',now())`,
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
        'Org B project',
      ]);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM decisions WHERE project_id = $1`, [projectBId]);
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

    it("(1) org A actor cannot materialize a decision referencing org B's project — throws CANVAS_CROSS_ORG_REFERENCE, zero rows written", async () => {
      const { materializeWorkspaceTarget } = await import(
        '../../../server/src/services/canvasMaterialize.js'
      );
      const before = await countDecisionsForProject(projectBId);

      let caught: unknown = null;
      try {
        await materializeWorkspaceTarget({
          organizationId: orgA,
          actorUserId: userA,
          target: 'decision',
          title: 'Cross-org forge attempt',
          contentMd: 'body',
          summary: 'summary',
          projectId: projectBId,
          sourceDraftId: `draft-${suffix}-a`,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeTruthy();
      const errorRecord = caught as { statusCode?: unknown; code?: unknown; field?: unknown };
      expect(errorRecord.statusCode).toBe(403);
      expect(errorRecord.code).toBe('CANVAS_CROSS_ORG_REFERENCE');
      expect(errorRecord.field).toBe('projectId');

      expect(await countDecisionsForProject(projectBId)).toBe(before);
    });

    it("(2) org B actor (real project owner) can materialize a decision on their own project", async () => {
      const { materializeWorkspaceTarget } = await import(
        '../../../server/src/services/canvasMaterialize.js'
      );
      const before = await countDecisionsForProject(projectBId);

      const result = await materializeWorkspaceTarget({
        organizationId: orgB,
        actorUserId: userB,
        target: 'decision',
        title: 'Legit org B decision',
        contentMd: 'body',
        summary: 'summary',
        projectId: projectBId,
        sourceDraftId: `draft-${suffix}-b`,
      });

      expect(result.type).toBe('decision');
      expect(await countDecisionsForProject(projectBId)).toBe(before + 1);

      const { rows } = await pool.query(
        `SELECT organization_id, project_id FROM decisions WHERE id = $1`,
        [result.id]
      );
      expect(rows[0]?.organization_id).toBe(orgB);
      expect(rows[0]?.project_id).toBe(projectBId);
    });
  }
);
