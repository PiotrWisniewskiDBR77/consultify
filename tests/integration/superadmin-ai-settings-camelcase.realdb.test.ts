/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('FIX-AISET-SUPERADMIN ustawienia AI: camelCase <-> snake_case', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const orgId = randomUUID();
  const superId = randomUUID();
  const adminId = randomUUID();
  let superAuth = '';
  let adminAuth = '';

  const seeded = {
    default_provider: 'provider-seeded',
    fallback_chain: JSON.stringify(['provider-fallback']),
    circuit_breaker_config: JSON.stringify({ failureThreshold: 9, cooldownSeconds: 91 }),
    global_token_limit: 9876543,
    global_rate_limit: JSON.stringify({ requestsPerMinute: 17, requestsPerHour: 171 }),
    max_context_window_size: 65432,
    max_tokens_per_request: 7654,
    pii_detection_sensitivity: 'high',
    require_encryption: 0,
    data_residency: 'EU',
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json({ limit: '10mb' }));
    ApiGateway.getInstance().initializeRoutes(app);

    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'DAY250 org','active')`, [orgId]);
    for (const [id, role, email] of [
      [superId, 'SUPERADMIN', `day250-super-${superId}@test.invalid`],
      [adminId, 'OWNER', `day250-admin-${adminId}@test.invalid`],
    ]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
         VALUES($1,$2,$3,'unused',$4,'active',1)`,
        [id, orgId, email, role]
      );
    }
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgId, adminId]
    );
    await pool.query(`DELETE FROM superadmin_ai_settings WHERE id='global'`);
    await pool.query(
      `INSERT INTO superadmin_ai_settings (
        id, default_provider, fallback_chain, circuit_breaker_config, global_token_limit,
        global_rate_limit, max_context_window_size, max_tokens_per_request,
        pii_detection_sensitivity, require_encryption, data_residency
      ) VALUES ('global',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      Object.values(seeded)
    );
    await pool.query(
      `INSERT INTO organization_ai_settings (
        organization_id, policy_level, max_policy_level, default_proactivity_mode,
        max_ai_calls_per_day, max_tokens_per_month, monthly_budget_usd,
        hard_limit_usd, freeze_on_limit
      ) VALUES ($1,'PROACTIVE','AUTOPILOT','BALANCED',321,7654321,54.25,432.1,1)`,
      [orgId]
    );
    await pool.query(
      `INSERT INTO user_ai_settings(user_id,response_style,writing_tone,proactivity_mode,system_instructions)
       VALUES($1,'concise','professional','BALANCED','day250')`,
      [adminId]
    );

    const sign = (id: string, role: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId: orgId, organization_id: orgId, role },
        config.JWT_SECRET,
        { expiresIn: '30m', jwtid: randomUUID() }
      )}`;
    superAuth = sign(superId, 'SUPERADMIN');
    adminAuth = sign(adminId, 'OWNER');
  }, 180_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM user_ai_settings WHERE user_id IN ($1,$2)`, [superId, adminId]);
    await pool.query(`DELETE FROM organization_ai_settings WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [superId, adminId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    await pool.query(`DELETE FROM superadmin_ai_settings WHERE id='global'`);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  it('ODCZYT: realny GET zwraca zasiane snake_case jako camelCase', async () => {
    const res = await request(app).get('/api/ai-settings/superadmin').set('Authorization', superAuth);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      defaultProvider: 'provider-seeded',
      fallbackChain: ['provider-fallback'],
      circuitBreakerConfig: { failureThreshold: 9, cooldownSeconds: 91 },
      globalTokenLimit: 9876543,
      maxContextWindowSize: 65432,
      maxTokensPerRequest: 7654,
      piiDetectionSensitivity: 'high',
      requireEncryption: false,
      dataResidency: 'EU',
    }));
    expect(res.body.default_provider).toBeUndefined();
  });

  it('para ZAPIS: PUT camelCase, niezależny GET i surowy SQL widzą nowe wartości', async () => {
    const body = {
      defaultProvider: 'provider-updated',
      fallbackChain: ['provider-a', 'provider-b'],
      circuitBreakerConfig: { failureThreshold: 4, cooldownSeconds: 44 },
      globalTokenLimit: 112233,
      globalRateLimit: { requestsPerMinute: 22, requestsPerHour: 222 },
      maxContextWindowSize: 45678,
      maxTokensPerRequest: 3456,
      piiDetectionSensitivity: 'low',
      requireEncryption: true,
      dataResidency: 'PL',
    };
    const put = await request(app).put('/api/ai-settings/superadmin').set('Authorization', superAuth).send(body);
    expect(put.status, JSON.stringify(put.body)).toBe(200);

    const get = await request(app).get('/api/ai-settings/superadmin').set('Authorization', superAuth);
    expect(get.status).toBe(200);
    expect(get.body).toEqual(expect.objectContaining(body));

    const raw = (await pool.query(
      `SELECT default_provider, fallback_chain, circuit_breaker_config, global_token_limit,
              global_rate_limit, max_context_window_size, max_tokens_per_request,
              pii_detection_sensitivity, require_encryption, data_residency
         FROM superadmin_ai_settings WHERE id='global'`
    )).rows[0];
    expect(raw.default_provider).toBe(body.defaultProvider);
    expect(JSON.parse(raw.fallback_chain)).toEqual(body.fallbackChain);
    expect(JSON.parse(raw.circuit_breaker_config)).toEqual(body.circuitBreakerConfig);
    expect(Number(raw.global_token_limit)).toBe(body.globalTokenLimit);
    expect(JSON.parse(raw.global_rate_limit)).toEqual(body.globalRateLimit);
    expect(Number(raw.max_context_window_size)).toBe(body.maxContextWindowSize);
    expect(Number(raw.max_tokens_per_request)).toBe(body.maxTokensPerRequest);
    expect(raw.pii_detection_sensitivity).toBe(body.piiDetectionSensitivity);
    expect(Boolean(raw.require_encryption)).toBe(true);
    expect(raw.data_residency).toBe(body.dataResidency);
  });

  it('para UPRAWNIEŃ: nie-superadmin dostaje 403 bez zmiany, superadmin nadal działa', async () => {
    const before = (await pool.query(`SELECT default_provider FROM superadmin_ai_settings WHERE id='global'`)).rows[0];
    const denied = await request(app)
      .put('/api/ai-settings/superadmin')
      .set('Authorization', adminAuth)
      .send({ defaultProvider: 'forbidden-provider' });
    expect(denied.status).toBe(403);
    const after = (await pool.query(`SELECT default_provider FROM superadmin_ai_settings WHERE id='global'`)).rows[0];
    expect(after.default_provider).toBe(before.default_provider);

    const allowed = await request(app).get('/api/ai-settings/superadmin').set('Authorization', superAuth);
    expect(allowed.status, JSON.stringify(allowed.body)).toBe(200);
    expect(allowed.body.defaultProvider).toBe(before.default_provider);
  });

  it('GET /effective zwraca pięć wartości organizacji pod nazwami camelCase i zachowuje wartości', async () => {
    const res = await request(app).get('/api/ai-settings/effective').set('Authorization', adminAuth);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.policyLevel).toBe('PROACTIVE');
    expect(res.body.maxTokensPerMonth).toBe(7654321);
    expect(res.body.monthlyBudgetUSD).toBe(54.25);
    expect(res.body.hardLimitUSD).toBe(432.1);
    expect(res.body.freezeOnLimit).toBe(true);
    expect(res.body.org).toEqual(expect.objectContaining({
      policyLevel: 'PROACTIVE', maxTokensPerMonth: 7654321,
      monthlyBudgetUSD: 54.25, hardLimitUSD: 432.1, freezeOnLimit: true,
    }));
    expect(res.body.policy_level).toBeUndefined();
    expect(res.body.org.policy_level).toBeUndefined();
  });
});
