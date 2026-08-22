#!/usr/bin/env node
/**
 * Wave 3 / module 13 Chat — deterministic, provider-free owner fixture.
 *
 * Mutating commands require CHAT_OWNER_FIXTURE_CONFIRM=YES. DATABASE_URL must
 * point to loopback PostgreSQL and an exact `consultify_w3_chat_owner_*` DB.
 *
 *   ... node scripts/dev/seed-wave3-chat-owner-review.mjs provision
 *   ... CHAT_OWNER_FIXTURE_PASSWORD=<local-only> CHAT_OWNER_FIXTURE_MANIFEST=/secure/new-manifest.json npx tsx scripts/dev/seed-wave3-chat-owner-review.mjs seed
 *   ... node scripts/dev/seed-wave3-chat-owner-review.mjs readback
 *   ... node scripts/dev/seed-wave3-chat-owner-review.mjs reset
 *   ... node scripts/dev/seed-wave3-chat-owner-review.mjs drop
 *
 * `provision` creates the exact disposable DB and applies current migrations.
 * `seed` creates only local identities/source data, then calls the canonical
 * `createChatProposal` service with its DB-backed source provider. It never
 * invokes an LLM or any external provider. `reset` removes fixture rows only;
 * `drop` is the preferred final cleanup and proves catalog absence. Every
 * `seed` requires a new manifest path; manifests are written once (0600),
 * never overwritten, and are intentionally retained by `reset` and `drop`.
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const DATABASE_URL = process.env.DATABASE_URL || '';
const CONFIRM = process.env.CHAT_OWNER_FIXTURE_CONFIRM;
const PASSWORD = process.env.CHAT_OWNER_FIXTURE_PASSWORD;
const MANIFEST_PATH = process.env.CHAT_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_chat_owner_';
const FIXTURE_ID = 'W3-CHAT-OWNER-v1';
const FIXTURE_NAME = 'wave3-chat-owner-review-v1';
const MUTATING = new Set(['provision', 'seed', 'reset', 'drop']);

const IDS = Object.freeze({
  org: 'w3-chat-owner-org-v1',
  foreignOrg: 'w3-chat-owner-foreign-org-v1',
  owner: 'w3-chat-owner-user-v1',
  member: 'w3-chat-member-user-v1',
  revoked: 'w3-chat-revoked-user-v1',
  foreignOwner: 'w3-chat-foreign-owner-v1',
  ownerMembership: 'w3-chat-owner-membership-v1',
  memberMembership: 'w3-chat-member-membership-v1',
  revokedMembership: 'w3-chat-revoked-membership-v1',
  foreignMembership: 'w3-chat-foreign-membership-v1',
  // Mounted conversation routes validate these public identities as UUIDs.
  conversation: '13000000-0000-4000-8000-000000000001',
  message: '13000000-0000-4000-8000-000000000002',
  idempotencyKey: 'w3-chat-owner-proposal-v1',
});

const SOURCE_CONTENT =
  'Pilot Atlas achieved 12% OEE improvement in the verified Q3 review. ' +
  'See [Source: Q3 Pilot Review] and https://evidence.local.test/q3-pilot-review.';

function fail(message) {
  throw new Error(`[W3-CHAT fixture] BLOCKED: ${message}`);
}

function qualifiedUrl() {
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  let url;
  try { url = new URL(DATABASE_URL); } catch { fail('DATABASE_URL must be a valid URL'); }
  if (!LOCAL_HOSTS.has(url.hostname)) fail(`database host ${url.hostname} is not loopback`);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName.startsWith(DB_PREFIX) || !/^consultify_w3_chat_owner_[a-z0-9_]+$/.test(dbName)) {
    fail(`database name must match ${DB_PREFIX}[a-z0-9_]+`);
  }
  if (!['provision', 'seed', 'readback', 'reset', 'drop'].includes(COMMAND)) {
    fail(`unknown command ${COMMAND}`);
  }
  if (MUTATING.has(COMMAND) && CONFIRM !== 'YES') {
    fail(`${COMMAND} requires CHAT_OWNER_FIXTURE_CONFIRM=YES`);
  }
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('seed requires CHAT_OWNER_FIXTURE_MANIFEST pointing to a new file');
    if (existsSync(MANIFEST_PATH)) fail('CHAT_OWNER_FIXTURE_MANIFEST already exists; refusing overwrite');
  }
  return { url, dbName };
}

function canonicalizeForHash(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    sorted[key] = canonicalizeForHash(value[key]);
  }
  return sorted;
}

function canonicalSourceHash(value) {
  return createHash('sha256').update(JSON.stringify(canonicalizeForHash(value))).digest('hex');
}

function persistManifest(manifest) {
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if ((DATABASE_URL && serialized.includes(DATABASE_URL)) || (PASSWORD && serialized.includes(PASSWORD))) {
    fail('manifest secret scan rejected database credentials or fixture password');
  }
  if (/postgres(?:ql)?:\/\//i.test(serialized)) fail('manifest secret scan rejected a database URL');
  try {
    writeFileSync(MANIFEST_PATH, serialized, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error && error.code === 'EEXIST') fail('CHAT_OWNER_FIXTURE_MANIFEST already exists; refusing overwrite');
    throw error;
  }
  const mode = statSync(MANIFEST_PATH).mode & 0o777;
  if (mode !== 0o600) fail(`manifest mode must be 0600, got 0${mode.toString(8)}`);
}

async function maintenanceClient(url) {
  const maintenance = new URL(url.toString());
  maintenance.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  return client;
}

async function provision(url, dbName) {
  const admin = await maintenanceClient(url);
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
    if (exists.rowCount) fail('database already exists; use reset or explicit drop first');
    await admin.query(`CREATE DATABASE ${dbName}`);
  } finally { await admin.end(); }
  const result = spawnSync('npx', ['tsx', 'server/scripts/migrate.postgres.ts', '--safe'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      DB_TYPE: 'postgres',
      NODE_ENV: 'test',
      DOTENV_IGNORE_LOCAL: '1',
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) fail(`migration command failed with exit ${result.status}`);
  console.log(JSON.stringify({ command: 'provision', database: dbName, migrated: true }));
}

async function reset(client) {
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM artifact_handoff_receipts WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM artifact_handoff_proposals WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM conversation_messages WHERE conversation_id=$1', [IDS.conversation]);
    await client.query('DELETE FROM conversations WHERE id=$1', [IDS.conversation]);
    await client.query('DELETE FROM organization_members WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM users WHERE id=ANY($1)', [[IDS.owner, IDS.member, IDS.revoked, IDS.foreignOwner]]);
    await client.query('DELETE FROM organizations WHERE id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query(`CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
      fixture_id text PRIMARY KEY,
      ownership_nonce text NOT NULL,
      database_name text NOT NULL
    )`);
    await client.query('DELETE FROM public.wave3_owner_fixture_markers WHERE fixture_id=$1', [
      FIXTURE_ID,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function seed(client) {
  const existing = await client.query(
    'SELECT count(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id=$1 AND idempotency_key=$2',
    [IDS.org, IDS.idempotencyKey]
  );
  if (existing.rows[0].n === 1) {
    const manifest = await readback(client, false);
    persistManifest(manifest);
    console.log(JSON.stringify(manifest, null, 2));
    return manifest;
  }
  if (existing.rows[0].n > 1) fail('multiple proposals exist for the stable fixture identity');
  if (!PASSWORD || PASSWORD.length < 12) fail('first seed requires CHAT_OWNER_FIXTURE_PASSWORD with at least 12 characters');
  await reset(client);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES
       ($1,'Wave 3 Chat Owner Review','enterprise','active'),
       ($2,'Wave 3 Chat Foreign Boundary','enterprise','active')`,
      [IDS.org, IDS.foreignOrg]
    );
    for (const [id, org, email, role] of [
      [IDS.owner, IDS.org, 'w3.chat.owner@local.test', 'OWNER'],
      [IDS.member, IDS.org, 'w3.chat.member@local.test', 'MEMBER'],
      [IDS.revoked, IDS.org, 'w3.chat.revoked@local.test', 'OWNER'],
      [IDS.foreignOwner, IDS.foreignOrg, 'w3.chat.foreign@local.test', 'OWNER'],
    ]) {
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,$4,$5,'active')`,
        [id, org, email, passwordHash, role]
      );
    }
    for (const [id, org, user, role, status] of [
      [IDS.ownerMembership, IDS.org, IDS.owner, 'OWNER', 'ACTIVE'],
      [IDS.memberMembership, IDS.org, IDS.member, 'MEMBER', 'ACTIVE'],
      [IDS.revokedMembership, IDS.org, IDS.revoked, 'OWNER', 'INACTIVE'],
      [IDS.foreignMembership, IDS.foreignOrg, IDS.foreignOwner, 'OWNER', 'ACTIVE'],
    ]) {
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [id, org, user, role, status]
      );
    }
    await client.query(
      `INSERT INTO conversations(id,user_id,organization_id,title)
       VALUES($1,$2,$3,'W3 Chat owner review — sourced pilot decision')`,
      [IDS.conversation, IDS.owner, IDS.org]
    );
    await client.query(
      `INSERT INTO conversation_messages(id,conversation_id,role,content,metadata,created_at)
       VALUES($1,$2,'ai',$3,$4::jsonb,'2026-08-21T08:00:00.000Z')`,
      [IDS.message, IDS.conversation, SOURCE_CONTENT, JSON.stringify({ fixture: 'W3_CHAT_OWNER_V1' })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  // Qualify the canonical DB-backed provider for this explicitly guarded,
  // disposable local test database before importing server configuration.
  process.env.NODE_ENV = 'test';
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'postgres';
  process.env.DOTENV_IGNORE_LOCAL = '1';
  const { createChatProposal } = await import('../../server/src/services/chatHandoff/chatHandoffService.ts');
  const created = await createChatProposal({
    organizationId: IDS.org,
    userId: IDS.owner,
    conversationId: IDS.conversation,
    messageId: IDS.message,
    targetKind: 'document',
    commandSchemaVersion: 'v1',
    targetCommand: {
      type: 'create_document_draft',
      title: 'Pilot Atlas — Q3 evidence brief',
      sourceMessageId: IDS.message,
    },
    note: 'Owner must inspect the cited source before deciding. No action has executed.',
    suggestedTitle: 'Pilot Atlas — Q3 evidence brief',
    idempotencyKey: IDS.idempotencyKey,
  });
  if (created.proposal.state !== 'pending' || created.citations.length < 1) {
    fail('canonical service did not create a cited pending proposal');
  }
  const ownershipNonce = randomBytes(32).toString('hex');
  await client.query(`CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
    fixture_id text PRIMARY KEY,
    ownership_nonce text NOT NULL,
    database_name text NOT NULL
  )`);
  await client.query(
    `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     VALUES($1,$2,current_database())`,
    [FIXTURE_ID, ownershipNonce]
  );
  const manifest = await readback(client, false);
  persistManifest(manifest);
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

async function readback(client, emit = true) {
  const result = await client.query(
    `SELECT p.proposal_id,p.state,p.source_content_hash,p.source_version,p.target_kind,
            p.payload_json,p.idempotency_key,c.title,m.content,
            (SELECT count(*)::int FROM artifact_handoff_receipts r
              WHERE r.proposal_id=p.proposal_id) AS receipt_count
       FROM artifact_handoff_proposals p
       JOIN conversation_messages m ON m.id=p.producer_record_id
       JOIN conversations c ON c.id=m.conversation_id
      WHERE p.organization_id=$1 AND p.idempotency_key=$2`,
    [IDS.org, IDS.idempotencyKey]
  );
  if (result.rowCount !== 1) fail(`expected exactly one proposal, found ${result.rowCount}`);
  const row = result.rows[0];
  const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
  const personas = await client.query(
    `SELECT u.id,m.role,m.status,u.organization_id
       FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id
      WHERE u.id=ANY($1) ORDER BY u.id`,
    [[IDS.owner, IDS.member, IDS.revoked, IDS.foreignOwner]]
  );
  const marker = await client.query(
    `SELECT fixture_id,ownership_nonce,database_name
       FROM public.wave3_owner_fixture_markers
      WHERE fixture_id=$1 AND database_name=current_database()`,
    [FIXTURE_ID]
  );
  if (marker.rowCount !== 1 || !/^[a-f0-9]{64}$/.test(marker.rows[0].ownership_nonce)) {
    fail('durable Chat ownership marker is missing or invalid');
  }
  const manifest = {
    schemaVersion: 'w3-chat-owner-v1',
    fixture: FIXTURE_NAME,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    databaseName: marker.rows[0].database_name,
    ownershipNonce: marker.rows[0].ownership_nonce,
    marker: {
      table: 'wave3_owner_fixture_markers',
      fixtureId: FIXTURE_ID,
      ownershipNonce: marker.rows[0].ownership_nonce,
    },
    deepLink: `/chat/${IDS.conversation}`,
    deepLinkVerified: false,
    providerMode: 'none-db-source-only',
    ids: { ...IDS, proposal: row.proposal_id },
    expected: {
      proposalState: 'pending',
      targetKind: 'document',
      sourceVersion: Number(row.source_version),
      sourceContentHash: row.source_content_hash,
      sourceTextSha256: createHash('sha256').update(row.content).digest('hex'),
      citationCount: Array.isArray(payload?.citations) ? payload.citations.length : 0,
      receiptCount: Number(row.receipt_count),
    },
    personas: personas.rows,
  };
  const expectedTextHash = createHash('sha256').update(SOURCE_CONTENT).digest('hex');
  if (
    manifest.schemaVersion !== 'w3-chat-owner-v1' ||
    manifest.fixtureId !== FIXTURE_ID ||
    manifest.ownershipState !== 'FINAL' ||
    row.state !== 'pending' ||
    row.target_kind !== 'document' ||
    row.content !== SOURCE_CONTENT ||
    payload?.content !== SOURCE_CONTENT ||
    manifest.expected.sourceContentHash !== canonicalSourceHash(payload) ||
    manifest.expected.sourceTextSha256 !== expectedTextHash ||
    manifest.expected.citationCount !== 2 ||
    manifest.expected.receiptCount !== 0
  ) fail('canonical post-readback manifest validation failed');
  if (emit) console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

async function drop(url, dbName) {
  const admin = await maintenanceClient(url);
  try {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [dbName]);
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    const remains = await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [dbName]);
    if (remains.rows[0].n !== 0) fail('catalog absence check failed');
    console.log(JSON.stringify({ command: 'drop', database: dbName, catalogMatches: 0 }));
  } finally { await admin.end(); }
}

async function main() {
  const { url, dbName } = qualifiedUrl();
  if (COMMAND === 'provision') return provision(url, dbName);
  if (COMMAND === 'drop') return drop(url, dbName);
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    if (COMMAND === 'seed') await seed(client);
    else if (COMMAND === 'reset') {
      await reset(client);
      console.log(JSON.stringify({ command: 'reset', fixtureRows: 0 }));
    } else await readback(client);
  } finally { await client.end(); }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
