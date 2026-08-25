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
import { randomBytes } from 'node:crypto';
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
const FIXTURE_ID = 'W3-SETTINGS-OWNER-v1';

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

function manifest(databaseName, ownershipNonce, readback = null) {
  return {
    schemaVersion: 'w3-settings-owner-v1',
    fixture: FIXTURE_ID,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId: FIXTURE_ID, ownershipNonce },
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
  if (
    payload?.fixture !== FIXTURE_ID ||
    payload?.fixtureId !== FIXTURE_ID ||
    payload?.ownershipState !== 'FINAL' ||
    payload?.marker?.table !== 'wave3_owner_fixture_markers' ||
    payload?.marker?.fixtureId !== FIXTURE_ID ||
    payload?.marker?.ownershipNonce !== payload?.ownershipNonce ||
    !/^[a-f0-9]{64}$/.test(payload?.ownershipNonce || '') ||
    !Array.isArray(payload?.personas) ||
    payload.personas.length !== USERS.length ||
    Number(payload?.readback?.personas) !== USERS.length
  ) fail('manifest schema/readback verification failed before write');
  for (const user of USERS) {
    if (bytes.includes(user.password)) fail('manifest contains a fixture password');
  }
  if (/postgres(?:ql)?:\/\//i.test(bytes)) fail('manifest contains a database URL');
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
    persisted?.fixture !== FIXTURE_ID ||
    persisted?.fixtureId !== FIXTURE_ID ||
    persisted?.ownershipState !== 'FINAL' ||
    persisted?.marker?.table !== 'wave3_owner_fixture_markers' ||
    persisted?.marker?.fixtureId !== FIXTURE_ID ||
    persisted?.marker?.ownershipNonce !== persisted?.ownershipNonce ||
    !/^[a-f0-9]{64}$/.test(persisted?.ownershipNonce || '') ||
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
  let createdByThisInvocation = false;
  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  try {
    if (await databaseExists(adminClient, databaseName)) fail('target database already exists; reset it first');
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);
    createdByThisInvocation = true;
  } finally { await adminClient.end(); }

  try {
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
        ['settings:regional', { language: 'pl', timezone: 'Europe/Warsaw', currency: 'PLN', units: 'metric', numberFormat: 'pl-PL', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDayOfWeek: 'monday' }],
        ['settings:appearance', { theme: 'light' }],
        ['settings:notifications', { email: true, push: false, inApp: true, digest: 'weekly' }],
        ['settings:notification-digest', { frequency: 'weekly', content: 'summary', format: 'html' }],
      ]) {
        await client.query('INSERT INTO user_preferences(user_id,key,value) VALUES($1,$2,$3)', [IDS.owner, key, JSON.stringify(value)]);
      }
      await client.query(
        `INSERT INTO gdpr_requests(id,organization_id,user_id,type,status,request_type,requested_at,format,metadata)
         VALUES($1,$2,$3,'export','pending','export',CURRENT_TIMESTAMP,'json',$4)`,
        [IDS.exportRequest, IDS.mainOrg, IDS.owner, JSON.stringify({ fixture: true, portable: true })]
      );
      await client.query(
        `INSERT INTO data_export_requests(id,organization_id,user_id,export_type,status,requested_at,expires_at)
         VALUES($1,$2,$3,'gdpr','pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '7 days')`,
        [IDS.exportRequest, IDS.mainOrg, IDS.owner]
      );
      await client.query(
        `INSERT INTO gdpr_requests(id,organization_id,user_id,type,status,request_type,requested_at,reason,scheduled_at,metadata)
         VALUES($1,$2,$3,'deletion','cancelled','deletion',CURRENT_TIMESTAMP,'Owner cancelled during boundary review',NULL,$4)`,
        [IDS.cancelledDeletion, IDS.mainOrg, IDS.owner, JSON.stringify({ fixture: true, destructiveExecution: false })]
      );
      const ownershipNonce = randomBytes(32).toString('hex');
      await client.query(`CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
        fixture_id text PRIMARY KEY, ownership_nonce text NOT NULL, database_name text NOT NULL)`);
      await client.query(
        `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
         VALUES($1,$2,current_database())`,
        [FIXTURE_ID, ownershipNonce]
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
  } catch (error) {
    if (createdByThisInvocation) {
      const cleanup = new pg.Client({ connectionString: admin.toString() });
      await cleanup.connect();
      try {
        await cleanup.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]);
        await cleanup.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } finally { await cleanup.end(); }
    }
    throw error;
  }
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
        (SELECT count(*)::int FROM organization_members WHERE
          (user_id=$3 AND role='OWNER' AND UPPER(status)='ACTIVE') OR
          (user_id=$10 AND role='MEMBER' AND UPPER(status)='ACTIVE') OR
          (user_id=$11 AND role='ADMIN' AND UPPER(status)='ACTIVE') OR
          (user_id=$12 AND role='OWNER' AND UPPER(status)='ACTIVE') OR
          (user_id=$2 AND role='MEMBER' AND UPPER(status)='REVOKED') OR
          (user_id=$13 AND role='OWNER' AND UPPER(status)='ACTIVE')) persona_access_contracts,
        (SELECT count(*)::int FROM user_preferences WHERE user_id=$3) preferences,
        (SELECT first_name FROM users WHERE id=$3) owner_first_name,
        (SELECT language FROM users WHERE id=$3) owner_language,
        (SELECT timezone FROM users WHERE id=$3) owner_timezone,
        (SELECT value::jsonb->>'language' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_language,
        (SELECT value::jsonb->>'timezone' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_timezone,
        (SELECT value::jsonb->>'currency' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_currency,
        (SELECT value::jsonb->>'units' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_units,
        (SELECT value::jsonb->>'numberFormat' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_number_format,
        (SELECT value::jsonb->>'dateFormat' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_date_format,
        (SELECT value::jsonb->>'timeFormat' FROM user_preferences WHERE user_id=$3 AND key='settings:regional') regional_time_format,
        (SELECT value::jsonb->>'theme' FROM user_preferences WHERE user_id=$3 AND key='settings:appearance') appearance_theme,
        (SELECT value::jsonb->>'frequency' FROM user_preferences WHERE user_id=$3 AND key='settings:notification-digest') notification_digest,
        (SELECT count(*)::int FROM gdpr_requests WHERE id=ANY($4::text[])) gdpr_alternates,
        (SELECT status FROM data_export_requests WHERE id=$8 AND organization_id=$14 AND user_id=$3) export_status,
        (SELECT status FROM gdpr_requests WHERE id=$9) deletion_status,
        (SELECT scheduled_at FROM gdpr_requests WHERE id=$9) deletion_scheduled_at,
        (SELECT legal_hold_enabled FROM org_policies WHERE organization_id=$5) legal_hold_enabled,
        (SELECT count(*)::int FROM user_mfa WHERE user_id=ANY($1::text[])) mfa_secrets,
        (SELECT count(*)::int FROM integrations WHERE organization_id=ANY($6::text[])) oauth_integrations,
        (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations,
        (SELECT ownership_nonce FROM public.wave3_owner_fixture_markers WHERE fixture_id=$7 AND database_name=current_database()) ownership_nonce`,
      [USERS.map((user) => user.id), IDS.revoked, IDS.owner, [IDS.exportRequest, IDS.cancelledDeletion], IDS.legalHoldOrg, [IDS.mainOrg, IDS.foreignOrg, IDS.legalHoldOrg], FIXTURE_ID, IDS.exportRequest, IDS.cancelledDeletion, IDS.member, IDS.admin, IDS.foreign, IDS.legalHold, IDS.mainOrg]
    );
    const row = result.rows[0];
    if (
      Number(row.personas) !== 6 ||
      Number(row.active_memberships) !== 5 ||
      Number(row.revoked_memberships) !== 1 ||
      Number(row.persona_access_contracts) !== 6 ||
      Number(row.preferences) !== 4 ||
      row.owner_first_name !== 'Owner' ||
      row.owner_language !== 'pl' ||
      row.owner_timezone !== 'Europe/Warsaw' ||
      row.regional_language !== 'pl' ||
      row.regional_timezone !== 'Europe/Warsaw' ||
      row.regional_currency !== 'PLN' ||
      row.regional_units !== 'metric' ||
      row.regional_number_format !== 'pl-PL' ||
      row.regional_date_format !== 'DD/MM/YYYY' ||
      row.regional_time_format !== '24h' ||
      row.appearance_theme !== 'light' ||
      row.notification_digest !== 'weekly' ||
      Number(row.gdpr_alternates) !== 2 ||
      row.export_status !== 'pending' ||
      row.deletion_status !== 'cancelled' ||
      row.deletion_scheduled_at !== null ||
      Number(row.legal_hold_enabled) !== 1 ||
      Number(row.mfa_secrets) !== 0 ||
      Number(row.oauth_integrations) !== 0 ||
      Number(row.successful_migrations) < 831 ||
      !/^[a-f0-9]{64}$/.test(row.ownership_nonce || '')
    ) fail('FINAL profile/preferences/access/data-controls/legal-hold readback mismatch');
    const payload = manifest(databaseName, row.ownership_nonce, row);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally { await client.end(); }
}

async function reset({ admin, databaseName }) {
  requireYes();
  if (!MANIFEST_PATH || !path.isAbsolute(MANIFEST_PATH) || !fs.existsSync(MANIFEST_PATH))
    fail('reset requires exact existing SETTINGS_OWNER_FIXTURE_MANIFEST');
  if (fs.lstatSync(MANIFEST_PATH).isSymbolicLink() || (fs.statSync(MANIFEST_PATH).mode & 0o777) !== 0o600)
    fail('reset manifest must be a regular non-symlink 0600 file');
  const receipt = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (
    receipt.fixture !== FIXTURE_ID || receipt.fixtureId !== FIXTURE_ID ||
    receipt.ownershipState !== 'FINAL' || receipt.databaseName !== databaseName ||
    receipt.marker?.table !== 'wave3_owner_fixture_markers' ||
    receipt.marker?.fixtureId !== FIXTURE_ID ||
    receipt.marker?.ownershipNonce !== receipt.ownershipNonce
  ) fail('reset manifest ownership binding mismatch');
  const owned = new pg.Client({ connectionString: TARGET_URL });
  await owned.connect();
  try {
    const marker = await owned.query(
      `SELECT database_name FROM public.wave3_owner_fixture_markers
       WHERE fixture_id=$1 AND ownership_nonce=$2`,
      [FIXTURE_ID, receipt.ownershipNonce]
    );
    if (marker.rowCount !== 1 || marker.rows[0].database_name !== databaseName)
      fail('reset durable ownership marker mismatch');
  } finally { await owned.end(); }
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    if (await databaseExists(client, databaseName)) await client.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    const absent = !(await databaseExists(client, databaseName));
    console.log(JSON.stringify({ fixture: FIXTURE_ID, databaseName, dropped: true, catalogAbsent: absent, manifestPreserved: true }, null, 2));
  } finally { await client.end(); }
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx);
else await reset(ctx);
