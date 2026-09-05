/** @vitest-environment node */

/**
 * GET /api/decisions/:id/history — regression test for the route that never
 * existed.
 *
 * POMIAR NA ŻYWO 05.09 (evidence/odbior-zywo-20260905/02-moja-praca,
 * `karta-decision` / `decision-record`): otwarcie karty decyzji logowało 2×
 * `HTTP 404 GET /api/decisions/<id>/history`, a sekcja HISTORIA nie miała
 * źródła danych. Wołacz w `src/services/api.ts` (`Api.getDecisionHistory`)
 * istniał od dawna — brakowało wyłącznie trasy obok siostrzanej
 * `/:id/detail`.
 *
 * Test biegnie przez REALNY ApiGateway i REALNEGO Postgresa (bez atrapy —
 * `Database.ts` zwraca `changes: 1` dla każdego UPDATE, więc zapisów nie
 * wolno mierzyć na atrapie).
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('GET /api/decisions/:id/history (real ApiGateway + real Postgres)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const decisionId = randomUUID();
  const historyRowId = randomUUID();

  let app: Express;
  let sql: Client;
  let authorization: string;
  let foreignAuthorization: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    for (const [orgId, name] of [
      [organizationId, 'Decision history owner org'],
      [otherOrganizationId, 'Decision history foreign org'],
    ]) {
      await sql.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
        [orgId, name]
      );
    }

    for (const [id, orgId, email, firstName] of [
      [userId, organizationId, 'owner-dec-history@example.test', 'Owner'],
      [otherUserId, otherOrganizationId, 'foreign-dec-history@example.test', 'Foreign'],
    ]) {
      await sql.query(
        `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', $4, 'History', 'ADMIN', 'active', now())`,
        [id, orgId, email, firstName]
      );
      await sql.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
        [randomUUID(), orgId, id]
      );
    }

    await sql.query(
      `INSERT INTO decisions (id, organization_id, title, created_by, decision_maker_id, status)
       VALUES ($1, $2, 'Decision with an audit trail', $3, $3, 'pending')`,
      [decisionId, organizationId, userId]
    );

    // One real audit row, exactly as the controller writes them elsewhere.
    await sql.query(
      `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
       VALUES ($1, $2, 'approved', 'pending', 'approved', $3, $4)`,
      [historyRowId, decisionId, userId, JSON.stringify({ notes: 'Zatwierdzone na komitecie' })]
    );

    const sign = (id: string, orgId: string, email: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, email, organizationId: orgId, role: 'ADMIN' },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      )}`;
    authorization = sign(userId, organizationId, 'owner-dec-history@example.test');
    foreignAuthorization = sign(
      otherUserId,
      otherOrganizationId,
      'foreign-dec-history@example.test'
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM decision_history WHERE decision_id = $1', [decisionId]);
    await sql.query('DELETE FROM decisions WHERE id = $1', [decisionId]);
    for (const orgId of [organizationId, otherOrganizationId]) {
      await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [orgId]);
      await sql.query('DELETE FROM users WHERE organization_id = $1', [orgId]);
      await sql.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
    await sql.end();
  });

  it('returns the persisted audit trail instead of 404', async () => {
    const res = await request(app)
      .get(`/api/decisions/${decisionId}/history`)
      .set('Authorization', authorization);

    // The measured defect was literally this status code.
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);

    const rows = res.body?.history;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: historyRowId,
      action: 'approved',
      changedBy: userId,
      newStatus: 'approved',
    });
    // Row comes from the DB, not from a hardcoded stub.
    expect(rows[0].changedByName).toBe('Owner History');
    expect(rows[0].notes).toBe('Zatwierdzone na komitecie');
    expect(String(rows[0].changedAt ?? '')).not.toBe('');
  });

  it('hides another organization decision behind 404 (no existence oracle)', async () => {
    const res = await request(app)
      .get(`/api/decisions/${decisionId}/history`)
      .set('Authorization', foreignAuthorization);

    expect(res.status).toBe(404);
    expect(res.body?.history).toBeUndefined();
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/decisions/${decisionId}/history`);
    expect([401, 403]).toContain(res.status);
  });
});
