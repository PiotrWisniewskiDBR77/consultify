/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('C6 R2 organization AI budget contract — real route/JWT/PostgreSQL', () => {
  let app: express.Express;
  let pool: import('pg').Pool;
  let authorization = '';
  let budgetService: typeof import('../../services/aiBudgetService.js').default;
  const suffix = randomUUID();
  const orgId = `e1-budget-org-${suffix}`;
  const ownerId = `e1-budget-owner-${suffix}`;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [orgId, 'E1 budget org']);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'OWNER','active')`,
      [ownerId, orgId, `${ownerId}@example.test`]
    );
    const { default: config } = await import('../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: ownerId, organizationId: orgId, role: 'OWNER' },
      config.JWT_SECRET,
      {
        expiresIn: '10m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    )}`;
    const { default: routes } = await import('../ai/ai-settings.routes.js');
    budgetService = (await import('../../services/aiBudgetService.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/ai-settings', routes);
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM ai_budgets WHERE organization_id=$1', [orgId]);
    await pool.query('DELETE FROM organization_ai_settings WHERE organization_id=$1', [orgId]);
    await pool.query('DELETE FROM admin_audit_logs WHERE admin_id=$1 OR organization_id=$2', [ownerId, orgId]);
    await pool.query('DELETE FROM users WHERE id=$1', [ownerId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]);
    await pool.end();
  });

  it('persists UI-shaped settings, reloads them, and drives below/above real usage checks', async () => {
    const save = await request(app)
      .put(`/api/ai-settings/org/${orgId}`)
      .set('Authorization', authorization)
      .send({ monthlyBudgetUSD: 10, hardLimitUSD: 10, freezeOnLimit: true });
    expect(save.status).toBe(200);
    expect(save.body).toMatchObject({ monthlyBudgetUSD: 10, hardLimitUSD: 10, freezeOnLimit: true });

    const reload = await request(app)
      .get(`/api/ai-settings/org/${orgId}`)
      .set('Authorization', authorization);
    expect(reload.status).toBe(200);
    expect(reload.body).toMatchObject({ monthlyBudgetUSD: 10, hardLimitUSD: 10, freezeOnLimit: true });
    expect((await budgetService.checkBudget(orgId, ownerId, { tokens: 0, cost: 0 })).allowed).toBe(true);

    const usage = await budgetService.recordUsage(orgId, ownerId, {
      model: 'budget-contract-probe',
      outputTokens: 5_000_000,
    });
    expect(usage.cost).toBe(10);
    expect((await budgetService.checkBudget(orgId, ownerId, { tokens: 0, cost: 0 })).allowed).toBe(false);

    const raise = await request(app)
      .put(`/api/ai-settings/org/${orgId}`)
      .set('Authorization', authorization)
      .send({ monthlyBudgetUSD: 20, hardLimitUSD: 20, freezeOnLimit: true });
    expect(raise.status).toBe(200);
    expect((await budgetService.checkBudget(orgId, ownerId, { tokens: 0, cost: 0 })).allowed).toBe(true);
  }, 60000);
});
