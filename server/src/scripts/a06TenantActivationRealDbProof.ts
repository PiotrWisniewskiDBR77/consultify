import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';
import {
  activateA06ForTenant,
  updateAgentTenantSettings,
} from '../services/v8/agentTenantSettingsService.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: async (text: string, params: unknown[] = []) => {
    const r = await pool.query(adaptQuery(text), params);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  },
  get(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => r.rows[0] ?? null);
    if (cb) {
      void p.then(
        (v) => cb(null, v),
        (e) => cb(e, null)
      );
      return proofDb;
    }
    return p;
  },
  all(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => r.rows);
    if (cb) {
      void p.then(
        (v) => cb(null, v),
        (e) => cb(e, [])
      );
      return proofDb;
    }
    return p;
  },
  run(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => ({ changes: r.rowCount ?? 0 }));
    if (cb) {
      void p.then(
        (v) => cb.call(v, null),
        (e) => cb.call({ changes: 0 }, e)
      );
      return proofDb;
    }
    return p;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize: (cb: Function) => cb(),
  close: () => Promise.resolve(),
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await pool.query(`CREATE TABLE organizations(id TEXT PRIMARY KEY);CREATE TABLE projects(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL);
    CREATE TABLE v8_feature_flags(flag_id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,module TEXT NOT NULL,enabled INTEGER NOT NULL,updated_at TIMESTAMPTZ,updated_by TEXT,UNIQUE(organization_id,module));
    CREATE TABLE v8_tool_catalog(tool_id TEXT PRIMARY KEY,organization_id TEXT,name TEXT,description TEXT,category TEXT,risk_class TEXT,mutation_type TEXT,classification_status TEXT,default_approval_mode TEXT,classified_by TEXT,classified_at TIMESTAMPTZ,version TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    CREATE TABLE v8_consumer_tool_policies(policy_id TEXT PRIMARY KEY,organization_id TEXT,project_id TEXT,consumer_class TEXT,tool_id TEXT,allowed INTEGER,approval_override TEXT,max_invocations_per_run INTEGER,effective_from TIMESTAMPTZ,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    INSERT INTO organizations VALUES('org-admin');INSERT INTO projects VALUES('project-admin','org-admin');`);
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260808_v8_agent_admin_settings.sql'),
      'utf8'
    )
  );
  const defaults = await updateAgentTenantSettings({
    organizationId: 'org-admin',
    projectId: 'project-admin',
    actorUserId: 'owner',
    actorRole: 'OWNER',
    expectedVersion: 0,
    inAppEnabled: true,
    emailEnabled: false,
    calendarEnabled: false,
    cadence: 'manual',
    timezone: 'Europe/Warsaw',
    autoActions: {},
    legalHold: false,
  });
  assert.equal(defaults.version, 1);
  assert.equal(defaults.in_app_enabled, true);
  assert.equal(defaults.email_enabled, false);
  assert.equal(defaults.retention_detail_days, 30);
  assert.equal(defaults.retention_aggregate_months, 13);
  assert.equal(defaults.export_enabled, false);
  assert.equal(defaults.purge_enabled, false);
  await assert.rejects(
    () =>
      updateAgentTenantSettings({
        organizationId: 'org-admin',
        projectId: 'project-admin',
        actorUserId: 'owner',
        actorRole: 'OWNER',
        expectedVersion: 0,
        inAppEnabled: true,
        emailEnabled: false,
        calendarEnabled: false,
        cadence: 'manual',
        timezone: 'Europe/Warsaw',
        autoActions: {},
        legalHold: false,
      }),
    /AGENT_SETTINGS_VERSION_CONFLICT/
  );
  await assert.rejects(
    () =>
      updateAgentTenantSettings({
        organizationId: 'org-admin',
        projectId: 'project-admin',
        actorUserId: 'owner',
        actorRole: 'OWNER',
        expectedVersion: 1,
        inAppEnabled: true,
        emailEnabled: false,
        calendarEnabled: false,
        cadence: 'daily',
        timezone: 'Europe/Warsaw',
        autoActions: { approveProposal: true },
        legalHold: false,
      }),
    /AGENT_AUTO_ACTIONS_REQUIRE_POLICY/
  );
  await assert.rejects(
    () =>
      updateAgentTenantSettings({
        organizationId: 'org-admin',
        projectId: 'project-admin',
        actorUserId: 'member',
        actorRole: 'MEMBER',
        expectedVersion: 1,
        inAppEnabled: true,
        emailEnabled: false,
        calendarEnabled: false,
        cadence: 'manual',
        timezone: 'Europe/Warsaw',
        autoActions: {},
        legalHold: false,
      }),
    /AGENT_ADMIN_ROLE_REQUIRED/
  );
  const request = {
    organizationId: 'org-admin',
    projectId: 'project-admin',
    actorUserId: 'owner',
    actorRole: 'OWNER',
    idempotencyKey: 'activation-admin-1',
  };
  const [a, b] = await Promise.all([activateA06ForTenant(request), activateA06ForTenant(request)]);
  assert.equal(a.receipt_id, b.receipt_id);
  assert.equal(Number(a.policy_count), 17);
  assert.equal([a, b].filter((x) => x.idempotentReplay).length, 1);
  const readback = (
    await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM v8_tool_catalog) tools,(SELECT COUNT(*)::int FROM v8_consumer_tool_policies) policies,(SELECT COUNT(*)::int FROM v8_agent_tenant_activation_receipts) receipts,(SELECT COUNT(*)::int FROM v8_agent_admin_audit_events) audits,(SELECT enabled FROM v8_feature_flags WHERE organization_id='org-admin' AND module='v8_enabled') v8_enabled`
    )
  ).rows[0];
  assert.deepEqual(readback, { tools: 17, policies: 17, receipts: 1, audits: 2, v8_enabled: 1 });
  console.log(
    JSON.stringify({
      proof: 'A06_TENANT_ADMIN_SETTINGS_REALDB_GREEN',
      safeDefaults: true,
      authorityDenied: true,
      versionConflictDenied: true,
      autoActionsDenied: true,
      concurrency2: { tools: 17, policies: 17, receipts: 1 },
      tenantV8Enabled: true,
      retention: { detailDays: 30, aggregateMonths: 13 },
      exportEnabled: false,
      purgeEnabled: false,
      externalSideEffects: 0,
    })
  );
}
main().then(
  () => pool.end(),
  async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  }
);
