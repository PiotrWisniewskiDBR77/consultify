#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current?.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function requireBinary(name: string): void {
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`[db-restore] Required binary "${name}" not found in PATH.`);
  }
}

function resolveBackupPath(rawPath: string): string {
  const absolutePath = path.resolve(process.cwd(), rawPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`[db-restore] Backup file not found: ${absolutePath}`);
  }
  return absolutePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupPathRaw = String(args.file || process.env.DB_RESTORE_FILE || '').trim();
  if (!backupPathRaw) {
    throw new Error('[db-restore] Missing backup file. Pass --file or DB_RESTORE_FILE.');
  }
  const backupPath = resolveBackupPath(backupPathRaw);

  requireBinary('psql');
  requireBinary('gunzip');

  const target = resolveScriptDatabaseTarget({
    label: 'db-restore',
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('db-restore', target);
  requireConfirmation('DB_RESTORE_CONFIRM', 'RESTORE_POSTGRES_DB', 'db-restore');

  const backupDir = path.resolve(process.cwd(), 'server/exports/db-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const safetyLabel = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  console.log('[db-restore] Creating safety backup before restore...');
  const safetyBackupResult = spawnSync(
    'npx',
    ['tsx', 'server/scripts/backup-database.ts', '--label', safetyLabel, '--output-dir', backupDir],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: target.connectionString,
      },
    }
  );
  if (safetyBackupResult.status !== 0) {
    throw new Error(
      `[db-restore] Safety backup failed with exit code ${safetyBackupResult.status ?? 'unknown'}.`
    );
  }

  const restoreCommand = `gunzip -c "${backupPath}" | psql "${target.connectionString}"`;
  const restoreResult = spawnSync('bash', ['-lc', restoreCommand], {
    stdio: 'inherit',
    env: process.env,
  });
  if (restoreResult.status !== 0) {
    throw new Error(`[db-restore] Restore failed with exit code ${restoreResult.status ?? 'unknown'}.`);
  }

  console.log('✅ PostgreSQL restore completed.');
  console.log(`- source_backup=${backupPath}`);
  console.log(`- host=${target.host}`);
  console.log(`- database=${target.database}`);
}

main().catch((error) => {
  console.error('❌ Database restore failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
