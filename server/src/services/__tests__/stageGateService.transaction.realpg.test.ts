/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { GATE_TYPES, passGate } from '../stageGateService.js';

const NO_RETRY = { retry: 0 } as const;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const databaseUrl = process.env.DATABASE_URL ?? '';
const expectedDatabase = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : undefined;

describe('PMO E3 stage-gate transaction', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `f23-rollback-org-${suffix}`;
  const projectId = `f23-rollback-project-${suffix}`;
  const requesterId = `f23-rollback-requester-${suffix}`;
  const reviewerId = `f23-rollback-reviewer-${suffix}`;
  const triggerName = `f23_rollback_${suffix.replaceAll('-', '_')}`;

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
      'F23 rollback proof',
    ]);
    await pool.query(`INSERT INTO users(id,email,organization_id) VALUES($1,$2,$3),($4,$5,$3)`, [
      requesterId,
      `${requesterId}@test.invalid`,
      organizationId,
      reviewerId,
      `${reviewerId}@test.invalid`,
    ]);
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,current_phase,context_data,owner_id)
       VALUES($1,$2,$3,'Context',$4,$5)`,
      [
        projectId,
        organizationId,
        'F23 rollback project',
        JSON.stringify({
          strategicGoals: ['Goal'],
          challenges: ['Challenge'],
          constraints: ['Constraint'],
        }),
        reviewerId,
      ]
    );
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role)
       VALUES($1,$2,$3,'PROJECT_LEADER','PROJECT_LEADER'),
             ($4,$2,$5,'PROJECT_SPONSOR','PROJECT_SPONSOR')`,
      [randomUUID(), projectId, requesterId, randomUUID(), reviewerId]
    );
    await pool.query(
      `CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled phase failure'; END $$`
    );
    await pool.query(
      `CREATE TRIGGER ${triggerName} BEFORE UPDATE ON projects FOR EACH ROW WHEN (NEW.id = '${projectId}') EXECUTE FUNCTION ${triggerName}()`
    );
  });

  afterAll(async () => {
    await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON projects`).catch(() => undefined);
    await pool.query(`DROP FUNCTION IF EXISTS ${triggerName}()`).catch(() => undefined);
    await pool
      .query('DELETE FROM stage_gates WHERE project_id=$1', [projectId])
      .catch(() => undefined);
    await pool
      .query('DELETE FROM project_members WHERE project_id=$1', [projectId])
      .catch(() => undefined);
    await pool.query('DELETE FROM projects WHERE id=$1', [projectId]).catch(() => undefined);
    await pool
      .query('DELETE FROM users WHERE id = ANY($1::text[])', [[requesterId, reviewerId]])
      .catch(() => undefined);
    await pool
      .query('DELETE FROM organizations WHERE id=$1', [organizationId])
      .catch(() => undefined);
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('rolls back the gate receipt when the phase update fails', async () => {
    await expect(
      passGate(projectId, GATE_TYPES.READINESS_GATE, requesterId, 'rollback proof', 'OWNER', {
        organizationId,
      })
    ).resolves.toMatchObject({ status: 'PENDING', requestedBy: requesterId });

    await expect(
      passGate(projectId, GATE_TYPES.READINESS_GATE, reviewerId, 'rollback proof', 'OWNER', {
        organizationId,
      })
    ).rejects.toMatchObject({ code: 'STAGE_GATE_WRITE_FAILED' });
    expect(
      (
        await pool.query(
          `SELECT COUNT(*)::int AS count FROM stage_gates
          WHERE project_id=$1 AND status='PASSED'`,
          [projectId]
        )
      ).rows[0].count
    ).toBe(0);
    expect(
      (
        await pool.query(
          `SELECT status,requested_by,approved_by FROM stage_gates WHERE project_id=$1`,
          [projectId]
        )
      ).rows[0]
    ).toMatchObject({ status: 'PENDING', requested_by: requesterId, approved_by: null });
    expect(
      (await pool.query('SELECT current_phase FROM projects WHERE id=$1', [projectId])).rows[0]
        .current_phase
    ).toBe('Context');
  });
});
