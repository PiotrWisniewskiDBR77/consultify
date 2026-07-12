#!/usr/bin/env tsx
/**
 * F15 (data-integrity) one-off backfill: decode pre-existing HTML-entity
 * escaping in tasks.title / initiatives.title / initiatives.name /
 * decisions.title / reports.title / reports.name / interview_sessions.name.
 *
 * Continuation of Z139 and its narrower sibling
 * `backfill-decode-tool-session-names.ts` (tool_sessions.name only — see that
 * script's header for the full background on the sanitizer/idempotency fix
 * dd4c6f42a9, 2026-07-11). This script generalizes the exact same
 * decode-before-store / backfill pattern to the wider set of plain-text
 * title/name columns flagged by the Z139 audit (candidate F15) and now fixed
 * at their write sites (see commit "fix(security/F15): decode HTML entities
 * before storing task/initiative/decision/report/interview_session titles").
 *
 * Live-DB audit (TROLLEY, 2026-07-12, read-only):
 *   tasks.title:              2 / 3084 rows escaped
 *   initiatives.title:        0 / 1354 rows escaped
 *   initiatives.name:         0 / 1354 rows escaped
 *   decisions.title:          0 / 1400 rows escaped
 *   reports.title:            0 / 5    rows escaped
 *   reports.name:             column does not exist on TROLLEY schema
 *   interview_sessions.name:  0 / 238  rows escaped
 * (initiatives/decisions/reports/interview_sessions read 0 because the
 * global root-fix dd4c6f42a9 landed 07-11 and stopped new damage before any
 * of those tables accumulated a hit — NOT because their write paths were
 * already safe. This backfill exists so future/other environments with
 * older rows can be swept the same way.)
 *
 * Safety:
 * - Read-only by default. Prints every row that WOULD change (table, column,
 *   id, current value, decoded value) and a per-table + grand total summary.
 *   Makes NO database writes unless invoked with --write.
 * - Idempotent: decodeHtmlEntities() is a no-op on already-plain text, so
 *   running this twice (or on rows nobody touched) is safe. The UPDATE also
 *   guards on the original value (`WHERE <col> = $before`) so a concurrent
 *   edit between scan and write is not clobbered.
 * - Column-existence checked per table/column before querying (schema drift
 *   safe across SQLite/Postgres deployments and older snapshots).
 *
 * Usage:
 *   npx tsx server/scripts/backfill-decode-entity-titles.ts            # dry run (default)
 *   npx tsx server/scripts/backfill-decode-entity-titles.ts --write    # apply the fix
 *   npx tsx server/scripts/backfill-decode-entity-titles.ts --table=tasks --write  # scope to one table
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 * NEVER run --write against prod (centerbeam) without Piotr's explicit sign-off.
 * NOT run by this task — dry-run only, verified against TROLLEY (see report).
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { decodeHtmlEntities } from '../src/utils/htmlEntities.js';
import logger from '../src/utils/Logger.js';

interface TargetColumn {
  table: string;
  column: string;
}

// Broad net: any of the 6 entities sanitizeString() escapes.
const ENTITY_PATTERN = "&(amp|lt|gt|quot|#x27|#96);";

const TARGETS: TargetColumn[] = [
  { table: 'tasks', column: 'title' },
  { table: 'initiatives', column: 'title' },
  { table: 'initiatives', column: 'name' },
  { table: 'decisions', column: 'title' },
  { table: 'reports', column: 'title' },
  { table: 'reports', column: 'name' },
  { table: 'interview_sessions', column: 'name' },
];

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

async function columnExists(
  client: pg.Client,
  table: string,
  column: string
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return (res.rowCount ?? 0) > 0;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const tableArg = process.argv.find((a) => a.startsWith('--table='));
  const scopedTable = tableArg ? tableArg.split('=')[1]?.trim() : undefined;

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for entity-title backfill');
  }
  if (resolvedDb.reason) {
    logger.warn(`[backfill-entity-titles] ${resolvedDb.reason}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const targets = scopedTable ? TARGETS.filter((t) => t.table === scopedTable) : TARGETS;

  let grandChanged = 0;
  let grandScanned = 0;

  for (const { table, column } of targets) {
    const exists = await columnExists(client, table, column);
    if (!exists) {
      logger.info(`[backfill-entity-titles] ${table}.${column}: column does not exist, skipped`);
      continue;
    }

    const candidatesResult = await client.query<{ id: string; val: string }>(
      `SELECT id, ${column} AS val
       FROM ${table}
       WHERE ${column} ~ $1
       ORDER BY updated_at DESC NULLS LAST`,
      [ENTITY_PATTERN]
    );
    const candidates = candidatesResult.rows || [];
    grandScanned += candidates.length;

    const changes: Array<{ id: string; before: string; after: string }> = [];
    for (const row of candidates) {
      const decoded = decodeHtmlEntities(row.val);
      if (decoded !== row.val) {
        changes.push({ id: row.id, before: row.val, after: decoded });
      }
    }
    grandChanged += changes.length;

    logger.info(
      `[backfill-entity-titles] ${table}.${column}: scanned=${candidates.length} candidates, would-change=${changes.length}${
        write ? ' (WRITE MODE)' : ' (DRY RUN — pass --write to apply)'
      }`
    );
    for (const c of changes) {
      logger.info(`  id=${c.id} before="${c.before}" after="${c.after}"`);
    }

    if (write && changes.length > 0) {
      for (const c of changes) {
        await client.query(
          `UPDATE ${table} SET ${column} = $1 WHERE id = $2 AND ${column} = $3`,
          [c.after, c.id, c.before]
        );
      }
      logger.info(`[backfill-entity-titles] ${table}.${column}: wrote ${changes.length} row(s).`);
    }
  }

  logger.info(
    `[backfill-entity-titles] TOTAL scanned=${grandScanned}, would-change=${grandChanged}${
      write ? ' (WRITE MODE — applied)' : ' (DRY RUN — pass --write to apply)'
    }`
  );

  await client.end();
}

main().catch((error) => {
  logger.error('[backfill-entity-titles] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
