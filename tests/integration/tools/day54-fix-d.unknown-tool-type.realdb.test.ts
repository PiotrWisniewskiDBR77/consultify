/** @vitest-environment node */
/**
 * DOWÓD MUTACYJNY dla FIX-D (dyżur 54, odbiór adwersaryjny 2026-08-28).
 *
 * Defekt: `ToolController.createToolSession` sprawdzał wyłącznie
 * `availability.exists && !availability.isActive` (409 dla znanego,
 * nieaktywnego typu). Nieznany typ narzędzia (`availability.exists === false`)
 * omijał ten warunek w całości i tworzył REALNĄ sesję w `tool_sessions`
 * (potwierdzone odbiorem: `business-model-canvas` -> 200 + wiersz w bazie).
 *
 * Ten test biegnie przez realny `ApiGateway.getInstance().initializeRoutes(app)`,
 * podpisany JWT, realny PostgreSQL (własny kontener, pełny runner migracji
 * `NODE_ENV=test`) — zero mocków warstwy HTTP ani bazy.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const NO_RETRY = { retry: 0 } as const;

describe('Day 54 FIX-D — nieznany typ narzędzia nie tworzy sesji', NO_RETRY, () => {
  const prefix = `day54-fixd-${randomUUID()}`;
  const organizationId = `${prefix}-org`;
  const userId = `${prefix}-owner`;
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let token = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        isSuperAdmin: false,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'x','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tool_sessions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const create = (toolType: string) =>
    request(app)
      .post('/api/tools')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolType, name: `${prefix}-${toolType}` });

  const countToolSessions = async (): Promise<number> => {
    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tool_sessions WHERE organization_id = $1`,
      [organizationId]
    );
    return Number(res.rows[0]?.count ?? '0');
  };

  it('refuses an unknown tool type with 404 UNKNOWN_TOOL_TYPE and creates ZERO rows', async () => {
    const before = await countToolSessions();
    expect(before, 'baseline musi być zero przed testem').toBe(0);

    const response = await create('business-model-canvas');

    expect(response.status, JSON.stringify(response.body)).toBe(404);
    expect(response.body.code).toBe('UNKNOWN_TOOL_TYPE');

    // Niezależny SELECT — nie ufamy kodowi odpowiedzi, sprawdzamy stan bazy.
    const after = await countToolSessions();
    expect(after, 'nieznany typ NIE MOŻE utworzyć wiersza w tool_sessions').toBe(0);
  });

  it('still allows the approved Dynamic SWOT type (200) — no behavior change', async () => {
    const response = await create('dynamic-swot');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  });

  it('still refuses a known but inactive catalog type (409) — no behavior change', async () => {
    const response = await create('market-forces');
    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body.error).toBe('This tool is inactive and cannot start a session yet');
  });

  /**
   * FIX-D CORRECTION (adversarial self-check, 2026-08-28): the literal
   * instruction ("!availability.exists -> 404, no exception") was proven
   * live to break `traceabilityService.materializeMyWorkSession()`
   * (src/services/traceabilityService.ts), which creates a
   * `toolType: 'MYWORK'` session as the canonical source for MyWork ->
   * output traceability. 'MYWORK' is a reserved, non-catalog session kind —
   * it is never a row in KnownToolsService's `tools` table, so
   * `getKnownToolAvailability('MYWORK')` always returns `exists: false`.
   * ToolController.createToolSession therefore carries an explicit
   * exception for it (see the comment above the availability check). This
   * test is the mutation-proof for that correction.
   */
  it('still allows the reserved MYWORK session kind (200) — traceability path', async () => {
    const response = await create('MYWORK');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  });
});
