/**
 * schema.ts (domain) — applies the Meeting Core migration on top of the
 * shared minimal schema from tests/meeting-core/pg/schema.ts (CUDZY plik,
 * not edited here).
 *
 * Order matters: createMeetingCoreSchema() creates `meetings` (among other
 * tables) first; ALTER TABLE meetings ADD COLUMN ... and the new
 * meeting_participants/meeting_note_entries/meeting_outputs tables (which FK
 * into meetings) must run after that.
 *
 * Reads the ACTUAL migration file from server/migrations/ — not a
 * hand-copied/paraphrased version — so these tests exercise the exact SQL
 * that would (eventually, in a real deploy) run against a live database.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_PATH = resolve(__dirname, '../../../server/migrations/20260801_meeting_core.sql');

interface QueryRunner {
  query(sql: string): Promise<unknown>;
}

export async function applyMeetingCoreMigration(db: QueryRunner): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  // node-pg's simple query protocol (no params) accepts a multi-statement
  // string as-is — this is the same migration text a real migration runner
  // would execute, not a re-split/re-assembled approximation of it.
  await db.query(sql);
}
