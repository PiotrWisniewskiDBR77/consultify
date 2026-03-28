/**
 * V8 Real-DB Test Setup — CP-02
 *
 * Provides helpers for running V8 integration tests against a real Railway
 * Postgres database. Uses DATABASE_PUBLIC_URL (never *.railway.internal from
 * local) via the shared databaseTargetResolver.
 */

import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../../../../config/databaseTargetResolver.js';

const { Client } = pg;

let client: InstanceType<typeof Client> | null = null;

/**
 * Returns true when the V8 real-DB test mode is active.
 * Tests that touch the real DB should call this and skip otherwise.
 */
export function isRealDbMode(): boolean {
  return process.env.V8_DB_TEST_MODE === 'real';
}

/**
 * Connect to the real Railway Postgres and set search_path to `v8, public`.
 * Throws if the v8 schema does not exist.
 */
export async function connectV8Db(): Promise<InstanceType<typeof Client>> {
  const { databaseUrl, source } = resolveReachableDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('No database URL available. Set DATABASE_PUBLIC_URL for V8 DB tests.');
  }

  console.log(`[V8-DB-Test] Connecting via ${source}`);

  const c = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
  });
  await c.connect();
  await c.query('SET search_path TO v8, public');

  const schemaCheck = await c.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'v8'"
  );
  if (schemaCheck.rows.length === 0) {
    await c.end();
    throw new Error('v8 schema does not exist. Run: npx tsx scripts/v8-migrate.ts --apply');
  }

  client = c;
  return c;
}

/**
 * Return the active pg.Client. Throws if not connected.
 */
export function getV8DbClient(): InstanceType<typeof Client> {
  if (!client) {
    throw new Error('V8 DB not connected. Call connectV8Db() first.');
  }
  return client;
}

/**
 * Gracefully close the connection.
 */
export async function disconnectV8Db(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

/**
 * Truncate all tables in the v8 schema (CASCADE).
 * Useful between test suites to guarantee a clean slate.
 */
export async function truncateV8Tables(): Promise<void> {
  const c = getV8DbClient();
  const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'v8'");
  for (const row of tables.rows) {
    await c.query(`TRUNCATE TABLE v8."${row.tablename}" CASCADE`);
  }
}

/**
 * Count of tables in the v8 schema.
 */
export async function getV8TableCount(): Promise<number> {
  const c = getV8DbClient();
  const result = await c.query("SELECT COUNT(*) AS count FROM pg_tables WHERE schemaname = 'v8'");
  return parseInt(result.rows[0].count, 10);
}

/**
 * Count of indexes in the v8 schema.
 */
export async function getV8IndexCount(): Promise<number> {
  const c = getV8DbClient();
  const result = await c.query("SELECT COUNT(*) AS count FROM pg_indexes WHERE schemaname = 'v8'");
  return parseInt(result.rows[0].count, 10);
}

/**
 * List all table names in the v8 schema (sorted).
 */
export async function getV8TableNames(): Promise<string[]> {
  const c = getV8DbClient();
  const result = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'v8' ORDER BY tablename"
  );
  return result.rows.map((r: { tablename: string }) => r.tablename);
}
