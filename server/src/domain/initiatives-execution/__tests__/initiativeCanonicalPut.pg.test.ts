/** @vitest-environment node */

/**
 * §0.2e: (a) V8 is enabled, (b) Results beta enforcement is active, (c) the
 * database is PostgreSQL, (d) auth bypass is disabled, (e) assertions inspect
 * the dedicated canonical-write error code rather than accepting any 409, and
 * (f) unified read is enabled explicitly. These conditions are asserted below.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

describe('CODEX2 E1 canonical PUT compatibility', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  // FIX-2 (97_ODBIOR_W1_W2.md §8): second owner candidate eligible via
  // organization_members.role IN ('OWNER','ADMIN') (postgresInitiativeReader
  // .isEligibleInitiativeOwner), and a third candidate that is an ACTIVE org
  // member but neither a project member/owner nor OWNER/ADMIN — ineligible.
  const eligibleOwnerId = randomUUID();
  const ineligibleOwnerId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    expect(process.env.ENABLE_INITIATIVE_UNIFIED_READ).toBe('true');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,'CODEX2 E1','active'),($2,'CODEX2 E1 foreign','active')`, [organizationId, foreignOrganizationId]);
    await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active'),($4,$5,$6,'local-only','OWNER','active')`, [userId, organizationId, `${userId}@test.invalid`, foreignUserId, foreignOrganizationId, `${foreignUserId}@test.invalid`]);
    await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','MEMBER','active'),($4,$5,$6,'local-only','MEMBER','active')`, [eligibleOwnerId, organizationId, `${eligibleOwnerId}@test.invalid`, ineligibleOwnerId, organizationId, `${ineligibleOwnerId}@test.invalid`]);
    await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`, [randomUUID(), organizationId, userId, randomUUID(), foreignOrganizationId, foreignUserId]);
    // eligibleOwnerId: ADMIN org role -> isEligibleInitiativeOwner() true via role branch.
    // ineligibleOwnerId: MEMBER org role, no project_members row, not project owner -> false.
    await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'MEMBER','ACTIVE')`, [randomUUID(), organizationId, eligibleOwnerId, randomUUID(), organizationId, ineligibleOwnerId]);
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'CODEX2 E1 project',$3)`, [projectId, organizationId, userId]);
    authorization = `Bearer ${jwt.sign({ id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const sourceId = `manual-hub-${randomUUID()}`;
    const submit = await request(app).post('/api/initiatives/runtime-v1/source-proposals').set('Authorization', authorization).send({ proposalId, expectedVersion: 0, clientRequestId: `submit-${randomUUID()}`, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, provenance: { system: 'consultify.initiatives-hub', recordType: 'manual-initiative-proposal', capturedAt: new Date().toISOString(), evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`] }, title: 'Before', problem: 'Before problem', proposedOutcome: null, priority: 'MEDIUM', projectId, initiativeOwnerId: userId, visibility: 'PROJECT' });
    expect(submit.status, JSON.stringify(submit.body)).toBe(201);
    const register = await request(app).post('/api/initiatives/runtime-v1/registrations').set('Authorization', authorization).send({ initiativeId, expectedVersion: 0, clientRequestId: `register-${randomUUID()}`, proposalId, proposalVersion: 1, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, title: 'Before', problem: 'Before problem', proposedOutcome: null, priority: 'MEDIUM', projectId, visibility: 'PROJECT', initiativeOwnerId: userId });
    expect(register.status, JSON.stringify(register.body)).toBe(201);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_outbox_events WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM ie_audit_events WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM ie_command_receipts WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM projects WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
    await sql.end();
  });

  it('keeps marker behavior when unified write is OFF', async () => {
    process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'false';
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', authorization).send({ title: 'Blocked while off' });
    expect(response.status).toBe(404);
  });

  it('routes supported fields to the canonical command and returns 200', async () => {
    process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', authorization).send({ title: 'After', summary: 'After outcome', description: 'After problem' });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.id).toBe(initiativeId);
  });

  it('persists the supported update in ie_aggregate_state', async () => {
    const result = await sql.query(`SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`, [organizationId, initiativeId]);
    expect(result.rows[0].payload_json.title).toBe('After');
    expect(result.rows[0].payload_json.problem).toBe('After problem');
    expect(result.rows[0].payload_json.proposedOutcome).toBe('After outcome');
  });

  it('rejects unsupported fields with the dedicated 409 contract', async () => {
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', authorization).send({ title: 'Still after', priority: 'high' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INITIATIVE_CANONICAL_WRITE_REQUIRED');
    expect(response.body.unsupportedFields).toEqual(expect.arrayContaining(['priority']));
    expect(response.body.canonicalWriter).toBe('/api/initiatives/runtime-v1');
  });

  it('rejects an ineligible ownerId with 422 INITIATIVE_OWNER_INELIGIBLE', async () => {
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', authorization).send({ ownerId: ineligibleOwnerId });
    expect(response.status, JSON.stringify(response.body)).toBe(422);
    expect(response.body.code).toBe('INITIATIVE_OWNER_INELIGIBLE');
    const result = await sql.query(`SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`, [organizationId, initiativeId]);
    expect(result.rows[0].payload_json.initiativeOwnerId).toBe(userId);
  });

  it('routes an eligible ownerId to the canonical command and persists it (FIX-2)', async () => {
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', authorization).send({ ownerId: eligibleOwnerId });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const result = await sql.query(`SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`, [organizationId, initiativeId]);
    expect(result.rows[0].payload_json.initiativeOwnerId).toBe(eligibleOwnerId);
  });

  it('does not reveal a canonical record to another tenant', async () => {
    const foreignToken = `Bearer ${jwt.sign({ id: foreignUserId, userId: foreignUserId, email: `${foreignUserId}@test.invalid`, organizationId: foreignOrganizationId, organization_id: foreignOrganizationId, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    const response = await request(app).put(`/api/initiatives/${initiativeId}`).set('Authorization', foreignToken).send({ title: 'Foreign write' });
    expect(response.status).toBe(404);
  });

  it('does not deliver any canonical outbox event', async () => {
    const result = await sql.query(`SELECT count(*)::int AS count FROM ie_outbox_delivery_receipts`);
    expect(result.rows[0].count).toBe(0);
  });
});
