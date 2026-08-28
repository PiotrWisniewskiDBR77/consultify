/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 55 D.2 — Settings cannot enable flags or tools behind DEC-238', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const orgId = randomUUID();
  const memberId = randomUUID();
  const adminId = randomUUID();
  const app = express();
  let memberAuth = '';
  let adminAuth = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [orgId]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','MEMBER','active'),($4,$2,$5,'unused','ADMIN','active')`,
      [memberId, orgId, `${memberId}@test.invalid`, adminId, `${adminId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'MEMBER','ACTIVE'),($4,$2,$5,'ADMIN','ACTIVE')`,
      [randomUUID(), orgId, memberId, randomUUID(), adminId]
    );
    const sign = (id: string, role: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId: orgId, organization_id: orgId, role },
        config.JWT_SECRET,
        { expiresIn: '10m', jwtid: randomUUID() }
      )}`;
    memberAuth = sign(memberId, 'MEMBER');
    adminAuth = sign(adminId, 'ADMIN');
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM settings_audit_log WHERE user_id=ANY($1::text[])`, [
      [memberId, adminId],
    ]);
    await pool.query(`DELETE FROM developer_settings WHERE user_id=ANY($1::text[])`, [
      [memberId, adminId],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [[memberId, adminId]]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const counts = async () => {
    const relations = await pool.query(
      `SELECT to_regclass('public.v8_feature_flags')::text AS v8_flags,
              to_regclass('public.feature_flags')::text AS feature_flags,
              to_regclass('public.tool_sessions')::text AS tool_sessions`
    );
    const count = async (table: string | null) =>
      table
        ? Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]?.n ?? 0)
        : null;
    return {
      v8FeatureFlags: await count(relations.rows[0]?.v8_flags),
      featureFlags: await count(relations.rows[0]?.feature_flags),
      toolSessions: await count(relations.rows[0]?.tool_sessions),
    };
  };
  const put = (body: object) =>
    request(app)
      .put('/api/settings/developer')
      .set('Authorization', memberAuth)
      .set('x-org-context', orgId)
      .send(body);

  it('persists an ordinary developer preference without changing flags or tools', async () => {
    const before = await counts();
    const response = await put({ developerMode: true, apiLogging: true, showDebugInfo: true });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(
      (
        await pool.query(
          `SELECT developer_mode,api_logging,show_debug_info FROM developer_settings WHERE user_id=$1`,
          [memberId]
        )
      ).rows[0]
    ).toMatchObject({ developer_mode: 1, api_logging: 1, show_debug_info: 1 });
    expect(await counts()).toEqual(before);
  });

  it('rejects a feature-flag shaped write and preserves every capability table', async () => {
    const before = await counts();
    const rowBefore = await pool.query(`SELECT * FROM developer_settings WHERE user_id=$1`, [
      memberId,
    ]);
    const response = await put({
      developerMode: true,
      betaFeatures: ['ENABLE_V8_GLOBAL'],
      v8_feature_flags: { ENABLE_V8_GLOBAL: true },
      featureFlags: { ENABLE_SIGNAL_PRODUCER: true },
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('DEVELOPER_SETTINGS_CAPABILITY_WRITE_FORBIDDEN');
    expect(await counts()).toEqual(before);
    expect(
      await pool.query(`SELECT * FROM developer_settings WHERE user_id=$1`, [memberId])
    ).toEqual(expect.objectContaining({ rows: rowBefore.rows }));
  });

  it('rejects a tool-type shaped write and creates no tool session', async () => {
    const before = await counts();
    const response = await put({
      developerMode: true,
      enabledTools: ['financial_model'],
      toolTypes: ['dynamic_swot', 'unapproved_tool'],
      betaTools: ['unapproved_tool'],
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('DEVELOPER_SETTINGS_CAPABILITY_WRITE_FORBIDDEN');
    expect(await counts()).toEqual(before);
  });

  it('keeps the administrative feature-flag inventory unavailable to MEMBER and ADMIN', async () => {
    for (const authorization of [memberAuth, adminAuth]) {
      const response = await request(app)
        .get('/api/feature-flags')
        .set('Authorization', authorization)
        .set('x-org-context', orgId);
      expect(response.status).toBe(403);
    }
  });
});
