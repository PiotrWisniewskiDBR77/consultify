#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.WAVE3_RECOVERY_DATABASE_URL || '';
const manifestDirectory = process.env.WAVE3_RECOVERY_MANIFEST_DIR || '/tmp';
const expectedMigrations = 831;
const fixtures = Object.freeze([
  ['organization', 'W3-ORGANIZATION-OWNER-v1'],
  ['interview', 'W3-INTERVIEW-OWNER-v1'],
  ['tools', 'W3-TOOLS-OWNER-v1'],
  ['assessment', 'W3-ASSESSMENT-OWNER-v1'],
  ['initiatives', 'W3-INITIATIVES-OWNER-v1'],
  ['execution', 'W3-EXECUTION-OWNER-v1'],
  ['my-work', 'W3-MY-WORK-OWNER-v1'],
  ['meetings', 'W3-MEETINGS-OWNER-v1'],
  ['results', 'W3-RESULTS-OWNER-v1'],
  ['finance', 'W3-FINANCE-OWNER-v1'],
  ['materials', 'W3-MATERIALS-OWNER-v1'],
  ['audits', 'W3-AUDITS-OWNER-v1'],
  ['chat', 'W3-CHAT-OWNER-v1'],
  ['admin', 'W3-ADMIN-OWNER-v1'],
  ['settings', 'W3-SETTINGS-OWNER-v1'],
  ['partner', 'W3-PARTNER-OWNER-v1'],
]);

function fail(message) {
  throw new Error(`[W3 recovery audit] BLOCKED: ${message}`);
}

if (!databaseUrl) fail('WAVE3_RECOVERY_DATABASE_URL is required');
const adminUrl = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(adminUrl.hostname)) {
  fail('only a loopback PostgreSQL endpoint is allowed');
}
if (adminUrl.pathname.slice(1) !== 'postgres')
  fail('database URL must target the postgres catalog');
if (!path.isAbsolute(manifestDirectory)) fail('manifest directory must be absolute');

const manifests = [];
const databaseNames = new Set();
const nonces = new Set();
for (const [module, fixtureId] of fixtures) {
  const manifestPath = path.join(
    manifestDirectory,
    `consultify-wave3-${module}-owner-recovered-20260823.json`
  );
  if (!fs.existsSync(manifestPath)) fail(`${module}: manifest is absent`);
  const stat = fs.lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
    fail(`${module}: manifest must be a regular non-symlink 0600 file`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    manifest.fixtureId !== fixtureId ||
    manifest.ownershipState !== 'FINAL' ||
    manifest.marker?.table !== 'wave3_owner_fixture_markers' ||
    manifest.marker?.fixtureId !== fixtureId ||
    manifest.marker?.ownershipNonce !== manifest.ownershipNonce ||
    !/^[a-f0-9]{64}$/.test(String(manifest.ownershipNonce || '')) ||
    !new RegExp(`^consultify_w3_${module.replace('-', '_')}_owner_[a-z0-9_]+$`).test(
      String(manifest.databaseName || '')
    )
  ) {
    fail(`${module}: FINAL manifest identity contract is invalid`);
  }
  if (databaseNames.has(manifest.databaseName)) fail(`${module}: duplicate database name`);
  if (nonces.has(manifest.ownershipNonce)) fail(`${module}: duplicate ownership nonce`);
  databaseNames.add(manifest.databaseName);
  nonces.add(manifest.ownershipNonce);
  manifests.push({ module, fixtureId, manifestPath, manifest });
}

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  const catalog = await admin.query(
    'SELECT datname FROM pg_database WHERE datname=ANY($1::text[]) ORDER BY datname',
    [[...databaseNames]]
  );
  if (catalog.rowCount !== fixtures.length) {
    const found = new Set(catalog.rows.map((row) => row.datname));
    fail(`catalog missing: ${[...databaseNames].filter((name) => !found.has(name)).join(', ')}`);
  }
} finally {
  await admin.end();
}

const results = [];
for (const entry of manifests) {
  const target = new URL(adminUrl);
  target.pathname = `/${entry.manifest.databaseName}`;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const migrations = await client.query(
      "SELECT count(*)::int AS n FROM schema_migrations WHERE status IN ('applied','success')"
    );
    const marker = await client.query(
      `SELECT database_name FROM wave3_owner_fixture_markers
       WHERE fixture_id=$1 AND ownership_nonce=$2`,
      [entry.fixtureId, entry.manifest.ownershipNonce]
    );
    if (Number(migrations.rows[0]?.n) !== expectedMigrations) {
      fail(`${entry.module}: expected ${expectedMigrations} migrations`);
    }
    if (marker.rowCount !== 1 || marker.rows[0].database_name !== entry.manifest.databaseName) {
      fail(`${entry.module}: durable marker mismatch`);
    }
    results.push({
      module: entry.module,
      fixtureId: entry.fixtureId,
      databaseName: entry.manifest.databaseName,
      migrations: expectedMigrations,
      manifestMode: '0600',
      markerVerified: true,
    });
  } finally {
    await client.end();
  }
}

console.log(
  JSON.stringify(
    {
      schema: 'W3-RECOVERY-AUDIT-v1',
      status: 'PASS',
      denominator: fixtures.length,
      qualified: results.length,
      uniqueDatabases: databaseNames.size,
      uniqueOwnershipNonces: nonces.size,
      results,
    },
    null,
    2
  )
);
