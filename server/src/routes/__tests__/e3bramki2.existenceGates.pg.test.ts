/** @vitest-environment node */

/**
 * §0.2e: (a) V8 is enabled (ENABLE_V8_GLOBAL=true, required for the
 * `/api/v8/execution-control/*` mount), (b) the database is PostgreSQL
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
 * Scope: CODEX2 E3 paczka 2/3 — 16 kolejnych bramek istnienia inicjatywy
 * przełączone na initiativeUnifiedReader w:
 *   - server/src/controllers/InitiativeController.ts (4 bramki: addStakeholder,
 *     addWatcher, createRaidItem, updateGateRoles)
 *   - server/src/routes/v8/execution-control.routes.ts (4 bramki: budget/entries,
 *     realized, baseline realized, escalation entityType=INITIATIVE)
 *   - server/src/services/initiativeGovernanceService.ts (4 bramki:
 *     linkGoalToInitiative, createGovernanceGate, linkDecisionToInitiative,
 *     getInitiativeDecisions)
 *   - server/src/routes/pmo/initiatives.routes.ts (3 bramki: PATCH /:id/template,
 *     POST /:id/changes, POST /:id/apply-blueprint)
 *   - server/src/routes/benefits.routes.ts (1 z 3: POST /kpi-mappings)
 *
 * Zgodnie z FIX-5 ("Test tras realdb ... dla KAŻDEJ paczki plików ... może
 * być jeden plik testu z tabelą przypadków") ten plik testuje JEDNĄ
 * reprezentatywną trasę per dotknięty plik (5 tras łącznie) — wybraną tak,
 * żeby gałąź ON faktycznie przechodziła przez initiativeExists() bez
 * blokowania się o inny, niezwiązany brak zasobu (patrz komentarz przy
 * `kpiParentInitiativeId` / `kpiId` niżej dla benefits.routes.ts).
 *
 * Dowód mutacyjny M3 (isInitiativeUnifiedReadEnabled() -> false) jest
 * wykonywany ręcznie przez podmianę pliku `cp` (nie na stałe w tym pliku
 * testowym) i opisany w raporcie — wzorem e3bramki1.existenceGates.pg.test.ts.
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

describe(
  'CODEX2 E3 paczka 2 — bramki istnienia (InitiativeController.ts + execution-control.routes.ts + initiativeGovernanceService.ts + pmo/initiatives.routes.ts + benefits.routes.ts)',
  { retry: 0 },
  () => {
    const organizationId = randomUUID();
    const foreignOrganizationId = randomUUID();
    const userId = randomUUID();
    const foreignUserId = randomUUID();
    const projectId = randomUUID();
    const initiativeId = `initiative-${randomUUID()}`;
    const proposalId = `proposal-${randomUUID()}`;
    // Plain LEGACY fixtures used ONLY to satisfy an unrelated FK (KPI must
    // reference a real `initiatives` row) so the benefits.routes.ts case
    // exercises OUR gate, not a false 404 from a missing KPI parent. Kept
    // separate from `initiativeId` (which stays canonical-only) on purpose.
    const kpiParentInitiativeId = `initiative-legacy-${randomUUID()}`;
    const kpiId = `kpi-${randomUUID()}`;
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
        `INSERT INTO organizations(id,name,status) VALUES($1,'E3 pkt2','active'),($2,'E3 pkt2 foreign','active')`,
        [organizationId, foreignOrganizationId]
      );
      await sql.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active'),($4,$5,$6,'local-only','OWNER','active')`,
        [
          userId,
          organizationId,
          `${userId}@test.invalid`,
          foreignUserId,
          foreignOrganizationId,
          `${foreignUserId}@test.invalid`,
        ]
      );
      await sql.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, userId, randomUUID(), foreignOrganizationId, foreignUserId]
      );
      await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'E3 pkt2 project',$3)`, [
        projectId,
        organizationId,
        userId,
      ]);

      // Legacy KPI parent — NOT the fixture under test, only exists so
      // benefits.routes.ts's unrelated `parentKpi` lookup can succeed.
      await sql.query(`INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,'E3 pkt2 kpi parent','DRAFT')`, [
        kpiParentInitiativeId,
        organizationId,
      ]);
      await sql.query(
        `INSERT INTO initiative_kpis(id,initiative_id,organization_id,name) VALUES($1,$2,$3,'E3 pkt2 kpi')`,
        [kpiId, kpiParentInitiativeId, organizationId]
      );

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
          title: 'E3 pkt2 canonical',
          problem: 'E3 pkt2 problem',
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
          title: 'E3 pkt2 canonical',
          problem: 'E3 pkt2 problem',
          proposedOutcome: null,
          priority: 'MEDIUM',
          projectId,
          visibility: 'PROJECT',
          initiativeOwnerId: userId,
        });
      expect(register.status, JSON.stringify(register.body)).toBe(201);

      // SQL control: the fixture under test must be canonical-only.
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
      await sql.query(`DELETE FROM initiative_kpi_mappings WHERE organization_id IN ($1,$2)`, [
        organizationId,
        foreignOrganizationId,
      ]);
      await sql.query(`DELETE FROM initiative_governance_gates WHERE organization_id IN ($1,$2)`, [
        organizationId,
        foreignOrganizationId,
      ]);
      await sql.query(`DELETE FROM initiative_kpis WHERE organization_id IN ($1,$2)`, [
        organizationId,
        foreignOrganizationId,
      ]);
      await sql.query(`DELETE FROM initiative_budget_items WHERE organization_id IN ($1,$2)`, [
        organizationId,
        foreignOrganizationId,
      ]);
      await sql.query(`DELETE FROM initiatives WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
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

    // Table of cases: one representative route per touched file. All five
    // gates below were pure single-query lookups before this packet (no
    // pre-existing dual-fallback like InitiativeController.ts:3586 in
    // paczka 1), so `offStatus` is uniformly 404 for our canonical-only
    // fixture — matching the marker bit for bit.
    const cases: Array<{ label: string; call: (auth: string) => Promise<request.Response> }> = [
      {
        label: 'InitiativeController.ts updateGateRoles — PUT /api/initiatives/:id/gate-roles',
        call: (auth) =>
          request(app)
            .put(`/api/initiatives/${initiativeId}/gate-roles`)
            .set('Authorization', auth)
            .send({ roles: [] }),
      },
      {
        label: 'initiativeGovernanceService.ts createGovernanceGate — POST /api/initiatives-v4/initiatives/:initiativeId/gates',
        call: (auth) =>
          request(app)
            .post(`/api/initiatives-v4/initiatives/${initiativeId}/gates`)
            .set('Authorization', auth)
            .send({ gateName: 'E3 pkt2 gate' }),
      },
      {
        label: 'pmo/initiatives.routes.ts — PATCH /api/initiatives/:id/template',
        call: (auth) =>
          request(app)
            .patch(`/api/initiatives/${initiativeId}/template`)
            .set('Authorization', auth)
            .send({ templateId: null }),
      },
      {
        label: 'benefits.routes.ts — POST /api/benefits/kpi-mappings',
        call: (auth) =>
          request(app)
            .post('/api/benefits/kpi-mappings')
            .set('Authorization', auth)
            .send({ initiativeId, kpiId }),
      },
    ];

    for (const { label, call } of cases) {
      it(`${label} — OFF: zachowanie jak na markerze (404, rekord kanoniczny niewidoczny)`, async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await call(authorization);
        expect(response.status, JSON.stringify(response.body)).toBe(404);
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

    // execution-control.routes.ts is tested SEPARATELY, not through the
    // generic `cases` table above: the router-level mount
    // (`v8Router.use('/execution-control', requireCanonicalExecutionWriter,
    // executionControlRoutes)`, server/src/routes/v8/index.ts:119) runs
    // `requireCanonicalExecutionWriter` in front of EVERY route in this
    // file, and that middleware retires every non-GET method except one
    // explicit exception (`DELETE /budget/entries/:id`) with a flat 409
    // EXECUTION_RUNTIME_V1_WRITE_REQUIRED — BEFORE any of our four gates
    // (budget/entries, realized, baseline realized, escalation) ever run.
    // This is pre-existing (DEC-453, 07.09), unrelated to E3, and applies
    // identically at ON and OFF: measured here, not assumed. The four gates
    // inside these handlers are therefore currently unreachable via
    // ApiGateway with a real request — the E3 conversion itself was
    // verified by code inspection (identical ternary pattern to the
    // already-proven paczka 1 / paczka 2 gates above), but end-to-end HTTP
    // proof of "ON reveals the canonical record" is not obtainable for this
    // file until that upstream retirement gate is revisited (out of E3
    // scope — flagged in the report, not silently worked around).
    it('execution-control.routes.ts POST /budget/entries — 409 identycznie ON/OFF/obca-org (bramka wyżej w stosie, nie nasza)', async () => {
      for (const [flag, auth] of [
        ['false', authorization],
        ['true', authorization],
        ['false', foreignAuthorization],
        ['true', foreignAuthorization],
      ] as const) {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
        const response = await request(app)
          .post('/api/v8/execution-control/budget/entries')
          .set('Authorization', auth)
          .send({ initiativeId, entryType: 'ACTUAL', costType: 'CAPEX', amount: 100 });
        expect(response.status, JSON.stringify(response.body)).toBe(409);
        expect(response.body?.code).toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');
      }
    });
  }
);
