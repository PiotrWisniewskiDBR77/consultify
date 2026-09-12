/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');
const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

describe.skipIf(!enabled)('CODEX6 E4 safe and complete tenant export contract', () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const orgId = `cx6-export-${suffix}`;
  const otherOrgId = `cx6-export-other-${suffix}`;
  const adminId = `cx6-export-admin-${suffix}`;
  const otherUserId = `cx6-export-other-user-${suffix}`;
  const initiativeId = `cx6-export-initiative-${suffix}`;
  const otherInitiativeId = `cx6-export-other-initiative-${suffix}`;
  const staffingPlanId = `cx6-export-plan-${suffix}`;
  const otherStaffingPlanId = `cx6-export-other-plan-${suffix}`;
  const rootTable = `cx6_export_root_${suffix}`;
  const childTable = `cx6_export_child_${suffix}`;
  const largeTable = `cx6_export_large_${suffix}`;
  const sharedUserRowsTable = `cx6_shared_user_rows_${suffix}`;
  const businessSessionsTable = `interview_sessions_${suffix}`;
  const sentinels = {
    password: `fixture-password-${suffix}`,
    mfaSecret: `fixture-mfa-${suffix}`,
    backupCodes: `fixture-backup-${suffix}`,
    accessToken: `fixture-token-${suffix}`,
    childSecret: `fixture-child-secret-${suffix}`,
    nestedToken: `fixture-nested-token-${suffix}`,
    camelApiKey: `fixture-camel-api-key-${suffix}`,
    textJsonSecret: `fixture-text-json-secret-${suffix}`,
    encryptedSecret: `fixture-encrypted-secret-${suffix}`,
  };
  let pool: Pool;
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name,organization_type,is_active) VALUES ($1,$2,'PAID',1),($3,$4,'PAID',1)`, [orgId, `Safe Export ${suffix}`, otherOrgId, `Other Export ${suffix}`]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,mfa_secret,mfa_backup_codes)
       VALUES ($1,$2,$3,$4,'Safe','Admin','ADMIN','active',$5,$6),($7,$8,$9,'other-password','Other','User','USER','active','other-mfa','other-backup')`,
      [adminId, orgId, `${adminId}@example.test`, sentinels.password, sentinels.mfaSecret, sentinels.backupCodes, otherUserId, otherOrgId, `${otherUserId}@example.test`]
    );
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'USER','ACTIVE')`, [randomUUID(), orgId, adminId, randomUUID(), otherOrgId, otherUserId]);
    await pool.query(`INSERT INTO initiatives(id,organization_id,name,status) VALUES ($1,$2,'Safe export initiative','DRAFT'),($3,$4,'Other export initiative','DRAFT')`, [initiativeId, orgId, otherInitiativeId, otherOrgId]);
    await pool.query(`INSERT INTO staffing_plans(id,initiative_id,organization_id,name) VALUES ($1,$2,$3,'Own staffing plan'),($4,$5,$6,'Other staffing plan')`, [staffingPlanId, initiativeId, orgId, otherStaffingPlanId, otherInitiativeId, otherOrgId]);
    await pool.query(`INSERT INTO staffing_plan_roles(id,staffing_plan_id,role_name) VALUES ('own-staffing-role',$1,'Own export role'),('other-staffing-role',$2,'Other export role')`, [staffingPlanId, otherStaffingPlanId]);
    await pool.query(`CREATE TABLE ${quoteIdentifier(rootTable)} (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), access_token TEXT, payload TEXT, config_json TEXT, metadata JSONB)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(childTable)} (id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES ${quoteIdentifier(rootTable)}(id), mfa_secret TEXT, note TEXT)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(largeTable)} (id INTEGER PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), label TEXT)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(sharedUserRowsTable)} (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), note TEXT)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(businessSessionsTable)} (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), summary TEXT)`);
    await pool.query(`INSERT INTO ${quoteIdentifier(rootTable)}(id,organization_id,access_token,payload,config_json,metadata) VALUES ('own-root',$1,$2,'own-payload',json_build_object('clientSecret',$3::text,'legalValue','kept')::text,jsonb_build_object('refresh_token',$4::text,'apiKey',$5::text,'legal_value','kept')),('other-root',$6,'other-token','other-payload','{}','{}')`, [orgId, sentinels.accessToken, sentinels.textJsonSecret, sentinels.nestedToken, sentinels.camelApiKey, otherOrgId]);
    await pool.query(`INSERT INTO integration_secrets(id,organization_id,secret_key,encrypted_value) VALUES ($1,$2,'clientSecret',$3)`, [`cx6-secret-${suffix}`, orgId, sentinels.encryptedSecret]);
    await pool.query(`INSERT INTO ${quoteIdentifier(childTable)}(id,root_id,mfa_secret,note) VALUES ('own-child','own-root',$1,'own-child-note'),('other-child','other-root','other-child-secret','other-child-note')`, [sentinels.childSecret]);
    await pool.query(`INSERT INTO ${quoteIdentifier(sharedUserRowsTable)}(id,org_id,user_id,note) VALUES ('shared-own',$1,$2,'shared-own-note'),('shared-other',$3,$2,'shared-other-note')`, [orgId, adminId, otherOrgId]);
    await pool.query(`INSERT INTO ${quoteIdentifier(businessSessionsTable)}(id,organization_id,summary) VALUES ('business-session-own',$1,'business-session-own-summary'),('business-session-other',$2,'business-session-other-summary')`, [orgId, otherOrgId]);
    await pool.query(`INSERT INTO ${quoteIdentifier(largeTable)}(id,organization_id,label) SELECT value,$1,'large-' || value FROM generate_series(1,20001) value`, [orgId]);

    const config = (await import('../../config/Config.js')).default;
    token = jwt.sign({ id: adminId, email: `${adminId}@example.test`, role: 'ADMIN', organizationId: orgId }, config.JWT_SECRET, { expiresIn: '15m' });
    const routes = (await import('../organization/ownership.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/organizations', routes);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(childTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(rootTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(largeTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(sharedUserRowsTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(businessSessionsTable)}`).catch(() => undefined);
    await pool.query('DELETE FROM integration_secrets WHERE id=$1', [`cx6-secret-${suffix}`]).catch(() => undefined);
    await pool.query('DELETE FROM staffing_plan_roles WHERE staffing_plan_id IN ($1,$2)', [staffingPlanId, otherStaffingPlanId]).catch(() => undefined);
    await pool.query('DELETE FROM staffing_plans WHERE organization_id IN ($1,$2)', [orgId, otherOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM initiatives WHERE organization_id IN ($1,$2)', [orgId, otherOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1,$2)', [orgId, otherOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id IN ($1,$2)', [orgId, otherOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id IN ($1,$2)', [orgId, otherOrgId]).catch(() => undefined);
    await pool.end();
  }, 120_000);

  it('JSON excludes secret values, includes FK descendants, has no silent row cap, and isolates tenants', async () => {
    const response = await request(app).get(`/api/organizations/${orgId}/export`).set('Authorization', `Bearer ${token}`);
    expect(response.status, response.text).toBe(200);
    const body = JSON.parse(response.text);
    const serialized = JSON.stringify(body);
    for (const sentinel of Object.values(sentinels)) expect(serialized).not.toContain(sentinel);
    for (const forbiddenField of ['password', 'mfa_secret', 'mfa_backup_codes', 'access_token', 'refresh_token']) {
      expect(serialized).not.toContain(`"${forbiddenField}"`);
    }
    expect(serialized).not.toContain(otherUserId);
    expect(serialized).not.toContain('other-payload');
    expect(serialized).not.toContain('other-child-note');
    expect(serialized).not.toContain('shared-other-note');
    expect(serialized).not.toContain('business-session-other-summary');
    expect(body.tables.users).toEqual([expect.objectContaining({ id: adminId, email: `${adminId}@example.test` })]);
    expect(body.tables[childTable]).toEqual([expect.objectContaining({ id: 'own-child', note: 'own-child-note' })]);
    expect(body.tables[sharedUserRowsTable]).toEqual([expect.objectContaining({ id: 'shared-own', note: 'shared-own-note' })]);
    expect(body.tables[businessSessionsTable]).toEqual([expect.objectContaining({ id: 'business-session-own', summary: 'business-session-own-summary' })]);
    expect(body.tables.staffing_plan_roles).toEqual([
      expect.objectContaining({ id: 'own-staffing-role', role_name: 'Own export role' }),
    ]);
    expect(serialized).not.toContain('other-staffing-role');
    expect(body.rowCounts[largeTable]).toBe(20_001);
    expect(body.securityManifest).toEqual(expect.objectContaining({ complete: true, truncated: false }));
    expect(body.securityManifest.excludedColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'users', classes: expect.arrayContaining(['authentication']), count: expect.any(Number) }),
      expect.objectContaining({ table: rootTable, classes: ['credential_or_security_material'], count: 1 }),
      expect.objectContaining({ table: childTable, classes: ['credential_or_security_material'], count: 1 }),
    ]));
    expect(body.securityManifest.excludedTables).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'integration_secrets' }),
    ]));
  }, 120_000);

  it('CSV is generated from the same safe complete result', async () => {
    const response = await request(app).get(`/api/organizations/${orgId}/export?format=csv`).set('Authorization', `Bearer ${token}`);
    expect(response.status, response.text).toBe(200);
    for (const sentinel of Object.values(sentinels)) expect(response.text).not.toContain(sentinel);
    for (const forbiddenField of ['password', 'mfa_secret', 'mfa_backup_codes', 'access_token', 'refresh_token']) {
      expect(response.text).not.toContain(`"${forbiddenField}"`);
    }
    expect(response.text).toContain('own-child-note');
    expect(response.text).toContain('own-staffing-role');
    expect(response.text).not.toContain('other-child-note');
    expect(response.text).not.toContain('other-staffing-role');
    expect(response.text.split(`"${largeTable}"`).length - 1).toBe(20_001);
  }, 120_000);
});
