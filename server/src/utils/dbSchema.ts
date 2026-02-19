/**
 * Lightweight DB schema helpers (SQLite + Postgres).
 *
 * Used to make queries resilient to schema drift between environments.
 */

import * as queryHelpers from './queryHelpers.js';

const cache = new Map<string, Promise<Set<string>>>();

async function getSqliteColumns(table: string): Promise<Set<string>> {
  const rows = await queryHelpers.queryAll<{ name?: string }>(`PRAGMA table_info(${table})`);
  return new Set((rows || []).map((r) => String(r.name || '')).filter(Boolean));
}

async function getPostgresColumns(table: string): Promise<Set<string>> {
  const rows = await queryHelpers.queryAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?`,
    [table]
  );
  return new Set((rows || []).map((r) => String(r.column_name)));
}

export async function getTableColumns(table: string): Promise<Set<string>> {
  const key = `${String(process.env.DB_TYPE || 'sqlite').toLowerCase()}:${table}`;
  if (!cache.has(key)) {
    const p = (async () => {
      const dbType = String(process.env.DB_TYPE || '').toLowerCase();
      if (dbType === 'postgres') return await getPostgresColumns(table);
      return await getSqliteColumns(table);
    })();
    cache.set(key, p);
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
