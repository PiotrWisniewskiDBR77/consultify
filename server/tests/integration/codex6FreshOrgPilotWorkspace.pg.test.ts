/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('CODEX6 E1 fresh organization pilot workspace', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const suffix = randomUUID();
  const email = `codex6-e1-${suffix}@test.invalid`;
  const companyName = `Codex6 Fresh Organization ${suffix}`;
  let organizationId = '';
  let userId = '';
  let token = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../src/Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const registration = await request(app).post('/api/auth/register').send({
      email,
      password: 'Codex6-Fresh-Org-Password-123!',
      firstName: 'Pilot',
      lastName: 'Owner',
      companyName,
      acceptedLegalDocs: ['TOS', 'PRIVACY'],
    });
    expect(registration.status).toBe(200);
    organizationId = String(registration.body.user?.organizationId || '');
    userId = String(registration.body.user?.id || '');
    token = String(registration.body.token || '');
    expect(organizationId).toBeTruthy();
    expect(userId).toBeTruthy();
    expect(token).toBeTruthy();
  }, 60_000);

  afterAll(async () => {
    if (organizationId) {
      await pool.query('DELETE FROM initiatives WHERE organization_id=$1', [organizationId]);
      await pool.query(
        `DELETE FROM interview_questions WHERE session_id IN
           (SELECT id FROM interview_sessions WHERE organization_id=$1)`,
        [organizationId]
      );
      await pool.query('DELETE FROM interview_sessions WHERE organization_id=$1', [organizationId]);
      await pool.query(
        `DELETE FROM project_members WHERE project_id IN
           (SELECT id FROM projects WHERE organization_id=$1)`,
        [organizationId]
      );
      await pool.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM v8.v8_feature_flags WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM user_onboarding WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM users WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM organization_limits WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    }
    await pool.end();
    const pgModule = await import('../../src/database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('registration provisions one English starter project and owner membership', async () => {
    const projects = await pool.query<{
      id: string;
      name: string;
      description: string;
      owner_id: string;
      is_system: boolean;
    }>(
      `SELECT id,name,description,owner_id,is_system
         FROM projects WHERE organization_id=$1 ORDER BY created_at`,
      [organizationId]
    );
    expect(projects.rows).toHaveLength(1);
    expect(projects.rows[0]).toMatchObject({
      name: 'First value workspace',
      owner_id: userId,
      is_system: true,
    });
    expect(projects.rows[0]?.description).toMatch(/first interview.*assessment.*initiative/i);

    const membership = await pool.query(
      'SELECT project_role FROM project_members WHERE project_id=$1 AND user_id=$2',
      [projects.rows[0]?.id, userId]
    );
    expect(membership.rows).toHaveLength(1);
    expect(membership.rows[0]?.project_role).toBe('PROJECT_MANAGER');
  });

  it('the first interview can be created without manually supplying a project id', async () => {
    const response = await request(app)
      .post('/api/interview/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pilot discovery interview' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Pilot discovery interview' });
    expect(response.body.projectId || response.body.project_id).toBeTruthy();
  });

  it('persists a complete initiative card and accepts the canonical submit transition', async () => {
    const project = await pool.query('SELECT id FROM projects WHERE organization_id=$1 LIMIT 1', [
      organizationId,
    ]);
    const created = await request(app)
      .post('/api/initiatives')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Stabilize pilot delivery',
        description: 'Create a visible weekly delivery cadence for the pilot area.',
        summary: 'Create a visible weekly delivery cadence for the pilot area.',
        hypothesis: 'A named cadence will reduce delivery variance.',
        projectId: project.rows[0].id,
        ownerBusinessId: userId,
        ownerExecutionId: userId,
        scopeIn: ['Pilot area'],
        scopeOut: ['Other production areas'],
        sourceType: 'manual',
      });
    expect(created.status).toBe(200);

    const row = await pool.query(
      'SELECT description,owner_business_id,scope_in FROM initiatives WHERE id=$1',
      [created.body.id]
    );
    expect(row.rows[0]).toMatchObject({
      description: 'Create a visible weekly delivery cadence for the pilot area.',
      owner_business_id: userId,
    });
    expect(JSON.parse(row.rows[0].scope_in)).toEqual(['Pilot area']);

    const submitted = await request(app)
      .patch(`/api/initiatives/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PENDING_APPROVAL', reason: 'Ready for pilot review' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');
  });
});
