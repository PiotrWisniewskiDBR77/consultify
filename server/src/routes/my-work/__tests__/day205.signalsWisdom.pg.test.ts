/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day205 R2 signal decisions become organization wisdom through real Gateway', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const signalId = randomUUID();
  const runId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id,name,plan,status) VALUES ($1,'Day205 R2','enterprise','active')`, [organizationId]);
    await sql.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','MEMBER','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'MEMBER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO work_signals
       (signal_id,organization_id,dedupe_key,domain,signal_type,origin,severity,
        subject_type,subject_id,audience_user_id,title_key,rule_id,rule_version,run_id)
       VALUES ($1,$2,$3,'EXECUTION','task_overdue','DETERMINISTIC','warning',
               'task','day205-task',$4,'day205.title','day205.rule',1,$5)`,
      [signalId, organizationId, `day205:${signalId}`, userId, runId]
    );
    const [{ default: config }, { ApiGateway }] = await Promise.all([
      import('../../../config/Config.js'),
      import('../../../Gateway.js'),
    ]);
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, role: 'MEMBER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM organization_context_claims WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_context_items WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_context_snapshots WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM my_work_signal_snoozes WHERE user_id=$1`, [userId]);
    await sql.query(`DELETE FROM my_work_signal_dismissals WHERE user_id=$1`, [userId]);
    await sql.query(`DELETE FROM work_signals WHERE signal_id=$1`, [signalId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('preserves mutation responses and persists non-empty snooze and dismiss claims', async () => {
    const snooze = await request(app)
      .post(`/api/my-work/signals/${signalId}/snooze`)
      .set('Authorization', authorization)
      .send({ preset: '1h' });
    expect(snooze.status, JSON.stringify(snooze.body)).toBe(200);
    expect(snooze.body).toEqual({ snoozedUntil: expect.any(String) });

    const dismiss = await request(app)
      .post(`/api/my-work/signals/${signalId}/dismiss`)
      .set('Authorization', authorization);
    expect(dismiss.status, JSON.stringify(dismiss.body)).toBe(200);
    expect(dismiss.body).toEqual({ dismissedAt: expect.any(String) });

    const claims = await sql.query<{ value: Record<string, unknown> }>(
      `SELECT value_json::jsonb AS value FROM organization_context_claims
       WHERE organization_id=$1 AND claim_path='notes.manualContext' ORDER BY created_at`,
      [organizationId]
    );
    expect(claims.rows).toHaveLength(2);
    expect(claims.rows.map((row) => row.value.type)).toEqual(['signal_snooze', 'signal_dismiss']);
    expect(claims.rows.every((row) => String(row.value.content || '').length > 20)).toBe(true);

    const { default: organizationContextService } = await import('../../../services/organizationContext/OrganizationContextService.js');
    const resolved = JSON.stringify(await organizationContextService.buildResolvedContext(organizationId));
    expect(resolved).toContain('signal_snooze');
    expect(resolved).toContain('signal_dismiss');
    expect(resolved).toContain(signalId);
  });
});
