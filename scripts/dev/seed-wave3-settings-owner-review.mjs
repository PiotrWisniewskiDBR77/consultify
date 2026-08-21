#!/usr/bin/env node
/**
 * Wave 3 / module 15 (Settings) — isolated deterministic owner fixture.
 *
 * SETTINGS_OWNER_FIXTURE_CONFIRM=YES \
 * SETTINGS_OWNER_FIXTURE_DATABASE_URL=postgresql://.../consultify_w3_settings_owner_demo \
 *   node scripts/dev/seed-wave3-settings-owner-review.mjs seed
 *
 * SETTINGS_OWNER_FIXTURE_DATABASE_URL=postgresql://.../consultify_w3_settings_owner_demo \
 *   node scripts/dev/seed-wave3-settings-owner-review.mjs readback
 *
 * SETTINGS_OWNER_FIXTURE_CONFIRM=YES \
 * SETTINGS_OWNER_FIXTURE_DATABASE_URL=postgresql://.../consultify_w3_settings_owner_demo \
 *   node scripts/dev/seed-wave3-settings-owner-review.mjs reset
 *
 * Seed/reset operate only on a local database named consultify_w3_settings_owner_*.
 * Reset is the whole-database drop; no row-level destructive cleanup is provided.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.SETTINGS_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.SETTINGS_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.SETTINGS_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_settings_owner_';

const IDS = Object.freeze({
  mainOrg: '15000000-0000-4000-8000-000000000001',
  foreignOrg: '15000000-0000-4000-8000-000000000002',
  legalHoldOrg: '15000000-0000-4000-8000-000000000003',
  owner: '15000000-0000-4000-8000-000000000011',
  member: '15000000-0000-4000-8000-000000000012',
  admin: '15000000-0000-4000-8000-000000000013',
  foreign: '15000000-0000-4000-8000-000000000014',
  revoked: '15000000-0000-4000-8000-000000000015',
  legalHold: '15000000-0000-4000-8000-000000000016',
  exportRequest: '15000000-0000-4000-8000-000000000021',
  cancelledDeletion: '15000000-0000-4000-8000-000000000022',
});

const USERS = Object.freeze([
  { id: IDS.owner, org: IDS.mainOrg, email: 'w3.settings.owner@local.test', role: 'OWNER', status: 'ACTIVE', password: 'Wave3SettingsOwner!2026' },
  { id: IDS.member, org: IDS.mainOrg, email: 'w3.settings.member@local.test', role: 'MEMBER', status: 'ACTIVE', password: 'Wave3SettingsMember!2026' },
  { id: IDS.admin, org: IDS.mainOrg, email: 'w3.settings.admin@local.test', role: 'ADMIN', status: 'ACTIVE', password: 'Wave3SettingsAdmin!2026' },
  { id: IDS.foreign, org: IDS.foreignOrg, email: 'w3.settings.foreign@local.test', role: 'OWNER', status: 'ACTIVE', password: 'Wave3SettingsForeign!2026' },
  { id: IDS.revoked, org: IDS.mainOrg, email: 'w3.settings.revoked@local.test', role: 'MEMBER', status: 'REVOKED', password: 'Wave3SettingsRevoked!2026' },
  { id: IDS.legalHold, org: IDS.legalHoldOrg, email: 'w3.settings.legalhold@local.test', role: 'OWNER', status: 'ACTIVE', password: 'Wave3SettingsLegalHold!2026' },
]);

function fail(message) {
  throw new Error(`[W3 Settings fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('SETTINGS_OWNER_FIXTURE_DATABASE_URL is required');
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  let target;
  try { target = new URL(TARGET_URL); } catch { fail('fixture database URL is invalid'); }
  if (!LOCAL_HOSTS.has(target.hostname)) fail(`database host ${target.hostname} is not local`);
  const databaseName = target.pathname.replace(/^\//, '');
  if (!databaseName.startsWith(DB_PREFIX) || !/^consultify_w3_settings_owner_[a-z0-9_]+$/.test(databaseName)) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('SETTINGS_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://')) {
      fail('SETTINGS_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    }
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
  }
  return { target, admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires SETTINGS_OWNER_FIXTURE_CONFIRM=YES');
}

function manifest(databaseName, readback = null) {
  return {
    fixture: 'W3-SETTINGS-OWNER-v1',
    databaseName,
    deepLink: '/settings/profile',
    deepLinkVerified: false,
    destructiveExecution: false,
    oauthActivation: false,
    mfaEnrollment: false,
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    ownerJourney: [
      'profile harmless edit -> save -> refresh readback',
      'regional/theme/notifications preference -> save -> refresh readback',
      'export request/status/download on isolated data',
      'deletion wrong-password denial -> correct request -> cancel -> refresh readback',
      'legal-hold persona denial with zero destructive execution',
      'OAuth unavailable/revoke messaging and MFA deferral only',
    ],
    seededAlternates: {
      export: { requestId: IDS.exportRequest, status: 'pending' },
      deletion: { requestId: IDS.cancelledDeletion, status: 'cancelled', scheduledAt: null },
      wrongPassword: { seededSecret: false, expected: '403 and zero write' },
      legalHold: true,
    },
    readback,
  };
}

async function databaseExists(client, databaseName) {
  return Number((await client.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1', [databaseName])).rows[0].n) === 1;
}

function persistManifest(manifestPath, payload) {
  const bytes = `${JSON.stringify(payload, null, 2)}\n`;
  let handle;
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
    persisted?.fixture !== 'W3-SETTINGS-OWNER-v1' ||
    !Array.isArray(persisted?.personas) ||
    persisted.personas.length !== USERS.length ||
    Number(persisted?.readback?.personas) !== USERS.length
  ) {
    fail('persisted manifest schema/readback verification failed');
  }
  const serialized = JSON.stringify(persisted);
  for (const user of USERS) {
    if (serialized.includes(user.password)) fail('persisted manifest contains a fixture password');
  }
  return { path: manifestPath, bytes: Buffer.byteLength(bytes), mode: '0600', verified: true };
}

async function seed({ admin, databaseName, manifestPath }) {
  requireYes();
  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  try {
    if (await databaseExists(adminClient, databaseName)) fail('target database already exists; reset it first');
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);
  } finally { await adminClient.end(); }

  const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: TARGET_URL },
    encoding: 'utf8',
  });
  if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);

  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name] of [[IDS.mainOrg, 'W3 Settings Owner Review'], [IDS.foreignOrg, 'W3 Settings Foreign Boundary'], [IDS.legalHoldOrg, 'W3 Settings Legal Hold']]) {
      await client.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [id, name]);
    }
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone)
         VALUES($1,$2,$3,$4,$5,'Settings Fixture',$6,'active','pl','Europe/Warsaw')`,
        [user.id, user.org, user.email, hash, user.role === 'OWNER' ? 'Owner' : user.role === 'ADMIN' ? 'Admin' : 'Member', user.role]
      );
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [`membership-${user.id}`, user.org, user.id, user.role, user.status]
      );
    }
    await client.query(
      `INSERT INTO org_policies(id,organization_id,retention_days,legal_hold_enabled,residency_region)
       VALUES($1,$2,365,1,'EU')`,
      ['w3-settings-legal-hold-policy', IDS.legalHoldOrg]
    );
    for (const [key, value] of [
      ['settings:regional', { language: 'pl', timezone: 'Europe/Warsaw', currency: 'PLN' }],
      ['settings:appearance', { theme: 'light' }],
      ['settings:notifications', { email: true, push: false, inApp: true, digest: 'weekly' }],
    ]) {
      await client.query('INSERT INTO user_preferences(user_id,key,value) VALUES($1,$2,$3)', [IDS.owner, key, JSON.stringify(value)]);
    }
    await client.query(
      `INSERT INTO gdpr_requests(id,organization_id,user_id,type,status,request_type,requested_at,format,metadata)
       VALUES($1,$2,$3,'export','pending','export',CURRENT_TIMESTAMP,'json',$4)`,
      [IDS.exportRequest, IDS.mainOrg, IDS.owner, JSON.stringify({ fixture: true, portable: true })]
    );
    await client.query(
      `INSERT INTO gdpr_requests(id,organization_id,user_id,type,status,request_type,requested_at,reason,scheduled_at,metadata)
       VALUES($1,$2,$3,'deletion','cancelled','deletion',CURRENT_TIMESTAMP,'Owner cancelled during boundary review',NULL,$4)`,
      [IDS.cancelledDeletion, IDS.mainOrg, IDS.owner, JSON.stringify({ fixture: true, destructiveExecution: false })]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
  const payload = await readback({ databaseName });
  const persisted = persistManifest(manifestPath, payload);
  console.log(JSON.stringify({ manifestWritten: persisted }, null, 2));
  return payload;
}

async function readback({ databaseName }) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
        (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
        (SELECT count(*)::int FROM organization_members WHERE user_id=ANY($1::text[]) AND UPPER(status)='ACTIVE') active_memberships,
        (SELECT count(*)::int FROM organization_members WHERE user_id=$2 AND UPPER(status)='REVOKED') revoked_memberships,
        (SELECT count(*)::int FROM user_preferences WHERE user_id=$3) preferences,
        (SELECT count(*)::int FROM gdpr_requests WHERE id=ANY($4::text[])) gdpr_alternates,
        (SELECT legal_hold_enabled FROM org_policies WHERE organization_id=$5) legal_hold_enabled,
        (SELECT count(*)::int FROM user_mfa WHERE user_id=ANY($1::text[])) mfa_secrets,
        (SELECT count(*)::int FROM integrations WHERE organization_id=ANY($6::text[])) oauth_integrations`,
      [USERS.map((user) => user.id), IDS.revoked, IDS.owner, [IDS.exportRequest, IDS.cancelledDeletion], IDS.legalHoldOrg, [IDS.mainOrg, IDS.foreignOrg, IDS.legalHoldOrg]]
    );
    const payload = manifest(databaseName, result.rows[0]);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally { await client.end(); }
}

async function reset({ admin, databaseName }) {
  requireYes();
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    if (await databaseExists(client, databaseName)) await client.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    const absent = !(await databaseExists(client, databaseName));
    console.log(JSON.stringify({ fixture: 'W3-SETTINGS-OWNER-v1', databaseName, dropped: true, catalogAbsent: absent }, null, 2));
  } finally { await client.end(); }
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx);
else await reset(ctx);
