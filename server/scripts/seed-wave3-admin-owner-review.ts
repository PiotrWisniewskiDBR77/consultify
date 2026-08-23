#!/usr/bin/env npx tsx
/**
 * Wave 3 / module 14 (Admin) — isolated deterministic owner-review fixture.
 *
 * ADMIN_OWNER_FIXTURE_CONFIRM=YES \
 * ADMIN_OWNER_FIXTURE_DATABASE_URL=postgresql://.../consultify_w3_admin_owner_demo \
 * ADMIN_OWNER_FIXTURE_MANIFEST=/absolute/new/path/admin-owner.json \
 *   npx tsx server/scripts/seed-wave3-admin-owner-review.ts seed
 *
 * Seed/reset operate only on an exact local consultify_w3_admin_owner_* DB.
 * Reset drops the whole database and intentionally preserves the manifest.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.ADMIN_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.ADMIN_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.ADMIN_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_admin_owner_';
const FIXTURE_ID = 'W3-ADMIN-OWNER-v1';
const EXPECTED_MIGRATIONS = 831;

const IDS = Object.freeze({
  mainOrg: '14000000-0000-4000-8000-000000000001',
  foreignOrg: '14000000-0000-4000-8000-000000000002',
  lastOwnerOrg: '14000000-0000-4000-8000-000000000003',
  owner: '14000000-0000-4000-8000-000000000011',
  admin: '14000000-0000-4000-8000-000000000012',
  member: '14000000-0000-4000-8000-000000000013',
  revoked: '14000000-0000-4000-8000-000000000014',
  foreignOwner: '14000000-0000-4000-8000-000000000015',
  foreignAdmin: '14000000-0000-4000-8000-000000000016',
  superadmin: '14000000-0000-4000-8000-000000000017',
  lastOwner: '14000000-0000-4000-8000-000000000018',
  invitation: '14000000-0000-4000-8000-000000000021',
  invitationCommand: '14000000-0000-4000-8000-000000000022',
  invitationAttempt: '14000000-0000-4000-8000-000000000023',
  invitationEvent: '14000000-0000-4000-8000-000000000024',
});

const USERS = Object.freeze([
  { id: IDS.owner, org: IDS.mainOrg, email: 'w3.admin.owner@local.test', role: 'OWNER', membership: 'ACTIVE', password: 'Wave3AdminOwner!2026' },
  { id: IDS.admin, org: IDS.mainOrg, email: 'w3.admin.admin@local.test', role: 'ADMIN', membership: 'ACTIVE', password: 'Wave3AdminAdmin!2026' },
  { id: IDS.member, org: IDS.mainOrg, email: 'w3.admin.member@local.test', role: 'MEMBER', membership: 'ACTIVE', password: 'Wave3AdminMember!2026' },
  { id: IDS.revoked, org: IDS.mainOrg, email: 'w3.admin.revoked@local.test', role: 'ADMIN', membership: 'REMOVED_BY_REAL_IAM_COMMAND', password: 'Wave3AdminRevoked!2026' },
  { id: IDS.foreignOwner, org: IDS.foreignOrg, email: 'w3.admin.foreign.owner@local.test', role: 'OWNER', membership: 'ACTIVE', password: 'Wave3AdminForeignOwner!2026' },
  { id: IDS.foreignAdmin, org: IDS.foreignOrg, email: 'w3.admin.foreign.admin@local.test', role: 'ADMIN', membership: 'ACTIVE', password: 'Wave3AdminForeignAdmin!2026' },
  { id: IDS.superadmin, org: IDS.mainOrg, email: 'w3.admin.superadmin@local.test', role: 'SUPERADMIN', membership: 'NONE', password: 'Wave3AdminSuperadmin!2026' },
  { id: IDS.lastOwner, org: IDS.lastOwnerOrg, email: 'w3.admin.last.owner@local.test', role: 'OWNER', membership: 'ACTIVE', password: 'Wave3AdminLastOwner!2026' },
]);

function fail(message: string): never {
  throw new Error(`[W3 Admin fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('ADMIN_OWNER_FIXTURE_DATABASE_URL is required');
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  let target: URL;
  try { target = new URL(TARGET_URL); } catch { fail('fixture database URL is invalid'); }
  if (!LOCAL_HOSTS.has(target.hostname)) fail(`database host ${target.hostname} is not local`);
  const databaseName = target.pathname.replace(/^\//, '');
  if (!databaseName.startsWith(DB_PREFIX) || !/^consultify_w3_admin_owner_[a-z0-9_]+$/.test(databaseName)) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed' || COMMAND === 'reset') {
    if (!MANIFEST_PATH) fail('ADMIN_OWNER_FIXTURE_MANIFEST is required for seed/reset');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://')) {
      fail('ADMIN_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    }
    if (COMMAND === 'seed' && fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
    if (COMMAND === 'reset' && !fs.existsSync(MANIFEST_PATH)) fail('reset requires the existing fixture manifest');
    if (COMMAND === 'reset' && fs.lstatSync(MANIFEST_PATH).isSymbolicLink()) fail('reset manifest must not be a symlink');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires ADMIN_OWNER_FIXTURE_CONFIRM=YES');
}

async function databaseExists(client: pg.Client, databaseName: string) {
  return Number((await client.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1', [databaseName])).rows[0].n) === 1;
}

function logicalManifest(databaseName: string, ownershipNonce: string, readback: Record<string, unknown> | null = null) {
  return {
    fixture: FIXTURE_ID,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId: FIXTURE_ID, ownershipNonce },
    databaseName,
    deepLink: '/admin',
    deepLinkVerified: false,
    externalEmailAttempted: false,
    backupRestoreExecuted: false,
    invitationDelivery: {
      mode: 'canonical-shaped durable fixture row; sender deliberately not invoked',
      state: 'FAILED',
      failureCode: 'EXTERNAL_DELIVERY_DISABLED_FOR_OWNER_FIXTURE',
      rawTokenPersisted: false,
    },
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    realIamCommands: [
      'MEMBER -> ADMIN',
      'ADMIN -> MEMBER',
      'revoked former ADMIN membership removal plus session-revocation marker',
    ],
    negativeBoundaries: {
      lastOwner: 'LAST_OWNER_PROTECTED',
      platformSuperadminWithoutTenantMembership: 'CAPABILITY_REQUIRED',
      foreignTarget: 'MEMBER_NOT_FOUND',
      staleExpectedRole: 'MEMBER_NOT_FOUND',
    },
    readback,
  };
}

function persistManifest(manifestPath: string, payload: ReturnType<typeof logicalManifest>) {
  const bytes = `${JSON.stringify(payload, null, 2)}\n`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(manifestPath, 'wx', 0o600);
    fs.writeFileSync(handle, bytes, { encoding: 'utf8' });
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  const stat = fs.statSync(manifestPath);
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if ((stat.mode & 0o777) !== 0o600) fail('persisted manifest mode is not 0600');
  if (
    persisted?.fixture !== FIXTURE_ID ||
    persisted?.fixtureId !== FIXTURE_ID ||
    persisted?.ownershipState !== 'FINAL' ||
    !/^[a-f0-9]{64}$/.test(persisted?.ownershipNonce || '') ||
    persisted?.marker?.table !== 'wave3_owner_fixture_markers' ||
    persisted?.marker?.fixtureId !== FIXTURE_ID ||
    persisted?.marker?.ownershipNonce !== persisted.ownershipNonce ||
    !Array.isArray(persisted?.personas) ||
    persisted.personas.length !== USERS.length ||
    Number(persisted?.readback?.personas) !== USERS.length
  ) fail('persisted manifest schema/readback verification failed');
  const serialized = JSON.stringify(persisted);
  for (const user of USERS) if (serialized.includes(user.password)) fail('persisted manifest contains a fixture password');
  if (/token_hash|rawToken/i.test(serialized) && persisted.invitationDelivery.rawTokenPersisted !== false) {
    fail('persisted manifest contains invitation secret material');
  }
  return { path: manifestPath, bytes: Buffer.byteLength(bytes), mode: '0600', verified: true };
}

async function seedBaseData() {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name] of [
      [IDS.mainOrg, 'W3 Admin Owner Review'],
      [IDS.foreignOrg, 'W3 Admin Foreign Boundary'],
      [IDS.lastOwnerOrg, 'W3 Admin Last Owner Boundary'],
    ]) await client.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [id, name]);

    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone)
         VALUES($1,$2,$3,$4,$5,'Admin Fixture',$6,'active','pl','Europe/Warsaw')`,
        [user.id, user.org, user.email, hash, user.role === 'SUPERADMIN' ? 'Superadmin' : user.role, user.role]
      );
      if (user.membership !== 'NONE') {
        await client.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
           VALUES($1,$2,$3,$4,'ACTIVE')`,
          [`membership-${user.id}`, user.org, user.id, user.role]
        );
      }
    }

    const tokenHash = crypto.createHash('sha256').update('w3-admin-non-secret-unusable-invitation-fixture').digest('hex');
    const intentDigest = crypto.createHash('sha256').update(JSON.stringify({ type: 'CREATE', email: 'w3.admin.invited@local.test', role: 'MEMBER' })).digest('hex');
    await client.query(
      `INSERT INTO invitations
       (id,organization_id,email,role,role_to_assign,token,token_hash,status,invited_by,expires_at,invitation_type,metadata)
       VALUES($1,$2,'w3.admin.invited@local.test','MEMBER','MEMBER',NULL,$3,'pending',$4,CURRENT_TIMESTAMP + INTERVAL '7 days','ORG',$5)`,
      [IDS.invitation, IDS.mainOrg, tokenHash, IDS.owner, JSON.stringify({ adminIamCommandId: IDS.invitationCommand, externalDeliveryDisabled: true })]
    );
    await client.query(
      `INSERT INTO admin_iam_invitation_commands
       (id,organization_id,actor_id,command_type,idempotency_key,intent_digest,invitation_id,receipt_json)
       VALUES($1,$2,$3,'CREATE','w3-admin-invite-create-v1',$4,$5,$6)`,
      [IDS.invitationCommand, IDS.mainOrg, IDS.owner, intentDigest, IDS.invitation, JSON.stringify({ commandId: IDS.invitationCommand, invitationId: IDS.invitation, organizationId: IDS.mainOrg, deliveryState: 'FAILED' })]
    );
    await client.query(
      `INSERT INTO admin_iam_invitation_delivery_attempts
       (id,organization_id,invitation_id,command_id,delivery_state,failure_code)
       VALUES($1,$2,$3,$4,'FAILED','EXTERNAL_DELIVERY_DISABLED_FOR_OWNER_FIXTURE')`,
      [IDS.invitationAttempt, IDS.mainOrg, IDS.invitation, IDS.invitationCommand]
    );
    await client.query(
      `INSERT INTO invitation_events(id,invitation_id,event_type,performed_by_user_id,metadata)
       VALUES($1,$2,'created',$3,$4)`,
      [IDS.invitationEvent, IDS.invitation, IDS.owner, JSON.stringify({ commandId: IDS.invitationCommand, externalDeliveryDisabled: true })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

async function runRealIamCommands() {
  Object.assign(process.env, {
    NODE_ENV: 'test', DB_TYPE: 'postgres', MOCK_DB: 'false', RUN_DB_TESTS: '1',
    POSTGRES_SKIP_INIT_IN_TEST: '1', DATABASE_URL: TARGET_URL,
  });
  const service = await import('../src/services/orgPeopleIamService.js');
  const database = await import('../src/database/Database.js');
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;
  await database.resetConnection();

  const promoted = await service.changeOrganizationMemberRoleAtomicallyViaIam({
    actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg,
    targetMemberId: IDS.member, newRole: 'ADMIN', expectedRole: 'MEMBER', idempotencyKey: 'w3-admin-member-promote-v1',
  });
  if (promoted.denied) fail(`real IAM promote denied: ${promoted.code}`);
  const replay = await service.changeOrganizationMemberRoleAtomicallyViaIam({
    actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg,
    targetMemberId: IDS.member, newRole: 'ADMIN', expectedRole: 'MEMBER', idempotencyKey: 'w3-admin-member-promote-v1',
  });
  if (replay.denied || !('replayed' in replay) || replay.replayed !== true) fail('real IAM replay was not recognized');
  const restored = await service.changeOrganizationMemberRoleAtomicallyViaIam({
    actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg,
    targetMemberId: IDS.member, newRole: 'MEMBER', expectedRole: 'ADMIN', idempotencyKey: 'w3-admin-member-restore-v1',
  });
  if (restored.denied) fail(`real IAM role restore denied: ${restored.code}`);
  const revoked = await service.removeOrganizationMemberAtomicallyViaIam({
    actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg,
    targetMemberId: IDS.revoked, expectedRole: 'ADMIN', idempotencyKey: 'w3-admin-revoke-former-admin-v1',
  });
  if (revoked.denied) fail(`real IAM revoke denied: ${revoked.code}`);

  const boundaries = [
    await service.changeOrganizationMemberRoleAtomicallyViaIam({ actorId: IDS.lastOwner, actorRole: 'OWNER', organizationId: IDS.lastOwnerOrg, targetMemberId: IDS.lastOwner, newRole: 'MEMBER', expectedRole: 'OWNER', idempotencyKey: 'w3-admin-last-owner-negative-v1' }),
    await service.changeOrganizationMemberRoleAtomicallyViaIam({ actorId: IDS.superadmin, actorRole: 'SUPERADMIN', organizationId: IDS.mainOrg, targetMemberId: IDS.member, newRole: 'ADMIN', expectedRole: 'MEMBER', idempotencyKey: 'w3-admin-superadmin-negative-v1' }),
    await service.changeOrganizationMemberRoleAtomicallyViaIam({ actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg, targetMemberId: IDS.foreignAdmin, newRole: 'MEMBER', expectedRole: 'ADMIN', idempotencyKey: 'w3-admin-foreign-negative-v1' }),
    await service.changeOrganizationMemberRoleAtomicallyViaIam({ actorId: IDS.owner, actorRole: 'OWNER', organizationId: IDS.mainOrg, targetMemberId: IDS.member, newRole: 'ADMIN', expectedRole: 'ADMIN', idempotencyKey: 'w3-admin-stale-negative-v1' }),
  ];
  const expected = ['LAST_OWNER_PROTECTED', 'CAPABILITY_REQUIRED', 'MEMBER_NOT_FOUND', 'MEMBER_NOT_FOUND'];
  boundaries.forEach((result, index) => {
    if (!result.denied || result.code !== expected[index]) fail(`negative IAM boundary ${index} returned ${JSON.stringify(result)}`);
  });
  await database.resetConnection();
  await postgresDatabase.close();
}

async function installOwnershipMarker(databaseName: string, ownershipNonce: string) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(
         fixture_id TEXT PRIMARY KEY,
         ownership_nonce TEXT NOT NULL,
         database_name TEXT NOT NULL
       )`
    );
    await client.query(
      `INSERT INTO wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
       VALUES($1,$2,$3)`,
      [FIXTURE_ID, ownershipNonce, databaseName]
    );
  } finally { await client.end(); }
}

async function readback({ databaseName }: { databaseName: string }, expectedNonce?: string) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
       (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$2 AND UPPER(status)='ACTIVE') main_active_memberships,
       (SELECT role FROM organization_members WHERE organization_id=$2 AND user_id=$3) member_final_role,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$2 AND user_id=$4) revoked_memberships,
       (SELECT count(*)::int FROM revoked_tokens WHERE user_id=$4) revoked_markers,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$5 AND UPPER(status)='ACTIVE') foreign_active_memberships,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$6 AND role='OWNER' AND UPPER(status)='ACTIVE') last_owner_memberships,
       (SELECT count(*)::int FROM organization_members WHERE user_id=$7) superadmin_tenant_memberships,
       (SELECT count(*)::int FROM admin_iam_member_commands WHERE organization_id=$2) member_commands,
       (SELECT count(*)::int FROM role_change_audit_events WHERE organization_id=$2) main_audit_events,
       (SELECT count(*)::int FROM admin_iam_invitation_commands WHERE id=$8) invitation_commands,
       (SELECT count(*)::int FROM admin_iam_invitation_delivery_attempts WHERE invitation_id=$9 AND delivery_state='FAILED') failed_delivery_attempts,
       (SELECT count(*)::int FROM invitations WHERE id=$9 AND status='pending' AND token IS NULL) pending_tokenless_invitations,
       (SELECT count(*)::int FROM role_change_audit_events WHERE organization_id IN ($5,$6)) boundary_audit_events,
       (SELECT count(*)::int FROM admin_iam_member_commands WHERE idempotency_key LIKE '%negative%') negative_commands,
       (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
      [[...USERS.map((user) => user.id)], IDS.mainOrg, IDS.member, IDS.revoked, IDS.foreignOrg, IDS.lastOwnerOrg, IDS.superadmin, IDS.invitationCommand, IDS.invitation]
    );
    const rb = result.rows[0];
    const expected = {
      personas: 8, main_active_memberships: 3, member_final_role: 'MEMBER', revoked_memberships: 0,
      revoked_markers: 1, foreign_active_memberships: 2, last_owner_memberships: 1,
      superadmin_tenant_memberships: 0, member_commands: 3, main_audit_events: 3,
      invitation_commands: 1, failed_delivery_attempts: 1, pending_tokenless_invitations: 1,
      boundary_audit_events: 0, negative_commands: 0,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (String(rb[key]) !== String(value)) fail(`readback ${key} expected ${value}, got ${rb[key]}`);
    }
    if (Number(rb.successful_migrations) !== EXPECTED_MIGRATIONS) {
      fail(`migration ledger expected exactly ${EXPECTED_MIGRATIONS}, got ${rb.successful_migrations}`);
    }
    const marker = await client.query(
      `SELECT ownership_nonce,database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1`,
      [FIXTURE_ID]
    );
    if (marker.rowCount !== 1 || marker.rows[0].database_name !== databaseName) {
      fail('durable ownership marker does not match the target database');
    }
    const ownershipNonce = String(marker.rows[0].ownership_nonce || '');
    if (!/^[a-f0-9]{64}$/.test(ownershipNonce) || (expectedNonce && ownershipNonce !== expectedNonce)) {
      fail('durable ownership nonce does not match the expected fixture identity');
    }
    const payload = logicalManifest(databaseName, ownershipNonce, rb);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally { await client.end(); }
}

async function seed({ admin, databaseName, manifestPath }: ReturnType<typeof context>) {
  requireYes();
  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  try {
    if (await databaseExists(adminClient, databaseName)) fail('target database already exists; reset it first');
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);
  } finally { await adminClient.end(); }

  const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: TARGET_URL }, encoding: 'utf8',
  });
  if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);
  await seedBaseData();
  await runRealIamCommands();
  const ownershipNonce = crypto.randomBytes(32).toString('hex');
  await installOwnershipMarker(databaseName, ownershipNonce);
  const payload = await readback({ databaseName }, ownershipNonce);
  const persisted = persistManifest(manifestPath, payload);
  console.log(JSON.stringify({ manifestWritten: persisted }, null, 2));
}

async function reset({ admin, databaseName }: ReturnType<typeof context>) {
  requireYes();
  const stat = fs.statSync(MANIFEST_PATH);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) fail('reset manifest must be a regular 0600 file');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (
    manifest?.databaseName !== databaseName || manifest?.fixture !== FIXTURE_ID ||
    manifest?.fixtureId !== FIXTURE_ID || manifest?.ownershipState !== 'FINAL' ||
    manifest?.marker?.table !== 'wave3_owner_fixture_markers' ||
    manifest?.marker?.fixtureId !== FIXTURE_ID ||
    manifest?.marker?.ownershipNonce !== manifest?.ownershipNonce
  ) fail('reset manifest identity does not match the Admin fixture');
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    if (!(await databaseExists(client, databaseName))) fail('reset target database is absent');
    await readback({ databaseName }, manifest.ownershipNonce);
    await client.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    const absent = !(await databaseExists(client, databaseName));
    console.log(JSON.stringify({ fixture: FIXTURE_ID, databaseName, dropped: true, catalogAbsent: absent, manifestPreserved: true }, null, 2));
  } finally { await client.end(); }
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx);
else await reset(ctx);
