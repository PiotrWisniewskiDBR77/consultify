/**
 * Cross-flow Runtime Build — shared fixture for packages A–E.
 *
 * One tenancy/actor/lineage fixture reused by every package, so a receipt written
 * by a consumer in package C can be traced to the same organization and actor a
 * package-A respondent started from.
 *
 * TRAPS THIS FILE ENCODES (each one has already cost this repo real time)
 * ----------------------------------------------------------------------
 * 1. JWT secret is pinned at IMPORT TIME, before any `server/src/*` module can
 *    load Config.ts and compute a different deterministic default. Import this
 *    module FIRST in every suite.
 * 2. `NODE_ENV=test` ALONE substitutes a mock database; the required trio is
 *    NODE_ENV=test + RUN_DB_TESTS=1 + MOCK_DB=false. Set here, not left to the shell.
 * 3. `E2E_MODE` is explicitly DELETED here. Under E2E_MODE the auth middleware
 *    accepts an unsigned `{alg:'none'}` token, skips signature and revocation
 *    checks and auto-seeds organization membership — every RBAC/tenant claim made
 *    under it is a claim about the bypass, not about production auth. G4 forbids it.
 * 4. Deterministic IDs derived from a semantic path, never from a clock or RNG,
 *    so a rerun on a fresh database produces identical rows.
 * 5. Cold readback opens a brand-new client so an in-process cache cannot
 *    masquerade as durability.
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

// G4: never prove auth under the bypass.
delete process.env.E2E_MODE;
delete process.env.ENABLE_TEST_AUTH_BYPASS;

export const CF = 'f2-';

// ---------------------------------------------------------------------------
// (2) Deterministic identity
// ---------------------------------------------------------------------------
export function cfId(...parts: Array<string | number>): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${CF}${parts[0]}-${digest.slice(0, 24)}`;
}

export function cfUuid(...parts: Array<string | number>): string {
  const h = createHash('sha256').update(`f2|${parts.join('|')}`).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

/** Fixed instant — nothing in the fixture reads the wall clock. */
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
    email: `${slug}.${role.toLowerCase()}@crossflow-runtime.local`,
    role,
    organizationId: orgId,
  });
  return { id: orgId, name, owner: actor('OWNER'), admin: actor('ADMIN'), member: actor('MEMBER') };
}

/** Primary tenant — the whole positive path runs here. */
export const TENANT_A = buildTenant('alpha', 'F2 Alpha Sp. z o.o.');
/** Second tenant — exists only to prove denial without existence leakage. */
export const TENANT_B = buildTenant('beta', 'F2 Beta Sp. z o.o.');

export const ALL_TENANTS = [TENANT_A, TENANT_B];
export const ALL_ACTORS = ALL_TENANTS.flatMap((t) => [t.owner, t.admin, t.member]);

// ---------------------------------------------------------------------------
// (4) Real signed JWT — G4
// ---------------------------------------------------------------------------
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      `runtime fixture: JWT_SECRET missing or <32 chars (${secret?.length ?? 0}) at mint time. ` +
        'Import runtimeFixture.ts FIRST, before any server/src/* import.'
    );
  }
  return secret;
}

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

/**
 * The forged token G4 forbids as evidence. Suites assert this is REJECTED, which
 * is what proves the run is not riding the bypass.
 */
export function forgedE2EToken(actor: CfActor): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    e2e: true,
    id: actor.id,
    email: actor.email,
    role: actor.role,
    organizationId: actor.organizationId,
    exp: Math.floor(Date.UTC(2030, 0, 1) / 1000),
  })}.e2e`;
}

// ---------------------------------------------------------------------------
// (5) Database access
// ---------------------------------------------------------------------------
export function requireDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.IE_TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `runtime fixture requires a LOCAL disposable DATABASE_URL. Got: ${url || '(unset)'}`
    );
  }
  return url;
}

export function newClient(): pg.Client {
  return new pg.Client({ connectionString: requireDbUrl(), statement_timeout: 30_000 });
}

/**
 * COLD READBACK — new TCP connection, new backend process, nothing shared with
 * the writer's pool. A value that survives this came from disk.
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

/**
 * Fail-closed harness guard. `RUN_DB_TESTS=1` is an explicit promise that a
 * database exists; if it then does not, that is a FAILURE. This repo has 33
 * realdb suites whose guard reports `expect(true).toBe(true)` — green with zero
 * assertions executed. G2 forbids that here.
 */
export async function requireDatabase(): Promise<void> {
  if (await dbReachable()) return;
  throw new Error(
    'RUN_DB_TESTS=1 but the disposable Postgres at DATABASE_URL is unreachable. ' +
      'Refusing to report a vacuous pass.'
  );
}

// ---------------------------------------------------------------------------
// (6) Seeding and teardown
// ---------------------------------------------------------------------------
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
       VALUES ($1, $2, $3, 'Crossflow', $4, $5, 'active', $6)
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, role = EXCLUDED.role`,
      [actor.id, actor.organizationId, actor.email, actor.role, actor.role, CF_EPOCH]
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
 * Deletes this lane's rows from the given tables, children first, and returns
 * per-table counts so a suite can assert ZERO residue instead of trusting that
 * cleanup ran. Missing tables and tables without an org column are skipped.
 */
export async function purge(
  client: pg.Client,
  orderedTables: string[]
): Promise<Record<string, number>> {
  const orgs = ALL_TENANTS.map((t) => t.id);
  const deleted: Record<string, number> = {};
  for (const table of orderedTables) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    if (exists.rowCount === 0) continue;
    const col = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
          AND column_name IN ('organization_id','org_id','tenant_id')
        ORDER BY column_name LIMIT 1`,
      [table]
    );
    if (col.rowCount === 0) continue;
    const res = await client
      .query(`DELETE FROM "${table}" WHERE "${col.rows[0].column_name}" = ANY($1::text[])`, [orgs])
      .catch(() => null);
    if (res) deleted[table] = res.rowCount ?? 0;
  }
  return deleted;
}

export async function dropTenants(client: pg.Client): Promise<void> {
  const orgs = ALL_TENANTS.map((t) => t.id);
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [orgs]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [ALL_ACTORS.map((a) => a.id)]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [orgs]);
}

// ---------------------------------------------------------------------------
// (7) Shared assertion helpers — G5
// ---------------------------------------------------------------------------
/**
 * Runs `n` copies of `op` concurrently and reports an EXACT denominator: how
 * many attempts, how many fulfilled, how many rejected and why. A concurrency
 * claim without this breakdown is unfalsifiable.
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

/** Canonical JSON so a content hash is stable across runs and key orderings. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = walk((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
