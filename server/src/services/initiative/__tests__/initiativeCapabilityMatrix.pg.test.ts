/**
 * INI-04 — real-PostgreSQL test for the capability matrix's I/O helpers.
 *
 * The mocked-DB unit tests (`initiativeCapabilityMatrix.test.ts`) pin the
 * BEHAVIOR of `assertUsersInOrganization` and `readInitiativeRaciRoles`
 * against a stubbed `queryHelpers`. This file proves the SQL itself is
 * correct against a real PostgreSQL — quoted aliases, the three-way JOIN
 * tenant scope on the RACI read, and the org-scoped user lookup — through
 * the app's REAL `getDatabase()` → `queryHelpers` path, not a mock.
 *
 * WHY THIS MATTERS: the FIN-005 packet (2026-08-01, see project memory)
 * found that `NODE_ENV=test` without `RUN_DB_TESTS=1` silently mocks the DB —
 * a script can "pass" while writing nothing. This file follows the SAME
 * env-var contract the FIN-005 pg tests established specifically to avoid
 * that trap, and skips (not silently passes) when no real DB is reachable.
 *
 * HOW TO RUN
 * ----------
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/ini004 \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/initiative/__tests__/initiativeCapabilityMatrix.pg.test.ts \
 *     --no-file-parallelism
 *
 * Without that env combination the whole suite is SKIPPED (describe.skipIf),
 * never silently green.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// `server/vitest.config.ts` forces `DB_TYPE: 'sqlite'` via `test.env` for every
// suite (legacy default), which wins over whatever the shell/operator passed —
// exactly the trap the FIN-005 packet's runner script works around by driving
// `pg` directly instead of the app's DB layer. This file's LAST assertion
// exercises the real `getDatabase()` → `queryHelpers` path on purpose (proving
// the exported functions run unmodified against Postgres), so it needs
// `DB_TYPE` corrected back to `postgres` before that layer is first touched —
// done here, at module top level, before any queryHelpers import.
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('INI-04 capability matrix — real PostgreSQL', () => {
  let queryHelpers: typeof import('../../../utils/queryHelpers.js');
  let matrix: typeof import('../initiativeCapabilityMatrix.js');
  let Pool: typeof import('pg').Pool;
  let pool: InstanceType<typeof import('pg').Pool>;

  const orgA = `org-a-${randomUUID()}`;
  const orgB = `org-b-${randomUUID()}`;
  const userInOrgA = `user-a-${randomUUID()}`;
  const userInOrgB = `user-b-${randomUUID()}`;
  const initiativeId = `init-${randomUUID()}`;

  beforeAll(async () => {
    ({ Pool } = await import('pg'));
    pool = new Pool({ connectionString: CONNECTION_STRING });

    // Minimal, self-contained schema — just the columns
    // `initiativeCapabilityMatrix.ts` actually reads. This test owns its
    // tables (fresh, prefixed names) so it never collides with the app's
    // full migration set on a shared database.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ini04_users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ini04_initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ini04_initiative_stakeholders (
        id TEXT PRIMARY KEY,
        initiative_id TEXT NOT NULL,
        user_id TEXT,
        raci_type TEXT
      );
    `);

    await pool.query(`INSERT INTO ini04_users (id, organization_id) VALUES ($1, $2)`, [
      userInOrgA,
      orgA,
    ]);
    await pool.query(`INSERT INTO ini04_users (id, organization_id) VALUES ($1, $2)`, [
      userInOrgB,
      orgB,
    ]);
    await pool.query(`INSERT INTO ini04_initiatives (id, organization_id) VALUES ($1, $2)`, [
      initiativeId,
      orgA,
    ]);
    await pool.query(
      `INSERT INTO ini04_initiative_stakeholders (id, initiative_id, user_id, raci_type)
       VALUES ($1, $2, $3, 'A')`,
      [randomUUID(), initiativeId, userInOrgA]
    );
    // Cross-tenant leftover row: a stakeholder entry that points at an org-B
    // user on an org-A initiative. This is exactly the "role already exists
    // from before the write guard" scenario the module doc calls out — it
    // must grant NOTHING when read back.
    await pool.query(
      `INSERT INTO ini04_initiative_stakeholders (id, initiative_id, user_id, raci_type)
       VALUES ($1, $2, $3, 'A')`,
      [randomUUID(), initiativeId, userInOrgB]
    );

    // Import the REAL app modules only after env vars are set — Database.ts /
    // DatabaseConfig.ts read process.env at module-load time.
    queryHelpers = await import('../../../utils/queryHelpers.js');
    matrix = await import('../initiativeCapabilityMatrix.js');
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP TABLE IF EXISTS ini04_initiative_stakeholders`);
      await pool.query(`DROP TABLE IF EXISTS ini04_initiatives`);
      await pool.query(`DROP TABLE IF EXISTS ini04_users`);
      await pool.end();
    }
  });

  it('assertUsersInOrganization: real SELECT against the users table allows an in-tenant user', async () => {
    const row = await queryHelpers.queryOne(
      `SELECT id FROM ini04_users WHERE id = ? AND organization_id = ?`,
      [userInOrgA, orgA]
    );
    expect(row).toBeTruthy();
  });

  it('assertUsersInOrganization: DENIES a cross-tenant user id on real Postgres', async () => {
    // Exercises the exact query shape `assertUsersInOrganization` runs,
    // against the app's real users table name/columns substituted for the
    // scoped ini04_users fixture (same SELECT id FROM <table> WHERE id = ? AND
    // organization_id = ? contract).
    const row = await queryHelpers.queryOne(
      `SELECT id FROM ini04_users WHERE id = ? AND organization_id = ?`,
      [userInOrgB, orgA]
    );
    expect(row).toBeNull();
  });

  it('readInitiativeRaciRoles-equivalent JOIN: three-way tenant scope excludes the cross-tenant stakeholder row on real Postgres', async () => {
    // Same JOIN shape as `readInitiativeRaciRoles` (initiative_stakeholders →
    // initiatives → users, all org-scoped), against the ini04_* fixture
    // tables, proving the query text itself is valid Postgres SQL and that
    // the three-way join actually filters out the leftover cross-tenant row
    // rather than silently returning it.
    const rows = await queryHelpers.queryAll(
      `SELECT s.raci_type as "raciType"
         FROM ini04_initiative_stakeholders s
         JOIN ini04_initiatives i ON i.id = s.initiative_id
         JOIN ini04_users u ON u.id = s.user_id
        WHERE s.initiative_id = ?
          AND s.user_id = ?
          AND i.organization_id = ?
          AND u.organization_id = ?`,
      [initiativeId, userInOrgA, orgA, orgA]
    );
    expect(rows).toEqual([{ raciType: 'A' }]);

    const crossTenantRows = await queryHelpers.queryAll(
      `SELECT s.raci_type as "raciType"
         FROM ini04_initiative_stakeholders s
         JOIN ini04_initiatives i ON i.id = s.initiative_id
         JOIN ini04_users u ON u.id = s.user_id
        WHERE s.initiative_id = ?
          AND s.user_id = ?
          AND i.organization_id = ?
          AND u.organization_id = ?`,
      [initiativeId, userInOrgB, orgA, orgA]
    );
    expect(crossTenantRows).toEqual([]);
  });

  it('full round-trip through the REAL exported functions against real Postgres users/initiatives (production table names)', async () => {
    // `assertUsersInOrganization` and `readInitiativeRaciRoles` hard-code the
    // production table names (`users`, `initiatives`, `initiative_stakeholders`).
    // Create those tables for real (minimal columns) so the exported
    // functions run completely unmodified against this database.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS initiative_stakeholders (
        id TEXT PRIMARY KEY,
        initiative_id TEXT NOT NULL,
        user_id TEXT,
        raci_type TEXT
      );
    `);
    try {
      // The organizations must exist BEFORE the users that reference them.
      //
      // The `CREATE TABLE IF NOT EXISTS users (...)` above is a no-op against
      // the real migrated schema, where `users.organization_id` carries
      // `users_organization_id_fkey`. Inserting a user for an organization
      // that was never created therefore failed with 23503. It only ever
      // "worked" where that foreign key did not exist — the failure is
      // evidence the constraint is now real, not a reason to remove it.
      // Both ids are fresh random UUIDs, so these rows collide with nothing.
      await pool.query(
        `INSERT INTO organizations (id) VALUES ($1), ($2) ON CONFLICT (id) DO NOTHING`,
        [orgA, orgB]
      );

      await pool.query(`INSERT INTO users (id, organization_id) VALUES ($1, $2)`, [
        userInOrgA,
        orgA,
      ]);
      await pool.query(`INSERT INTO users (id, organization_id) VALUES ($1, $2)`, [
        userInOrgB,
        orgB,
      ]);
      // The real schema constrains this row in ways the minimal
      // `CREATE TABLE IF NOT EXISTS initiatives (id, organization_id)` above
      // cannot express — that statement is a no-op against it. `name` is NOT
      // NULL, and `status` carries `initiatives_status_check`, whose column
      // default ('step3') is itself not an accepted value. Both are supplied
      // explicitly rather than assumed away; 'DRAFT' is the lifecycle entry
      // state and is irrelevant to what this suite asserts (tenant scoping).
      await pool.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
        [initiativeId, orgA, 'INI-04 capability matrix fixture', 'DRAFT']
      );
      await pool.query(
        `INSERT INTO initiative_stakeholders (id, initiative_id, user_id, raci_type) VALUES ($1, $2, $3, 'A')`,
        [randomUUID(), initiativeId, userInOrgA]
      );
      await pool.query(
        `INSERT INTO initiative_stakeholders (id, initiative_id, user_id, raci_type) VALUES ($1, $2, $3, 'A')`,
        [randomUUID(), initiativeId, userInOrgB]
      );

      const okVerdict = await matrix.assertUsersInOrganization(orgA, [userInOrgA]);
      expect(okVerdict).toEqual({ ok: true, offending: [] });

      const deniedVerdict = await matrix.assertUsersInOrganization(orgA, [userInOrgB]);
      expect(deniedVerdict).toEqual({ ok: false, offending: [userInOrgB] });

      const raciInTenant = await matrix.readInitiativeRaciRoles(orgA, initiativeId, userInOrgA);
      expect(raciInTenant).toEqual([matrix.RACI_ROLE_TOKENS.A]);

      // The cross-tenant stakeholder row exists in the table (pre-existing
      // leftover scenario) but must grant NOTHING when read back for a
      // cross-tenant actor.
      const raciCrossTenant = await matrix.readInitiativeRaciRoles(orgA, initiativeId, userInOrgB);
      expect(raciCrossTenant).toEqual([]);
    } finally {
      // Reverse dependency order: children, then users, then the organizations
      // they point at. No CASCADE, no constraint juggling — just the correct
      // order, so nothing this file created is left behind for another file
      // to trip over.
      await pool.query(`DELETE FROM initiative_stakeholders WHERE initiative_id = $1`, [
        initiativeId,
      ]);
      await pool.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeId]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[userInOrgA, userInOrgB]]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    }
  });
});
