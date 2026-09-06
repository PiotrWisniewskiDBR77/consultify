#!/usr/bin/env tsx
/**
 * Seed Implementation Module sample data (PostgreSQL).
 *
 * Provides coherent data for manual testing of the Execution Center:
 * initiatives (EXECUTING), tasks, RAID items, budget entries, initiative dependencies.
 *
 * Safe to run multiple times (idempotent via deterministic IDs + ON CONFLICT DO NOTHING).
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx server/scripts/seed-implementation-sample.ts
 *
 * Optional env:
 *   SEED_ORG_ID          Organization ID (default: first org from DB, or creates minimal one)
 *   SEED_PROJECT_ID      Project ID (default: first project for org, or creates one)
 *   SEED_USER_EMAIL      User email for owner/assignee (default: first user in org)
 */
import path from 'path';

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { v5 as uuidv5 } from 'uuid';

type PgClient = Awaited<ReturnType<Pool['connect']>>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function makeIds(namespace: string) {
  const id = (name: string) => uuidv5(name, namespace);
  return { id };
}

async function tableExists(client: PgClient, table: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return r.rows.length > 0;
}

async function getColumns(client: PgClient, table: string): Promise<Set<string>> {
  const r = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return new Set(r.rows.map((x: { column_name: string }) => String(x.column_name)));
}

function qIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function insertRow(
  client: PgClient,
  table: string,
  columns: Set<string>,
  row: Record<string, unknown>
) {
  const keys = Object.keys(row).filter((k) => columns.has(k) && row[k] !== undefined);
  if (keys.length === 0) return;

  const colsSql = keys.map(qIdent).join(', ');
  const valsSql = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) => row[k]);
  const sql = `INSERT INTO ${qIdent(table)} (${colsSql}) VALUES (${valsSql}) ON CONFLICT DO NOTHING`;
  await client.query(sql, values);
}

async function getFirstOrg(client: PgClient): Promise<string | null> {
  const r = await client.query(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`);
  return r.rows.length ? String(r.rows[0].id) : null;
}

async function getFirstProject(client: PgClient, orgId: string): Promise<string | null> {
  const r = await client.query(
    `SELECT id FROM projects WHERE organization_id=$1 ORDER BY created_at ASC LIMIT 1`,
    [orgId]
  );
  return r.rows.length ? String(r.rows[0].id) : null;
}

async function getFirstUserInOrg(client: PgClient, orgId: string): Promise<string | null> {
  const r = await client.query(
    `SELECT id FROM users WHERE organization_id=$1 ORDER BY created_at ASC LIMIT 1`,
    [orgId]
  );
  return r.rows.length ? String(r.rows[0].id) : null;
}

async function getUserByEmail(client: PgClient, email: string): Promise<string | null> {
  const r = await client.query(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [email]);
  return r.rows.length ? String(r.rows[0].id) : null;
}

async function ensureOrganization(client: PgClient, orgId: string) {
  if (!(await tableExists(client, 'organizations'))) return;
  const cols = await getColumns(client, 'organizations');
  await insertRow(client, 'organizations', cols, {
    id: orgId,
    name: 'Implementation Sample Org',
    plan: cols.has('plan') ? 'enterprise' : undefined,
    status: cols.has('status') ? 'active' : undefined,
    created_at: cols.has('created_at') ? new Date() : undefined,
  });
}

async function ensureProject(client: PgClient, projectId: string, orgId: string, ownerId: string) {
  if (!(await tableExists(client, 'projects'))) return;
  const cols = await getColumns(client, 'projects');
  const now = new Date();
  await insertRow(client, 'projects', cols, {
    id: projectId,
    name: 'Implementation Sample Project',
    description: 'Sample project for Execution Center testing',
    status: 'active',
    phase: cols.has('phase') ? 'execution' : undefined,
    owner_id: cols.has('owner_id') ? ownerId : undefined,
    organization_id: orgId,
    created_at: cols.has('created_at') ? now : undefined,
    updated_at: cols.has('updated_at') ? now : undefined,
  });
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  if (process.env.ENV_FILE) {
    dotenv.config({ path: path.resolve(process.cwd(), process.env.ENV_FILE), override: true });
  }

  const dbType = String(process.env.DB_TYPE || '').toLowerCase();
  if (dbType && dbType !== 'postgres') {
    throw new Error(`This seed targets PostgreSQL only. Current DB_TYPE="${dbType}"`);
  }
  const databaseUrl = requireEnv('DATABASE_URL');
  if (!databaseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must be postgres');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const namespace = uuidv5('consultify:implementation-sample:v1', uuidv5.DNS);
    const ids = makeIds(namespace);
    const nowIso = new Date().toISOString();
    const dueSoon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    let orgId = process.env.SEED_ORG_ID?.trim() || null;
    if (!orgId) orgId = await getFirstOrg(client);
    if (!orgId) {
      orgId = ids.id('org:sample');
      await ensureOrganization(client, orgId);
      console.log(`Created org: ${orgId}`);
    }

    let ownerId = null;
    const seedEmail = process.env.SEED_USER_EMAIL?.trim();
    if (seedEmail) ownerId = await getUserByEmail(client, seedEmail);
    if (!ownerId) ownerId = await getFirstUserInOrg(client, orgId);
    if (!ownerId) {
      throw new Error(
        'No user found in org. Provide SEED_USER_EMAIL or run user seed first (e.g. seed-production-dbr77-users).'
      );
    }

    let projectId = process.env.SEED_PROJECT_ID?.trim() || null;
    if (!projectId) projectId = await getFirstProject(client, orgId);
    if (!projectId) {
      projectId = ids.id('project:sample');
      await ensureProject(client, projectId, orgId, ownerId);
      console.log(`Created project: ${projectId}`);
    }

    const initA = ids.id('initiative:ai-customer-pilot');
    const initB = ids.id('initiative:data-quality');

    if (await tableExists(client, 'initiatives')) {
      const cols = await getColumns(client, 'initiatives');
      const initiatives = [
        {
          id: initA,
          organization_id: orgId,
          project_id: projectId,
          name: 'AI Customer Service Pilot',
          title: cols.has('title') ? 'AI Customer Service Pilot' : undefined,
          description: cols.has('description')
            ? 'Deploy GenAI chatbot for L1 support to reduce ticket volume.'
            : undefined,
          summary: cols.has('summary')
            ? 'Pilot GenAI chatbot for L1 support.'
            : undefined,
          // DEC-424: 'EXECUTING' był poprawny przed migracją P12
          // (20262103_p12_initiative_status_slownik.sql); dziś initiatives_status_check_p12
          // dopuszcza wyłącznie 7 kodów z server/src/constants/initiativeStatuses.ts.
          status: 'IN_EXECUTION',
          current_stage: cols.has('current_stage') ? 'execution' : undefined,
          progress: cols.has('progress') ? 45 : undefined,
          owner_execution_id: cols.has('owner_execution_id') ? ownerId : undefined,
          owner_business_id: cols.has('owner_business_id') ? ownerId : undefined,
          created_by: cols.has('created_by') ? ownerId : undefined,
          start_date: cols.has('start_date') ? startDate : undefined,
          end_date: cols.has('end_date') ? endDate : undefined,
          pilot_end_date: cols.has('pilot_end_date') ? endDate : undefined,
          planned_end_date: cols.has('planned_end_date') ? endDate : undefined,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: initB,
          organization_id: orgId,
          project_id: projectId,
          name: 'Data Quality Dashboard',
          title: cols.has('title') ? 'Data Quality Dashboard' : undefined,
          description: cols.has('description')
            ? 'Build dashboard for master data quality monitoring.'
            : undefined,
          summary: cols.has('summary') ? 'Data quality monitoring dashboard.' : undefined,
          // DEC-424: 'EXECUTING' był poprawny przed migracją P12
          // (20262103_p12_initiative_status_slownik.sql); dziś initiatives_status_check_p12
          // dopuszcza wyłącznie 7 kodów z server/src/constants/initiativeStatuses.ts.
          status: 'IN_EXECUTION',
          current_stage: cols.has('current_stage') ? 'execution' : undefined,
          progress: cols.has('progress') ? 25 : undefined,
          owner_execution_id: cols.has('owner_execution_id') ? ownerId : undefined,
          owner_business_id: cols.has('owner_business_id') ? ownerId : undefined,
          created_by: cols.has('created_by') ? ownerId : undefined,
          start_date: cols.has('start_date') ? startDate : undefined,
          end_date: cols.has('end_date') ? endDate : undefined,
          pilot_end_date: cols.has('pilot_end_date') ? endDate : undefined,
          planned_end_date: cols.has('planned_end_date') ? endDate : undefined,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];
      for (const i of initiatives) await insertRow(client, 'initiatives', cols, i);
      console.log(`Seeded 2 initiatives (EXECUTING)`);
    }

    if (await tableExists(client, 'tasks')) {
      const cols = await getColumns(client, 'tasks');
      const tasks = [
        {
          id: ids.id('task:setup-dev'),
          organization_id: orgId,
          project_id: projectId,
          initiative_id: initA,
          title: 'Setup dev environment',
          description: 'Prepare sandbox and CI/CD for chatbot.',
          status: 'DONE',
          priority: 'high',
          due_date: dueSoon,
          assignee_id: ownerId,
          created_by: ownerId,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('task:integrate-api'),
          organization_id: orgId,
          project_id: projectId,
          initiative_id: initA,
          title: 'Integrate OpenAI API',
          description: 'Connect chatbot to LLM provider.',
          status: 'in_progress',
          priority: 'high',
          due_date: dueSoon,
          assignee_id: ownerId,
          created_by: ownerId,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('task:design-widget'),
          organization_id: orgId,
          project_id: projectId,
          initiative_id: initA,
          title: 'Design chat widget UI',
          description: 'UX mockups and accessibility review.',
          status: 'todo',
          priority: 'medium',
          due_date: dueSoon,
          assignee_id: ownerId,
          created_by: ownerId,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('task:data-model'),
          organization_id: orgId,
          project_id: projectId,
          initiative_id: initB,
          title: 'Define data quality metrics',
          description: 'KPI definitions and thresholds.',
          status: 'in_progress',
          priority: 'high',
          due_date: dueSoon,
          assignee_id: ownerId,
          created_by: ownerId,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];
      for (const t of tasks) await insertRow(client, 'tasks', cols, t);
      console.log(`Seeded ${tasks.length} tasks`);
    }

    if (await tableExists(client, 'raid_items')) {
      const cols = await getColumns(client, 'raid_items');
      const raidItems = [
        {
          id: ids.id('raid:risk-1'),
          organization_id: orgId,
          initiative_id: initA,
          type: 'RISK',
          title: 'Vendor API rate limits',
          description: 'External API throttling may delay responses.',
          status: 'OPEN',
          probability: cols.has('probability') ? 'MEDIUM' : undefined,
          impact: cols.has('impact') ? 'HIGH' : undefined,
          owner_id: ownerId,
          due_date: dueSoon,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('raid:issue-1'),
          organization_id: orgId,
          initiative_id: initB,
          type: 'ISSUE',
          title: 'Legacy data format inconsistency',
          description: 'Some sources use old schema.',
          status: 'OPEN',
          probability: cols.has('probability') ? undefined : undefined,
          impact: cols.has('impact') ? 'MEDIUM' : undefined,
          owner_id: ownerId,
          due_date: dueSoon,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];
      for (const r of raidItems) await insertRow(client, 'raid_items', cols, r);
      console.log(`Seeded ${raidItems.length} RAID items`);
    }

    if (await tableExists(client, 'budget_entries')) {
      const cols = await getColumns(client, 'budget_entries');
      const beId = ids.id('budget:entry-1');
      await insertRow(client, 'budget_entries', cols, {
        id: beId,
        organization_id: orgId,
        initiative_id: initA,
        entry_type: 'ACTUAL',
        cost_type: 'CAPEX',
        category: 'Infrastructure',
        amount: 15000,
        currency: 'PLN',
        description: 'Dev environment setup',
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
        source: 'manual',
        created_by: ownerId,
        created_at: nowIso,
      });
      console.log(`Seeded 1 budget entry`);
    }

    if (await tableExists(client, 'initiative_dependencies')) {
      const cols = await getColumns(client, 'initiative_dependencies');
      const depId = ids.id('dep:init-a-to-b');
      const row: Record<string, unknown> = {
        id: depId,
        organization_id: orgId,
        project_id: projectId,
        from_initiative_id: initA,
        to_initiative_id: initB,
        type: 'FINISH_TO_START',
        created_at: nowIso,
      };
      if (cols.has('source_id')) row.source_id = 'manual';
      await insertRow(client, 'initiative_dependencies', cols, row);
      console.log(`Seeded 1 initiative dependency`);
    }

    await client.query('COMMIT');
    console.log('Implementation sample seed complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
