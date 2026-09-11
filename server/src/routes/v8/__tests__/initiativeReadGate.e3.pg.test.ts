/** @vitest-environment node */

/**
 * FIX-5 (97_ODBIOR_W1_W2.md §8): E3 (47 bramek `initiativeExists`/
 * `isInitiativeUnifiedReadEnabled`) had 2 gates actually switched by E1
 * Codex (`results.routes.ts` GET /dashboard, `execution-control.routes.ts`
 * GET /capacity/timeline) but ZERO test coverage — mutation M3 (force
 * `isInitiativeUnifiedReadEnabled()` to always return false) did not
 * redden anything for either route.
 *
 * §0.2e conditions asserted below: V8 enabled, Results beta enforcement
 * active, database is PostgreSQL, auth bypass disabled, unified read
 * toggled explicitly per-test (the thing under test).
 *
 * Real-DB-through-`ApiGateway` per FIX-5's own instruction — a canonical-only
 * initiative (registered via Runtime-v1, present in `ie_aggregate_state`,
 * absent from the legacy `initiatives` table) only resolves when the
 * unified reader is consulted. This avoids touching the global
 * `validateOrgMembership` mock (Z18) entirely.
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

describe('CODEX2 E3 read gates: results dashboard + execution-control capacity timeline', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;
  let foreignAuthorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,'CODEX2 E3','active'),($2,'CODEX2 E3 foreign','active')`,
      [organizationId, foreignOrganizationId]
    );
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active'),($4,$5,$6,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`, foreignUserId, foreignOrganizationId, `${foreignUserId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId, randomUUID(), foreignOrganizationId, foreignUserId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'CODEX2 E3 project',$3)`, [
      projectId,
      organizationId,
      userId,
    ]);

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    foreignAuthorization = `Bearer ${jwt.sign(
      {
        id: foreignUserId,
        userId: foreignUserId,
        email: `${foreignUserId}@test.invalid`,
        organizationId: foreignOrganizationId,
        organization_id: foreignOrganizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    // Register a CANONICAL-ONLY initiative: it lands in `ie_aggregate_state`
    // but never in the legacy `initiatives` table, so the OFF-path legacy
    // `SELECT ... FROM initiatives WHERE id = ...` genuinely cannot find it —
    // that is the property both gates under test are supposed to bridge.
    const sourceId = `manual-hub-${randomUUID()}`;
    const submit = await request(app)
      .post('/api/initiatives/runtime-v1/source-proposals')
      .set('Authorization', authorization)
      .send({
        proposalId,
        expectedVersion: 0,
        clientRequestId: `submit-${randomUUID()}`,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        provenance: {
          system: 'consultify.initiatives-hub',
          recordType: 'manual-initiative-proposal',
          capturedAt: new Date().toISOString(),
          evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`],
        },
        title: 'E3 gate initiative',
        problem: 'E3 gate problem',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        initiativeOwnerId: userId,
        visibility: 'PROJECT',
      });
    expect(submit.status, JSON.stringify(submit.body)).toBe(201);
    const register = await request(app)
      .post('/api/initiatives/runtime-v1/registrations')
      .set('Authorization', authorization)
      .send({
        initiativeId,
        expectedVersion: 0,
        clientRequestId: `register-${randomUUID()}`,
        proposalId,
        proposalVersion: 1,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        title: 'E3 gate initiative',
        problem: 'E3 gate problem',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        visibility: 'PROJECT',
        initiativeOwnerId: userId,
      });
    expect(register.status, JSON.stringify(register.body)).toBe(201);

    const legacyRow = await sql.query(`SELECT id FROM initiatives WHERE id = $1`, [initiativeId]);
    expect(legacyRow.rowCount, 'fixture must be canonical-only (absent from legacy initiatives table)').toBe(0);
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

  const routesUnderTest = [
    { name: 'results dashboard', path: () => `/api/v8/results/dashboard?initiativeId=${initiativeId}` },
    {
      name: 'execution-control capacity timeline',
      path: () => `/api/v8/execution-control/capacity/timeline?initiativeId=${initiativeId}`,
    },
  ];

  for (const route of routesUnderTest) {
    describe(route.name, () => {
      it('ON (unified read enabled): canonical-only initiative is NOT 404', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const response = await request(app).get(route.path()).set('Authorization', authorization);
        expect(response.status, JSON.stringify(response.body)).not.toBe(404);
      });

      it('OFF (unified read disabled): canonical-only initiative IS 404 — mutation M3 must redden this', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await request(app).get(route.path()).set('Authorization', authorization);
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body.code).toBe('INITIATIVE_NOT_FOUND');
      });

      it('foreign org, ON: still 404 (no cross-tenant leak)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const response = await request(app).get(route.path()).set('Authorization', foreignAuthorization);
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body.code).toBe('INITIATIVE_NOT_FOUND');
      });

      it('foreign org, OFF: still 404 (no cross-tenant leak)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await request(app).get(route.path()).set('Authorization', foreignAuthorization);
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body.code).toBe('INITIATIVE_NOT_FOUND');
      });
    });
  }
});
