/**
 * K5 acceptance — automatic TTL reclaim on a real local PostgreSQL schema.
 *
 * The old and fresh organizations are created on the production schema. The test proves the 24-hour boundary, default-ON flag, hard three-
 * tenant batch limit, explicit default-OFF gate and absence of rows across the
 * complete cleanup plan.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import demoService from '../../server/src/services/demoService.js';
import { deleteDemoDatasetForOrganization } from '../../server/src/services/demo/demoSeedService.js';

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`K5 requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

const MARK = 'odbior--k5--';
const OLD_ID = `ateliertoys-demo-session-${MARK}old`;
const FRESH_ID = `ateliertoys-demo-session-${MARK}fresh`;
const EXTRA_IDS = [0, 1, 2].map((n) => `ateliertoys-demo-session-${MARK}extra-${n}`);
const WHITELISTED_ID = `ateliertoys-demo-session-${MARK}whitelisted`;
const HUMAN_ID = `ateliertoys-demo-session-${MARK}human`;
const HUMAN_USER_ID = `${HUMAN_ID}--user`;
const PAID_ID = `ateliertoys-demo-session-${MARK}paid`;
const FAULT_ID = `ateliertoys-demo-session-${MARK}fault`;
const RECHECK_ID = `ateliertoys-demo-session-${MARK}recheck`;
const FRESH_ENDED_ID = `ateliertoys-demo-session-${MARK}fresh-ended`;
const BASE_ID = `${MARK}base-org`;
const BASE_USER_ID = `${MARK}base-user`;
const ALL_IDS = [
  OLD_ID,
  FRESH_ID,
  WHITELISTED_ID,
  HUMAN_ID,
  PAID_ID,
  FAULT_ID,
  RECHECK_ID,
  FRESH_ENDED_ID,
  ...EXTRA_IDS,
  BASE_ID,
];

const executedTables = new Set<string>();

const DIRECT_ORG_TABLES = [
  'activity_logs',
  'analysis_financials',
  'assessment_reports',
  'assessments',
  'closure_delivery_receipts',
  'custom_prompts',
  'decisions',
  'digitization_analyses',
  'financial_analyses',
  'financial_models',
  'financial_statement_ingest_runs',
  'financial_statement_packs',
  'financial_statements',
  'initiative_benefits',
  'initiative_dependencies',
  'initiative_milestones',
  'initiatives',
  'interview_insight_findings',
  'interview_insight_handoffs',
  'interview_insights',
  'interview_sessions',
  'knowledge_docs',
  'my_idea_maps',
  'my_ideas',
  'notebook_pages',
  'organization_context_claims',
  'organization_context_items',
  'organization_context_snapshots',
  'presentation_decks',
  'projects',
  'results_writer_observations',
  'rollout_changes',
  'rollout_closures',
  'rollout_kpis',
  'rollout_risks',
  'status_reports',
  'tasks',
  'teams',
  'tool_sessions',
  'users',
  'v8_output_artifacts',
  'v8_output_exports',
] as const;

const CHILD_TABLES = [
  ['task_comments', 'task_id', 'tasks'],
  ['project_users', 'project_id', 'projects'],
  ['project_kpis', 'project_id', 'projects'],
  ['team_members', 'team_id', 'teams'],
  ['financial_statement_values', 'statement_id', 'financial_statements'],
  ['assessment_report_sections', 'report_id', 'assessment_reports'],
  ['knowledge_chunks', 'doc_id', 'knowledge_docs'],
] as const;

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function tableExists(client: pg.Client, table: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${table}`]
  );
  return Boolean(result.rows[0]?.exists);
}

async function orgExists(id: string): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query(`SELECT 1 FROM organizations WHERE id = $1`, [id]);
    return result.rowCount === 1;
  });
}

async function purgeFixtures(): Promise<void> {
  for (const id of ALL_IDS) await deleteDemoDatasetForOrganization(id);
}

beforeAll(async () => {
  await purgeFixtures();
  await withClient(async (client) => {
    const insertOrg = `INSERT INTO organizations
      (id, name, plan, status, billing_status, organization_type, is_active, created_at)
      VALUES ($1, $2, 'demo', 'active', $4, 'DEMO', 1, $3)`;
    await client.query(insertOrg, [
      OLD_ID,
      'Atelier Toys',
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      null,
    ]);
    await client.query(insertOrg, [FRESH_ID, `${MARK} fresh sandbox`, new Date(), null]);
    await client.query(insertOrg, [
      WHITELISTED_ID,
      'Atelier',
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      null,
    ]);
    await client.query(insertOrg, [
      HUMAN_ID,
      `${MARK} human-owned sandbox`,
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      null,
    ]);
    await client.query(insertOrg, [
      PAID_ID,
      `${MARK} paid sandbox`,
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      'paid',
    ]);
    await client.query(insertOrg, [
      FAULT_ID,
      `${MARK} rollback sandbox`,
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      null,
    ]);
    await client.query(insertOrg, [
      RECHECK_ID,
      `${MARK} recheck sandbox`,
      new Date(Date.now() - 25 * 60 * 60 * 1000),
      null,
    ]);
    await client.query(insertOrg, [
      FRESH_ENDED_ID,
      `${MARK} fresh ended sandbox`,
      new Date(),
      null,
    ]);
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1, $2, 'real.person@customer.example', 'Real', 'Person', 'owner', 'active')`,
      [HUMAN_USER_ID, HUMAN_ID]
    );
    for (const id of EXTRA_IDS) {
      await client.query(insertOrg, [
        id,
        `${MARK} expired batch candidate`,
        new Date(Date.now() - 25 * 60 * 60 * 1000),
        null,
      ]);
    }

    await client.query(
      `INSERT INTO organizations
       (id, name, plan, status, billing_status, organization_type, is_active, created_at)
       VALUES ($1, $2, 'demo', 'active', NULL, 'INTERNAL', 1, NOW())`,
      [BASE_ID, `${MARK} session base`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Demo', 'Controller', 'owner', 'active')`,
      [BASE_USER_ID, BASE_ID, `${MARK}controller@example.com`]
    );
    await client.query(
      `INSERT INTO demo_sessions
       (id, user_id, base_org_id, session_org_id, status, anchor_date, expires_at, ended_at)
       VALUES ($1, $2, $3, $4, 'ended', NOW(), NOW() - INTERVAL '1 hour', NOW())`,
      [`${MARK}ended-session`, BASE_USER_ID, BASE_ID, FRESH_ENDED_ID]
    );

    // Representative parent/child graph. The denominator audit below checks the
    // complete 49-table plan, while these rows prove actual child-first removal.
    const userId = `${OLD_ID}--user`;
    const projectId = `${OLD_ID}--project`;
    const taskId = `${OLD_ID}--task`;
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Demo', 'Seed', 'owner', 'active')`,
      [userId, OLD_ID, `${MARK}seed@example.com`]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, 'K5 project')`,
      [projectId, OLD_ID]
    );
    await client.query(
      `INSERT INTO tasks (id, project_id, organization_id, title) VALUES ($1, $2, $3, 'K5 task')`,
      [taskId, projectId, OLD_ID]
    );
    await client.query(
      `INSERT INTO task_comments (id, task_id, user_id, content) VALUES ($1, $2, $3, 'K5 child row')`,
      [`${OLD_ID}--comment`, taskId, userId]
    );

    const faultUserId = `${FAULT_ID}--user`;
    const faultProjectId = `${FAULT_ID}--project`;
    const faultTaskId = `${FAULT_ID}--task`;
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Demo', 'Fault', 'owner', 'active')`,
      [faultUserId, FAULT_ID, `${MARK}fault@example.com`]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, 'K5 rollback project')`,
      [faultProjectId, FAULT_ID]
    );
    await client.query(
      `INSERT INTO tasks (id, project_id, organization_id, title) VALUES ($1, $2, $3, 'K5 rollback task')`,
      [faultTaskId, faultProjectId, FAULT_ID]
    );
    await client.query(
      `INSERT INTO task_comments (id, task_id, user_id, content) VALUES ($1, $2, $3, 'rollback')`,
      [`${FAULT_ID}--comment`, faultTaskId, faultUserId]
    );
  });
}, 60_000);

afterAll(async () => {
  await purgeFixtures();
}, 60_000);

describe('K5: demo sandbox TTL cleanup (real PostgreSQL)', () => {
  it('defaults OFF and does not delete a matching expired sandbox', async () => {
    const env = {
      ...process.env,
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_WHITELIST: [FAULT_ID, RECHECK_ID].join(','),
    };
    delete env.ENABLE_DEMO_SANDBOX_TTL;
    expect((await demoService.findExpiredDemoCandidates(3, env)).map((row) => row.id)).toContain(
      OLD_ID
    );
    expect(await demoService.cleanupExpiredDemos(env)).toBe(0);
    expect(await orgExists(OLD_ID)).toBe(true);
  });

  it('when explicitly ON, deletes a brand-named sandbox, respects 24h and caps one run at three tenants', async () => {
    const env = {
      ...process.env,
      ENABLE_DEMO_SANDBOX_TTL: 'true',
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_LIMIT: '999',
      DEMO_CLEANUP_WHITELIST: [FAULT_ID, RECHECK_ID].join(','),
    };
    const candidates = await demoService.findExpiredDemoCandidates(3, env);
    const fixtureCandidates = candidates.filter((row) => row.id.includes(MARK));
    expect(fixtureCandidates).toHaveLength(3);
    expect(fixtureCandidates.map((row) => row.id)).toContain(OLD_ID);
    expect(fixtureCandidates.map((row) => row.id)).not.toContain(FRESH_ID);

    const deleted = await demoService.cleanupExpiredDemos(env, {
      afterDeleteStep: (table) => executedTables.add(table),
    });
    expect(deleted).toBe(3);
    expect(await orgExists(OLD_ID)).toBe(false);
    expect(await orgExists(FRESH_ID)).toBe(true);
    expect(await orgExists(WHITELISTED_ID)).toBe(false);
    expect(await orgExists(HUMAN_ID)).toBe(true);
  }, 120_000);

  it('leaves zero rows for the reclaimed sandbox in all 49 dependent tables', async () => {
    await withClient(async (client) => {
      let checked = 0;
      for (const table of DIRECT_ORG_TABLES) {
        expect(await tableExists(client, table), `${table} must exist`).toBe(true);
        expect(executedTables.has(table), `${table} DELETE must execute`).toBe(true);
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM ${table} WHERE organization_id = $1`,
          [OLD_ID]
        );
        expect(result.rows[0]?.count, table).toBe(0);
        checked += 1;
      }
      for (const [table, foreignKey, parent] of CHILD_TABLES) {
        expect(await tableExists(client, table), `${table} must exist`).toBe(true);
        expect(await tableExists(client, parent), `${parent} must exist`).toBe(true);
        expect(executedTables.has(table), `${table} DELETE must execute`).toBe(true);
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM ${table} child
           WHERE NOT EXISTS (SELECT 1 FROM ${parent} parent WHERE parent.id = child.${foreignKey})`
        );
        expect(result.rows[0]?.count, `${table} orphan rows`).toBe(0);
        checked += 1;
      }
      console.info(
        `[K5] cleanup plan audited: ${checked} existing dependents, all DELETEs executed`
      );
      const org = await client.query(
        `SELECT COUNT(*)::int AS count FROM organizations WHERE id = $1`,
        [OLD_ID]
      );
      expect(org.rows[0]?.count).toBe(0);
      expect(checked + 1).toBe(50);
    });
  }, 60_000);

  it('protects paid tenants and a fresh tenant even when its session is ended', async () => {
    const env = {
      ...process.env,
      ENABLE_DEMO_SANDBOX_TTL: 'true',
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_WHITELIST: [FAULT_ID, RECHECK_ID, ...EXTRA_IDS].join(','),
    };
    const candidates = await demoService.findExpiredDemoCandidates(3, env);
    expect(candidates.map((row) => row.id)).not.toContain(PAID_ID);
    expect(candidates.map((row) => row.id)).not.toContain(FRESH_ENDED_ID);
    expect(await orgExists(PAID_ID)).toBe(true);
    expect(await orgExists(FRESH_ENDED_ID)).toBe(true);
  });

  it('re-checks safety under lock and skips a tenant that becomes paid after selection', async () => {
    const env = {
      ...process.env,
      ENABLE_DEMO_SANDBOX_TTL: 'true',
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_WHITELIST: [FAULT_ID, OLD_ID, ...EXTRA_IDS].join(','),
    };
    expect((await demoService.findExpiredDemoCandidates(3, env)).map((row) => row.id)).toContain(
      RECHECK_ID
    );
    const deleted = await demoService.cleanupExpiredDemos(env, {
      beforeCandidateTransaction: async (candidate) => {
        if (candidate.id !== RECHECK_ID) return;
        await withClient(async (client) => {
          await client.query(`UPDATE organizations SET billing_status = 'paid' WHERE id = $1`, [
            RECHECK_ID,
          ]);
        });
      },
    });
    expect(deleted).toBe(0);
    expect(await orgExists(RECHECK_ID)).toBe(true);
  });

  it('rolls back every earlier DELETE after a deterministic mid-purge failure', async () => {
    const env = {
      ...process.env,
      ENABLE_DEMO_SANDBOX_TTL: 'true',
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_WHITELIST: [OLD_ID, RECHECK_ID, ...EXTRA_IDS].join(','),
    };
    const deleted = await demoService.cleanupExpiredDemos(env, {
      afterDeleteStep: (table, organizationId) => {
        if (organizationId === FAULT_ID && table === 'tasks') {
          throw new Error('K5 deterministic fault after tasks DELETE');
        }
      },
    });
    expect(deleted).toBe(0);
    await withClient(async (client) => {
      const counts = await Promise.all([
        client.query(`SELECT COUNT(*)::int count FROM organizations WHERE id = $1`, [FAULT_ID]),
        client.query(`SELECT COUNT(*)::int count FROM users WHERE organization_id = $1`, [
          FAULT_ID,
        ]),
        client.query(`SELECT COUNT(*)::int count FROM projects WHERE organization_id = $1`, [
          FAULT_ID,
        ]),
        client.query(`SELECT COUNT(*)::int count FROM tasks WHERE organization_id = $1`, [
          FAULT_ID,
        ]),
        client.query(`SELECT COUNT(*)::int count FROM task_comments WHERE task_id = $1`, [
          `${FAULT_ID}--task`,
        ]),
      ]);
      expect(counts.map((result) => result.rows[0]?.count)).toEqual([1, 1, 1, 1, 1]);
    });
  });

  it('explicit OFF disables deletion', async () => {
    const before = await Promise.all(EXTRA_IDS.map(orgExists));
    expect(before.some(Boolean)).toBe(true);
    const deleted = await demoService.cleanupExpiredDemos({
      ...process.env,
      ENABLE_DEMO_SANDBOX_TTL: 'false',
      DEMO_CLEANUP_TTL_HOURS: '24',
      DEMO_CLEANUP_WHITELIST: [FAULT_ID, RECHECK_ID].join(','),
    });
    expect(deleted).toBe(0);
    expect(await Promise.all(EXTRA_IDS.map(orgExists))).toEqual(before);
  }, 30_000);
});
