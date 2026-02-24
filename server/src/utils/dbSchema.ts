/**
 * Lightweight DB schema helpers (SQLite + Postgres).
 *
 * Used to make queries resilient to schema drift between environments.
 */

import * as queryHelpers from './queryHelpers.js';

const cache = new Map<string, Promise<Set<string>>>();

async function getPostgresColumns(table: string): Promise<Set<string>> {
  const rows = await queryHelpers.queryAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set((rows || []).map((r) => String(r.column_name)));
}

export async function getTableColumns(table: string): Promise<Set<string>> {
  const key = `postgres:${table}`;
  if (!cache.has(key)) {
    cache.set(key, getPostgresColumns(table));
  }
  return await cache.get(key)!;
}

export async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols = await getTableColumns(table);
  return cols.has(column);
}

export function clearSchemaCache(): number {
  const size = cache.size;
  cache.clear();
  return size;
}
