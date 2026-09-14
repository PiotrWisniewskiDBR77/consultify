/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const expectedDatabase = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : undefined;

describe('PMO E3 stage gates through ApiGateway and real PostgreSQL', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const suffix = randomUUID();
  const ownerEmail = `f23-owner-${suffix}@test.invalid`;
  const attackerEmail = `f23-attacker-${suffix}@test.invalid`;
  const requesterEmail = `f23-requester-${suffix}@test.invalid`;
  let ownerToken = '';
  let attackerToken = '';
  let ownerId = '';
  let requesterId = '';
  let ownerOrg = '';
  let projectId = '';

  const register = (email: string, companyName: string) =>
    request(app).post('/api/auth/register').send({
      email,
      password: 'F23-Proof-Password-123!',
      firstName: 'F23',
      lastName: 'Proof',
      companyName,
      acceptedLegalDocs: ['TOS', 'PRIVACY'],
    });

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment({ expectedDatabase });
    await pool.query(
      readFileSync(new URL('../../../migrations/20262190_f2_3_pmo_stage_gates.sql', import.meta.url), 'utf8')
    );
    const { ApiGateway } = await import('../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const owner = await register(ownerEmail, `F23 Owner ${suffix}`);
    const attacker = await register(attackerEmail, `F23 Attacker ${suffix}`);
    const requester = await register(requesterEmail, `F23 Requester ${suffix}`);
    expect(owner.status).toBe(200);
    expect(attacker.status).toBe(200);
    expect(requester.status).toBe(200);
    ownerToken = String(owner.body.token);
    attackerToken = String(attacker.body.token);
    const ownerRow = (
      await pool.query<{ id: string; organization_id: string }>(
        'SELECT id, organization_id FROM users WHERE email=$1',
        [ownerEmail]
      )
    ).rows[0];
    ownerId = ownerRow.id;
    ownerOrg = ownerRow.organization_id;
    requesterId = (
      await pool.query<{ id: string }>(
        'UPDATE users SET organization_id=$1 WHERE email=$2 RETURNING id',
        [ownerOrg, requesterEmail]
      )
    ).rows[0].id;
    projectId = `f23-project-${suffix}`;
    await pool.query(
      `INSERT INTO projects(id, organization_id, name, current_phase, context_data, owner_id)
       VALUES ($1,$2,$3,'Context',$4,$5)`,
      [
        projectId,
        ownerOrg,
        'PMO E3 gateway proof',
        JSON.stringify({
          strategicGoals: ['Increase delivery reliability'],
          challenges: ['Fragmented governance'],
          constraints: ['Fixed pilot window'],
        }),
        ownerId,
      ]
    );
    await pool.query(
      `INSERT INTO project_members
        (id, project_id, user_id, project_role, normalized_project_role, allocation_percent, permissions)
       VALUES ($1,$2,$3,'PROJECT_SPONSOR','PROJECT_SPONSOR',20,$4)`,
      [randomUUID(), projectId, ownerId, JSON.stringify([])]
    );
    await pool.query(
      `INSERT INTO project_members
        (id, project_id, user_id, project_role, normalized_project_role, allocation_percent, permissions)
       VALUES ($1,$2,$3,'PROJECT_LEADER','PROJECT_LEADER',80,$4)`,
      [randomUUID(), projectId, requesterId, JSON.stringify([])]
    );
  }, 60_000);

  afterAll(async () => {
    await pool.query('DELETE FROM stage_gates WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM project_members WHERE project_id=$1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM projects WHERE id=$1', [projectId]).catch(() => undefined);
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('returns 404 for a foreign tenant before revealing gate readiness', async () => {
    const response = await request(app)
      .get(`/api/stage-gates/${projectId}/current`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Project not found' });
  });

  it('denies a project role without gate.approve', async () => {
    await pool.query(
      `UPDATE project_members
          SET project_role='TASK_ASSIGNEE', normalized_project_role='TASK_ASSIGNEE'
        WHERE project_id=$1 AND user_id=$2`,
      [projectId, ownerId]
    );
    const response = await request(app)
      .post(`/api/stage-gates/${projectId}/pass/READINESS_GATE`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestedBy: requesterId, notes: 'must be denied' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('STAGE_GATE_ROLE_FORBIDDEN');
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM stage_gates WHERE project_id=$1', [projectId])).rows[0].count).toBe(0);
  });

  it('rejects self-approval with a stable client code and no readiness disclosure', async () => {
    await pool.query(
      `UPDATE project_members
          SET project_role='PROJECT_SPONSOR', normalized_project_role='PROJECT_SPONSOR'
        WHERE project_id=$1 AND user_id=$2`,
      [projectId, ownerId]
    );
    const response = await request(app)
      .post(`/api/stage-gates/${projectId}/pass/READINESS_GATE`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestedBy: ownerId, notes: 'self approval must fail' });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'SEPARATION_OF_DUTIES_REQUIRED' });
    expect(response.body).not.toHaveProperty('missingElements');
    expect(
      (await pool.query('SELECT COUNT(*)::int AS count FROM stage_gates WHERE project_id=$1', [projectId]))
        .rows[0].count
    ).toBe(0);
  });

  it('authorizes the project reviewer before reading readiness', async () => {
    await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [
      projectId,
      ownerId,
    ]);
    const response = await request(app)
      .post(`/api/stage-gates/${projectId}/pass/READINESS_GATE`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestedBy: requesterId });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'STAGE_GATE_ROLE_FORBIDDEN' });
    expect(response.body).not.toHaveProperty('missingElements');
    await pool.query(
      `INSERT INTO project_members
        (id, project_id, user_id, project_role, normalized_project_role, allocation_percent, permissions)
       VALUES ($1,$2,$3,'PROJECT_SPONSOR','PROJECT_SPONSOR',20,$4)`,
      [randomUUID(), projectId, ownerId, JSON.stringify([])]
    );
  });

  it('passes a ready gate for the project sponsor and persists phase plus receipt', async () => {
    await pool.query(
      `UPDATE project_members
          SET project_role='PROJECT_SPONSOR', normalized_project_role='PROJECT_SPONSOR'
        WHERE project_id=$1 AND user_id=$2`,
      [projectId, ownerId]
    );
    const current = await request(app)
      .get(`/api/stage-gates/${projectId}/current`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({ gateType: 'READINESS_GATE', status: 'READY' });

    const passage = await request(app)
      .post(`/api/stage-gates/${projectId}/pass/READINESS_GATE`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestedBy: requesterId, notes: 'weekly sponsor review' });
    expect(passage.status).toBe(200);
    expect(passage.body).toMatchObject({ gateType: 'READINESS_GATE', status: 'PASSED', toPhase: 'Assessment' });

    const project = (await pool.query('SELECT current_phase FROM projects WHERE id=$1', [projectId])).rows[0];
    const gate = (
      await pool.query(
        `SELECT organization_id, gate_type, status, requested_by, approved_by, notes
           FROM stage_gates WHERE project_id=$1`,
        [projectId]
      )
    ).rows[0];
    expect(project.current_phase).toBe('Assessment');
    expect(gate).toMatchObject({
      organization_id: ownerOrg,
      gate_type: 'READINESS_GATE',
      status: 'PASSED',
      approved_by: ownerId,
      requested_by: requesterId,
      notes: 'weekly sponsor review',
    });
  });
});
