/**
 * FLOW-TRANSFORM-MVP-001 — deterministic, multi-tenant fixture for the
 * cross-module transformation flow (CROSS-FLOW-QUALIFICATION lane).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every prior proof of this flow was a single-module slice with its own ad-hoc
 * setup, so no two slices ever shared one lineage and "the whole flow works"
 * was never testable. This module owns ONE tenant/actor/lineage fixture that
 * all cross-flow suites reuse, so a receipt produced in Execution can be traced
 * back to the very same organization + actor that started in Chat.
 *
 * HARD RULES THIS FILE ENCODES (each one is a trap this repo has already paid for)
 * ------------------------------------------------------------------------------
 * 1. JWT secret is pinned at IMPORT TIME, before any `server/src/*` module can
 *    load `Config.ts` and compute a different deterministic default. Mirrors
 *    `tests/acceptance/harness.ts:49-54`. Import this file FIRST in every suite.
 * 2. Real JWT, real `verifyToken`, real routers — no auth mock, no `E2E_MODE`,
 *    no `MOCK_AUTH`. A test that bypasses auth proves nothing about tenancy.
 * 3. `NODE_ENV=test` ALONE substitutes a mock database
 *    (`server/src/database/Database.ts`), so the required trio is
 *    `NODE_ENV=test` + `RUN_DB_TESTS=1` + `MOCK_DB=false`. Set here, not left
 *    to the caller's shell.
 * 4. Deterministic IDs — every identifier derives from a seeded counter, never
 *    from `Date.now()` / `randomUUID()`, so a rerun on a fresh database
 *    produces byte-identical rows and a diff is meaningful.
 * 5. Cold readback uses a SEPARATE pg client the suite opens after the writer
 *    closed, so an in-process cache cannot masquerade as durability.
 */
import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import pg from 'pg';

// ---------------------------------------------------------------------------
// (1) Environment pin — MUST run before any server module is imported.
// ---------------------------------------------------------------------------
const PINNED_JWT_SECRET = 'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = PINNED_JWT_SECRET;

process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.RUN_DB_TESTS = '1';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

/** Deterministic, collision-proof prefix for every row this lane creates. */
export const CF = 'cfq-';

// ---------------------------------------------------------------------------
// (2) Deterministic identity generation
// ---------------------------------------------------------------------------
/**
 * Stable ID derived from a semantic path, not from a counter or clock: the same
 * logical object always gets the same id across runs AND across suites, which
 * is what makes one lineage assertable end to end. Truncated sha256 keeps it
 * inside the `text` id columns without needing uuid formatting.
 */
export function cfId(...parts: Array<string | number>): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${CF}${parts[0]}-${digest.slice(0, 24)}`;
}

/** Deterministic UUID-shaped id, for columns with a uuid type or format check. */
export function cfUuid(...parts: Array<string | number>): string {
  const h = createHash('sha256').update(`cfq|${parts.join('|')}`).digest('hex');
  // RFC-4122 v4 shape (version nibble 4, variant nibble 8) so format checks pass.
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

/** Fixed instant — nothing in the fixture may read the wall clock. */
export const CF_EPOCH = new Date('2026-08-17T00:00:00.000Z');

// ---------------------------------------------------------------------------
// (3) Tenants and actors
// ---------------------------------------------------------------------------
export type CfRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface CfActor {
  id: string;
  email: string;
  role: CfRole;
  organizationId: string;
}

export interface CfTenant {
  id: string;
  name: string;
  owner: CfActor;
  admin: CfActor;
  member: CfActor;
}

function buildTenant(slug: string, name: string): CfTenant {
  const orgId = cfId('org', slug);
  const actor = (role: CfRole): CfActor => ({
    id: cfId('user', slug, role),
    email: `${slug}.${role.toLowerCase()}@crossflow.local`,
    role,
    organizationId: orgId,
  });
  return {
    id: orgId,
    name,
    owner: actor('OWNER'),
    admin: actor('ADMIN'),
    member: actor('MEMBER'),
  };
}

/** Primary tenant — the whole positive flow runs here. */
export const TENANT_A = buildTenant('alpha', 'Crossflow Alpha Sp. z o.o.');
/** Second tenant — exists only to prove denial without existence leakage. */
export const TENANT_B = buildTenant('beta', 'Crossflow Beta Sp. z o.o.');

export const ALL_TENANTS = [TENANT_A, TENANT_B];
export const ALL_ACTORS = ALL_TENANTS.flatMap((t) => [t.owner, t.admin, t.member]);

// ---------------------------------------------------------------------------
// (4) Real JWT
// ---------------------------------------------------------------------------
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      `crossflow fixture: JWT_SECRET missing or <32 chars (${secret?.length ?? 0}) at mint time. ` +
        'Something overwrote it after this module loaded — import flowFixture.ts FIRST, before ' +
        'any server/src/* import.'
    );
  }
  return secret;
}

/**
 * Mints a token carrying exactly the claims `auth.middleware.attachUser()`
 * reads. Both spellings of the org claim are supplied because different
 * routers read different ones.
 */
export function mintToken(actor: CfActor, overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      id: actor.id,
      email: actor.email,
      organizationId: actor.organizationId,
      organization_id: actor.organizationId,
      role: actor.role,
      ...overrides,
    },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

export function bearer(actor: CfActor): string {
  return `Bearer ${mintToken(actor)}`;
}

// ---------------------------------------------------------------------------
// (5) Database access
// ---------------------------------------------------------------------------
export function requireDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.IE_TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `crossflow fixture requires a LOCAL disposable DATABASE_URL. Got: ${url || '(unset)'}`
    );
  }
  return url;
}

export function newClient(): pg.Client {
  return new pg.Client({ connectionString: requireDbUrl(), statement_timeout: 30_000 });
}

/**
 * COLD READBACK. Opens a brand-new client (new TCP connection, new backend
 * process, nothing shared with the writer's pool), runs `fn`, then closes it.
 * Any value that survives this genuinely came from disk, not from an
 * in-process map, a memoized service singleton or a warm pool's session state.
 */
export async function coldRead<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = newClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** True when a disposable local Postgres is actually reachable. */
export async function dbReachable(): Promise<boolean> {
  let client: pg.Client | null = null;
  try {
    client = newClient();
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client?.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// (6) Seeding and teardown
// ---------------------------------------------------------------------------
/**
 * Creates both tenants and their three actors each. Idempotent: safe to call
 * from several suites against the same database.
 *
 * `organization_members.role` is CHECK-constrained to
 * OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST — the three roles used here are the
 * ones the RBAC middleware actually distinguishes for maker/checker.
 */
export async function seedTenants(client: pg.Client): Promise<void> {
  for (const tenant of ALL_TENANTS) {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, created_at)
       VALUES ($1, $2, 'enterprise', 'active', $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [tenant.id, tenant.name, CF_EPOCH]
    );
  }

  for (const actor of ALL_ACTORS) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         email = EXCLUDED.email,
         role = EXCLUDED.role`,
      [
        actor.id,
        actor.organizationId,
        actor.email,
        'Crossflow',
        actor.role,
        actor.role,
        CF_EPOCH,
      ]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [cfId('member', actor.id), actor.organizationId, actor.id, actor.role, CF_EPOCH]
    );
  }
}

/**
 * Deletes every row this lane created, in FK-safe order, and returns the
 * per-table delete counts so a suite can assert ZERO residue instead of
 * trusting that cleanup ran. Unknown/absent tables are skipped rather than
 * failing — the table list is a superset covering all cross-flow segments.
 */
export async function purgeFixture(
  client: pg.Client,
  tables: string[]
): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  for (const table of tables) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    if (exists.rowCount === 0) continue;

    const orgCol = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
          AND column_name IN ('organization_id','org_id','tenant_id')
        ORDER BY column_name LIMIT 1`,
      [table]
    );
    if (orgCol.rowCount === 0) continue;

    const col = orgCol.rows[0].column_name as string;
    const res = await client.query(
      `DELETE FROM "${table}" WHERE "${col}" = ANY($1::text[])`,
      [ALL_TENANTS.map((t) => t.id)]
    );
    deleted[table] = res.rowCount ?? 0;
  }
  return deleted;
}

/** Final teardown of tenants/actors themselves. Call after `purgeFixture`. */
export async function dropTenants(client: pg.Client): Promise<void> {
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
    ALL_TENANTS.map((t) => t.id),
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [ALL_ACTORS.map((a) => a.id)]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
    ALL_TENANTS.map((t) => t.id),
  ]);
}

// ---------------------------------------------------------------------------
// (7) Assertion helpers shared across the 15 segments
// ---------------------------------------------------------------------------
/**
 * Runs `n` copies of `op` truly concurrently and reports an EXACT denominator:
 * how many attempts were made, how many succeeded, how many were rejected and
 * why. A concurrency claim without this breakdown is unfalsifiable.
 */
export async function raceExactly<T>(
  n: number,
  op: (attempt: number) => Promise<T>
): Promise<{ attempts: number; fulfilled: T[]; rejected: string[] }> {
  const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => op(i)));
  return {
    attempts: n,
    fulfilled: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    rejected: results.flatMap((r) =>
      r.status === 'rejected' ? [String((r.reason as Error)?.message ?? r.reason)] : []
    ),
  };
}

/**
 * Cross-tenant denial must not leak existence: a foreign object has to look
 * exactly like a nonexistent one. Returns the pair of statuses so the suite can
 * assert equality rather than merely "not 200".
 */
export function existenceLeak(foreignStatus: number, nonexistentStatus: number): boolean {
  return foreignStatus !== nonexistentStatus;
}
