#!/usr/bin/env node
/**
 * run-migrations-staging.js
 * Applies pending YYYYMMDD_*.sql migrations to the staging (trolley) DB.
 * Tracks applied migrations in tp_migration_history (idempotent).
 *
 * Usage:  node server/scripts/run-migrations-staging.js
 */

'use strict';

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load staging DATABASE_URL from .env.staging.local
const envFile = path.resolve(__dirname, '../../.env.staging.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) process.env.DATABASE_URL = m[1].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL not found in .env.staging.local');
  process.exit(1);
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const PATTERN = /^(\d{8})_.*\.sql$/;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅  Connected to staging DB');

  // Ensure tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tp_migration_history (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT,
      duration_ms INTEGER
    )
  `);

  // Load already-applied migrations
  const { rows } = await client.query('SELECT filename FROM tp_migration_history');
  const applied = new Set(rows.map(r => r.filename));

  // Discover pending
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => PATTERN.test(f))
    .sort();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅  No pending migrations — already up to date');
    await client.end();
    return;
  }

  console.log(`\n📋  ${pending.length} pending migration(s):\n`);
  for (const f of pending) console.log(`    • ${f}`);
  console.log();

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
    const t0 = Date.now();

    process.stdout.write(`  ⏳  ${file} ... `);
    try {
      await client.query(sql);
      const ms = Date.now() - t0;
      await client.query(
        'INSERT INTO tp_migration_history (filename, checksum, duration_ms) VALUES ($1, $2, $3)',
        [file, checksum, ms]
      );
      console.log(`✅  (${ms}ms)`);
    } catch (err) {
      console.log(`❌  FAILED`);
      console.error(`\n    ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  console.log('\n✅  All migrations applied successfully.\n');
  await client.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
