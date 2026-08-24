#!/usr/bin/env npx tsx
/**
 * Durable Wave 3 Finance owner-review fixture.
 *
 * Commands: seed | readback | reset
 * The retained database is created only on loopback under the exact
 * consultify_w3_finance_owner_* prefix. Reset requires a matching 0600 receipt
 * and durable in-database marker.
 */

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.FINANCE_OWNER_FIXTURE_DATABASE_URL || '';
const MANIFEST_PATH = process.env.FINANCE_OWNER_FIXTURE_MANIFEST || '';
const PDF_PATH = process.env.FINANCE_STATEMENT_ACCEPTANCE_PDF || '';
const CONFIRM = process.env.FINANCE_OWNER_FIXTURE_CONFIRM;
const FIXTURE_ID = 'W3-FINANCE-OWNER-v1';
const SOURCE_SHA = 'e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e';
const MAIN_ORG = 'wave3-finance-owner-org-v1';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function fail(message: string): never {
  throw new Error(`[W3 Finance fixture] BLOCKED: ${message}`);
}

function context() {
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  if (!TARGET_URL) fail('FINANCE_OWNER_FIXTURE_DATABASE_URL is required');
  if (!MANIFEST_PATH || !path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://')) {
    fail('FINANCE_OWNER_FIXTURE_MANIFEST must be an absolute local path');
  }
  let target: URL;
  try {
    target = new URL(TARGET_URL);
  } catch {
    fail('Finance fixture database URL is invalid');
  }
  if (!LOCAL_HOSTS.has(target.hostname)) fail('Finance fixture requires loopback PostgreSQL');
  const databaseName = target.pathname.replace(/^\//, '');
  if (!/^consultify_w3_finance_owner_[a-z0-9_]+$/.test(databaseName)) {
    fail('database name must match consultify_w3_finance_owner_*');
  }
  if (COMMAND === 'seed') {
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest exists; overwrite refused');
    if (!PDF_PATH || !fs.existsSync(PDF_PATH)) fail('official Finance PDF is required');
    const sourceSha = crypto.createHash('sha256').update(fs.readFileSync(PDF_PATH)).digest('hex');
    if (sourceSha !== SOURCE_SHA) fail('official Finance PDF SHA-256 mismatch');
  } else if (!fs.existsSync(MANIFEST_PATH)) {
    fail('matching Finance fixture manifest is required');
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  return { target, admin, databaseName };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires FINANCE_OWNER_FIXTURE_CONFIRM=YES');
}

function readReceipt() {
  const stat = fs.statSync(MANIFEST_PATH);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) fail('manifest must be a regular 0600 file');
  const receipt = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (
    receipt?.fixtureId !== FIXTURE_ID ||
    receipt?.fixture !== 'wave3-finance-owner-review-v1' ||
    typeof receipt?.ownershipNonce !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.ownershipNonce) ||
    receipt?.marker?.table !== 'wave3_owner_fixture_markers' ||
    receipt?.marker?.fixtureId !== FIXTURE_ID ||
    receipt?.marker?.ownershipNonce !== receipt.ownershipNonce
  ) {
    fail('manifest ownership contract is invalid');
  }
  return receipt;
}

async function databaseExists(admin: pg.Client, databaseName: string) {
  return (
    Number(
      (
        await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [
          databaseName,
        ])
      ).rows[0].n
    ) === 1
  );
}

function writeProvisional(databaseName: string, nonce: string) {
  const handle = fs.openSync(MANIFEST_PATH, 'wx', 0o600);
  try {
    fs.writeFileSync(
      handle,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          fixture: 'wave3-finance-owner-review-v1',
          fixtureId: FIXTURE_ID,
          ownershipState: 'PROVISIONAL',
          databaseName,
          ownershipNonce: nonce,
          marker: {
            table: 'wave3_owner_fixture_markers',
            fixtureId: FIXTURE_ID,
            ownershipNonce: nonce,
          },
          source: { fileName: path.basename(PDF_PATH), sha256: SOURCE_SHA },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  } finally {
    fs.closeSync(handle);
  }
}

function rewriteReceipt(payload: Record<string, unknown>) {
  const temporary = `${MANIFEST_PATH}.next-${process.pid}`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(temporary, MANIFEST_PATH);
}

async function writeMarker(nonce: string) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query(`CREATE TABLE public.wave3_owner_fixture_markers(
      fixture_id text PRIMARY KEY,
      ownership_nonce text NOT NULL,
      database_name text NOT NULL
    )`);
    await client.query(
      `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
       VALUES($1,$2,current_database())`,
      [FIXTURE_ID, nonce]
    );
  } finally {
    await client.end();
  }
}

async function verifyMarker(receipt: any) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT count(*)::int AS count
         FROM public.wave3_owner_fixture_markers
        WHERE fixture_id=$1 AND ownership_nonce=$2 AND database_name=current_database()`,
      [FIXTURE_ID, receipt.ownershipNonce]
    );
    if (result.rows[0]?.count !== 1) fail('durable Finance ownership marker mismatch');
  } finally {
    await client.end();
  }
}

async function coldReadback(receipt: any) {
  await verifyMarker(receipt);
  const versionIds = Object.values(receipt.workspaces ?? {})
    .map((workspace: any) => workspace?.businessVersionId)
    .filter(Boolean);
  const statementIds = (receipt.statement?.statements ?? []).map(
    (statement: any) => statement.statementId
  );
  const receiptIds = (receipt.statement?.statements ?? []).map(
    (statement: any) => statement.sourceReceiptId
  );
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
        (SELECT count(*)::int FROM schema_migrations WHERE status='success') AS migrations,
        (SELECT count(*)::int FROM finance_business_versions version
          JOIN finance_working_revisions revision
            ON revision.working_revision_id=version.source_working_revision_id
           AND revision.organization_id=version.organization_id AND revision.is_current=true
          JOIN finance_compute_snapshots snapshot
            ON snapshot.compute_snapshot_id=version.compute_snapshot_id
           AND snapshot.organization_id=version.organization_id
         WHERE version.organization_id=$1 AND version.business_version_id=ANY($2::text[])
           AND version.status='APPROVED'
           AND version.content_semantic_hash=revision.content_semantic_hash
           AND version.content_semantic_hash=snapshot.content_semantic_hash
           AND version.compute_run_id=revision.compute_run_id
           AND version.compute_run_id=snapshot.compute_run_id) AS approved_versions,
        (SELECT count(*)::int FROM financial_statements
         WHERE organization_id=$1 AND id=ANY($3::text[])) AS statements,
        (SELECT count(*)::int FROM finance_statement_source_receipts
         WHERE organization_id=$1 AND receipt_id=ANY($4::text[]) AND content_sha256=$5) AS source_receipts,
        (SELECT count(*)::int FROM finance_baseline_workspace_contexts
         WHERE organization_id=$1 AND business_version_id=$6) AS baseline_contexts`,
      [
        MAIN_ORG,
        versionIds,
        statementIds,
        receiptIds,
        SOURCE_SHA,
        receipt.workspaces?.baseline?.businessVersionId,
      ]
    );
    const readback = result.rows[0];
    if (
      Number(readback.migrations) !== 834 ||
      Number(readback.approved_versions) !== 5 ||
      Number(readback.statements) !== 6 ||
      Number(readback.source_receipts) !== 6 ||
      Number(readback.baseline_contexts) !== 1
    ) {
      fail(`cold readback mismatch: ${JSON.stringify(readback)}`);
    }
    return {
      migrations: 834,
      approvedVersions: 5,
      statements: 6,
      sourceReceipts: 6,
      baselineContexts: 1,
      lifecycleHashRunIdentityVerified: true,
    };
  } finally {
    await client.end();
  }
}

async function seed(ctx: ReturnType<typeof context>) {
  requireYes();
  const nonce = crypto.randomBytes(32).toString('hex');
  writeProvisional(ctx.databaseName, nonce);
  let created = false;
  let markerWritten = false;
  try {
    const admin = new pg.Client({ connectionString: ctx.admin.toString() });
    await admin.connect();
    try {
      if (await databaseExists(admin, ctx.databaseName)) fail('target database already exists');
      await admin.query(`CREATE DATABASE "${ctx.databaseName}"`);
      created = true;
    } finally {
      await admin.end();
    }
    await writeMarker(nonce);
    markerWritten = true;
  } catch (error) {
    if (created && !markerWritten) {
      const admin = new pg.Client({ connectionString: ctx.admin.toString() });
      await admin.connect();
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${ctx.databaseName}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    }
    rewriteReceipt({
      ...JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
      ownershipState: 'FAILED_BEFORE_DURABLE_MARKER',
    });
    throw error;
  }

  const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: TARGET_URL },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (migration.status !== 0) {
    rewriteReceipt({
      ...JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
      ownershipState: 'FAILED_AFTER_DURABLE_MARKER',
      error: String(migration.stderr || migration.stdout).slice(-2000),
    });
    fail(`migration failed with status ${migration.status}`);
  }

  const generatedManifest = `${MANIFEST_PATH}.generated-${process.pid}`;
  const run = spawnSync(
    path.join(process.cwd(), 'node_modules/.bin/tsx'),
    ['server/scripts/run-wave3-finance-owner-review.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: TARGET_URL,
        FINANCE_STATEMENT_ACCEPTANCE_PDF: PDF_PATH,
        FINANCE_OWNER_FIXTURE_MANIFEST: generatedManifest,
        FINANCE_OWNER_FIXTURE_RETAIN_DATABASE: '1',
        FINANCE_OWNER_FIXTURE_OWNERSHIP_NONCE: nonce,
        SEED_WAVE3_FINANCE_OWNER_REVIEW: 'YES',
      },
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    }
  );
  if (run.status !== 0) {
    rewriteReceipt({
      ...JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
      ownershipState: 'FAILED_AFTER_DURABLE_MARKER',
      error: String(run.stderr || run.stdout).slice(-2000),
    });
    fail(`full-chain harness failed with status ${run.status}`);
  }
  try {
    const generated = JSON.parse(fs.readFileSync(generatedManifest, 'utf8'));
    const readback = await coldReadback(generated);
    const finalReceipt = { ...generated, ownershipState: 'FINAL', readback };
    const serialized = JSON.stringify(finalReceipt);
    for (const secret of [
      TARGET_URL,
      'Wave3FinanceOwner!2026',
      'Wave3FinanceAdmin!2026',
      'Wave3FinanceForeign!2026',
    ]) {
      if (serialized.includes(secret)) fail('final Finance manifest contains secret material');
    }
    rewriteReceipt(finalReceipt);
    fs.unlinkSync(generatedManifest);
    process.stdout.write(
      `${JSON.stringify({ fixtureId: FIXTURE_ID, databaseName: ctx.databaseName, readback })}\n`
    );
  } catch (error) {
    rewriteReceipt({
      ...JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
      ownershipState: 'FAILED_AFTER_DURABLE_MARKER',
      error: error instanceof Error ? error.message.slice(-2000) : String(error).slice(-2000),
    });
    throw error;
  }
}

async function readback(ctx: ReturnType<typeof context>) {
  const receipt = readReceipt();
  if (receipt.databaseName !== ctx.databaseName || receipt.ownershipState !== 'FINAL') {
    fail('cold readback requires the matching FINAL Finance receipt');
  }
  const result = await coldReadback(receipt);
  process.stdout.write(
    `${JSON.stringify({ fixtureId: FIXTURE_ID, databaseName: ctx.databaseName, readback: result })}\n`
  );
}

async function reset(ctx: ReturnType<typeof context>) {
  requireYes();
  const receipt = readReceipt();
  if (receipt.databaseName !== ctx.databaseName) fail('manifest databaseName mismatch');
  await verifyMarker(receipt);
  const admin = new pg.Client({ connectionString: ctx.admin.toString() });
  await admin.connect();
  try {
    if (!(await databaseExists(admin, ctx.databaseName))) fail('owned Finance database is absent');
    await admin.query(`DROP DATABASE "${ctx.databaseName}" WITH (FORCE)`);
    if (await databaseExists(admin, ctx.databaseName))
      fail('Finance database still exists after reset');
  } finally {
    await admin.end();
  }
  process.stdout.write(
    `${JSON.stringify({ fixtureId: FIXTURE_ID, databaseName: ctx.databaseName, dropped: true, catalogAbsent: true })}\n`
  );
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx);
else await reset(ctx);
