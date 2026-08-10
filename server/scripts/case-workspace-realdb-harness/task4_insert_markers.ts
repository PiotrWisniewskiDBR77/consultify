#!/usr/bin/env tsx
/**
 * Case Workspace real-DB harness — Task 4 (persistence/readback), INSERT half.
 *
 * Seeds a minimal organizations/projects/users/organization_members fixture
 * (following server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts's
 * seedOrg/seedUser/seedMember convention), then inserts two synthetic marker
 * rows: one case_core row and one case_plan_versions row hanging off it.
 * All IDs are FIXED (not randomUUID) so a second, independent process
 * (task4_readback_markers.ts) can look them up without any shared state
 * beyond the database itself.
 *
 * This process then explicitly closes its pg.Pool and exits — the
 * readback script is run as a completely separate `node`/`tsx` process
 * afterward, proving the rows survive beyond this process's connection
 * lifetime (not just an in-memory cache).
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host:port/db \
 *     npx tsx server/scripts/case-workspace-realdb-harness/task4_insert_markers.ts
 */
import { Pool } from 'pg';

const MARKER = {
  orgId: 'case-workspace-harness-marker-org-1',
  projectId: 'case-workspace-harness-marker-project-1',
  userId: 'case-workspace-harness-marker-user-1',
  memberId: 'case-workspace-harness-marker-member-1',
  caseId: 'case-workspace-harness-marker-case-1',
  planVersionId: 'case-workspace-harness-marker-plan-1',
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, max: 4 });
  try {
    // Clean slate in case a previous harness run left these behind.
    await pool.query(`DELETE FROM case_plan_versions WHERE case_plan_version_id = $1`, [
      MARKER.planVersionId,
    ]);
    await pool.query(`DELETE FROM case_core WHERE case_id = $1`, [MARKER.caseId]);
    await pool.query(`DELETE FROM organization_members WHERE id = $1`, [MARKER.memberId]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [MARKER.projectId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [MARKER.userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [MARKER.orgId]);

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      MARKER.orgId,
      'Case Workspace realdb harness org (task4)',
    ]);
    await pool.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      MARKER.projectId,
      MARKER.orgId,
      'Case Workspace realdb harness project (task4)',
    ]);
    await pool.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      MARKER.userId,
      MARKER.orgId,
      `${MARKER.userId}@example.test`,
    ]);
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [MARKER.memberId, MARKER.orgId, MARKER.userId]
    );

    const insertedCase = await pool.query(
      `INSERT INTO case_core (
         case_id, project_id, organization_id, contracted_closure_type,
         created_by_actor_id, case_status, governance_tier
       ) VALUES ($1, $2, $3, 'DELIVERY_COMPLETED', $4, 'ACTIVE', 'STANDARD')
       RETURNING case_id, case_status, governance_tier, version`,
      [MARKER.caseId, MARKER.projectId, MARKER.orgId, MARKER.userId]
    );
    console.log('Inserted case_core row:', JSON.stringify(insertedCase.rows[0]));

    const insertedPlan = await pool.query(
      `INSERT INTO case_plan_versions (
         case_plan_version_id, case_id, plan_number, semantic_graph, graph_digest,
         status, change_reason, created_by_actor_id
       ) VALUES ($1, $2, 1, $3, $4, 'DRAFT', 'task4 persistence/readback marker', $5)
       RETURNING case_plan_version_id, case_id, plan_number, status`,
      [
        MARKER.planVersionId,
        MARKER.caseId,
        JSON.stringify({ nodes: ['harness-marker-node'], edges: [] }),
        'harness-marker-digest-0001',
        MARKER.userId,
      ]
    );
    console.log('Inserted case_plan_versions row:', JSON.stringify(insertedPlan.rows[0]));

    console.log('MARKER_IDS=' + JSON.stringify(MARKER));
    console.log('Task 4 (insert half): PASS — marker rows inserted.');
  } finally {
    await pool.end();
    console.log('Pool explicitly closed.');
  }
}

main().catch((err) => {
  console.error('task4_insert_markers.ts FAILED:', err);
  process.exit(1);
});
