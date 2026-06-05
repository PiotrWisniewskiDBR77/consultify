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

import { getTableColumns } from './dbSchema.js';
import { run as dbRun } from './DbPromise.js';

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
