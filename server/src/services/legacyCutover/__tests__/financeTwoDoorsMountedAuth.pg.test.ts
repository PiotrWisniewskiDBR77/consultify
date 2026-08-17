/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import verifyToken from '../../../middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../../middleware/v8Auth.middleware.js';
import * as DbPromise from '../../../utils/DbPromise.js';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(databaseUrl) &&
  /localhost|127\.0\.0\.1/.test(databaseUrl);
const cleanupEnabled = process.env.LEGACY_CUTOVER_TEST_CLEANUP === '1';
const canonicalVitestJwtSecret = 'test-jwt-secret-key-min-32-chars-long-for-validation';
if (process.env.JWT_SECRET !== canonicalVitestJwtSecret) {
  throw new Error('FIN_TWO_DOORS_CANONICAL_VITEST_JWT_SECRET_MISMATCH');
}
const jwtSecret = process.env.JWT_SECRET;
const prefix = `fin-auth-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const foreignOrg = `${prefix}-foreign-org`;
const active = `${prefix}-active`;
const revoked = `${prefix}-revoked`;
const superNoMembership = `${prefix}-super`;
const foreign = `${prefix}-foreign`;
const orgModel = `${prefix}-org-a-model`;
const suiteLock = 'finance-two-doors-mounted-auth';

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.ENABLE_V8_GLOBAL = 'true';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

function authorization(userId: string, organizationId: string, role = 'ADMIN') {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
        isSuperAdmin: role === 'SUPERADMIN',
      },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

describe.skipIf(!enabled)('Finance W01/W02 mounted signed-JWT membership wall', () => {
  let pool: Pool;
  let lockClient: PoolClient;
  let w01: express.Express;
  let w02: express.Express;

  async function mutationSnapshot() {
    const result = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM financial_models WHERE id LIKE $1) AS models,
         (SELECT count(*)::int FROM financial_model_events WHERE model_id LIKE $1) AS model_events,
         (SELECT count(*)::int FROM financial_model_outputs WHERE model_id LIKE $1) AS outputs,
         (SELECT count(*)::int FROM financial_model_validations WHERE model_id LIKE $1) AS validations,
         (SELECT count(*)::int FROM financial_model_versions WHERE model_id LIKE $1) AS versions,
         (SELECT count(*)::int FROM legacy_cutover_signal_intents WHERE request_id LIKE $1) AS intents,
         (SELECT count(*)::int FROM legacy_cutover_usage_events WHERE request_id LIKE $1) AS observations,
         (SELECT count(*)::int FROM finance_legacy_usage_events WHERE request_id LIKE $1) AS finance_observations`,
      [`${prefix}%`]
    );
    return result.rows[0];
  }

  function expectBusinessUnchanged(after: Record<string, number>, before: Record<string, number>) {
    expect(after).toMatchObject({
      models: before.models,
      model_events: before.model_events,
      outputs: before.outputs,
      validations: before.validations,
      versions: before.versions,
    });
  }

  async function fullResidue(queryable: Pool | PoolClient) {
    const result = await queryable.query(
      `SELECT
         (SELECT count(*)::int FROM organizations WHERE id IN ($2,$3)) AS organizations,
         (SELECT count(*)::int FROM users WHERE id LIKE $1) AS users,
         (SELECT count(*)::int FROM organization_members WHERE id LIKE $1) AS memberships,
         (SELECT count(*)::int FROM financial_models WHERE id LIKE $1) AS models,
         (SELECT count(*)::int FROM financial_model_events WHERE model_id LIKE $1) AS model_events,
         (SELECT count(*)::int FROM financial_model_outputs WHERE model_id LIKE $1) AS outputs,
         (SELECT count(*)::int FROM financial_model_validations WHERE model_id LIKE $1) AS validations,
         (SELECT count(*)::int FROM financial_model_versions WHERE model_id LIKE $1) AS versions,
         (SELECT count(*)::int FROM legacy_cutover_signal_intents WHERE request_id LIKE $1) AS intents,
         (SELECT count(*)::int FROM legacy_cutover_usage_events WHERE request_id LIKE $1) AS observations,
         (SELECT count(*)::int FROM finance_legacy_usage_events WHERE request_id LIKE $1) AS finance_observations`,
      [`${prefix}%`, org, foreignOrg]
    );
    return result.rows[0];
  }

  const zeroResidue = {
    organizations: 0, users: 0, memberships: 0, models: 0, model_events: 0,
    outputs: 0, validations: 0, versions: 0, intents: 0, observations: 0,
    finance_observations: 0,
  };

  async function callBoth(userId: string, organizationId: string, suffix: string, body = {}) {
    const headers = authorization(userId, organizationId, userId === superNoMembership ? 'SUPERADMIN' : 'ADMIN');
    return Promise.all([
      request(w01)
        .post(`/api/v8/finance/models/${prefix}-${suffix}-w01/approve`)
        .set(headers)
        .set('x-request-id', `${prefix}-${suffix}-w01`)
        .send(body),
      request(w02)
        .post(`/api/financial-modeling/models/${prefix}-${suffix}-w02/approve`)
        .set(headers)
        .set('x-request-id', `${prefix}-${suffix}-w02`)
        .send(body),
    ]);
  }

  beforeAll(async () => {
    if (!cleanupEnabled) throw new Error('LEGACY_CUTOVER_TEST_CLEANUP=1 is required');
    pool = new Pool({ connectionString: databaseUrl });
    const databaseName = (await pool.query(`SELECT current_database() AS name`)).rows[0].name as string;
    if (!databaseName.startsWith('consultify_fin_')) {
      throw new Error(`FIN_TWO_DOORS_TEST_DB_NOT_DISPOSABLE:${databaseName}`);
    }
    lockClient = await pool.connect();
    await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [suiteLock]);
    const now = new Date().toISOString();
    for (const organizationId of [org, foreignOrg]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$1,'enterprise','active',1,$2)`,
        [organizationId, now]
      );
    }
    for (const [userId, organizationId, role] of [
      [active, org, 'ADMIN'],
      [revoked, org, 'ADMIN'],
      [superNoMembership, org, 'SUPERADMIN'],
      [foreign, foreignOrg, 'ADMIN'],
    ]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
         VALUES($1,$2,$3,'unused',$4,'active',$5)`,
        [userId, organizationId, `${userId}@test.invalid`, role, now]
      );
    }
    for (const [userId, organizationId, status] of [
      [active, org, 'ACTIVE'],
      [revoked, org, 'REVOKED'],
      [foreign, foreignOrg, 'ACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'ADMIN',$4,$5)`,
        [`${prefix}-${userId}-membership`, organizationId, userId, status, now]
      );
    }
    await pool.query(
      `INSERT INTO financial_models
         (id,organization_id,name,start_date,status,version,created_by,created_at,updated_at)
       VALUES($1,$2,$3,CURRENT_DATE,'draft',1,$4,$5,$5)`,
      [orgModel, org, orgModel, active, now]
    );

    const financeRouter = (await import('../../../routes/v8/finance.routes.js')).default;
    w01 = express();
    w01.use(express.json());
    w01.use('/api/v8/finance', verifyToken, requireV8OrgContext, attachV8Context, financeRouter);
    const modelingRouter = (await import('../../../routes/financial-modeling.routes.js')).default;
    w02 = express();
    w02.use(express.json());
    w02.use('/api/financial-modeling', modelingRouter);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    let cleanupClient: PoolClient | undefined;
    try {
      cleanupClient = await pool.connect();
      await cleanupClient.query('BEGIN');
      await cleanupClient.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM finance_legacy_usage_events WHERE organization_id IN ($1,$2)`, [org, foreignOrg]);
      await cleanupClient.query(`DELETE FROM financial_model_versions WHERE model_id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM financial_model_validations WHERE model_id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM financial_model_outputs WHERE model_id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM financial_model_events WHERE model_id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM financial_models WHERE id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM users WHERE id LIKE $1`, [`${prefix}%`]);
      await cleanupClient.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, foreignOrg]);
      expect(await fullResidue(cleanupClient)).toEqual(zeroResidue);
      await cleanupClient.query('COMMIT');
      expect(await fullResidue(pool)).toEqual(zeroResidue);
    } catch (error) {
      if (cleanupClient) await cleanupClient.query('ROLLBACK');
      throw error;
    } finally {
      cleanupClient?.release();
      if (lockClient) {
        await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [suiteLock]);
        lockClient.release();
      }
      await pool.end();
    }
  });

  it('rejects missing and invalid bearer identity before either Finance door', async () => {
    const before = await mutationSnapshot();
    for (const app of [w01, w02]) {
      const path = app === w01
        ? `/api/v8/finance/models/${orgModel}/approve`
        : `/api/financial-modeling/models/${orgModel}/approve`;
      expect((await request(app).post(path).send({})).status).toBe(401);
      expect((await request(app).post(path).set('Authorization', 'Bearer invalid.jwt.token').send({})).status).toBe(401);
    }
    expect(await mutationSnapshot()).toEqual(before);
  });

  it('lets an ACTIVE tenant caller reach each governed door without tenant spoofing', async () => {
    const before = await mutationSnapshot();
    const [first, second] = await callBoth(active, org, 'active', { organizationId: foreignOrg });
    expect(first.status).toBe(410);
    expect(first.body).toMatchObject({ code: 'FINANCE_LEGACY_WRITER_DISABLED' });
    expect(second.status).toBe(404);
    const after = await mutationSnapshot();
    expectBusinessUnchanged(after, before);
    expect(after).toMatchObject({
      intents: before.intents + 1,
      observations: before.observations + 1,
      finance_observations: before.finance_observations + 1,
    });
    expect((await pool.query(
      `SELECT request_id,access_kind,legacy_id,organization_id
         FROM finance_legacy_usage_events WHERE request_id=$1`,
      [`${prefix}-active-w01`]
    )).rows).toEqual([{
      request_id: `${prefix}-active-w01`, access_kind: 'legacy_writer_blocked',
      legacy_id: `${prefix}-active-w01`, organization_id: org,
    }]);
    expect((await pool.query(
      `SELECT request_id,writer_id,identity_status,legacy_id,organization_id
         FROM legacy_cutover_usage_events WHERE request_id=$1`,
      [`${prefix}-active-w02`]
    )).rows).toEqual([{
      request_id: `${prefix}-active-w02`, writer_id: 'FIN-W02', identity_status: 'not_migrated',
      legacy_id: `${prefix}-active-w02`, organization_id: org,
    }]);
    expect((await pool.query(
      `SELECT request_id,organization_id FROM legacy_cutover_signal_intents WHERE request_id=$1`,
      [`${prefix}-active-w02`]
    )).rows).toEqual([{ request_id: `${prefix}-active-w02`, organization_id: org }]);
  });

  it('rejects the same signed token on the next request after membership is revoked', async () => {
    const before = await mutationSnapshot();
    await pool.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [org, active]);
    const [first, second] = await callBoth(active, org, 'revoked');
    for (const response of [first, second]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    }
    expect(await mutationSnapshot()).toEqual(before);
    await pool.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [org, active]);
  });

  it('denies a SUPERADMIN token without ACTIVE tenant membership', async () => {
    const before = await mutationSnapshot();
    const [first, second] = await callBoth(superNoMembership, org, 'super');
    expect([first.status, second.status]).toEqual([403, 403]);
    expect(await mutationSnapshot()).toEqual(before);
  });

  it('denies a foreign ACTIVE caller the real org-A model and ignores body tenant spoofing', async () => {
    const before = await mutationSnapshot();
    const headers = authorization(foreign, foreignOrg);
    const first = await request(w01).post(`/api/v8/finance/models/${orgModel}/approve`)
      .set(headers).set('x-request-id', `${prefix}-foreign-w01`)
      .send({ organizationId: org, organization_id: org });
    const second = await request(w02).post(`/api/financial-modeling/models/${orgModel}/approve`)
      .set(headers).set('x-request-id', `${prefix}-foreign-w02`)
      .send({ organizationId: org, organization_id: org });
    expect(first.status).toBe(410);
    expect(second.status).toBe(404);
    const after = await mutationSnapshot();
    expectBusinessUnchanged(after, before);
    expect((await pool.query(
      `SELECT
         (SELECT count(*)::int FROM legacy_cutover_usage_events WHERE request_id LIKE $1 AND organization_id=$2) +
         (SELECT count(*)::int FROM finance_legacy_usage_events WHERE request_id LIKE $1 AND organization_id=$2) +
         (SELECT count(*)::int FROM legacy_cutover_signal_intents WHERE request_id LIKE $1 AND organization_id=$2) AS n`,
      [`${prefix}-foreign%`, org]
    )).rows[0].n).toBe(0);
    expect((await pool.query(
      `SELECT request_id,user_id,organization_id,access_kind,legacy_table,legacy_id
         FROM finance_legacy_usage_events WHERE request_id=$1`,
      [`${prefix}-foreign-w01`]
    )).rows).toEqual([{
      request_id: `${prefix}-foreign-w01`, user_id: foreign, organization_id: foreignOrg,
      access_kind: 'legacy_writer_blocked', legacy_table: 'financial_models', legacy_id: orgModel,
    }]);
    expect((await pool.query(
      `SELECT request_id,user_id,organization_id,writer_id,access_kind,legacy_table,legacy_id,identity_status
         FROM legacy_cutover_usage_events WHERE request_id=$1`,
      [`${prefix}-foreign-w02`]
    )).rows).toEqual([{
      request_id: `${prefix}-foreign-w02`, user_id: foreign, organization_id: foreignOrg,
      writer_id: 'FIN-W02', access_kind: 'legacy_uncovered_writer', legacy_table: 'financial_models',
      legacy_id: orgModel, identity_status: 'not_migrated',
    }]);
    expect((await pool.query(
      `SELECT request_id,user_id,organization_id,writer_id,access_kind,legacy_table,legacy_id,identity_status
         FROM legacy_cutover_signal_intents WHERE request_id=$1`,
      [`${prefix}-foreign-w02`]
    )).rows).toEqual([{
      request_id: `${prefix}-foreign-w02`, user_id: foreign, organization_id: foreignOrg,
      writer_id: 'FIN-W02', access_kind: 'legacy_uncovered_writer', legacy_table: 'financial_models',
      legacy_id: orgModel, identity_status: 'not_migrated',
    }]);
  });

  it('fails both doors closed on a bounded membership adapter rejection', async () => {
    const before = await mutationSnapshot();
    const originalGet = DbPromise.get.bind(DbPromise);
    let matchHits = 0;
    const membershipLookup = vi.spyOn(DbPromise, 'get');
    membershipLookup.mockImplementation(async (...args: Parameters<typeof DbPromise.get>) => {
      const normalizedSql = String(args[0] || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalizedSql.includes('from organization_members') && matchHits < 2) {
        matchHits += 1;
        throw new Error('bounded membership lookup failure');
      }
      return originalGet(...args);
    });
    try {
      const [first, second] = await callBoth(active, org, 'db-failure');
      for (const response of [first, second]) {
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_UNVERIFIABLE' });
      }
    } finally {
      membershipLookup.mockRestore();
    }
    expect(matchHits).toBe(2);
    expect(await mutationSnapshot()).toEqual(before);
    const [recoveredFirst, recoveredSecond] = await callBoth(active, org, 'db-recovered');
    expect(recoveredFirst.status).toBe(410);
    expect(recoveredSecond.status).toBe(404);
  });
});
