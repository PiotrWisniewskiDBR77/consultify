#!/usr/bin/env tsx
/**
 * Kasuje sesje narzędzi Tools utworzone przez harness testowy (warstwa B),
 * rozpoznawane po prefiksie nazwy "[HARNESS-TEST]". demo=twarz → zero rekordów testowych.
 *
 * Bezpieczne: kasuje TYLKO wiersze z prefiksem, na jawnie wybranym targecie DB, po potwierdzeniu.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="<staging-postgres-url>" TOOLS_HARNESS_CLEANUP_CONFIRM=DELETE_HARNESS_TOOL_SESSIONS \
 *     npx tsx server/scripts/cleanup-test-tool-sessions.ts
 */
import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

const PREFIX = '[HARNESS-TEST]%';

async function cleanup(dbUrl: string, label: string): Promise<void> {
  console.log(`\n=== Cleanup harness tool_sessions: ${label} ===`);
  const client = new pg.Client(dbUrl);
  await client.connect();
  try {
    const ids = await client.query(
      `SELECT id FROM tool_sessions WHERE name LIKE $1`,
      [PREFIX],
    );
    const idList = ids.rows.map((r) => r.id);
    console.log(`  Znaleziono ${idList.length} sesji z prefiksem "${PREFIX.replace('%', '')}".`);
    if (!idList.length) return;

    for (const [table, col] of [
      ['tool_decisions', 'tool_session_id'],
      ['tool_initiative_links', 'tool_session_id'],
      ['tool_initiative_batches', 'tool_session_id'],
    ] as const) {
      try {
        const r = await client.query(
          `DELETE FROM ${table} WHERE ${col} = ANY($1::uuid[])`,
          [idList],
        );
        if (r.rowCount) console.log(`  ${table}: ${r.rowCount} usunięto`);
      } catch (e: any) {
        if (!e.message?.includes('does not exist')) console.log(`  ${table}: ⚠ ${e.message?.slice(0, 80)}`);
      }
    }
    const del = await client.query(`DELETE FROM tool_sessions WHERE name LIKE $1`, [PREFIX]);
    console.log(`  tool_sessions: ${del.rowCount} usunięto ✓`);
  } finally {
    await client.end();
  }
}

(async () => {
  requireConfirmation(
    'TOOLS_HARNESS_CLEANUP_CONFIRM',
    'DELETE_HARNESS_TOOL_SESSIONS',
    'cleanup-test-tool-sessions',
  );
  const target = resolveScriptDatabaseTarget({
    label: 'cleanup-test-tool-sessions',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('cleanup-test-tool-sessions', target);
  await cleanup(target.connectionString, `${target.host}/${target.database}`);
  console.log('\n✅ Cleanup zakończony.');
})().catch((e) => {
  console.error('Cleanup błąd:', e);
  process.exit(1);
});
