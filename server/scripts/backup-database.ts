#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import {
  logSelectedDatabaseTarget,
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

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function requireBinary(name: string): void {
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`[db-backup] Required binary "${name}" not found in PATH.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = String(args.label || process.env.DB_BACKUP_LABEL || 'manual').trim() || 'manual';
  const outputDir = ensureDir(
    path.resolve(process.cwd(), args['output-dir'] || 'server/exports/db-backups')
  );

  requireBinary('pg_dump');
  requireBinary('gzip');

  const target = resolveScriptDatabaseTarget({
    label: 'db-backup',
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('db-backup', target);

  const baseName = `postgres-backup-${label}-${stamp()}.sql`;
  const sqlPath = path.join(outputDir, baseName);
  const gzPath = `${sqlPath}.gz`;

  const dumpResult = spawnSync(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--file', sqlPath, target.connectionString],
    {
      stdio: 'inherit',
      env: process.env,
    }
  );
  if (dumpResult.status !== 0) {
    throw new Error(`[db-backup] pg_dump failed with exit code ${dumpResult.status ?? 'unknown'}.`);
  }

  const gzipResult = spawnSync('gzip', ['-f', sqlPath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (gzipResult.status !== 0) {
    throw new Error(`[db-backup] gzip failed with exit code ${gzipResult.status ?? 'unknown'}.`);
  }

  const stat = fs.statSync(gzPath);
  if (stat.size <= 0) {
    throw new Error('[db-backup] Backup file was created but is empty.');
  }

  console.log('✅ PostgreSQL backup created.');
  console.log(`- ${gzPath}`);
  console.log(`- size_bytes=${stat.size}`);
  console.log(`- host=${target.host}`);
  console.log(`- database=${target.database}`);
  console.log(`- source=${target.source}`);
}

main().catch((error) => {
  console.error('❌ Database backup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
