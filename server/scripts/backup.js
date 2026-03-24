import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { assertNoLocalDatabaseOutsideTests } from '../src/config/databaseTargetResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
assertNoLocalDatabaseOutsideTests(process.env);

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

if (!DB_HOST || !DB_NAME || !DB_USER) {
  throw new Error(
    'DB_HOST, DB_NAME and DB_USER are required. This backup script only supports explicitly configured external Postgres targets.'
  );
}

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${DB_NAME}-${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`[Backup] Starting backup for ${DB_NAME}...`);
  console.log(`[Backup] Target: ${filepath}`);

  // Construct pg_dump command
  // Note: This requires pg_dump to be installed on the system
  const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD };
  const cmd = `pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -F p -f "${filepath}" ${DB_NAME}`;

  exec(cmd, { env }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Backup] Failed: ${error.message}`);
      return;
    }
    if (stderr) {
      // pg_dump writes verbose info to stderr sometimes, but check keywords
      if (stderr.includes('error')) {
        console.warn(`[Backup] Warning (stderr): ${stderr}`);
      }
    }

    console.log(
      `[Backup] Success! Size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`
    );

    // Cleanup old backups (keep last 7 days)
    cleanupOldBackups();
  });
}

function cleanupOldBackups() {
  // Basic cleanup logic...
  console.log('[Backup] Cleanup check skipped for safety.');
}

backup();
