#!/usr/bin/env node
/**
 * Ensures the main application uses only PostgreSQL.
 * Fails CI if server/src contains SQLite-specific code that could cause runtime issues.
 *
 * Run: node scripts/check-postgres-only.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SERVER_SRC = join(ROOT, 'server', 'src');

// Directories to skip (scripts, seeds, migrations, backups)
const SKIP_DIRS = new Set(['_backup', 'migrations', 'scripts', 'seed', 'seeds', 'db']);
const SKIP_FILES = new Set(['sqliteAsync.js', 'sqliteAsyncAdapter.ts']); // Adapters wrap Postgres
const SKIP_TRANSLATION_FILES = new Set([
  'PostgresDatabase.ts', // Translates sqlite->postgres in adaptQuery
  'DatabaseInitializer.ts', // Contains dead SQLite branches (dbType always postgres)
]);

function walkDir(dir, files = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walkDir(full, files);
    } else if (
      /\.(ts|tsx|js|jsx)$/.test(name) &&
      !name.endsWith('.test.') &&
      !name.endsWith('.spec.') &&
      !SKIP_FILES.has(name) &&
      !/\s\d+\.(ts|tsx|js|jsx)$/.test(name) // skip "file 2.ts" backup copies
    ) {
      files.push(full);
    }
  }
  return files;
}

const CHECKS = [
  { re: /sqlite_master/, msg: 'sqlite_master (use information_schema)' },
  { re: /DB_TYPE\s*===\s*['"]sqlite['"]/, msg: 'DB_TYPE === "sqlite"' },
  { re: /dbType\s*===\s*['"]sqlite['"]/, msg: 'dbType === "sqlite"' },
  { re: /\bisSQLite\b/, msg: 'isSQLite variable' },
  { re: /from\s+['"]sqlite3['"]|require\s*\(\s*['"]sqlite3['"]/, msg: 'sqlite3 import' },
  { re: /type:\s*['"]SQLite['"]/, msg: 'type: "SQLite"' },
  { re: /SQLITE_PATH|SQLITE_DB/, msg: 'SQLITE_PATH/SQLITE_DB' },
];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const rel = filePath.replace(ROOT + '/', '');
  const issues = [];
  const lines = content.split('\n');
  const baseName = filePath.split('/').pop() || '';
  const isTranslationFile = SKIP_TRANSLATION_FILES.has(baseName);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const { re, msg } of CHECKS) {
      if (re.test(line)) {
        // PostgresDatabase.ts contains sqlite_master only in .replace() patterns - that's OK
        if (isTranslationFile && msg.includes('sqlite_master')) continue;
        issues.push({ file: rel, line: i + 1, msg });
        break;
      }
    }
  }

  return issues;
}

const files = walkDir(SERVER_SRC);
const allIssues = [];
for (const f of files) {
  allIssues.push(...checkFile(f));
}

// Dedupe by file+line+msg
const seen = new Set();
const unique = allIssues.filter((i) => {
  const k = `${i.file}:${i.line}:${i.msg}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (unique.length > 0) {
  console.error('\n❌ PostgreSQL-only check failed. Found SQLite references in app code:\n');
  for (const { file, line, msg } of unique) {
    console.error(`  ${file}:${line} - ${msg}`);
  }
  console.error('\nThe application must use only PostgreSQL. Update the above files.\n');
  process.exit(1);
}

console.log('✅ PostgreSQL-only check passed (no SQLite in app code)');
process.exit(0);
