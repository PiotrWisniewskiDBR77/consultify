/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 242 AI context organization isolation through ApiGateway', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let ownerToken = '';
  let attackerToken = '';
  let ownerOrgId = '';

  const register = (email: string, companyName: string) =>
    request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Day242-Proof-Password-123!',
        firstName: 'Day242',
        lastName: 'Proof',
        companyName,
        acceptedLegalDocs: ['TOS', 'PRIVACY'],
      });

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const suffix = randomUUID();
    const owner = await register(
      `day242-context-owner-${suffix}@test.invalid`,
      `Day242 Context Owner ${suffix}`
    );
    const attacker = await register(
      `day242-context-attacker-${suffix}@test.invalid`,
      `Day242 Context Attacker ${suffix}`
    );
    expect(owner.status).toBe(200);
    expect(attacker.status).toBe(200);
    ownerToken = String(owner.body.token);
    attackerToken = String(attacker.body.token);
    const ownerClaims = jwt.decode(ownerToken) as { organizationId?: string } | null;
    expect(ownerClaims).toBeTruthy();
    expect(jwt.decode(attackerToken)).toBeTruthy();
    ownerOrgId = String(ownerClaims?.organizationId);
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  const createContext = async () => {
    const marker = randomUUID();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO ai_contexts(id,organization_id,name,type,content,is_active,priority,created_at)
       VALUES($1,$2,$3,'custom',$4,1,1,now())`,
      [id, ownerOrgId, `Day242 ${marker}`, `before-${marker}`]
    );
    return { id, before: `before-${marker}` };
  };

  it('returns 404 and preserves foreign context on PUT, while its owner can update it', async () => {
    const { id, before } = await createContext();
    const attack = await request(app)
      .put(`/api/context/${id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ content: 'foreign-overwrite' });
    expect(attack.status).toBe(404);
    expect(
      (await pool.query('SELECT content FROM ai_contexts WHERE id=$1', [id])).rows[0].content
    ).toBe(before);
    const owner = await request(app)
      .put(`/api/context/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'owner-overwrite' });
    expect(owner.status).toBe(200);
    expect(
      (await pool.query('SELECT content FROM ai_contexts WHERE id=$1', [id])).rows[0].content
    ).toBe('owner-overwrite');
  });

  it('returns 404 and preserves foreign context on DELETE, while its owner can delete it', async () => {
    const { id } = await createContext();
    const attack = await request(app)
      .delete(`/api/context/${id}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(attack.status).toBe(404);
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM ai_contexts WHERE id=$1', [id])).rows[0]
        .count
    ).toBe(1);
    const owner = await request(app)
      .delete(`/api/context/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(owner.status).toBe(200);
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM ai_contexts WHERE id=$1', [id])).rows[0]
        .count
    ).toBe(0);
  });
});
