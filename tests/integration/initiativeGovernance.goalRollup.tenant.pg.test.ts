/**
 * RES-10 — getGoalRollup tenant fail-closed, against REAL PostgreSQL, two organizations.
 *
 * The unit/route tests prove the guard with a mocked DB. This one closes the gap that
 * a mock cannot: it runs the service's ACTUAL SQL against a real Postgres holding real
 * rows for two orgs, so the leak is demonstrated as data, not as a mocked return value.
 *
 * Opt-in — needs a disposable Postgres. NEVER point this at demo or prod: it creates and
 * drops its own schema objects.
 *
 *   docker run -d --name res10-pg -e POSTGRES_PASSWORD=res10 -e POSTGRES_USER=res10 \
 *     -e POSTGRES_DB=res10 -p 55432:5432 postgres:15-alpine
 *   RES10_PG_URL=postgresql://res10:res10@localhost:55432/res10 \
 *     npx vitest run tests/integration/initiativeGovernance.goalRollup.tenant.pg.test.ts --retry=0
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const PG_URL = process.env.RES10_PG_URL;
const describeIfPg = PG_URL ? describe : describe.skip;

let client: Client;

// The service talks to the DB only through queryHelpers. Point those at a real
// client so the SQL under test is executed verbatim by Postgres.
vi.mock('../../server/src/utils/queryHelpers.js', () => ({
  queryAll: async (sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows,
  queryFirst: async (sql: string, params: unknown[] = []) =>
    (await client.query(sql, params)).rows[0] ?? null,
  queryRun: async (sql: string, params: unknown[] = []) => {
    const r = await client.query(sql, params);
    return { changes: r.rowCount ?? 0 };
  },
}));

const ORG_A = 'org-A';
const ORG_B = 'org-B';

async function svc() {
  const mod = await import('../../server/src/services/initiativeGovernanceService.js');
  return mod.initiativeGovernanceService;
}

describeIfPg('RES-10 — goal rollup cross-tenant (real PostgreSQL)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: PG_URL });
    await client.connect();

    // Minimal slice of the live schema (server/migrations/20260719_baseline_gap.sql).
    await client.query(`DROP TABLE IF EXISTS goal_initiative_links, goals, initiatives CASCADE`);
    await client.query(`
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        parent_goal_id TEXT,
        goal_type TEXT NOT NULL DEFAULT 'objective',
        title TEXT NOT NULL,
        description TEXT,
        owner_id TEXT,
        time_frame TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        progress REAL DEFAULT 0.0,
        target_value REAL,
        current_value REAL,
        unit TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await client.query(`
      CREATE TABLE initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT,
        status TEXT,
        progress REAL DEFAULT 0.0
      )`);
    await client.query(`
      CREATE TABLE goal_initiative_links (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        contribution_weight REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (goal_id, initiative_id)
      )`);

    // Org B: one parent goal, two child goals, two linked initiatives — the exact
    // shape whose counts and aggregate progress used to leak.
    await client.query(
      `INSERT INTO goals (id, organization_id, goal_type, title, progress) VALUES
         ('goal-of-B', $1, 'scorecard', 'Org B confidential scorecard', 10),
         ('goal-of-A', $2, 'scorecard', 'Org A own scorecard', 10)`,
      [ORG_B, ORG_A]
    );
    await client.query(
      `INSERT INTO goals (id, organization_id, parent_goal_id, goal_type, title, progress) VALUES
         ('child-of-B-1', $1, 'goal-of-B', 'key_result', 'B child 1', 80),
         ('child-of-B-2', $1, 'goal-of-B', 'key_result', 'B child 2', 40)`,
      [ORG_B]
    );
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status, progress) VALUES
         ('init-of-B-1', $1, 'B init 1', 'active', 70),
         ('init-of-B-2', $1, 'B init 2', 'active', 30)`,
      [ORG_B]
    );
    await client.query(
      `INSERT INTO goal_initiative_links (id, goal_id, initiative_id, contribution_weight) VALUES
         ('l1', 'goal-of-B', 'init-of-B-1', 1.0),
         ('l2', 'goal-of-B', 'init-of-B-2', 1.0)`
    );
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(`DROP TABLE IF EXISTS goal_initiative_links, goals, initiatives CASCADE`);
    await client.end();
  });

  it("org A gets nothing for org B's goal — no counts, no progress, no metadata", async () => {
    const s = await svc();

    const result = await s.getGoalRollup(ORG_A, 'goal-of-B');

    expect(result).toBeNull();
    // Pre-fix this returned {goal:null, linkedInitiatives:2, childGoals:2, rollupProgress:60}.
    expect(JSON.stringify(result)).not.toMatch(/child-of-B|init-of-B|goal-of-B/);
  });

  it('org B still gets its own rollup (positive control, same row)', async () => {
    const s = await svc();

    const result = await s.getGoalRollup(ORG_B, 'goal-of-B');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      linkedInitiatives: 2,
      childGoals: 2,
      initiativeProgressCount: 2,
    });
    // children 80 + 40, initiatives 70*1 + 30*1, over weight 4 → 55
    expect(Math.round(result!.rollupProgress)).toBe(55);
    expect((result!.goal as { id: string }).id).toBe('goal-of-B');
  });

  it('a goal id present in no org is 404-shaped for everyone', async () => {
    const s = await svc();

    await expect(s.getGoalRollup(ORG_A, 'goal-nowhere')).resolves.toBeNull();
    await expect(s.getGoalRollup(ORG_B, 'goal-nowhere')).resolves.toBeNull();
  });

  it('org A sees its own goal normally (guard is tenant-scoped, not a blanket deny)', async () => {
    const s = await svc();

    const result = await s.getGoalRollup(ORG_A, 'goal-of-A');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ linkedInitiatives: 0, childGoals: 0 });
  });
});
