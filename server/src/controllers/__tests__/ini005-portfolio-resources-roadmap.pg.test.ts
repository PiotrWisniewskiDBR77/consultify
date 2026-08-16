/**
 * INI-05 — real-PostgreSQL test for Portfolio membership, Resources (CAS),
 * and Roadmap (milestones + dependencies) mutation contracts.
 *
 * Exercises the REAL Express handlers (`InitiativeController.moveInitiative`,
 * `.addResource`, `.updateResource`, `.deleteResource`,
 * `.createPortfolioDependency`, `.deletePortfolioDependency`,
 * `.createMilestone`, `.updateMilestone`, `.deleteMilestone`, plus the
 * corresponding GETs) via lightweight req/res doubles — no mocked
 * `queryHelpers`, so every SQL statement in this file runs against a real
 * PostgreSQL. The 5-way concurrency test in particular is not meaningful any
 * other way: optimistic-concurrency correctness is a property of the
 * database's row locking, not of application code, and a mocked DB can't
 * prove it.
 *
 * Same env-var contract as the FIN-005 / INI-04 real-PG suites (see project
 * memory: `NODE_ENV=test` alone silently mocks the DB) — this file is
 * `describe.skipIf`-gated on the same four variables and never reports a
 * false green when no real database is reachable.
 *
 * HOW TO RUN
 * ----------
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/ini005 \
 *   npx vitest run --config vitest.config.ts \
 *     src/controllers/__tests__/ini005-portfolio-resources-roadmap.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// See initiativeCapabilityMatrix.pg.test.ts (INI-04) for why this is needed:
// `server/vitest.config.ts` forces `DB_TYPE: 'sqlite'` for every suite via
// `test.env`, which wins over the shell/operator env. Correct it back BEFORE
// the app's DB layer is first imported (below), so the real Postgres driver
// is what `queryHelpers`/`getDatabase()` actually construct.
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

/** Minimal Express req/res double — enough to drive `asyncHandler`-wrapped
 * static controller methods without mounting a real HTTP server. */
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
    get: () => 'vitest-pg-suite',
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
  let capturedNextError: unknown = null;
  const next = (err: unknown) => {
    capturedNextError = err;
  };
  return {
    req,
    res,
    next,
    getNextError: () => capturedNextError,
  };
}

async function call(
  handler: (req: any, res: any, next: any) => Promise<unknown>,
  opts: Parameters<typeof mockReqRes>[0]
) {
  const { req, res, next, getNextError } = mockReqRes(opts);
  await handler(req, res, next);
  const err = getNextError();
  if (err) throw err;
  return res;
}

describe.skipIf(!REAL_PG)('INI-05 Portfolio/Resources/Roadmap — real PostgreSQL', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let InitiativeController: typeof import('../InitiativeController.js').default;
  let getPortfolioRead: typeof import('../../services/v8/planningPortfolioReadService.js').getPortfolioRead;
  let getCapacityTimeline: typeof import('../../services/workloadCapacityService.js').getCapacityTimeline;
  let getInitiativeCapacity: typeof import('../../services/workloadCapacityService.js').getInitiativeCapacity;

  const orgA = `org-a-${randomUUID()}`;
  const orgB = `org-b-${randomUUID()}`;
  const projectA = `proj-a-${randomUUID()}`;
  const projectA2 = `proj-a2-${randomUUID()}`;
  const projectB = `proj-b-${randomUUID()}`;
  const ownerUserA = `user-owner-a-${randomUUID()}`;
  const noRoleUserA = `user-norole-a-${randomUUID()}`;
  const userB = `user-b-${randomUUID()}`;

  async function createSchema() {
    // Idempotent — every statement is CREATE ... IF NOT EXISTS, run TWICE in
    // beforeAll (see the "fresh migration + replay" test below) to prove
    // replay-safety, matching the additive-migration convention the real
    // migration files in this repo follow.
    const statements = [
      `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY)`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        role TEXT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        avatar_url TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        program_id TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        name TEXT,
        title TEXT,
        owner_business_id TEXT,
        owner_execution_id TEXT,
        sponsor_id TEXT,
        allocated_capacity_fte NUMERIC DEFAULT 0,
        required_capacity_fte NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS initiative_resources (
        id TEXT PRIMARY KEY,
        initiative_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        allocation_percentage INTEGER DEFAULT 100,
        start_date DATE,
        end_date DATE,
        notes TEXT,
        source TEXT DEFAULT 'manual',
        idempotency_key TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS initiative_dependencies (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        from_initiative_id TEXT,
        to_initiative_id TEXT,
        type TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        created_by TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS initiative_milestones (
        id TEXT PRIMARY KEY,
        initiative_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        target_date DATE,
        actual_date DATE,
        status TEXT DEFAULT 'PENDING',
        order_index INTEGER DEFAULT 0,
        is_gate BOOLEAN DEFAULT FALSE,
        gate_decision_id TEXT,
        idempotency_key TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_by TEXT
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
      `CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        ts TEXT,
        actor_id TEXT,
        actor_type TEXT,
        org_id TEXT,
        action TEXT,
        resource_type TEXT,
        resource_id TEXT,
        before_json TEXT,
        after_json TEXT,
        metadata_json TEXT,
        ip TEXT,
        user_agent TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        initiative_id TEXT,
        assignee_id TEXT,
        estimated_hours NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'todo',
        updated_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS task_allocations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        week_start DATE NOT NULL,
        allocated_hours NUMERIC NOT NULL
      )`,
    ];
    for (const sql of statements) {
      await pool.query(sql);
    }
  }

  // INI-05 — Railway `dev` real-PG run. `dev` (thomas.proxy.rlwy.net:20221)
  // has real, persistent data (orgs/initiatives/users belonging to actual
  // accounts) — unlike the throwaway-Docker mode this file is normally run
  // against, this suite must NEVER create/drop tables there. Set
  // INI005_SHARED_DB=1 to: skip createSchema() entirely (the real schema
  // already has everything — including this packet's own additive
  // `version` migration, applied separately via
  // `migrate.postgres.ts --only`), and in afterAll DELETE only the
  // randomly-suffixed test rows this file itself created (cascades through
  // initiatives -> resources/dependencies/milestones via the real FKs),
  // never DROP TABLE.
  // Whether this run owns the database or is a guest on a migrated one.
  //
  // This used to be `process.env.INI005_SHARED_DB === '1'` — an opt-in nobody
  // set, so every CI and local run took the throwaway branch and ended in
  // `DROP TABLE tasks`. Against the real, fully-migrated schema that DROP
  // fails with 2BP01: `tasks` carries six dependent foreign keys
  // (task_dependencies ×2, task_comments, decisions, studio_documents,
  // kpi_recovery_actions), and more arrive as the product grows. The fixture
  // was written against a partial schema and silently rotted as the real one
  // filled in.
  //
  // Detected rather than declared: a database that carries an applied
  // migration ledger was built by the migration corpus, not by this file, so
  // this file must not touch its schema. The env var is kept as an explicit
  // override for operators. Deliberately NOT solved by disabling constraints
  // or by `DROP ... CASCADE` — both would destroy tables this fixture does not
  // own.
  let SHARED_DB = process.env.INI005_SHARED_DB === '1';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    if (!SHARED_DB) {
      const migrated = await pool.query(
        `SELECT COUNT(*)::int AS n
           FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'schema_migrations'`
      );
      if (migrated.rows[0]?.n > 0) {
        const applied = await pool.query(`SELECT COUNT(*)::int AS n FROM schema_migrations`);
        if (applied.rows[0]?.n > 0) SHARED_DB = true;
      }
    }

    if (SHARED_DB) {
      // Prove the additive migration this run depends on was actually
      // applied — fail loudly here rather than mysteriously later.
      const versionCol = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'initiative_resources' AND column_name = 'version'`
      );
      if (versionCol.rowCount === 0) {
        throw new Error(
          'INI005_SHARED_DB=1 but initiative_resources.version is missing — run ' +
            'migrate.postgres.ts --only 20260802_ini005_resources_cas_version.sql against this DB first.'
        );
      }
    } else {
      // "fresh migration + replay": run schema creation TWICE. If any
      // statement were not additive/idempotent this would throw on the
      // second pass. Only meaningful (and only safe) on a throwaway DB.
      await createSchema();
      await createSchema();
    }

    await pool.query(`INSERT INTO organizations (id) VALUES ($1), ($2)`, [orgA, orgB]);
    await pool.query(
      `INSERT INTO users (id, organization_id, role) VALUES ($1,$2,$3), ($4,$5,$6), ($7,$8,$9)`,
      [ownerUserA, orgA, 'user', noRoleUserA, orgA, 'user', userB, orgB, 'user']
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1,$2,$3), ($4,$5,$6), ($7,$8,$9)`,
      [projectA, orgA, 'Project A', projectA2, orgA, 'Project A2', projectB, orgB, 'Project B']
    );

    // Import the REAL app modules only after env + schema are ready —
    // Database.ts/DatabaseConfig.ts read process.env at first call.
    InitiativeController = (await import('../InitiativeController.js')).default;
    getPortfolioRead = (await import('../../services/v8/planningPortfolioReadService.js'))
      .getPortfolioRead;
    ({ getCapacityTimeline, getInitiativeCapacity } = await import(
      '../../services/workloadCapacityService.js'
    ));
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    if (SHARED_DB) {
      // Row-level cleanup only — NEVER touch schema on a shared, persistent
      // database. Children are deleted explicitly, deepest first, rather than
      // leaning on ON DELETE CASCADE: cascade is a property of how the FK
      // happens to be declared today, and a child added later without it would
      // turn this cleanup into a silent leak. Every id is a fresh random UUID
      // generated by this file, so nothing else in the database can match.
      const orgIds = [orgA, orgB];
      for (const childSql of [
        `DELETE FROM initiative_milestones WHERE initiative_id IN (
           SELECT id FROM initiatives WHERE organization_id = ANY($1::text[]))`,
        `DELETE FROM initiative_dependencies WHERE from_initiative_id IN (
           SELECT id FROM initiatives WHERE organization_id = ANY($1::text[]))
           OR to_initiative_id IN (
           SELECT id FROM initiatives WHERE organization_id = ANY($1::text[]))`,
        `DELETE FROM initiative_resources WHERE initiative_id IN (
           SELECT id FROM initiatives WHERE organization_id = ANY($1::text[]))`,
      ]) {
        try {
          await pool.query(childSql, [orgIds]);
        } catch {
          // A child table absent from this schema revision is not an error —
          // the parent delete below still governs correctness, and the residue
          // assertion at the end is what actually gates cleanliness.
        }
      }

      await pool.query(`DELETE FROM initiatives WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM projects WHERE id = ANY($1::text[])`, [
        [projectA, projectA2, projectB],
      ]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
        [ownerUserA, noRoleUserA, userB],
      ]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);

      // Direct DB count, per the "cleanup" gate requirement: prove zero
      // residue, not just "the delete statements ran".
      const residue = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM initiatives WHERE organization_id = ANY($1::text[])) AS inits,
           (SELECT COUNT(*)::int FROM organizations WHERE id = ANY($1::text[])) AS orgs,
           (SELECT COUNT(*)::int FROM users WHERE id = ANY($2::text[])) AS users`,
        [
          [orgA, orgB],
          [ownerUserA, noRoleUserA, userB],
        ]
      );
      if (
        residue.rows[0].inits !== 0 ||
        residue.rows[0].orgs !== 0 ||
        residue.rows[0].users !== 0
      ) {
        throw new Error(
          `INI005_SHARED_DB cleanup left residue: ${JSON.stringify(residue.rows[0])}`
        );
      }
    } else {
      for (const table of [
        'task_allocations',
        'tasks',
        'audit_events',
        'initiative_history',
        'initiative_milestones',
        'initiative_dependencies',
        'initiative_resources',
        'initiatives',
        'projects',
        'users',
        'organizations',
      ]) {
        await pool.query(`DROP TABLE IF EXISTS ${table}`);
      }
    }
    await pool.end();
  });

  // Fresh initiative per test group, owned by ownerUserA (INITIATIVE_OWNER
  // via owner_execution_id) so `assertCanEditInitiative` grants edit
  // capability through the real INI-04 resolver, and denies it for
  // `noRoleUserA` (a real user in the same org with no owner/sponsor/RACI
  // role on this specific initiative).
  async function seedInitiative(
    overrides: Partial<{ organization_id: string; project_id: string | null; status: string }> = {}
  ) {
    const id = `init-${randomUUID()}`;
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, project_id, status, name, owner_execution_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        overrides.organization_id ?? orgA,
        overrides.project_id ?? null,
        overrides.status ?? 'DRAFT',
        'INI-05 pg-test initiative',
        ownerUserA,
      ]
    );
    return id;
  }

  describe('Portfolio — membership assignment', () => {
    it('owner can move an initiative to another in-org project; membership survives a fresh read-back', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });

      const res = await call(InitiativeController.moveInitiative, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { targetProjectId: projectA2 },
      });
      expect(res.statusCode).toBe(200);

      const row = await pool.query(`SELECT project_id FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(row.rows[0].project_id).toBe(projectA2);
    });

    it('permission deny: a user with no owner/sponsor/RACI role on the initiative cannot move it', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });

      const res = await call(InitiativeController.moveInitiative, {
        user: { id: noRoleUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { targetProjectId: projectA2 },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('CAPABILITY_REQUIRED');

      const row = await pool.query(`SELECT project_id FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(row.rows[0].project_id).toBe(projectA); // unchanged
    });

    it('cross-tenant deny: cannot move an initiative into a project belonging to another organization', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });

      const res = await call(InitiativeController.moveInitiative, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { targetProjectId: projectB },
      });
      expect(res.statusCode).toBe(404);

      const row = await pool.query(`SELECT project_id FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(row.rows[0].project_id).toBe(projectA);
    });

    it('terminal-status freeze: a DONE/ARCHIVED initiative cannot be moved even by its owner', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA, status: 'ARCHIVED' });

      const res = await call(InitiativeController.moveInitiative, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { targetProjectId: projectA2 },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('INITIATIVE_TERMINAL_STATUS_FROZEN');
    });

    it('canonical resource/capacity rollup: the portfolio read model reflects the SAME allocation total the resource writer just committed', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });

      // Two resources, 60% + 90% — single canonical source is
      // syncInitiativeCapacity (staffingPlanService.ts), fired by the same
      // capability/tenant/CAS-gated addResource this packet hardened.
      await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', name: 'Ada', allocationPercentage: 60 },
      });
      await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', name: 'Grace', allocationPercentage: 90 },
      });

      const { initiatives } = await getPortfolioRead(orgA, {});
      const row = initiatives.find((i: any) => i.id === initiativeId) as any;
      expect(row.allocatedCapacityFte).toBeCloseTo(1.5, 5);
    });
  });

  describe('Resources — allocation CRUD, tenant scope, CAS', () => {
    it('addResource denies a userId belonging to another organization', async () => {
      const initiativeId = await seedInitiative();

      const res = await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', userId: userB, allocationPercentage: 50 },
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('CROSS_TENANT_ASSIGNMENT_DENIED');

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM initiative_resources WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(count.rows[0].c).toBe(0);
    });

    it('permission deny: a no-role user cannot add a resource', async () => {
      const initiativeId = await seedInitiative();
      const res = await call(InitiativeController.addResource, {
        user: { id: noRoleUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', allocationPercentage: 50 },
      });
      expect(res.statusCode).toBe(403);
    });

    it('create → CAS update (matching version succeeds, stale version 409) → fresh read-back → delete leaves no orphan', async () => {
      const initiativeId = await seedInitiative();

      const created = await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', name: 'Ada', allocationPercentage: 50 },
      });
      expect(created.statusCode).toBe(201);
      const resourceId = created.body.resource.id;

      // Fresh read-back: version starts at 1.
      const afterCreate = await call(InitiativeController.getResources, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
      });
      expect(afterCreate.body.resources).toHaveLength(1);
      expect(afterCreate.body.resources[0].version).toBe(1);

      // CAS update with the CORRECT version succeeds and bumps the version.
      const updateOk = await call(InitiativeController.updateResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId, resourceId },
        body: { allocationPercentage: 75, expectedVersion: 1 },
      });
      expect(updateOk.statusCode).toBe(200);
      expect(updateOk.body.version).toBe(2);

      // Same stale expectedVersion=1 again → 409, value NOT applied.
      const staleUpdate = await call(InitiativeController.updateResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId, resourceId },
        body: { allocationPercentage: 99, expectedVersion: 1 },
      });
      expect(staleUpdate.statusCode).toBe(409);
      expect(staleUpdate.body.code).toBe('RESOURCE_VERSION_CONFLICT');
      expect(staleUpdate.body.currentVersion).toBe(2);

      const afterStale = await pool.query(
        `SELECT allocation_percentage, version FROM initiative_resources WHERE id = $1`,
        [resourceId]
      );
      expect(afterStale.rows[0].allocation_percentage).toBe(75); // the 409 write never landed
      expect(afterStale.rows[0].version).toBe(2);

      // Delete, then confirm no active orphan row remains.
      const del = await call(InitiativeController.deleteResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId, resourceId },
      });
      expect(del.statusCode).toBe(200);
      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS c FROM initiative_resources WHERE id = $1`,
        [resourceId]
      );
      expect(remaining.rows[0].c).toBe(0);
    });

    it('5-way concurrent update race on the SAME expectedVersion: exactly one wins, four get 409, final version is exactly +1', async () => {
      const initiativeId = await seedInitiative();
      const created = await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', name: 'Race', allocationPercentage: 10 },
      });
      const resourceId = created.body.resource.id;

      const attempts = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          call(InitiativeController.updateResource, {
            user: { id: ownerUserA, organizationId: orgA, role: 'user' },
            params: { id: initiativeId, resourceId },
            body: { allocationPercentage: 20 + i, expectedVersion: 1 },
          })
        )
      );

      const succeeded = attempts.filter((r) => r.statusCode === 200);
      const conflicted = attempts.filter((r) => r.statusCode === 409);
      expect(succeeded).toHaveLength(1);
      expect(conflicted).toHaveLength(4);
      expect(conflicted.every((r) => r.body.code === 'RESOURCE_VERSION_CONFLICT')).toBe(true);

      // No double-counting: exactly one row, version incremented exactly once.
      const final = await pool.query(
        `SELECT COUNT(*)::int AS c, MAX(version) AS v FROM initiative_resources WHERE id = $1`,
        [resourceId]
      );
      expect(final.rows[0].c).toBe(1);
      expect(Number(final.rows[0].v)).toBe(2);
    });
  });

  describe('Roadmap — dependencies + milestones', () => {
    it('createPortfolioDependency denies a toInitiativeId belonging to another organization', async () => {
      const fromId = await seedInitiative();
      const foreignId = await seedInitiative({ organization_id: orgB });

      const res = await call(InitiativeController.createPortfolioDependency, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        body: { fromInitiativeId: fromId, toInitiativeId: foreignId },
      });
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('CROSS_TENANT_DEPENDENCY_DENIED');

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM initiative_dependencies WHERE from_initiative_id = $1`,
        [fromId]
      );
      expect(count.rows[0].c).toBe(0);
    });

    it('rejects a dependency that would form a cycle (A→B, then B→A)', async () => {
      const a = await seedInitiative();
      const b = await seedInitiative();

      const ab = await call(InitiativeController.createPortfolioDependency, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        body: { fromInitiativeId: a, toInitiativeId: b },
      });
      expect(ab.statusCode).toBe(201);

      const ba = await call(InitiativeController.createPortfolioDependency, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        body: { fromInitiativeId: b, toInitiativeId: a },
      });
      expect(ba.statusCode).toBe(400);
      expect(ba.body.rule).toBe('DEPENDENCY_CYCLE_DETECTED');
    });

    it('create → fresh read-back → delete, with permission deny for a no-role user', async () => {
      const a = await seedInitiative();
      const b = await seedInitiative();

      const deny = await call(InitiativeController.createPortfolioDependency, {
        user: { id: noRoleUserA, organizationId: orgA, role: 'user' },
        body: { fromInitiativeId: a, toInitiativeId: b },
      });
      expect(deny.statusCode).toBe(403);

      const created = await call(InitiativeController.createPortfolioDependency, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        body: { fromInitiativeId: a, toInitiativeId: b },
      });
      expect(created.statusCode).toBe(201);
      const depId = created.body.dependency.id;

      const listed = await call(InitiativeController.getPortfolioDependencies, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
      });
      expect((listed.body.dependencies || listed.body).some((d: any) => d.id === depId)).toBe(true);

      const del = await call(InitiativeController.deletePortfolioDependency, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: depId },
      });
      expect(del.statusCode).toBe(200);

      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS c FROM initiative_dependencies WHERE id = $1`,
        [depId]
      );
      expect(remaining.rows[0].c).toBe(0);
    });

    it('milestone create→update→delete: audited, capability-gated, fresh read-back matches saved values (not a legacy/stale value)', async () => {
      const initiativeId = await seedInitiative();

      const deny = await call(InitiativeController.createMilestone, {
        user: { id: noRoleUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { name: 'Should be denied' },
      });
      expect(deny.statusCode).toBe(403);

      const created = await call(InitiativeController.createMilestone, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { name: 'Kickoff', targetDate: '2026-09-01' },
      });
      expect(created.statusCode).toBe(201);
      const milestoneId = created.body.milestone.id;

      const updated = await call(InitiativeController.updateMilestone, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId, milestoneId },
        body: { targetDate: '2026-10-15', status: 'IN_PROGRESS' },
      });
      expect(updated.statusCode).toBe(200);

      // Fresh read-back must reflect exactly what was just saved (the
      // contract: "Timeline nie może pokazywać legacy wartości innych niż
      // zapisane") — not the original create-time value.
      const listed = await call(InitiativeController.getMilestones, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
      });
      const row = listed.body.milestones.find((m: any) => m.id === milestoneId);
      // node-pg returns a DATE column as a JS Date at LOCAL midnight, not a
      // string — `.toISOString()` (UTC) can push the day back a day
      // depending on the runner's timezone (documented FIN-005 pitfall).
      // Use local getters instead.
      const targetDate = new Date(row.targetDate);
      const localDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      expect(localDateStr).toBe('2026-10-15');
      expect(row.status).toBe('IN_PROGRESS');

      // Audit trail exists for both the create and the update.
      const auditRows = await pool.query(
        `SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY ts`,
        [milestoneId]
      );
      expect(auditRows.rows.map((r) => r.action)).toEqual([
        'initiative.milestone.created',
        'initiative.milestone.updated',
      ]);

      const del = await call(InitiativeController.deleteMilestone, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId, milestoneId },
      });
      expect(del.statusCode).toBe(200);
      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS c FROM initiative_milestones WHERE id = $1`,
        [milestoneId]
      );
      expect(remaining.rows[0].c).toBe(0);
    });
  });

  describe('Hard reload / reopen — durable read-back after a fresh GET', () => {
    it('portfolio membership, a resource, and a milestone all survive a simulated hard reload (independent fresh reads)', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });

      await call(InitiativeController.moveInitiative, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { targetProjectId: projectA2 },
      });
      const resource = await call(InitiativeController.addResource, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { role: 'member', name: 'Reload check', allocationPercentage: 40 },
      });
      const milestone = await call(InitiativeController.createMilestone, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
        body: { name: 'Reload milestone' },
      });

      // "Hard reload" = brand-new, independent GETs with no shared in-memory
      // state from the writes above.
      const projectRow = await pool.query(`SELECT project_id FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(projectRow.rows[0].project_id).toBe(projectA2);

      const resourcesAfterReload = await call(InitiativeController.getResources, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
      });
      expect(
        resourcesAfterReload.body.resources.some((r: any) => r.id === resource.body.resource.id)
      ).toBe(true);

      const milestonesAfterReload = await call(InitiativeController.getMilestones, {
        user: { id: ownerUserA, organizationId: orgA, role: 'user' },
        params: { id: initiativeId },
      });
      expect(
        milestonesAfterReload.body.milestones.some((m: any) => m.id === milestone.body.milestone.id)
      ).toBe(true);
    });
  });

  describe('Timeline + Capacity — deterministic real-PG cold readback', () => {
    it('uses the persisted initiative anchor and shared capacity policy across repeated reads', async () => {
      const initiativeId = await seedInitiative({ project_id: projectA });
      await pool.query(`UPDATE initiatives SET created_at = '2026-08-12T10:00:00Z' WHERE id = $1`, [
        initiativeId,
      ]);
      const resourceId = `resource-${randomUUID()}`;
      await pool.query(
        `INSERT INTO initiative_resources
           (id, initiative_id, organization_id, user_id, role, allocation_percentage)
         VALUES ($1,$2,$3,$4,'member',100)`,
        [resourceId, initiativeId, orgA, ownerUserA]
      );
      const taskId = `task-${randomUUID()}`;
      await pool.query(
        `INSERT INTO tasks
           (id, organization_id, project_id, initiative_id, assignee_id, estimated_hours, status)
         VALUES ($1,$2,$3,$4,$5,24,'todo')`,
        [taskId, orgA, projectA, initiativeId, ownerUserA]
      );
      await pool.query(
        `INSERT INTO task_allocations (id, task_id, organization_id, week_start, allocated_hours)
         VALUES ($1,$2,$3,'2026-08-10',24)`,
        [`allocation-${randomUUID()}`, taskId, orgA]
      );

      const firstTimeline = await getCapacityTimeline(orgA, initiativeId);
      const firstCapacity = await getInitiativeCapacity(orgA, initiativeId);
      const coldTimeline = await getCapacityTimeline(orgA, initiativeId);
      const coldCapacity = await getInitiativeCapacity(orgA, initiativeId);

      expect(coldTimeline).toEqual(firstTimeline);
      expect(coldCapacity).toEqual(firstCapacity);
      expect(firstTimeline).toHaveLength(12);
      expect(firstTimeline[0]).toEqual({
        weekStart: '2026-08-10',
        totalCapacity: 40,
        totalAllocated: 24,
        utilizationPercent: 60,
      });
      expect(firstCapacity.resources[0]).toMatchObject({
        userId: ownerUserA,
        allocationPercent: 100,
        allocatedHours: 24,
      });
    });
  });
});
