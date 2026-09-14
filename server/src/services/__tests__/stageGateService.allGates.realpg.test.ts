/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { evaluateGate, GATE_TYPES, passGate } from '../stageGateService.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const expectedDatabase = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : undefined;
const pool = new Pool({ connectionString: databaseUrl });

describe('PMO E3 five stage gates on real PostgreSQL', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `f23-five-org-${suffix}`;
  const projectId = `f23-five-project-${suffix}`;
  const actorId = `f23-five-user-${suffix}`;
  const assessmentId = `f23-five-assessment-${suffix}`;
  const initiativeId = `f23-five-initiative-${suffix}`;
  const kpiId = `f23-five-kpi-${suffix}`;
  const decisionId = `f23-five-decision-${suffix}`;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment({ expectedDatabase });
    await pool.query(
      readFileSync(
        new URL('../../../migrations/20262190_f2_3_pmo_stage_gates.sql', import.meta.url),
        'utf8'
      )
    );
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
      organizationId,
      'F23 five-gate proof',
    ]);
    await pool.query(`INSERT INTO users(id,email,organization_id) VALUES($1,$2,$3)`, [
      actorId,
      `${actorId}@test.invalid`,
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,current_phase,context_data,owner_id)
       VALUES($1,$2,$3,'Context','{}',$4)`,
      [projectId, organizationId, 'F23 five-gate project', actorId]
    );
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role)
       VALUES($1,$2,$3,'PROJECT_SPONSOR','PROJECT_SPONSOR')`,
      [randomUUID(), projectId, actorId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM stage_gates WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM kpi_measurements WHERE kpi_id=$1', [kpiId]).catch(() => undefined);
    await pool.query('DELETE FROM initiative_kpis WHERE id=$1', [kpiId]).catch(() => undefined);
    await pool.query('DELETE FROM decisions WHERE id=$1', [decisionId]).catch(() => undefined);
    await pool
      .query('DELETE FROM assessment_report_reviews WHERE assessment_id=$1', [assessmentId])
      .catch(() => undefined);
    await pool.query('DELETE FROM maturity_assessments WHERE id=$1', [assessmentId]).catch(() => undefined);
    await pool.query('DELETE FROM plan_baselines WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM roadmap_waves WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM initiatives WHERE id=$1', [initiativeId]).catch(() => undefined);
    await pool.query('DELETE FROM project_members WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM projects WHERE id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]).catch(() => undefined);
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('fails closed until each gate has evidence, then persists all five transitions', async () => {
    expect((await evaluateGate(projectId, GATE_TYPES.READINESS_GATE)).status).toBe('NOT_READY');
    await pool.query(
      `UPDATE projects SET context_data=$1 WHERE id=$2`,
      [
        JSON.stringify({
          strategicGoals: ['Reliable delivery'],
          challenges: ['Fragmented governance'],
          constraints: ['Fixed pilot window'],
        }),
        projectId,
      ]
    );
    await passGate(projectId, GATE_TYPES.READINESS_GATE, actorId, undefined, undefined, {
      organizationId,
    });

    expect((await evaluateGate(projectId, GATE_TYPES.DESIGN_GATE)).status).toBe('NOT_READY');
    await pool.query(
      `INSERT INTO maturity_assessments(id,project_id,is_complete) VALUES($1,$2,1)`,
      [assessmentId, projectId]
    );
    await pool.query(
      `INSERT INTO assessment_report_reviews
         (id,organization_id,assessment_id,version_id,reviewer_id,status)
       VALUES($1,$2,$3,$4,$5,'approved')`,
      [randomUUID(), organizationId, assessmentId, `version-${suffix}`, actorId]
    );
    await passGate(projectId, GATE_TYPES.DESIGN_GATE, actorId, undefined, undefined, {
      organizationId,
    });

    expect((await evaluateGate(projectId, GATE_TYPES.PLANNING_GATE)).status).toBe('NOT_READY');
    await pool.query(
      `INSERT INTO initiatives
         (id,organization_id,project_id,name,title,status,owner_business_id,priority,priority_order,
          planned_start_date,planned_end_date)
       VALUES($1,$2,$3,$4,$4,'APPROVED',$5,'high',1,'2026-10-01','2026-10-31')`,
      [initiativeId, organizationId, projectId, 'F23 planned initiative', actorId]
    );
    await pool.query(`UPDATE initiatives SET owner_business_id=$1 WHERE id=$2`, [
      actorId,
      initiativeId,
    ]);
    expect(await evaluateGate(projectId, GATE_TYPES.PLANNING_GATE)).toMatchObject({
      status: 'READY',
      missingElements: [],
    });
    await passGate(projectId, GATE_TYPES.PLANNING_GATE, actorId, undefined, undefined, {
      organizationId,
    });

    expect((await evaluateGate(projectId, GATE_TYPES.EXECUTION_GATE)).status).toBe('NOT_READY');
    await pool.query(
      `INSERT INTO plan_baselines(id,organization_id,project_id,snapshot,created_at)
       VALUES($1,$2,$3,'{}',$4)`,
      [randomUUID(), organizationId, projectId, new Date().toISOString()]
    );
    await pool.query(
      `INSERT INTO roadmap_waves(id,organization_id,project_id,name,start_date,end_date)
       VALUES($1,$2,$3,'Wave 1','2026-10-01','2026-10-31')`,
      [randomUUID(), organizationId, projectId]
    );
    await passGate(projectId, GATE_TYPES.EXECUTION_GATE, actorId, undefined, undefined, {
      organizationId,
    });

    expect((await evaluateGate(projectId, GATE_TYPES.CLOSURE_GATE)).status).toBe('NOT_READY');
    await pool.query(
      `INSERT INTO decisions
         (id,organization_id,project_id,title,status,required,decision_maker_id,created_by)
       VALUES($1,$2,$3,'F23 blocking decision','pending','true',$4,$4)`,
      [decisionId, organizationId, projectId, actorId]
    );
    await pool.query(`UPDATE initiatives SET status='CLOSED' WHERE id=$1`, [initiativeId]);
    await pool.query(
      `INSERT INTO initiative_kpis(id,initiative_id,organization_id,name,current_value)
       VALUES($1,$2,$3,'F23 measured KPI',100)`,
      [kpiId, initiativeId, organizationId]
    );
    await pool.query(
      `INSERT INTO kpi_measurements(id,kpi_id,value,measured_at,created_by)
       VALUES($1,$2,100,CURRENT_TIMESTAMP,$3)`,
      [randomUUID(), kpiId, actorId]
    );
    const blockedClosure = await evaluateGate(projectId, GATE_TYPES.CLOSURE_GATE);
    expect(blockedClosure.status).toBe('NOT_READY');
    expect(blockedClosure.missingElements).toContain('No blocking decisions pending');
    await pool.query(`UPDATE decisions SET status='decided' WHERE id=$1`, [decisionId]);
    await passGate(projectId, GATE_TYPES.CLOSURE_GATE, actorId, undefined, undefined, {
      organizationId,
    });

    const project = await pool.query<{ current_phase: string }>(
      `SELECT current_phase FROM projects WHERE id=$1`,
      [projectId]
    );
    const receipts = await pool.query<{ gate_type: string }>(
      `SELECT gate_type FROM stage_gates WHERE project_id=$1 AND status='PASSED' ORDER BY approved_at`,
      [projectId]
    );
    expect(project.rows[0].current_phase).toBe('Stabilization');
    expect(new Set(receipts.rows.map((row) => row.gate_type))).toEqual(
      new Set(Object.values(GATE_TYPES))
    );
    expect(receipts.rows).toHaveLength(5);
  }, 60_000);
});
