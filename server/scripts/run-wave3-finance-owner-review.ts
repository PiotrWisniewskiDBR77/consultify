#!/usr/bin/env tsx
/**
 * Runs the official-PDF exact-six G04 fixture on an already migrated,
 * disposable local PostgreSQL database. The acceptance test performs the
 * mounted/service writes, independent readback, manifest write, and finally
 * drops the whole database because its governance receipts are immutable.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_SHA = 'e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e';
const confirmation = process.env.SEED_WAVE3_FINANCE_OWNER_REVIEW;
const databaseUrl = process.env.DATABASE_URL ?? '';
const pdfPath = process.env.FINANCE_STATEMENT_ACCEPTANCE_PDF ?? '';
const manifestPath = process.env.FINANCE_OWNER_FIXTURE_MANIFEST ?? '';

if (confirmation !== 'YES') throw new Error('SEED_WAVE3_FINANCE_OWNER_REVIEW=YES is required');
if (!databaseUrl || !pdfPath || !manifestPath) {
  throw new Error(
    'DATABASE_URL, FINANCE_STATEMENT_ACCEPTANCE_PDF and FINANCE_OWNER_FIXTURE_MANIFEST are required'
  );
}
const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, '');
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
  throw new Error('Finance owner fixture requires loopback PostgreSQL');
}
if (!/^consultify_w3_finance_owner_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error('Database name must match consultify_w3_finance_owner_*');
}
const actualSha = createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');
if (actualSha !== EXPECTED_SHA) throw new Error('Official Finance PDF SHA-256 mismatch');
if (fs.existsSync(manifestPath)) {
  throw new Error('Refusing to overwrite an existing Finance owner fixture manifest');
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const result = spawnSync(
  path.join(repoRoot, 'node_modules/.bin/vitest'),
  ['run', 'server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts', '--maxWorkers=1'],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_TYPE: 'postgres',
      RUN_DB_TESTS: '1',
      MOCK_DB: 'false',
      FINANCE_STATEMENT_DROP_DATABASE_AFTER: '1',
    },
    stdio: 'inherit',
  }
);
if (result.status !== 0)
  throw new Error(`Finance owner fixture failed with status ${result.status}`);
if (!fs.existsSync(manifestPath)) throw new Error('Finance owner fixture produced no manifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.schemaVersion !== 1 ||
  manifest?.fixture !== 'wave3-finance-owner-review-v1' ||
  manifest?.source?.sha256 !== EXPECTED_SHA ||
  manifest?.statement?.statements?.length !== 6
) {
  throw new Error('Finance owner fixture manifest schema/hash/exact-six validation failed');
}
process.stdout.write(
  `${JSON.stringify({
    fixture: manifest.fixture,
    sourceSha256: manifest.source.sha256,
    statementCount: manifest.statement.statements.length,
    manifestPath: path.resolve(manifestPath),
    cleanup: manifest.cleanup,
  })}\n`
);
