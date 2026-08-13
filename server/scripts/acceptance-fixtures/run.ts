#!/usr/bin/env npx tsx
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
  if (!organizationId || !userId) throw new Error('ACCEPTANCE_ORG_ID and ACCEPTANCE_USER_ID are required');
  assertOrganizationAllowlisted(process.env, organizationId);
  const plan = [...buildFixturePlan({ organizationId, userId }), ...buildGoldenChildPlan({ organizationId, userId })];
  if (!write) { console.log(JSON.stringify({ mode:'DRY_RUN', organizationId, domains:plan.map(x=>x.domain), statements:plan.length }, null, 2)); return; }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const identity = await client.query(`SELECT u.organization_id, lower(u.email) email, u.status FROM organizations o JOIN users u ON u.id=$2 WHERE o.id=$1`, [organizationId,userId]);
    const actor = identity.rows[0];
    if (!actor || actor.organization_id !== organizationId || actor.status !== 'active') throw new Error('Target must be an active user in the exact allowlisted organization');
    for (const item of plan) await client.query(item.sql, item.params);
    for (const item of plan) { const result = await client.query(item.verifySql,item.verifyParams); if (result.rows[0]?.count !== 1) throw new Error(`Readback failed: ${item.domain}`); }
    await client.query('COMMIT');
    console.log(JSON.stringify({ mode:'WRITE', status:'PASS', organizationId, fixtures:plan.length }, null, 2));
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); }
}

if (process.argv[1]?.endsWith('/run.ts') || process.argv[1]?.endsWith('/run.js')) main().catch(e=>{ console.error(e); process.exit(1); });
