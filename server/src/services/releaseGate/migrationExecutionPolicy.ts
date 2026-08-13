/**
 * Which files does the strict Postgres migration chain actually EXECUTE?
 *
 * This is the single source of truth, shared by:
 *   - server/scripts/migrate.postgres.ts  (the runner itself)
 *   - server/scripts/release-migration-gate.ts (to compute "pending" the same way)
 *   - readiness checks and tests
 *
 * It lives here, under src/, rather than in the runner script for two reasons:
 *   1. One definition. A gate that computed "pending" from every file on disk reported ~212
 *      phantom pending migrations, because the runner deliberately skips legacy/seed/SQLite-only
 *      files. Two definitions of "required" is exactly the class of bug this wave exists to remove.
 *   2. migrate.postgres.ts starts with a `#!/usr/bin/env tsx` shebang, which Vite/Rollup cannot
 *      parse when a test pulls it into the module graph. Keeping this predicate shebang-free
 *      makes it testable.
 */

/**
 * Pre-500 files that ARE still executed, despite the blanket legacy exclusion, because each is
 * the sole producer of a table later migrations depend on. Mirrors the runner's list exactly.
 */
export const PROMOTED_LEGACY_PRODUCERS: readonly string[] = [
  '081_studio_tables.sql',
  '073_conversations.sql',
  '215_partner_portal.sql',
  '256_integrations_system.sql',
];

const PROMOTED_LEGACY_SET = new Set(PROMOTED_LEGACY_PRODUCERS);

/**
 * True when the file is excluded from the Postgres chain (SQLite-first, seed data, legacy
 * pre-baseline fragment, initdb snapshot, or an iCloud duplicate artifact).
 */
export function isSqliteOnlyMigration(filename: string): boolean {
  const f = filename.toLowerCase();
  const versionNum = Number.parseInt(filename.split('_')[0] || filename, 10);

  // iCloud/duplicate artifacts (e.g. "515_xxx 2.sql")
  if (/\s+\d+\.sql$/.test(f)) return true;

  // Seed/demo data files are not part of the schema migration flow.
  if (
    f.includes('seed') ||
    f.includes('mock') ||
    f.includes('demo') ||
    f.startsWith('add_') ||
    f === 'assessment-module.sql' ||
    f === 'fix_conversations_table.sql'
  ) {
    return true;
  }

  // Older pre-baseline fragments (<500) are often SQLite-first and conflict with the baseline.
  if (Number.isFinite(versionNum) && versionNum > 0 && versionNum < 500) {
    if (!f.startsWith('000_z_core_baseline')) return true;
  }

  if (f.startsWith('000_initdb_')) return true;
  if (f.includes('_sqlite')) return true;
  if (f.includes('fts5')) return true;
  if (f.includes('repair_sqlite')) return true;
  if (f.includes('sqlite') && !f.includes('postgres')) return true;
  if (f.endsWith('.sql.sql')) return true;
  return false;
}

/**
 * Would the strict runner execute this file? Use this — never a raw directory listing — whenever
 * you need the set of migrations an environment is REQUIRED to have applied.
 */
export function isExecutableMigration(filename: string): boolean {
  return PROMOTED_LEGACY_SET.has(filename) || !isSqliteOnlyMigration(filename);
}
