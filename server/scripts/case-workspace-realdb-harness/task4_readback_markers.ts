#!/usr/bin/env tsx
/**
 * Case Workspace real-DB harness — Task 4 (persistence/readback), READBACK half.
 *
 * Deliberately run as a SEPARATE process/pool from task4_insert_markers.ts
 * (a new `tsx` invocation is a new OS process with a brand new pg.Pool —
 * there is no shared JS state and no cached connection from the insert
 * script), to prove the marker rows persisted in Postgres itself, not in
 * any in-memory structure of the process that wrote them.
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host:port/db \
 *     npx tsx server/scripts/case-workspace-realdb-harness/task4_readback_markers.ts
 */
import { Pool } from 'pg';

const MARKER = {
  orgId: 'case-workspace-harness-marker-org-1',
  projectId: 'case-workspace-harness-marker-project-1',
  userId: 'case-workspace-harness-marker-user-1',
  caseId: 'case-workspace-harness-marker-case-1',
  planVersionId: 'case-workspace-harness-marker-plan-1',
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  console.log(`This process PID: ${process.pid} (independent of the insert process)`);
  const pool = new Pool({ connectionString, max: 4 });
  let ok = true;
  try {
    const caseRow = await pool.query(
      `SELECT case_id, project_id, organization_id, contracted_closure_type,
              created_by_actor_id, case_status, governance_tier, version
         FROM case_core WHERE case_id = $1`,
      [MARKER.caseId]
    );
    console.log('Read back case_core row:', JSON.stringify(caseRow.rows[0] ?? null));
    const c = caseRow.rows[0];
    if (!c) {
      console.error('FAIL: case_core marker row not found.');
      ok = false;
    } else {
      const checks: [string, boolean][] = [
        ['case_id', c.case_id === MARKER.caseId],
        ['project_id', c.project_id === MARKER.projectId],
        ['organization_id', c.organization_id === MARKER.orgId],
        ['contracted_closure_type', c.contracted_closure_type === 'DELIVERY_COMPLETED'],
        ['created_by_actor_id', c.created_by_actor_id === MARKER.userId],
        ['case_status', c.case_status === 'ACTIVE'],
        ['governance_tier', c.governance_tier === 'STANDARD'],
        ['version', Number(c.version) === 1],
      ];
      for (const [field, pass] of checks) {
        console.log(`  case_core.${field}: ${pass ? 'match' : 'MISMATCH'}`);
        if (!pass) ok = false;
      }
    }

    const planRow = await pool.query(
      `SELECT case_plan_version_id, case_id, plan_number, status, graph_digest
         FROM case_plan_versions WHERE case_plan_version_id = $1`,
      [MARKER.planVersionId]
    );
    console.log('Read back case_plan_versions row:', JSON.stringify(planRow.rows[0] ?? null));
    const p = planRow.rows[0];
    if (!p) {
      console.error('FAIL: case_plan_versions marker row not found.');
      ok = false;
    } else {
      const checks: [string, boolean][] = [
        ['case_plan_version_id', p.case_plan_version_id === MARKER.planVersionId],
        ['case_id', p.case_id === MARKER.caseId],
        ['plan_number', Number(p.plan_number) === 1],
        ['status', p.status === 'DRAFT'],
        ['graph_digest', p.graph_digest === 'harness-marker-digest-0001'],
      ];
      for (const [field, pass] of checks) {
        console.log(`  case_plan_versions.${field}: ${pass ? 'match' : 'MISMATCH'}`);
        if (!pass) ok = false;
      }
    }

    console.log(ok ? 'Task 4 (readback half): PASS — rows present and correct after independent process/pool.' : 'Task 4 (readback half): FAIL — see MISMATCH/not found lines above.');
  } finally {
    // Teardown — this harness cleans up after itself (CLAUDE.md: "Dane demo
    // = twarz produktu: probe'y sprzątają po sobie"). Order respects FKs.
    await pool.query(`DELETE FROM case_plan_versions WHERE case_plan_version_id = $1`, [
      MARKER.planVersionId,
    ]);
    await pool.query(`DELETE FROM case_core WHERE case_id = $1`, [MARKER.caseId]);
    await pool.query(`DELETE FROM organization_members WHERE user_id = $1`, [MARKER.userId]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [MARKER.projectId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [MARKER.userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [MARKER.orgId]);
    console.log('Marker fixture rows torn down.');
    await pool.end();
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('task4_readback_markers.ts FAILED:', err);
  process.exit(1);
});
