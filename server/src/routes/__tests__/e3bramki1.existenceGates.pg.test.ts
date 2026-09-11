/** @vitest-environment node */

/**
 * §0.2e: (a) V8 is enabled (ENABLE_V8_GLOBAL=true, required for the
 * `/api/v8/results/*` mount), (b) the database is PostgreSQL
 * (assertRealPostgresTestEnvironment), (c) auth bypass is disabled
 * (ENABLE_TEST_AUTH_BYPASS != 'true' — real JWTs are signed below), (d) the
 * flag under test (ENABLE_INITIATIVE_UNIFIED_READ) is toggled explicitly per
 * assertion rather than relying on a process-wide default, (e) the fixture
 * initiative is created ONLY through the canonical runtime-v1 write path
 * (source-proposals -> registrations) and is NEVER inserted into the legacy
 * `initiatives` table — so "not 404" at ON can only come from the unified
 * reader's canonical branch, not from a legacy row, and (f) a second,
 * foreign-organization JWT proves tenant isolation independently of the
 * flag. These conditions are asserted in beforeAll/each test below.
 *
 * Scope: CODEX2 E3 paczka 1/3 — 15 bramek istnienia inicjatywy przełączone
 * na initiativeUnifiedReader w:
 *   - server/src/routes/v8/results.routes.ts (10 bramek)
 *   - server/src/controllers/InitiativeController.ts (5 bramek)
 * Ten plik testuje jedną reprezentatywną trasę per plik (zgodnie z kontraktem
 * FIX-5: "Test tras realdb ... dla KAŻDEJ paczki plików ... może być jeden
 * plik testu z tabelą przypadków"), plus dowód mutacyjny M3 jest wykonywany
 * ręcznie i opisany w raporcie (podmiana pliku przez `cp`, nie na stałe w
 * tym pliku testowym).
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

describe('CODEX2 E3 paczka 1 — bramki istnienia (results.routes.ts + InitiativeController.ts)', { retry: 0 }, () => {
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
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,'E3 pkt1','active'),($2,'E3 pkt1 foreign','active')`,
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
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'E3 pkt1 project',$3)`, [
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

    // Canonical-only fixture: created exclusively through the runtime-v1
    // write path, NEVER inserted into the legacy `initiatives` table. Any
    // "not 404" result at flag ON can therefore only come from the unified
    // reader's canonical branch.
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
        title: 'E3 pkt1 canonical',
        problem: 'E3 pkt1 problem',
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
        title: 'E3 pkt1 canonical',
        problem: 'E3 pkt1 problem',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        visibility: 'PROJECT',
        initiativeOwnerId: userId,
      });
    expect(register.status, JSON.stringify(register.body)).toBe(201);

    // SQL control: the fixture must be canonical-only.
    const legacyRow = await sql.query(`SELECT id FROM initiatives WHERE id = $1`, [initiativeId]);
    expect(legacyRow.rowCount).toBe(0);
    const canonicalRow = await sql.query(
      `SELECT aggregate_id FROM ie_aggregate_state WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [organizationId, initiativeId]
    );
    expect(canonicalRow.rowCount).toBe(1);
  }, 30_000);

  afterEach(() => {
    delete process.env.ENABLE_INITIATIVE_UNIFIED_READ;
  });

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

  // Table of cases: one representative route per touched file.
  //
  // `offStatus`: status expected at flag OFF for our CANONICAL-ONLY fixture,
  // matching the marker (488f01a4f0) bit for bit. For most gates that is 404
  // (no flag existed before E3, so a canonical-only record was invisible).
  // `InitiativeController.ts:3586` (getMilestones) is the one exception in
  // this packet: it already had an UNCONDITIONAL, flag-independent fallback
  // to `ie_aggregate_state` before E3 touched it (comment "DWA REJESTRY,
  // JEDNA INICJATYWA" in the source) — confirmed on the marker via
  // `git show 488f01a4f0:server/src/controllers/InitiativeController.ts`.
  // So OFF already returned 200 for a canonical-only record before this
  // packet, and the switch preserves that (Boolean((await A) || (await B))
  // reproduces the original ternary's short-circuit exactly).
  const cases: Array<{ label: string; call: (auth: string) => Promise<request.Response>; offStatus: number }> = [
    {
      label: 'results.routes.ts:606 GET /api/v8/results/reconciliations?initiativeId=',
      call: (auth) =>
        request(app)
          .get(`/api/v8/results/reconciliations?initiativeId=${initiativeId}`)
          .set('Authorization', auth),
      offStatus: 404,
    },
    {
      label: 'InitiativeController.ts:3586 GET /api/pmo/initiatives/:id/milestones',
      call: (auth) => request(app).get(`/api/pmo/initiatives/${initiativeId}/milestones`).set('Authorization', auth),
      offStatus: 200,
    },
  ];

  for (const { label, call, offStatus } of cases) {
    it(`${label} — OFF: zachowanie jak na markerze (${offStatus})`, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
      const response = await call(authorization);
      expect(response.status).toBe(offStatus);
    });

    it(`${label} — ON: rekord kanoniczny nie jest 404`, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
      const response = await call(authorization);
      expect(response.status, JSON.stringify(response.body)).not.toBe(404);
    });

    it(`${label} — obca organizacja: 404 przy ON`, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
      const response = await call(foreignAuthorization);
      expect(response.status).toBe(404);
    });

    it(`${label} — obca organizacja: 404 przy OFF`, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
      const response = await call(foreignAuthorization);
      expect(response.status).toBe(404);
    });
  }
});
