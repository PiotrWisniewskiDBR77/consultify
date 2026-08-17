/**
 * FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001 — fixture.
 *
 * Two tenants, three roles, real signed JWTs, deterministic ids, and cleanup
 * scoped to exactly the rows this fixture creates — with ONE deliberate
 * exception. The evidence ledger refuses UPDATE and DELETE unconditionally and
 * its parents are ON DELETE RESTRICT, so there is no scoped way to remove an
 * evidence row. Those rows go through TRUNCATE, which is DDL requiring table
 * ownership, and everything else is still removed by id.
 */
import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import pg from 'pg';

// Pin the secret before any server module can load Config.ts and compute a
// different deterministic default.
const PINNED_JWT_SECRET = 'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = PINNED_JWT_SECRET;

process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.RUN_DB_TESTS = '1';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

// Auth must be real. Under E2E_MODE the middleware accepts an unsigned token,
// skips signature and revocation checks and auto-seeds membership — every
// RBAC/tenant claim made under it would be a claim about the bypass.
delete process.env.E2E_MODE;
delete process.env.ENABLE_TEST_AUTH_BYPASS;

export const FX = 'fme-';

export function fxId(...parts: Array<string | number>): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${FX}${parts[0]}-${digest.slice(0, 24)}`;
}

export const FX_EPOCH = new Date('2026-08-17T00:00:00.000Z');

export type FxRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface FxActor {
  id: string;
  email: string;
  organizationId: string;
  role: FxRole;
}

export interface FxTenant {
  id: string;
  name: string;
  projectId: string;
  owner: FxActor;
  admin: FxActor;
  member: FxActor;
  /** Member whose organization_members row is revoked, not ACTIVE. */
  revoked: FxActor;
}

/**
 * Membership status is decided by identity, not by sniffing the id string.
 * `fxId` hashes its parts, so the tag "REVOKED" never appears in the produced
 * id — an `id.includes('REVOKED')` test silently marks everyone ACTIVE and made
 * the revoked-membership control pass for the wrong reason until this set
 * replaced it. Declared before `buildTenant` because that function populates it
 * at construction time.
 */
const REVOKED_ACTOR_IDS = new Set<string>();

function buildTenant(slug: string): FxTenant {
  const orgId = fxId('org', slug);
  const actor = (role: FxRole, tag = role): FxActor => ({
    id: fxId('user', slug, tag),
    email: `${slug}.${tag.toLowerCase()}@closure-evidence.local`,
    organizationId: orgId,
    role,
  });
  const built = {
    id: orgId,
    name: `Closure Evidence ${slug}`,
    projectId: fxId('project', slug),
    owner: actor('OWNER'),
    admin: actor('ADMIN'),
    member: actor('MEMBER'),
    revoked: actor('MEMBER', 'REVOKED'),
  };
  REVOKED_ACTOR_IDS.add(built.revoked.id);
  return built;
}

/**
 * Tenants are namespaced per suite.
 *
 * Two suites sharing one tenant set look harmless until teardown: the first
 * suite deletes the shared users and organizations while the second suite's
 * rows still reference them, the FK refuses, teardown dies half-done and the
 * next run starts from corrupted state. Worse here than usual, because some of
 * those references live in an IMMUTABLE table that can never be cleaned up.
 * Each suite gets its own namespace instead.
 */
export function buildTenantPair(scope: string): { a: FxTenant; b: FxTenant } {
  return { a: buildTenant(`${scope}-alpha`), b: buildTenant(`${scope}-beta`) };
}

export const TENANT_A = buildTenant('alpha');
export const TENANT_B = buildTenant('beta');
export const ALL_TENANTS = [TENANT_A, TENANT_B];
const actorsOf = (tenants: FxTenant[]) =>
  tenants.flatMap((t) => [t.owner, t.admin, t.member, t.revoked]);
const ALL_ACTORS = actorsOf(ALL_TENANTS);

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'evidenceFixture: JWT_SECRET missing or <32 chars at mint time — import this module first.'
    );
  }
  return secret;
}

export function bearer(actor: FxActor): string {
  return `Bearer ${jwt.sign(
    {
      id: actor.id,
      email: actor.email,
      organizationId: actor.organizationId,
      organization_id: actor.organizationId,
      role: actor.role,
    },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  )}`;
}

/** The token G4 forbids as proof of anything; suites assert it is REJECTED. */
export function forgedE2EBearer(actor: FxActor): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    e2e: true,
    id: actor.id,
    email: actor.email,
    role: actor.role,
    organizationId: actor.organizationId,
    exp: Math.floor(Date.UTC(2030, 0, 1) / 1000),
  })}.e2e`;
}

export function requireDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `evidenceFixture requires a LOCAL disposable DATABASE_URL. Got: ${url || '(unset)'}`
    );
  }
  return url;
}

export function newClient(): pg.Client {
  return new pg.Client({ connectionString: requireDbUrl(), statement_timeout: 30_000 });
}

/** New connection, new backend process — nothing shared with the writer. */
export async function coldRead<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = newClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** New Pool (not Client), for the "cold reopen through a different pool" gate. */
export async function coldPoolRead<T>(fn: (p: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: requireDbUrl(), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/**
 * Fail-closed. RUN_DB_TESTS=1 is a promise that a database exists; if it does
 * not, that is a failure, never a green skip.
 */
export async function requireDatabase(): Promise<void> {
  let client: pg.Client | null = null;
  try {
    client = newClient();
    await client.connect();
    await client.query('SELECT 1');
  } catch (error) {
    throw new Error(
      `RUN_DB_TESTS=1 but the disposable Postgres is unreachable (${String(error)}). ` +
        'Refusing to report a vacuous pass.'
    );
  } finally {
    await client?.end().catch(() => undefined);
  }
}

export async function seedTenants(
  client: pg.Client,
  tenants: FxTenant[] = ALL_TENANTS
): Promise<void> {
  for (const tenant of tenants) {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, created_at)
       VALUES ($1, $2, 'enterprise', 'active', $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [tenant.id, tenant.name, FX_EPOCH]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [tenant.projectId, tenant.id, `${tenant.name} project`]
    );
  }
  for (const actor of actorsOf(tenants)) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'Closure', $4, $5, 'active', $6)
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, role = EXCLUDED.role`,
      [actor.id, actor.organizationId, actor.email, actor.role, actor.role, FX_EPOCH]
    );
    const isRevoked = REVOKED_ACTOR_IDS.has(actor.id);
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = EXCLUDED.status`,
      [
        fxId('member', actor.id),
        actor.organizationId,
        actor.id,
        actor.role,
        isRevoked ? 'REVOKED' : 'ACTIVE',
        FX_EPOCH,
      ]
    );
  }
}

/**
 * EXACT-SCOPE cleanup, children first, restricted to the ids this fixture
 * created. Evidence is removed by deleting its closure request and letting the
 * declared cascade carry it — the same path the append-only guard deliberately
 * permits.
 */
export async function cleanupFixture(
  client: pg.Client,
  ids: {
    closureRequestIds: string[];
    initiativeIds: string[];
    meetingIds: string[];
    notebookPageIds: string[];
    toolOutputIds?: string[];
    methodOutputIds?: string[];
    /**
     * The tenants THIS suite owns. Defaults to the module-level pair for the
     * suites written against it; a suite using `buildTenantPair` must pass its
     * own, or cleanup deletes another namespace's users and leaves its own behind.
     */
    tenants?: FxTenant[];
    /** Rows in tables this fixture does not model, deleted before their parents. */
    extra?: Array<{ table: string; ids: string[] }>;
  }
): Promise<void> {
  const tenants = ids.tenants ?? ALL_TENANTS;
  const actors = actorsOf(tenants);
  // Evidence FIRST, and necessarily wholesale: the ledger admits no scoped
  // delete. Suites in this directory run with --no-file-parallelism against a
  // disposable database, so "everything" is this run's own rows.
  await truncateEvidenceLedgerForFixture(client);
  await client.query(`DELETE FROM initiative_closure_requests WHERE id = ANY($1::text[])`, [
    ids.closureRequestIds,
  ]);
  await client.query(`DELETE FROM notebook_page_versions WHERE page_id = ANY($1::text[])`, [
    ids.notebookPageIds,
  ]);
  await client.query(`DELETE FROM notebook_pages WHERE id = ANY($1::text[])`, [
    ids.notebookPageIds,
  ]);
  await client.query(`DELETE FROM meeting_follow_ups WHERE meeting_id = ANY($1::text[])`, [
    ids.meetingIds,
  ]);
  await client.query(`DELETE FROM meeting_notes WHERE meeting_id = ANY($1::text[])`, [
    ids.meetingIds,
  ]);
  await client.query(`DELETE FROM meetings WHERE id = ANY($1::text[])`, [ids.meetingIds]);
  await client.query(`DELETE FROM tool_outputs WHERE id = ANY($1::text[])`, [
    ids.toolOutputIds ?? [],
  ]);
  await client.query(`DELETE FROM method_outputs WHERE id = ANY($1::text[])`, [
    ids.methodOutputIds ?? [],
  ]);
  // AFTER the artefact tables: `extra` is where their parents live (sessions,
  // snapshots), and deleting a snapshot still referenced by an output fails.
  for (const { table, ids: rowIds } of ids.extra ?? []) {
    // Table names come from this file's callers only — never from data.
    await client.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [rowIds]);
  }
  await client.query(`DELETE FROM initiatives WHERE id = ANY($1::text[])`, [ids.initiativeIds]);
  await client.query(
    `DELETE FROM audit_events WHERE org_id = ANY($1::text[]) AND action = 'INITIATIVE_CLOSURE_EVIDENCE_ADDED'`,
    [tenants.map((t) => t.id)]
  );
  await client.query(`DELETE FROM organization_members WHERE user_id = ANY($1::text[])`, [
    actors.map((a) => a.id),
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [actors.map((a) => a.id)]);
  await client.query(`DELETE FROM projects WHERE id = ANY($1::text[])`, [
    tenants.map((t) => t.projectId),
  ]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
    tenants.map((t) => t.id),
  ]);
}

/**
 * Evidence cannot be deleted. At all.
 *
 * The ledger's guard refuses UPDATE and DELETE unconditionally, and its parents
 * are ON DELETE RESTRICT, so there is no row-level way to remove an evidence row
 * — not for a cleanup script, not for the application, not for this fixture.
 *
 * An earlier version of this file used a session setting
 * (`SET LOCAL closure_evidence.retention_operation = 'authorized'`) that the
 * guard honoured. That was not authorization: any session with DELETE rights
 * could set it for itself, which includes the application's own pool. The door
 * is gone and the fixture does not get a private one either.
 *
 * What is left is TRUNCATE, which is DDL and requires ownership of the table —
 * a database privilege, checked by Postgres, that a runtime role is not granted.
 * That is exactly the shape a real retention operation would have to take, and
 * it is why this is safe to use here against a disposable test database while
 * remaining unavailable to anything serving a request.
 */
export async function truncateEvidenceLedgerForFixture(client: pg.Client): Promise<void> {
  await client.query('BEGIN');
  try {
    await assertDisposableCleanupTarget(client);
    await client.query('TRUNCATE TABLE initiative_closure_evidence');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

export async function assertDisposableCleanupTarget(client: pg.Client): Promise<string> {
  if (process.env.CLOSURE_EVIDENCE_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1') {
    throw new Error(
      'immutable fixture cleanup requires CLOSURE_EVIDENCE_ALLOW_IMMUTABLE_FIXTURE_CLEANUP=1'
    );
  }
  const prefix = String(process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX ?? '').trim();
  if (!prefix) throw new Error('CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX is required');
  const result = await client.query<{ name: string }>('SELECT current_database() AS name');
  const name = String(result.rows[0]?.name ?? '');
  if (!name.startsWith(prefix)) {
    throw new Error(`refusing fixture cleanup outside disposable database prefix ${prefix}`);
  }
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('closure-evidence-fixture-cleanup'))`);
  return name;
}

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
