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

import pg from 'pg';

const EXPECTED_SHA = 'e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e';
const confirmation = process.env.SEED_WAVE3_FINANCE_OWNER_REVIEW;
const databaseUrl = process.env.DATABASE_URL ?? '';
const pdfPath = process.env.FINANCE_STATEMENT_ACCEPTANCE_PDF ?? '';
const manifestPath = process.env.FINANCE_OWNER_FIXTURE_MANIFEST ?? '';
const retainDatabase = process.env.FINANCE_OWNER_FIXTURE_RETAIN_DATABASE === '1';
const ownershipNonce = process.env.FINANCE_OWNER_FIXTURE_OWNERSHIP_NONCE ?? '';

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
if (retainDatabase && !/^[a-f0-9]{64}$/.test(ownershipNonce)) {
  throw new Error('Retained Finance owner fixture requires a lowercase 64-hex ownership nonce');
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const result = spawnSync(
  path.join(repoRoot, 'node_modules/.bin/vitest'),
  [
    'run',
    'server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts',
    '--maxWorkers=1',
    '--retry=0',
    '--testTimeout=120000',
    '--reporter=json',
    `--outputFile=${manifestPath}.vitest.json`,
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_TYPE: 'postgres',
      RUN_DB_TESTS: '1',
      MOCK_DB: 'false',
      FINANCE_STATEMENT_DROP_DATABASE_AFTER: retainDatabase ? '0' : '1',
      FINANCE_OWNER_FIXTURE_RETAIN_DATABASE: retainDatabase ? '1' : '0',
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
  manifest?.statement?.statements?.length !== 6 ||
  Object.keys(manifest?.workspaces ?? {}).length !== 5 ||
  !Object.values(manifest?.workspaces ?? {}).every((workspace: any) =>
    String(workspace?.fixtureState ?? '').startsWith(
      workspace === manifest?.workspaces?.statement ? 'EXACT_SIX_' : 'COMPUTED_'
    )
  )
) {
  throw new Error('Finance owner fixture manifest schema/hash/exact-six validation failed');
}
if (
  retainDatabase &&
  (manifest?.ownershipState !== 'FINAL' ||
    manifest?.fixtureId !== 'W3-FINANCE-OWNER-v1' ||
    manifest?.ownershipNonce !== ownershipNonce ||
    manifest?.marker?.fixtureId !== manifest.fixtureId ||
    manifest?.marker?.ownershipNonce !== ownershipNonce ||
    manifest?.cleanup !== 'RETAINED_DATABASE_MARKER_BOUND')
) {
  throw new Error('Retained Finance owner fixture ownership contract validation failed');
}

const valuation = manifest?.workspaces?.valuation;
const owner = manifest?.personas?.owner;
if (
  !valuation?.artifactId ||
  !valuation?.businessVersionId ||
  !owner?.organizationId ||
  !owner?.userId
) {
  throw new Error('Finance owner fixture valuation identity is incomplete');
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(
    `INSERT INTO finance_artifact_aliases
       (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
        business_version_id, mapping_confidence, mapping_reason, created_by)
     VALUES ('valuations', $1, '', $1, $2, $3, 'AUTO_MIGRATE',
             'Wave 3 Finance owner-review fixture canonical identity', $4)
     ON CONFLICT (legacy_table, legacy_id, legacy_version) DO NOTHING`,
    [valuation.artifactId, owner.organizationId, valuation.businessVersionId, owner.userId]
  );
  const identity = await client.query(
    `SELECT artifact_id, organization_id, business_version_id, mapping_confidence
       FROM finance_artifact_aliases
      WHERE legacy_table='valuations' AND legacy_id=$1 AND legacy_version=''`,
    [valuation.artifactId]
  );
  if (
    identity.rowCount !== 1 ||
    identity.rows[0].artifact_id !== valuation.artifactId ||
    identity.rows[0].organization_id !== owner.organizationId ||
    identity.rows[0].business_version_id !== valuation.businessVersionId ||
    identity.rows[0].mapping_confidence !== 'AUTO_MIGRATE'
  ) {
    throw new Error('Finance owner fixture valuation identity readback mismatch');
  }
} finally {
  await client.end();
}
const serialized = JSON.stringify(manifest);
for (const secret of [
  databaseUrl,
  process.env.FINANCE_OWNER_PASSWORD,
  'Wave3FinanceOwner!2026',
  'Wave3FinanceAdmin!2026',
  'Wave3FinanceForeign!2026',
]) {
  if (secret && serialized.includes(secret)) {
    throw new Error('Finance owner fixture manifest contains secret material');
  }
}
process.stdout.write(
  `${JSON.stringify({
    fixture: manifest.fixture,
    sourceSha256: manifest.source.sha256,
    statementCount: manifest.statement.statements.length,
    manifestPath: path.resolve(manifestPath),
    cleanup: manifest.cleanup,
    valuationLegacyIdentity: valuation.artifactId,
  })}\n`
);
