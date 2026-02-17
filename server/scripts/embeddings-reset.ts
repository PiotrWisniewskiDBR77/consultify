#!/usr/bin/env tsx
/**
 * Reset embeddings after migration (pgvector tables / legacy embedding columns).
 *
 * This is intentionally conservative:
 * - It does NOT attempt to regenerate embeddings (needs provider keys + can be costly).
 * - It wipes the pgvector table (`ai_knowledge_embeddings`) and clears legacy JSON embeddings where present.
 *
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/embeddings-reset.ts
 *
 * Options:
 *   --dry-run   no writes, just prints what would run
 */

import path from 'path';

import dotenv from 'dotenv';

import { getDatabaseAsync } from '../src/database/Database.js';
import logger from '../src/utils/Logger.js';

function parseArgs(argv: string[]) {
  const args: Record<string, boolean> = {};
  for (const a of argv) if (a === '--dry-run') args['dry-run'] = true;
  return args;
}

async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return Number(res.rows?.[0]?.count || 0) > 0;
}

async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return Number(res.rows?.[0]?.count || 0) > 0;
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;

  process.env.DB_TYPE = 'postgres';
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const db = await getDatabaseAsync();

  const statements: Array<{ label: string; sql: string; params?: any[] }> = [];

  if (await tableExists(db, 'ai_knowledge_embeddings')) {
    statements.push({
      label: 'wipe ai_knowledge_embeddings',
      sql: 'DELETE FROM ai_knowledge_embeddings',
    });
  }

  // legacy table used by some flows (stores embedding JSON in SQLite; may exist in PG too)
  if (await tableExists(db, 'knowledge_chunks')) {
    if (await columnExists(db, 'knowledge_chunks', 'embedding')) {
      statements.push({
        label: 'clear knowledge_chunks.embedding',
        sql: 'UPDATE knowledge_chunks SET embedding = NULL',
      });
    }
  }

  logger.info(`[embeddings-reset] Planned statements: ${statements.length}`);
  for (const s of statements) logger.info(`[embeddings-reset] - ${s.label}: ${s.sql}`);

  if (dryRun) {
    logger.info('[embeddings-reset] dry-run enabled; exiting without writes.');
    return;
  }

  if (statements.length === 0) {
    logger.info('[embeddings-reset] Nothing to do.');
    return;
  }

  await db.query('BEGIN');
  try {
    for (const s of statements) await db.query(s.sql, s.params || []);
    await db.query('COMMIT');
    logger.info('[embeddings-reset] ✅ done');
  } catch (e: any) {
    await db.query('ROLLBACK');
    throw e;
  }
}

main().catch((e) => {
  logger.error('[embeddings-reset] Failed:', (e as any)?.message || e);
  process.exit(1);
});
