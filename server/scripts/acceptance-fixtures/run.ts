#!/usr/bin/env npx tsx
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { buildFixturePlan } from './fixturePlan.js';
import { buildGoldenChildPlan } from './goldenChildPlan.js';

export function assertTarget(env: NodeJS.ProcessEnv, write: boolean): void {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (env.NODE_ENV === 'production' || /production/i.test(env.RAILWAY_ENVIRONMENT_NAME || '')) throw new Error('Production target refused');
  if (env.RAILWAY_ENVIRONMENT_NAME !== 'demo') throw new Error('RAILWAY_ENVIRONMENT_NAME must equal demo');
  if (write && env.ACCEPTANCE_FIXTURES_CONFIRM !== 'SEED_DEMO_ACCEPTANCE_FIXTURES') throw new Error('Write confirmation missing');
}

export function assertOrganizationAllowlisted(env: NodeJS.ProcessEnv, organizationId: string): void {
  const allowedOrganizationIds = new Set(
    String(env.ACCEPTANCE_ORG_ALLOWLIST || '').split(',').map(value => value.trim()).filter(Boolean)
  );
  if (!allowedOrganizationIds.has(organizationId)) throw new Error('ACCEPTANCE_ORG_ID is not in ACCEPTANCE_ORG_ALLOWLIST');
}

async function main() {
  const write = process.argv.includes('--write');
  assertTarget(process.env, write);
  const organizationId = String(process.env.ACCEPTANCE_ORG_ID || '').trim();
  const userId = String(process.env.ACCEPTANCE_USER_ID || '').trim();
  const ownerEmail = String(process.env.ACCEPTANCE_TEST_OWNER_EMAIL || 'acceptance.owner@consultify.local').trim().toLowerCase();
  const ownerPassword = String(process.env.ACCEPTANCE_TEST_OWNER_PASSWORD || '');
  const ownerId = String(process.env.ACCEPTANCE_TEST_OWNER_ID || 'acceptance-owner-rehearsal-20260813').trim();
  if (!organizationId || !userId) throw new Error('ACCEPTANCE_ORG_ID and ACCEPTANCE_USER_ID are required');
  if (write && ownerPassword.length < 16) throw new Error('ACCEPTANCE_TEST_OWNER_PASSWORD must contain at least 16 characters');
  assertOrganizationAllowlisted(process.env, organizationId);
  const plan = [...buildFixturePlan({ organizationId, userId }), ...buildGoldenChildPlan({ organizationId, userId })];
  if (!write) { console.log(JSON.stringify({ mode:'DRY_RUN', organizationId, acceptanceOwner:{ id:ownerId,email:ownerEmail,role:'OWNER',status:'active' }, piotrReadback:true, domains:plan.map(x=>x.domain), statements:plan.length }, null, 2)); return; }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const identity = await client.query(`SELECT u.organization_id, lower(u.email) email, u.status FROM organizations o JOIN users u ON u.id=$2 WHERE o.id=$1`, [organizationId,userId]);
    const actor = identity.rows[0];
    if (!actor || actor.organization_id !== organizationId || actor.status !== 'active') throw new Error('Target must be an active user in the exact allowlisted organization');
    const piotr = await client.query(
      `SELECT u.id, u.organization_id, lower(u.email) email, upper(u.role) role,
              lower(u.status) status, upper(m.role) membership_role, upper(m.status) membership_status
         FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id
        WHERE lower(u.email)='piotr.wisniewski@dbr77.com' AND u.organization_id=$1`, [organizationId]);
    if (piotr.rows.length !== 1 || piotr.rows[0].role !== 'OWNER' || piotr.rows[0].status !== 'active' || piotr.rows[0].membership_role !== 'OWNER' || piotr.rows[0].membership_status !== 'ACTIVE') throw new Error('Piotr readback must be exactly one active OWNER in the target organization');
    const ownerPasswordHash = bcrypt.hashSync(ownerPassword, 10);
    const acceptanceOwner = await client.query(
      `INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status,created_at)
       VALUES ($1,$2,$3,$4,'Acceptance','Owner','OWNER','active',NOW())
       ON CONFLICT (email) DO UPDATE SET password=EXCLUDED.password,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,role='OWNER',status='active'
       WHERE users.id=EXCLUDED.id AND users.organization_id=EXCLUDED.organization_id
       RETURNING id,organization_id,lower(email) email,upper(role) role,lower(status) status`, [ownerId,organizationId,ownerEmail,ownerPasswordHash]);
    const seededOwner = acceptanceOwner.rows[0];
    if (!seededOwner || seededOwner.organization_id !== organizationId || seededOwner.role !== 'OWNER' || seededOwner.status !== 'active') throw new Error('Acceptance OWNER collision or readback failure');
    const acceptanceMembership = await client.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
       VALUES ($1,$2,$3,'OWNER','ACTIVE',NOW()) ON CONFLICT (organization_id,user_id) DO UPDATE SET role='OWNER',status='ACTIVE'
       RETURNING organization_id,user_id,upper(role) role,upper(status) status`, [`${ownerId}-membership`,organizationId,ownerId]);
    const seededMembership = acceptanceMembership.rows[0];
    if (!seededMembership || seededMembership.organization_id !== organizationId || seededMembership.user_id !== ownerId || seededMembership.role !== 'OWNER' || seededMembership.status !== 'ACTIVE') throw new Error('Acceptance OWNER membership readback failure');
    for (const item of plan) await client.query(item.sql, item.params);
    for (const item of plan) { const result = await client.query(item.verifySql,item.verifyParams); if (result.rows[0]?.count !== 1) throw new Error(`Readback failed: ${item.domain}`); }
    await client.query('COMMIT');
    console.log(JSON.stringify({ mode:'WRITE',status:'PASS',organizationId,acceptanceOwner:{id:ownerId,email:ownerEmail,role:'OWNER',status:'active'},piotr:{email:piotr.rows[0].email,role:piotr.rows[0].role,status:piotr.rows[0].status},fixtures:plan.length }, null, 2));
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); }
}

if (process.argv[1]?.endsWith('/run.ts') || process.argv[1]?.endsWith('/run.js')) main().catch(e=>{ console.error(e); process.exit(1); });
