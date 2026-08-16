/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('INI-MVP-PROFILE-001 mounted profile writer (real PostgreSQL)', () => {
  const suffix = randomUUID();
  const id = (part: string) => `ini_profile_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const initiative = id('initiative');
  const owner = id('owner');
  const member = id('member');
  const inactive = id('inactive');
  const foreignOwner = id('foreign_owner');
  let pool: Pool;
  let app: express.Express;
  let ownerToken = '';
  let memberWithStaleOwnerClaim = '';
  let inactiveToken = '';
  let foreignToken = '';

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const org of [orgA, orgB]) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
    }
    const people: Array<[string, string, string, string]> = [
      [owner, orgA, 'OWNER', 'ACTIVE'],
      [member, orgA, 'MEMBER', 'ACTIVE'],
      [inactive, orgA, 'OWNER', 'INACTIVE'],
      [foreignOwner, orgB, 'OWNER', 'ACTIVE'],
    ];
    for (const [userId, orgId, role, membershipStatus] of people) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'unused',$4,'active')`,
        [userId, orgId, `${userId}@example.test`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [id(`membership_${userId}`), orgId, userId, role, membershipStatus]
      );
    }
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,name,summary,status,profile_version)
       VALUES($1,$2,$3,'Initial','DRAFT',1)`,
      [initiative, orgA, `Profile ${suffix}`]
    );

    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, orgId: string, role = 'OWNER') =>
      jwt.sign(
        { id: userId, organizationId: orgId, role, email: `${userId}@example.test` },
        config.JWT_SECRET,
        { expiresIn: '10m' }
      );
    ownerToken = sign(owner, orgA);
    memberWithStaleOwnerClaim = sign(member, orgA, 'OWNER');
    inactiveToken = sign(inactive, orgA);
    foreignToken = sign(foreignOwner, orgB);

    const { default: router } = await import('../../../routes/pmo/initiatives.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', router);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM initiatives WHERE id=$1 AND organization_id=$2`, [
      initiative,
      orgA,
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [owner, member, inactive, foreignOwner],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('serializes eight identical writes into one immutable receipt and cold-reopens it', async () => {
    const write = () =>
      request(app)
        .put(`/api/initiatives/${initiative}/profile`)
        .set(auth(ownerToken))
        .set('Idempotency-Key', `profile-${suffix}`)
        .send({ summary: 'Governed profile', expectedVersion: 1 });
    const responses = await Promise.all(Array.from({ length: 8 }, write));
    expect(responses.every((response) => [200, 201].includes(response.status))).toBe(true);
    expect(new Set(responses.map((response) => response.body.version))).toEqual(new Set([2]));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const row = await cold.query(
      `SELECT i.summary,i.profile_version,count(r.id)::int AS receipt_count,
              min(r.request_hash) AS request_hash
         FROM initiatives i
         JOIN initiative_profile_update_receipts r
           ON r.initiative_id=i.id AND r.organization_id=i.organization_id
        WHERE i.id=$1 AND i.organization_id=$2
        GROUP BY i.summary,i.profile_version`,
      [initiative, orgA]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      summary: 'Governed profile',
      profile_version: 2,
      receipt_count: 1,
    });
    expect(row.rows[0].request_hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      cold.query(
        `UPDATE initiative_profile_update_receipts SET request_hash='tampered'
          WHERE organization_id=$1 AND initiative_id=$2`,
        [orgA, initiative]
      )
    ).rejects.toThrow(/immutable/);
    await cold.end();
  });

  it('rejects collision, stale version, stale elevated claims, inactive membership and foreign tenant', async () => {
    const collision = await request(app)
      .put(`/api/initiatives/${initiative}/profile`)
      .set(auth(ownerToken))
      .set('Idempotency-Key', `profile-${suffix}`)
      .send({ summary: 'Different payload', expectedVersion: 1 });
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_PAYLOAD_COLLISION');

    const stale = await request(app)
      .put(`/api/initiatives/${initiative}/profile`)
      .set(auth(ownerToken))
      .set('Idempotency-Key', `stale-${suffix}`)
      .send({ summary: 'Stale update', expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('PROFILE_VERSION_CONFLICT');

    const staleRole = await request(app)
      .put(`/api/initiatives/${initiative}/profile`)
      .set(auth(memberWithStaleOwnerClaim))
      .set('Idempotency-Key', `member-${suffix}`)
      .send({ summary: 'Forbidden member update', expectedVersion: 2 });
    expect(staleRole.status).toBe(403);
    expect(staleRole.body.code).toBe('INITIATIVE_PROFILE_ROLE_REQUIRED');

    const inactiveResult = await request(app)
      .put(`/api/initiatives/${initiative}/profile`)
      .set(auth(inactiveToken))
      .set('Idempotency-Key', `inactive-${suffix}`)
      .send({ summary: 'Inactive update', expectedVersion: 2 });
    expect(inactiveResult.status).toBe(403);
    expect(inactiveResult.body.code).toBe('ORG_MEMBERSHIP_REVOKED');

    const foreign = await request(app)
      .put(`/api/initiatives/${initiative}/profile`)
      .set(auth(foreignToken))
      .set('Idempotency-Key', `foreign-${suffix}`)
      .send({ summary: 'Foreign update', expectedVersion: 2 });
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe('INITIATIVE_NOT_FOUND');
  });
});
