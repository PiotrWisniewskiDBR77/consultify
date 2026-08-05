/**
 * dbDynamic — schema-aware INSERT helper shared between Canvas materializers.
 *
 * Filters value keys against the live table column set so a writer can pass a
 * union of columns from competing schema definitions without 422-ing on the
 * ones the current ensure-schema didn't add. Originally an inline helper in
 * `routes/work-canvas.routes.ts`; extracted (Canvas M-7) so the shared Canvas
 * materializer (`services/canvasMaterialize.ts`) can use it without a circular
 * dependency on the route module.
 */

import { run as dbRun } from './DbPromise.js';
import { getTableColumns } from './dbSchema.js';

export async function insertDynamic(
  table: string,
  values: Record<string, unknown>,
  requiredColumns: string[] = ['id']
): Promise<void> {
  const cols = await getTableColumns(table);
  for (const col of requiredColumns) {
    if (!cols.has(col)) {
      throw new Error(`Required column ${table}.${col} is not available`);
    }
  }
  const entries = Object.entries(values).filter(([key]) => cols.has(key));
  if (entries.length === 0) throw new Error(`No compatible columns for ${table}`);
  await dbRun(
    `INSERT INTO ${table} (${entries.map(([key]) => key).join(', ')}) VALUES (${entries
      .map(() => '?')
      .join(', ')})`,
    entries.map(([, value]) => value),
    { fallback: false }
  );
}

/**
 * A single query method bound to ONE pinned PostgreSQL connection (the shape
 * `withPgTransaction` in `../database/PostgresDatabase.ts` hands its callback).
 * Distinct from `Database` in `./DbPromise.ts` — that one always goes through
 * the shared connection POOL (a different physical connection per call), which
 * is exactly the footgun `insertDynamicTx` exists to avoid.
 */
export interface TxQueryFn {
  <T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

/**
 * insertDynamicTx — M01-P07C. Same schema-drift-safe column filtering as
 * `insertDynamic` above (silently drops columns the current deployment's
 * table doesn't have yet), but issues the INSERT through a caller-supplied
 * `query` bound to ONE pinned connection instead of `DbPromise.run()`'s
 * shared pool. `insertDynamic` cannot be reused as-is for a multi-statement
 * atomic write: `DbPromise.run()`/`get()`/`all()` each check out a
 * (possibly different) connection from the pool per call, so two
 * `insertDynamic` calls in sequence give no atomicity guarantee between them
 * — see canvasMaterialize.ts's `materializeWorkspaceTarget` idea branch
 * (M01-033) for the concrete bug this caused: the idea row and its idea-map
 * row were two independent connections/statements, so a crash between them
 * left an idea with no map.
 *
 * Placeholders are Postgres-native `$1, $2, …` (matching `withPgTransaction`'s
 * contract in `../database/PostgresDatabase.ts`), NOT the `?` style
 * `insertDynamic` uses — `withPgTransaction` does not run these through
 * `adaptQuery()`.
 */
export async function insertDynamicTx(
  query: TxQueryFn,
  table: string,
  values: Record<string, unknown>,
  requiredColumns: string[] = ['id']
): Promise<void> {
  const cols = await getTableColumns(table);
  for (const col of requiredColumns) {
    if (!cols.has(col)) {
      throw new Error(`Required column ${table}.${col} is not available`);
    }
  }
  const entries = Object.entries(values).filter(([key]) => cols.has(key));
  if (entries.length === 0) throw new Error(`No compatible columns for ${table}`);
  const columnList = entries.map(([key]) => key).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  await query(
    `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
    entries.map(([, value]) => value)
  );
}
