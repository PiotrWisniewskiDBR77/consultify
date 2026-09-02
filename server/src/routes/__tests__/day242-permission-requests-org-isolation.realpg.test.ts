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

describe('Day 242 permission requests organization isolation through ApiGateway', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let ownerToken = '';
  let attackerToken = '';

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
      `day242-perm-owner-${suffix}@test.invalid`,
      `Day242 Perm Owner ${suffix}`
    );
    const attacker = await register(
      `day242-perm-attacker-${suffix}@test.invalid`,
      `Day242 Perm Attacker ${suffix}`
    );
    expect(owner.status).toBe(200);
    expect(attacker.status).toBe(200);
    ownerToken = String(owner.body.token);
    attackerToken = String(attacker.body.token);
    expect(jwt.decode(ownerToken)).toBeTruthy();
    expect(jwt.decode(attackerToken)).toBeTruthy();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  const createRequest = async () => {
    const created = await request(app)
      .post('/api/permission-requests')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestedPermission: `day242-${randomUUID()}`, reason: 'tenant isolation proof' });
    expect(created.status).toBe(201);
    return String(created.body.id);
  };

  it('returns 404 and preserves a foreign pending request on approve, while its owner can approve it', async () => {
    const id = await createRequest();
    const attack = await request(app)
      .put(`/api/permission-requests/${id}/approve`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({});
    expect(attack.status).toBe(404);
    expect(
      (await pool.query('SELECT status FROM permission_requests WHERE id=$1', [id])).rows[0].status
    ).toBe('pending');
    const owner = await request(app)
      .put(`/api/permission-requests/${id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(owner.status).toBe(200);
    expect(
      (await pool.query('SELECT status FROM permission_requests WHERE id=$1', [id])).rows[0].status
    ).toBe('approved');
  });

  it('returns 404 and preserves a foreign pending request on reject, while its owner can reject it', async () => {
    const id = await createRequest();
    const attack = await request(app)
      .put(`/api/permission-requests/${id}/reject`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ rejectionReason: 'foreign mutation' });
    expect(attack.status).toBe(404);
    const afterAttack = await pool.query(
      'SELECT status,rejection_reason FROM permission_requests WHERE id=$1',
      [id]
    );
    expect(afterAttack.rows[0].status).toBe('pending');
    expect(afterAttack.rows[0].rejection_reason).toBeNull();
    const owner = await request(app)
      .put(`/api/permission-requests/${id}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rejectionReason: 'owner decision' });
    expect(owner.status).toBe(200);
    const afterOwner = await pool.query(
      'SELECT status,rejection_reason FROM permission_requests WHERE id=$1',
      [id]
    );
    expect(afterOwner.rows[0]).toMatchObject({
      status: 'rejected',
      rejection_reason: 'owner decision',
    });
  });
});
