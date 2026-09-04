/** @vitest-environment node */

// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru.
// Kontrakt pokazuje, że wąska licencja R2 nie wystarcza: handler trasy nie ma `req`,
// więc nie da się wykonać dozwolonej zamiany `undefined` -> `req` bez zmiany sygnatury.

import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const HTTP_PORT = 5491;
const organizationId = `day325-org-${randomUUID()}`;
const userId = `day325-user-${randomUUID()}`;
const memberId = `day325-member-${randomUUID()}`;
const programId = randomUUID();
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('KONTRAKT DLA DYŻURU 325 — język dociera przez realny Gateway do błędu OKR', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let server: Server;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [organizationId, 'Day 325']);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
      [memberId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO okr_vnext_programs (program_id, organization_id, name, status, created_by)
       VALUES ($1, $2, 'Day 325 draft program', 'draft', $3)`,
      [programId, organizationId, userId]
    );

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, role: 'ADMIN', userRole: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(HTTP_PORT, '127.0.0.1', () => resolve(listener));
    });
  }, 120_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query('DELETE FROM okr_vnext_cycles WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM okr_vnext_programs WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
    const pgModule = await import('../../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  const createCycle = async (headers: Record<string, string> = {}) => {
    const response = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/vnext/results/okr/cycles`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        programId,
        name: 'Day 325 cycle',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        draftOpenAt: '2026-09-01T00:00:00.000Z',
        submissionDueAt: '2026-09-20T00:00:00.000Z',
        activeStartAt: '2026-10-01T00:00:00.000Z',
        finalUpdateDueAt: '2026-12-15T00:00:00.000Z',
        reviewOpenAt: '2026-12-16T00:00:00.000Z',
        reflectionDueAt: '2026-12-20T00:00:00.000Z',
        closeAt: '2026-12-31T00:00:00.000Z',
      }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };

  // it.fails: test PRZECHODZI, dopóki mapper czyta tylko Accept-Language, i CZERWIENI SIĘ
  // w dniu, w ktorym zacznie czytac X-App-Language. Sygnal zyje, nic nie jest wyciszone.
  it.fails('X-App-Language: pl daje polski tekst i zachowuje PROGRAM_NOT_ACTIVE', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM okr_vnext_cycles WHERE organization_id = $1', [organizationId]);
    const response = await createCycle({ 'X-App-Language': 'pl' });
    const after = await pool.query('SELECT count(*)::int AS n FROM okr_vnext_cycles WHERE organization_id = $1', [organizationId]);
    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('PROGRAM_NOT_ACTIVE');
    expect(response.body.error).toBe('Program OKR nie jest aktywny, dlatego nie mozna otworzyc nowego cyklu.');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('bez nagłówka języka daje angielski tekst i zachowuje PROGRAM_NOT_ACTIVE', async () => {
    const response = await createCycle();
    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('PROGRAM_NOT_ACTIVE');
    expect(response.body.error).toBe('The OKR program is not active, so a new cycle cannot be opened.');
  });
});
