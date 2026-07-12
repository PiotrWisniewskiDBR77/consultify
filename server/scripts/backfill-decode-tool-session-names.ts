#!/usr/bin/env tsx
/**
 * Z139 (data-integrity) one-off backfill: decode pre-existing HTML-entity
 * escaping in tool_sessions.name.
 *
 * Background:
 * The global input-sanitization middleware (server/src/middleware/
 * inputSanitization.middleware.ts) escapes `& < > " ' \`` on every
 * req.body string write. Before commit dd4c6f42a9 ("global sanitizer
 * idempotent — kills Z139 double-escape at the source", 2026-07-11),
 * re-saving a value that already contained escaped entities compounded
 * the escaping on every save (`&` -> `&amp;` -> `&amp;amp;` -> ...).
 * That compounding is now fixed going forward, but rows written/edited
 * BEFORE the fix landed may still hold single- or multi-escaped text
 * (e.g. `Risk &amp; Uncertainty` instead of `Risk & Uncertainty`).
 *
 * This script decodes those pre-existing entities back to plain text —
 * matching the same "decode-before-store" pattern already used by the
 * Notebook/WorkCanvas fix (server/src/utils/htmlEntities.ts) and the new
 * tool_sessions.name write-site fixes (ToolController.createToolSession,
 * my-work.routes.ts createMyWorkToolSession, notebookConversionService.ts,
 * v8/interview.routes.ts, InterviewController.ts).
 *
 * Safety:
 * - Read-only by default. Prints every row that WOULD change (id, current
 *   name, decoded name) and a summary count. Makes NO database writes
 *   unless invoked with --write.
 * - Idempotent: decodeHtmlEntities() is a no-op on already-plain text, so
 *   running this twice (or on rows nobody touched) is safe.
 * - Scoped to tool_sessions.name only. Does NOT touch tasks.title /
 *   initiatives.title / decisions.title — those are a separate, broader
 *   finding (candidate F15, more write sites, out of scope for this pass)
 *   and would need their own audit before a shared backfill.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-decode-tool-session-names.ts            # dry run (default)
 *   npx tsx server/scripts/backfill-decode-tool-session-names.ts --write    # apply the fix
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 * NEVER run --write against prod (centerbeam) without Piotr's explicit sign-off.
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { decodeHtmlEntities } from '../src/utils/htmlEntities.js';
import logger from '../src/utils/Logger.js';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for tool_sessions.name backfill');
  }
  if (resolvedDb.reason) {
    logger.warn(`[backfill-tool-session-names] ${resolvedDb.reason}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  // Broad net: any of the 6 entities sanitizeString() escapes.
  const candidatesResult = await client.query<{ id: string; name: string }>(
    `SELECT id, name
     FROM tool_sessions
     WHERE name ~ '&(amp|lt|gt|quot|#x27|#96);'
     ORDER BY updated_at DESC`
  );
  const candidates = candidatesResult.rows || [];

  let changed = 0;
  const changes: Array<{ id: string; before: string; after: string }> = [];

  for (const row of candidates) {
    const decoded = decodeHtmlEntities(row.name);
    if (decoded !== row.name) {
      changes.push({ id: row.id, before: row.name, after: decoded });
      changed += 1;
    }
  }

  logger.info(
    `[backfill-tool-session-names] scanned=${candidates.length} candidates, would-change=${changed}${write ? ' (WRITE MODE)' : ' (DRY RUN — pass --write to apply)'}`
  );
  for (const c of changes) {
    logger.info(`  id=${c.id} before="${c.before}" after="${c.after}"`);
  }

  if (write && changed > 0) {
    for (const c of changes) {
      await client.query(`UPDATE tool_sessions SET name = $1 WHERE id = $2 AND name = $3`, [
        c.after,
        c.id,
        c.before,
      ]);
    }
    logger.info(`[backfill-tool-session-names] wrote ${changes.length} row(s).`);
  }

  await client.end();
}

main().catch((error) => {
  logger.error(
    '[backfill-tool-session-names] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
});
