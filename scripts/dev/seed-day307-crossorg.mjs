#!/usr/bin/env node

import { createRequire } from 'node:module';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '../..');
const requireFromRepo = createRequire(path.join(repo, 'package.json'));
const { Pool } = requireFromRepo('pg');
const jwt = requireFromRepo('jsonwebtoken');

const connectionString = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
if (!connectionString || !jwtSecret) {
  throw new Error('DATABASE_URL i JWT_SECRET sa wymagane');
}
const url = new URL(connectionString);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '6314' || url.pathname !== '/cx307') {
  throw new Error(`STOP: seeder day307 odmawia polaczenia poza 127.0.0.1:6314/cx307 (${url.host}${url.pathname})`);
}

const fixtures = [
  {
    orgId: 'day307-org-owner',
    orgName: 'Day307 Owner Organization',
    userId: 'day307-user-owner',
    memberId: 'day307-member-owner',
    email: 'day307-owner@test.invalid',
  },
  {
    orgId: 'day307-org-foreign',
    orgName: 'Day307 Foreign Organization',
    userId: 'day307-user-foreign',
    memberId: 'day307-member-foreign',
    email: 'day307-foreign@test.invalid',
  },
];

const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const fixture of fixtures) {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active)
       VALUES ($1, $2, 'enterprise', 'active', 1)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, status='active', is_active=1`,
      [fixture.orgId, fixture.orgName]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, is_active)
       VALUES ($1, $2, $3, 'unused-local-fixture', 'OWNER', 'active', 1)
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
         email=EXCLUDED.email, role='OWNER', status='active', is_active=1`,
      [fixture.userId, fixture.orgId, fixture.email]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
         user_id=EXCLUDED.user_id, role='OWNER', status='ACTIVE'`,
      [fixture.memberId, fixture.orgId, fixture.userId]
    );
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}

const result = Object.fromEntries(
  fixtures.map((fixture) => [
    fixture.orgId.endsWith('owner') ? 'owner' : 'foreign',
    {
      organizationId: fixture.orgId,
      userId: fixture.userId,
      email: fixture.email,
      token: jwt.sign(
        {
          id: fixture.userId,
          userId: fixture.userId,
          email: fixture.email,
          organizationId: fixture.orgId,
          organization_id: fixture.orgId,
          role: 'OWNER',
        },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '2h' }
      ),
    },
  ])
);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
