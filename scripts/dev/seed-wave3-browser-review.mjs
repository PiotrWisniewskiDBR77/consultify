#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
const CONFIRM = process.env.WAVE3_BROWSER_REVIEW_CONFIRM;

const IDS = Object.freeze({
  organizationId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
  memberId: '44444444-4444-4444-8444-444444444444',
  projectMemberId: '55555555-5555-4555-8555-555555555555',
});

const ACCOUNT = Object.freeze({
  email: 'wave3.owner@local.test',
  password: 'Wave3OwnerLocal!2026',
});

function fail(message) {
  throw new Error(`[wave3-browser-seed] BLOCKED: ${message}`);
}

function validateTarget() {
  if (CONFIRM !== 'YES') fail('WAVE3_BROWSER_REVIEW_CONFIRM=YES is required');
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  const url = new URL(DATABASE_URL);
  if (!new Set(['127.0.0.1', 'localhost', '::1']).has(url.hostname)) {
    fail('only a loopback PostgreSQL host is allowed');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^consultify_w3_runtime_[a-z0-9_]+$/.test(databaseName)) {
    fail('database must use the consultify_w3_runtime_* disposable prefix');
  }
  return databaseName;
}

async function main() {
  const databaseName = validateTarget();
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, 'Wave 3 Browser Review')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [IDS.organizationId]
    );
    const passwordHash = await bcrypt.hash(ACCOUNT.password, 10);
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, 'Piotr', 'Wave 3', 'ADMIN', 'active')
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         email = EXCLUDED.email,
         password = EXCLUDED.password,
         role = 'ADMIN',
         status = 'active'`,
      [IDS.userId, IDS.organizationId, ACCOUNT.email, passwordHash]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role='OWNER', status='ACTIVE'`,
      [IDS.memberId, IDS.organizationId, IDS.userId]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name)
       VALUES ($1, $2, 'Wave 3 Browser Review Project')
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, organization_id=EXCLUDED.organization_id`,
      [IDS.projectId, IDS.organizationId]
    );
    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, project_role)
       VALUES ($1, $2, $3, 'PROJECT_MANAGER')
       ON CONFLICT (project_id, user_id) DO UPDATE SET project_role='PROJECT_MANAGER'`,
      [IDS.projectMemberId, IDS.projectId, IDS.userId]
    );
    for (const moduleName of [
      'case_workspace',
      'core',
      'my_work',
      'execution',
      'initiatives',
      'results',
      'assessment',
      'outputs',
    ]) {
      await client.query(
        `INSERT INTO v8.v8_feature_flags
           (flag_id, organization_id, module, enabled, updated_by)
         VALUES (gen_random_uuid(), $1, $2, 1, $3)
         ON CONFLICT (organization_id, module) DO UPDATE SET enabled=1, updated_by=EXCLUDED.updated_by`,
        [IDS.organizationId, moduleName, IDS.userId]
      );
    }
    await client.query('COMMIT');

    const proof = await client.query(
      `SELECT
        (SELECT count(*)::int FROM users WHERE id=$1 AND email=$2 AND status='active') AS users,
        (SELECT count(*)::int FROM organization_members
          WHERE organization_id=$3 AND user_id=$1 AND role='OWNER' AND status='ACTIVE') AS memberships,
        (SELECT count(*)::int FROM project_members WHERE project_id=$4 AND user_id=$1) AS project_memberships,
        (SELECT count(*)::int FROM v8.v8_feature_flags
          WHERE organization_id=$3 AND enabled=1) AS enabled_flags`,
      [IDS.userId, ACCOUNT.email, IDS.organizationId, IDS.projectId]
    );
    const row = proof.rows[0];
    if (row.users !== 1 || row.memberships !== 1 || row.project_memberships !== 1) {
      fail('cold SQL readback did not confirm the complete browser persona');
    }
    console.log(
      JSON.stringify(
        {
          databaseName,
          userId: IDS.userId,
          organizationId: IDS.organizationId,
          projectId: IDS.projectId,
          email: ACCOUNT.email,
          localPassword: ACCOUNT.password,
          readback: row,
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
