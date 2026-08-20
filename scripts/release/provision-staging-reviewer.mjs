#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';

import jwt from 'jsonwebtoken';
import pg from 'pg';

const databaseUrl = String(process.env.DATABASE_URL || '');
const jwtSecret = String(process.env.JWT_SECRET || '');
const organizationId = String(process.env.PRIMARY_ORG_ID || '');
const outputPath = String(process.env.REVIEWER_SESSION_PATH || '');

if (!databaseUrl.startsWith('postgres')) throw new Error('DATABASE_URL is required.');
if (!jwtSecret) throw new Error('JWT_SECRET is required.');
if (!organizationId) throw new Error('PRIMARY_ORG_ID is required.');
if (!outputPath) throw new Error('REVIEWER_SESSION_PATH is required.');

const suffix = crypto.randomUUID();
const userId = crypto.randomUUID();
const email = `stg-reviewer-${suffix}@example.test`;
const role = 'ADMIN';
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query('BEGIN');
  const organization = await client.query(`SELECT id FROM organizations WHERE id=$1 FOR SHARE`, [
    organizationId,
  ]);
  if (organization.rowCount !== 1) throw new Error('Primary staging organization not found.');
  await client.query(
    `INSERT INTO users
       (id,organization_id,email,password,first_name,last_name,role,status,created_at,updated_at)
     VALUES($1,$2,$3,$4,'Staging','Reviewer',$5,'active',now(),now())`,
    [userId, organizationId, email, 'fixture-no-password-login', role]
  );
  await client.query(
    `INSERT INTO organization_members
       (id,organization_id,user_id,role,status,created_at)
     VALUES($1,$2,$3,$4,'ACTIVE',now())`,
    [crypto.randomUUID(), organizationId, userId, role]
  );
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

const token = jwt.sign(
  { id: userId, email, role, organizationId, jti: crypto.randomUUID() },
  jwtSecret,
  { expiresIn: '8h' }
);
const state = {
  reviewer: { token, userId, organizationId, email, role },
  fixture: { purpose: 'STG-JOURNEY-16 maker-checker', createdAt: new Date().toISOString() },
};
fs.writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(outputPath, 0o600);
process.stdout.write(
  `${JSON.stringify({ outputPath, userId, organizationId, role, tokenPersisted: true })}\n`
);
