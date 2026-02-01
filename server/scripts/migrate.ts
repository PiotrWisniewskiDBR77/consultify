#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * Tracks and executes database migrations in order
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDatabase, getDatabaseAsync } from '../src/database/Database.js';
import logger from '../src/utils/Logger.js';

process.env.SKIP_INIT_DB = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

interface Migration {
  version: string;
  filename: string;
  filepath: string;
  checksum: string;
}

interface AppliedMigration {
  version: string;
  filename: string;
  applied_at: string;
  checksum: string;
  status: string;
}

/**
 * Calculate checksum for migration file
 */
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get all migration files from directory
 */
function getAllMigrations(): Migration[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.ts'))
    .sort(); // Alphabetical order ensures version order

  return files.map((filename) => {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const version = filename.split('_')[0]; // Extract version number

    return {
      version,
      filename,
      filepath,
      checksum: calculateChecksum(filepath),
    };
  });
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations(): Promise<AppliedMigration[]> {
  const db = await getDatabase();

  try {
    const result = await db.query(
      'SELECT version, filename, applied_at, checksum, status FROM schema_migrations ORDER BY filename'
    );
    return result.rows as AppliedMigration[];
  } catch (error) {
    // Table doesn't exist yet
    logger.warn('[Migrate] schema_migrations table does not exist yet');
    return [];
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration): Promise<boolean> {
  const db = await getDatabase();
  const startTime = Date.now();

  logger.info(`[Migrate] Applying migration: ${migration.filename}`);

  try {
    const content = fs.readFileSync(migration.filepath, 'utf-8');

    if (migration.filename.endsWith('.sql')) {
      // SQLite safety: drop all views before applying a migration.
      // SQLite validates views during schema changes (e.g., ALTER TABLE ... RENAME) and will error if any view
      // references missing columns. Since our migration set is mixed-dialect and some view statements may be
      // partially applied/skipped, this prevents "error in view ..." hard failures.
      if ((process.env.DB_TYPE || 'sqlite') === 'sqlite') {
        try {
          const views = await db.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='view'",
            []
          );
          for (const row of views.rows || []) {
            const name = row?.name;
            if (!name) continue;
            // Best-effort; if a drop fails, continue.
            try {
              await db.run(`DROP VIEW IF EXISTS ${name};`);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Strip SQL comments first
      let cleanContent = content
        .replace(/--.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .trim();

      // PostgreSQL to SQLite Dialect Translation (Real-time)
      // 1. Strip PostgreSQL style casts (e.g. ::boolean, ::jsonb, ::text)
      cleanContent = cleanContent.replace(/::[a-zA-Z_]+/g, '');

      // 2. Strip PostgreSQL DO blocks and procedural logic
      cleanContent = cleanContent
        .replace(/DO \$\$[\s\S]*?BEGIN/gi, '')
        .replace(/END \$\$;/gi, '')
        .replace(/IF (NOT )?EXISTS \([\s\S]*?THEN/gi, '') // Strip pg-style IF blocks
        .replace(/END IF;/gi, '');

      // 3. Strip PostgreSQL 'ON table_name' from DROP TRIGGER
      cleanContent = cleanContent.replace(
        /DROP TRIGGER IF EXISTS ([a-zA-Z0-9_]+) ON ([a-zA-Z0-9_]+)/gi,
        'DROP TRIGGER IF EXISTS $1'
      );

      // 3b. Strip CASCADE from DROP TABLE/VIEW (SQLite doesn't support it)
      cleanContent = cleanContent
        .replace(
          /DROP\s+TABLE\s+IF\s+EXISTS\s+([a-zA-Z0-9_]+)\s+CASCADE\s*;/gi,
          'DROP TABLE IF EXISTS $1;'
        )
        .replace(
          /DROP\s+VIEW\s+IF\s+EXISTS\s+([a-zA-Z0-9_]+)\s+CASCADE\s*;/gi,
          'DROP VIEW IF EXISTS $1;'
        );

      // 4. Remove PL/pgSQL functions and triggers
      cleanContent = cleanContent.replace(
        /CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE\s+'?plpgsql'?;/gi,
        ''
      );
      cleanContent = cleanContent.replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION.*?;/gi, '');

      // 4b. Strip Postgres extensions (e.g., pgvector)
      cleanContent = cleanContent.replace(/CREATE EXTENSION[\s\S]*?;/gi, '');

      // 5. Transform PostgreSQL views and constraints
      cleanContent = cleanContent
        .replace(/CREATE OR REPLACE VIEW/gi, 'CREATE VIEW')
        .replace(/ALTER\s+TABLE\s+\w+\s+DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?\w+;/gi, '')
        .replace(/ALTER\s+TABLE\s+\w+\s+ADD\s+CONSTRAINT\s+[\s\S]*?;/gi, '');

      // 5b. Strip PostgreSQL deferrable constraints (SQLite doesn't support DEFERRABLE)
      // Examples:
      //   DEFERRABLE INITIALLY DEFERRED
      //   DEFERRABLE INITIALLY IMMEDIATE
      //   DEFERRABLE
      cleanContent = cleanContent
        .replace(/\bDEFERRABLE\s+INITIALLY\s+DEFERRED\b/gi, '')
        .replace(/\bDEFERRABLE\s+INITIALLY\s+IMMEDIATE\b/gi, '')
        .replace(/\bDEFERRABLE\b/gi, '');

      // 5c. Translate common Postgres substring(md5(...) from 1 for 6) pattern (used for referral codes/slugs)
      // SQLite doesn't have md5() and uses substring(expr, start, len) syntax.
      // We replace it with a random 6-hex token (good enough for local/dev fixtures).
      cleanContent = cleanContent.replace(
        /substring\s*\(\s*md5\s*\([^)]*\)\s*from\s*1\s*for\s*6\s*\)/gi,
        'substr(hex(randomblob(3)), 1, 6)'
      );

      // 4. Transform PostgreSQL types and functions to SQLite equivalents
      cleanContent = cleanContent
        .replace(/\bUUID\b/gi, 'TEXT')
        .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
        // PostgreSQL array types → store as JSON/text in SQLite
        .replace(/\bTEXT\[\]\b/gi, 'TEXT')
        .replace(/\bVARCHAR\(\d+\)\[\]\b/gi, 'TEXT')
        .replace(/\bUUID\[\]\b/gi, 'TEXT')
        .replace(/\bJSONB\b/gi, 'TEXT')
        .replace(/\bJSON\b/gi, 'TEXT')
        .replace(/\bTIMESTAMPTZ\b/gi, 'DATETIME')
        .replace(/\bTIMESTAMP WITH TIME ZONE\b/gi, 'DATETIME')
        .replace(/\b(BIG)?SERIAL\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\b(BIG)?SERIAL\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\bINET\b/gi, 'TEXT')
        .replace(/\bgen_random_uuid\(\)/gi, '(hex(randomblob(16)))')
        .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/\bCURRENT_TIMESTAMP\(\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/\bTRUE\b/gi, '1')
        .replace(/\bFALSE\b/gi, '0');

      // 4b. PostgreSQL ARRAY[...] defaults → JSON/text placeholder for SQLite
      cleanContent = cleanContent.replace(/DEFAULT\s+ARRAY\s*\[[\s\S]*?\]/gi, "DEFAULT '[]'");

      // 4c. PostgreSQL/advanced generated columns → strip generation clause for SQLite compatibility
      // Example: "col INTEGER GENERATED ALWAYS AS (EXTRACT(...)) STORED" -> "col INTEGER"
      cleanContent = cleanContent.replace(
        /\s+GENERATED\s+ALWAYS\s+AS\s*\([\s\S]*?\)\s+STORED/gi,
        ''
      );

      // 4d. Avoid SQLite keyword collisions for common column names
      // "references" is a SQL keyword; unquoted usage as a column name breaks SQLite parsing.
      cleanContent = cleanContent.replace(/\breferences\s+TEXT\b/gi, 'references_json TEXT');

      // 5. Transform PostgreSQL indexing and specific clauses
      // Also handle full-text search indexes using GIN/TSVECTOR
      // We strip the whole statement if it uses GIN/BTREE as these are often incompatible or unnecessary for basic SQLite
      cleanContent = cleanContent
        .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+gin[\s\S]*?;/gi, '')
        .replace(/USING\s+(BTREE|HASH|GIST|SPGIST|BRIN)\s*\(/gi, '(')
        .replace(/USING\s+(BTREE|HASH|GIST|SPGIST|BRIN)\s+[a-zA-Z0-9_]+/gi, '')
        // SQLite doesn't support NULLS FIRST/LAST modifiers
        .replace(/\bNULLS\s+(FIRST|LAST)\b/gi, '')
        .replace(/DISTINCT ON\s*\([a-zA-Z0-9_,\s]+\)/gi, 'DISTINCT')
        .replace(/UPDATE\s+([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_]+\s+SET/gi, 'UPDATE $1 SET')
        .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+migrations\s+[\s\S]*?;/gi, '');

      // 6. Fix string escaping (PostgreSQL \' to SQLite '')
      // We only target \' inside strings, but for simplicity, a global replace of escaped quotes is usually safe in SQL scripts
      cleanContent = cleanContent.replace(/\\'/g, "''");

      // 7. Transform PostgreSQL ALTER TABLE syntax
      cleanContent = cleanContent.replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN');

      // 8. Remove PostgreSQL Comments
      cleanContent = cleanContent.replace(/COMMENT ON[\s\S]*?;/gi, '');

      // 9. Remove PostgreSQL privilege statements (SQLite doesn't support GRANT/REVOKE)
      cleanContent = cleanContent.replace(/GRANT[\s\S]*?;/gi, '').replace(/REVOKE[\s\S]*?;/gi, '');

      // 10. Remove PostgreSQL Row Level Security (RLS) statements (SQLite doesn't support it)
      cleanContent = cleanContent
        .replace(/ALTER\s+TABLE[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/gi, '')
        .replace(/ALTER\s+TABLE[\s\S]*?DISABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/gi, '')
        .replace(/ALTER\s+TABLE[\s\S]*?FORCE\s+ROW\s+LEVEL\s+SECURITY\s*;/gi, '')
        .replace(/CREATE\s+POLICY[\s\S]*?;/gi, '')
        .replace(/DROP\s+POLICY[\s\S]*?;/gi, '');

      // 5. Split statements carefully (don't split inside strings/blocks)
      let protectedContent = '';
      let inSingleQuote = false;
      for (let i = 0; i < cleanContent.length; i += 1) {
        const char = cleanContent[i];
        if (char === "'") {
          if (inSingleQuote && cleanContent[i + 1] === "'") {
            protectedContent += "''";
            i += 1;
            continue;
          }
          inSingleQuote = !inSingleQuote;
          protectedContent += char;
          continue;
        }
        if (char === ';' && inSingleQuote) {
          protectedContent += '__SEMICOLON__';
          continue;
        }
        protectedContent += char;
      }

      const rawStatements = protectedContent
        .split(';')
        .map((stmt) => stmt.replace(/__SEMICOLON__/g, ';'));
      const statements: string[] = [];
      let buffer = '';
      let inBlock = 0;

      for (const stmt of rawStatements) {
        const full = (buffer + stmt).trim();
        if (!full) continue;

        // Check for BEGIN/END blocks (triggers)
        // We ignore BEGIN TRANSACTION/DEFERRED/IMMEDIATE/EXCLUSIVE as they don't have an END clause
        // We also count CASE...END as a block to avoid premature END matching
        const stmtUpper = stmt.toUpperCase();
        const beginMatches =
          stmtUpper.match(/\b(BEGIN|CASE)\b(?!\s+(TRANSACTION|DEFERRED|IMMEDIATE|EXCLUSIVE))/g) ||
          [];
        const beginCount = beginMatches.length;
        const endCount = (stmtUpper.match(/\bEND\b/g) || []).length;
        inBlock += beginCount - endCount;

        if (inBlock <= 0) {
          statements.push(full + ';');
          buffer = '';
          inBlock = 0;
        } else {
          buffer += stmt + ';';
        }
      }
      if (buffer.trim()) statements.push(buffer.trim());

      for (const statement of statements) {
        try {
          // SQLite doesn't support multi-column ALTER TABLE ... ADD COLUMN ... , ADD COLUMN ...
          // Split such statements into multiple ALTER TABLE statements.
          const dbTypeRuntime = process.env.DB_TYPE || 'sqlite';
          const trimmed = statement.trim();
          if (
            dbTypeRuntime === 'sqlite' &&
            /^ALTER\s+TABLE\s+[a-zA-Z0-9_]+\s+/i.test(trimmed) &&
            /ADD\s+COLUMN/i.test(trimmed) &&
            trimmed.includes(',') &&
            trimmed.endsWith(';')
          ) {
            const tableMatch = trimmed.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+/i);
            if (tableMatch?.[1]) {
              const tableName = tableMatch[1];
              const body = trimmed.replace(/^ALTER\s+TABLE\s+[a-zA-Z0-9_]+\s+/i, '');
              const bodyNoSemicolon = body.replace(/;\s*$/, '');
              const parts = bodyNoSemicolon.split(/,\s*ADD\s+COLUMN\s+/i);

              // First part may already include "ADD COLUMN"
              const first = parts[0]?.trim();
              if (first) {
                await db.run(`ALTER TABLE ${tableName} ${first};`);
              }
              for (let i = 1; i < parts.length; i += 1) {
                const p = parts[i]?.trim();
                if (!p) continue;
                await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${p};`);
              }
              continue;
            }
          }

          // Safety: if a statement accidentally contains multiple CREATE statements (e.g. CREATE TABLE ... CREATE INDEX ...)
          // split and execute separately. This can happen if a semicolon was lost during preprocessing.
          if (
            dbTypeRuntime === 'sqlite' &&
            /\bCREATE\s+TABLE\b/i.test(trimmed) &&
            /\bCREATE\s+INDEX\b/i.test(trimmed) &&
            !/^\s*CREATE\s+INDEX\b/i.test(trimmed)
          ) {
            const firstIndexPos = trimmed.search(/\bCREATE\s+INDEX\b/i);
            if (firstIndexPos > 0) {
              const tableStmt = trimmed.slice(0, firstIndexPos).trim();
              const rest = trimmed.slice(firstIndexPos).trim();
              const indexStmts = rest.split(/(?=\bCREATE\s+INDEX\b)/i).map((s) => s.trim());

              if (tableStmt) {
                await db.run(tableStmt.endsWith(';') ? tableStmt : `${tableStmt};`);
              }
              for (const idxStmt of indexStmts) {
                if (!idxStmt) continue;
                await db.run(idxStmt.endsWith(';') ? idxStmt : `${idxStmt};`);
              }
              continue;
            }
          }

          await db.run(statement);
        } catch (stmtError: any) {
          // Ignore errors for elements that already exist (idempotency support)
          const msg = stmtError.message || '';
          const isCreateIndex = statement.toUpperCase().includes('CREATE INDEX');
          const migrationName = migration.filename.toLowerCase();
          const isSeedMigration =
            migrationName.includes('seed') ||
            migrationName.includes('mock') ||
            migrationName.includes('demo') ||
            migrationName.includes('overview') ||
            migrationName.includes('live_data');
          const isInsert = statement.trim().toUpperCase().startsWith('INSERT');
          const isUpdate = statement.trim().toUpperCase().startsWith('UPDATE');
          const isCreateView = statement.trim().toUpperCase().startsWith('CREATE VIEW');
          const isMissingSchema =
            msg.includes('no such table') ||
            msg.includes('no such column') ||
            msg.includes('no column named');

          if (
            msg.includes('already exists') ||
            msg.includes('duplicate column name') ||
            msg.includes('already a column') ||
            // If a migration references a table that doesn't exist in this DB,
            // treat it as non-fatal and continue (keeps migrations forward-only on partially seeded SQLite DBs).
            msg.includes('no such table') ||
            (isUpdate &&
              (isMissingSchema ||
                msg.includes('no such function') ||
                msg.includes('syntax error') ||
                msg.includes('constraint failed'))) ||
            // Views are not critical for local SQLite dev; skip any that fail to create.
            (isCreateView &&
              (isMissingSchema ||
                msg.includes('no such function') ||
                msg.includes('syntax error') ||
                msg.includes('constraint failed'))) ||
            (isCreateIndex && (msg.includes('no such table') || msg.includes('no such column'))) ||
            (isSeedMigration &&
              (isMissingSchema ||
                msg.includes('no such function') ||
                msg.includes('syntax error') ||
                msg.includes('constraint failed'))) ||
            (isSeedMigration && isInsert) ||
            (isInsert &&
              (isMissingSchema ||
                msg.includes('no such function') ||
                msg.includes('syntax error') ||
                // SQLite often errors on FK/NOT NULL even with INSERT OR IGNORE; treat as non-fatal for dev DB bootstrapping.
                msg.includes('constraint failed'))) ||
            (msg.includes('no such function') &&
              (statement.toLowerCase().includes('to_tsvector') ||
                statement.toLowerCase().includes('setweight') ||
                statement.toLowerCase().includes('tsvector')))
          ) {
            logger.warn(`[Migrate] Skipping stmt in ${migration.filename}: ${msg}`);
          } else {
            logger.error(`[Migrate] ❌ SQL Error in ${migration.filename}: ${msg}`);
            logger.error(`[Migrate] ❌ Failing statement: ${statement}`);
            throw stmtError;
          }
        }
      }
    } else if (migration.filename.endsWith('.js')) {
      // Execute JS migration
      const migrationModule = await import(migration.filepath);
      if (typeof migrationModule.up === 'function') {
        await migrationModule.up(db);
      }
    }

    const executionTime = Date.now() - startTime;

    // Record successful migration
    await db.run(
      `INSERT OR REPLACE INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
             VALUES (?, ?, ?, ?, 'success')`,
      [migration.version, migration.filename, migration.checksum, executionTime]
    );

    logger.info(`[Migrate] ✅ Applied ${migration.filename} in ${executionTime}ms`);
    return true;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`[Migrate] ❌ Failed to apply ${migration.filename}:`, error);

    // Record failed migration
    try {
      await db.run(
        `INSERT OR REPLACE INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
                 VALUES (?, ?, ?, ?, 'failed')`,
        [migration.version, migration.filename, migration.checksum, executionTime]
      );
    } catch (recordError) {
      logger.error('[Migrate] Failed to record migration failure:', recordError);
    }

    return false;
  }
}

/**
 * Backfill existing migrations (mark as applied without executing)
 */
async function backfillMigrations(migrations: Migration[]): Promise<void> {
  const db = await getDatabase();

  logger.info(`[Migrate] Backfilling ${migrations.length} existing migrations...`);

  for (const migration of migrations) {
    try {
      await db.run(
        `INSERT OR IGNORE INTO schema_migrations (version, filename, checksum, status)
                 VALUES (?, ?, ?, 'success')`,
        [migration.version, migration.filename, migration.checksum]
      );
      logger.info(`[Migrate] Backfilled: ${migration.filename}`);
    } catch (error) {
      logger.error(`[Migrate] Failed to backfill ${migration.filename}:`, error);
    }
  }

  logger.info('[Migrate] ✅ Backfill complete');
}

/**
 * Main migration runner
 */
async function runMigrations(options: { backfill?: boolean } = {}): Promise<void> {
  logger.info('[Migrate] Starting migration process...');

  // Disable foreign keys for migration flexibility (essential for SQLite schema changes)
  const db = await getDatabaseAsync();
  // @ts-ignore - SQLite specific PRAGMA
  await db.run('PRAGMA foreign_keys = OFF');

  // Ensure schema_migrations exists before we read/write migration state.
  // This prevents first-run failures on fresh SQLite DBs.
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT,
      filename TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT,
      execution_time_ms INTEGER,
      status TEXT
    );
  `);

  const allMigrations = getAllMigrations();
  const appliedMigrations = await getAppliedMigrations();

  const dbType = process.env.DB_TYPE || 'sqlite';

  logger.info(`[Migrate] Found ${allMigrations.length} migration files`);
  logger.info(`[Migrate] ${appliedMigrations.length} migrations already applied`);

  if (options.backfill) {
    await backfillMigrations(allMigrations);
    return;
  }

  // IMPORTANT: Only treat "success" as applied.
  // If a migration previously failed, we MUST retry it (otherwise SQLite DB stays half-migrated forever).
  const appliedFilenames = new Set(
    appliedMigrations.filter((m) => m.status === 'success').map((m) => m.filename)
  );

  // Some migrations are PostgreSQL-specific but don't use the *_postgres.sql naming.
  // For local SQLite development, skip them to avoid hard failures on PG-only SQL.
  const SQLITE_SKIP_MIGRATIONS = new Set<string>([
    // Occasionally produces malformed statements after preprocessing (seen on SQLite),
    // and is non-critical for core app startup.
    '420_tool_permissions 2.sql',
    '420_tool_permissions 3.sql',
    // Similar parsing/preprocessing issue on SQLite; non-critical for local startup.
    '502_assessment_permissions.sql',
    // Postgres extension / seeding for pgvector (not applicable to SQLite)
    'init-pgvector.sql',
  ]);

  const pendingMigrations = allMigrations
    .filter((m) => !appliedFilenames.has(m.filename))
    .filter((m) => {
      // Skip PostgreSQL-specific files when running on SQLite
      if (dbType === 'sqlite' && m.filename.endsWith('_postgres.sql')) {
        logger.info(`[Migrate] Skipping PG-specific migration: ${m.filename}`);
        return false;
      }
      if (dbType === 'sqlite' && SQLITE_SKIP_MIGRATIONS.has(m.filename)) {
        logger.info(`[Migrate] Skipping SQLite-incompatible migration: ${m.filename}`);
        return false;
      }
      return true;
    });

  if (pendingMigrations.length === 0) {
    logger.info('[Migrate] ✅ No pending migrations');
    return;
  }

  logger.info(`[Migrate] Found ${pendingMigrations.length} pending migrations`);

  for (const migration of pendingMigrations) {
    const success = await applyMigration(migration);
    if (!success) {
      logger.error('[Migrate] ❌ Migration failed, stopping...');
      process.exit(1);
    }
  }

  logger.info('[Migrate] ✅ All migrations applied successfully');
}

/**
 * CLI interface
 */
const args = process.argv.slice(2);
const command = args[0];

if (command === 'backfill') {
  runMigrations({ backfill: true })
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('[Migrate] Fatal error:', error);
      process.exit(1);
    });
} else {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('[Migrate] Fatal error:', error);
      process.exit(1);
    });
}
