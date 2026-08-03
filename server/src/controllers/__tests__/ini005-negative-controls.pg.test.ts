/**
 * INI-05 — PERMANENT, automatic negative control for the capability guard.
 *
 * The main suite (ini005-portfolio-resources-roadmap.pg.test.ts) proves the
 * guard denies a no-role user. This file proves the OPPOSITE direction: with
 * `assertCanEditInitiative` neutralized (module-mocked to always allow), the
 * exact same no-role write SUCCEEDS — i.e. the guard, not some other check,
 * is what was actually blocking it. If a future refactor accidentally routes
 * a mutation around the guard, this test's twin in the main suite goes red;
 * if someone weakens the guard itself so it always allows, THIS file would
 * have already told you what "guard removed" looks like.
 *
 * Real PostgreSQL, same env-var contract as the main suite (never a false
 * green when no real DB is reachable) — see that file's header for the run
 * command and the `NODE_ENV=test` mock-DB pitfall this guards against.
 *
 * Tenant-isolation and CAS negative controls are NOT automated here: both
 * checks are inline in InitiativeController.ts (not separate, mockable
 * functions like the capability guard), so proving "remove the check ->
 * test goes red" without editing source would need refactoring them into
 * injectable dependencies — a bigger change than this packet's scope. That
 * pair was instead verified manually (bypass both inline checks, confirm
 * 5 tests in the main suite go red, revert, confirm 13/13 green again) and
 * is recorded in the INI-05 report and in commit d9992c042c's message as a
 * reproducible procedure, not just a one-time claim.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;
const SHARED_DB = process.env.INI005_SHARED_DB === '1';

// Module-level mock — must be declared before the controller (and therefore
// before this file's dynamic imports below) ever loads it.
vi.mock('../../services/initiative/ini005CapabilityGuard.js', () => ({
  assertCanEditInitiative: vi.fn().mockResolvedValue({
    allowed: true,
    denial: null,
    effectiveRoles: [],
  }),
}));

function mockReqRes(opts: {
  user?: { id: string; organizationId: string; role?: string } | null;
  params?: Record<string, string>;
  body?: unknown;
}) {
  const req: any = {
    user: opts.user ?? null,
    params: opts.params ?? {},
    body: opts.body ?? {},
    query: {},
    ip: '127.0.0.1',
    get: () => 'vitest-negative-control',
  };
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

async function call(handler: (req: any, res: any, next: any) => Promise<void>, opts: any) {
  const { req, res } = mockReqRes(opts);
  await handler(req, res, () => {});
  return res;
}

describe.skipIf(!REAL_PG)('INI-05 negative control — capability guard neutralized', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let InitiativeController: typeof import('../InitiativeController.js').default;

  const orgA = `org-negctl-${randomUUID()}`;
  const noRoleUserA = `user-negctl-norole-${randomUUID()}`;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    if (SHARED_DB) {
      // Real, persistent, already-populated DB (Railway dev) — schema
      // already has everything; only seed this file's own scoped rows.
      const orgCheck = await pool.query(`SELECT 1 FROM organizations LIMIT 0`);
      void orgCheck; // schema presence implied by a successful query below
    } else {
      // Throwaway DB — same minimal schema as the main suite.
      const statements = [
        `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY)`,
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, role TEXT)`,
        `CREATE TABLE IF NOT EXISTS initiatives (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          name TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS initiative_history (
          id TEXT PRIMARY KEY,
          initiative_id TEXT NOT NULL,
          action TEXT,
          old_value TEXT,
          new_value TEXT,
          changed_by TEXT,
          changed_at TIMESTAMPTZ DEFAULT now(),
          notes TEXT
        )`,
      ];
      for (const sql of statements) await pool.query(sql);
    }

    await pool.query(`INSERT INTO organizations (id) VALUES ($1)`, [orgA]);
    await pool.query(`INSERT INTO users (id, organization_id, role) VALUES ($1,$2,$3)`, [
      noRoleUserA,
      orgA,
      'user',
    ]);

    InitiativeController = (await import('../InitiativeController.js')).default;
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    if (SHARED_DB) {
      await pool.query(`DELETE FROM initiatives WHERE organization_id = $1`, [orgA]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [noRoleUserA]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgA]);
      const residue = await pool.query(
        `SELECT (SELECT COUNT(*)::int FROM organizations WHERE id = $1) AS c`,
        [orgA]
      );
      if (residue.rows[0].c !== 0) {
        throw new Error('negative-control cleanup left residue');
      }
    } else {
      // CASCADE: throwaway DB only (never reached in SHARED_DB mode above) —
      // other test files sharing this same container across the session may
      // have left FK-referencing tables (initiative_resources, etc.) behind.
      for (const table of ['initiative_history', 'projects', 'initiatives', 'users', 'organizations']) {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
    }
    await pool.end();
  });

  it('with assertCanEditInitiative mocked to always allow, a no-role user CAN move an initiative — proving the guard (not something else) was the real block', async () => {
    const initiativeId = `init-negctl-${randomUUID()}`;
    const targetProjectId = `proj-negctl-${randomUUID()}`;
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, status, name) VALUES ($1,$2,'DRAFT',$3)`,
      [initiativeId, orgA, 'negative control target']
    );
    // moveInitiative's own project-ownership check needs a real row too.
    await pool.query(`INSERT INTO projects (id, organization_id) VALUES ($1,$2)`, [
      targetProjectId,
      orgA,
    ]).catch(async () => {
      // projects table may not exist in throwaway mode — create it once.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL)`
      );
      await pool.query(`INSERT INTO projects (id, organization_id) VALUES ($1,$2)`, [
        targetProjectId,
        orgA,
      ]);
    });

    const res = await call(InitiativeController.moveInitiative, {
      user: { id: noRoleUserA, organizationId: orgA, role: 'user' },
      params: { id: initiativeId },
      body: { targetProjectId },
    });

    // With the guard neutralized, the write goes through — the main suite's
    // "permission deny" test proves the SAME scenario is 403 with the real
    // guard in place.
    expect(res.statusCode).toBe(200);
    const row = await pool.query(`SELECT project_id FROM initiatives WHERE id = $1`, [
      initiativeId,
    ]);
    expect(row.rows[0].project_id).toBe(targetProjectId);

    await pool.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeId]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [targetProjectId]);
  });
});
