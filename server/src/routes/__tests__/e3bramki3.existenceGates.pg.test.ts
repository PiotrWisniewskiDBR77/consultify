/** @vitest-environment node */

/**
 * §0.2e: (a) V8 is enabled (ENABLE_V8_GLOBAL=true, required for the
 * `/api/v8/*` mounts), (b) the database is PostgreSQL
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
 * Scope: CODEX2 E3 paczka 3/3 — the last 15 existence gates switched onto
 * initiativeUnifiedReader:
 *   - server/src/routes/benefits.routes.ts (2: roi/assumptions PUT,
 *     roi/realized POST)
 *   - server/src/routes/v8/execution.routes.ts (2: GET /runs, POST /runs)
 *   - server/src/controllers/DecisionController.ts (1: createDecision's
 *     assertRelatedObjectsBelongToOrg)
 *   - server/src/routes/initiatives-additive.routes.ts (1: the shared
 *     initiativeExistsInOrg() helper backing all 4 call sites in the file)
 *   - server/src/routes/pmo/initiativeClosure.routes.ts (1: GET
 *     /:id/closure-requests)
 *   - server/src/routes/v8/finance-value.routes.ts (1: POST
 *     /post-investment-reviews)
 *   - server/src/routes/v8/interview-insights.routes.ts (1: POST
 *     .../handoff target_initiative_id)
 *   - server/src/services/financialModelingService.ts (1: createModel's
 *     cross-org FK-injection guard)
 *   - server/src/services/initiative/initiativeClosureService.ts (1:
 *     addEvidence — FOR UPDATE row lock kept, unified-reader fallback added
 *     only for the case the legacy row is missing; see file comment)
 *   - server/src/services/interviewEnterpriseService.ts (1:
 *     promoteFindingToInitiative)
 *   - server/src/services/v8/planningPortfolioReadService.ts (1:
 *     getInitiativeTaskDependenciesRead)
 *   - server/src/services/workCanvasService.ts (1:
 *     confirmTargetObjectReadBack's 'initiative' case — exported in this
 *     packet, testability-only, so it can be called directly instead of
 *     reconstructing the full approveProposal materialization pipeline)
 *
 * The 7 route files are exercised through ApiGateway (one representative
 * request per file, per FIX-5). The 5 service files have no meaningfully
 * light HTTP entry point for the exact gate touched (they sit behind
 * heavier orchestration — capability middleware, idempotency headers, or a
 * multi-step materialization pipeline) — per the task contract ("dla
 * serwisów bez trasy — test jednostkowy serwisu na realnym PG") they are
 * called directly instead, still against the real Postgres fixture.
 *
 * Dowód mutacyjny M3 (isInitiativeUnifiedReadEnabled() -> false) jest
 * wykonywany ręcznie przez podmianę pliku `cp` (nie na stałe w tym pliku
 * testowym) i opisany w raporcie — wzorem e3bramki1/e3bramki2.
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
import { createModel } from '../../services/financialModelingService.js';
import {
  addEvidence,
  ClosureGateFailure,
} from '../../services/initiative/initiativeClosureService.js';
import {
  InterviewDistributionError,
  interviewEnterpriseService,
} from '../../services/interviewEnterpriseService.js';
import { getInitiativeTaskDependenciesRead } from '../../services/v8/planningPortfolioReadService.js';
import { confirmTargetObjectReadBack } from '../../services/workCanvasService.js';

describe(
  'CODEX2 E3 paczka 3 — bramki istnienia (benefits/execution/decisions/initiatives-additive/initiative-closure/finance-value/interview-insights routes + 5 serwisów)',
  { retry: 0 },
  () => {
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
        `INSERT INTO organizations(id,name,status) VALUES($1,'E3 pkt3','active'),($2,'E3 pkt3 foreign','active')`,
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
      await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'E3 pkt3 project',$3)`, [
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
      // "not 404 / not blocked" result at flag ON can therefore only come
      // from the unified reader's canonical branch.
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
          title: 'E3 pkt3 canonical',
          problem: 'E3 pkt3 problem',
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
          title: 'E3 pkt3 canonical',
          problem: 'E3 pkt3 problem',
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
      await sql.query(`DELETE FROM task_dependencies WHERE from_task_id LIKE 'e3pkt3-%' OR to_task_id LIKE 'e3pkt3-%'`);
      await sql.query(`DELETE FROM tasks WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM roi_realized_values WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM roi_assumptions WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM decisions WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM initiative_suggested_changes WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM initiative_closure_requests WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM financial_models WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM interview_findings WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM interview_insight_evidence_pointers WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM interview_insight_findings WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
      await sql.query(`DELETE FROM interview_insights WHERE organization_id IN ($1,$2)`, [organizationId, foreignOrganizationId]);
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

    // ------------------------------------------------------------------
    // Route files — one representative request per file, uniform 404
    // envelope. Table of cases (FIX-5 shape), same as e3bramki1/2.
    // ------------------------------------------------------------------
    const cases: Array<{ label: string; call: (auth: string) => Promise<request.Response> }> = [
      {
        label: 'benefits.routes.ts — PUT /api/benefits/roi/:initiativeId/assumptions',
        call: (auth) =>
          request(app)
            .put(`/api/benefits/roi/${initiativeId}/assumptions`)
            .set('Authorization', auth)
            .send({ capex: 1000, opexAnnual: 100, horizonMonths: 12 }),
      },
      {
        label: 'execution.routes.ts — GET /api/v8/execution/runs?initiativeId=',
        call: (auth) =>
          request(app)
            .get(`/api/v8/execution/runs`)
            .query({ initiativeId })
            .set('Authorization', auth),
      },
      {
        label: 'initiatives-additive.routes.ts — POST /api/initiatives/:initiativeId/suggested-changes',
        call: (auth) =>
          request(app)
            .post(`/api/initiatives/${initiativeId}/suggested-changes`)
            .set('Authorization', auth)
            .send({ kind: 'extend', title: 'E3 pkt3 suggested change' }),
      },
      {
        label: 'pmo/initiativeClosure.routes.ts — GET /api/initiatives/:id/closure-requests',
        call: (auth) =>
          request(app)
            .get(`/api/initiatives/${initiativeId}/closure-requests`)
            .set('Authorization', auth),
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

    // DecisionController.ts — assertRelatedObjectsBelongToOrg does NOT 404;
    // it 400s with a named field. Same shape, different envelope — tested
    // separately so the assertion matches what the code actually returns.
    describe('DecisionController.ts — POST /api/decisions (assertRelatedObjectsBelongToOrg)', () => {
      it('OFF: zastana query — 400 initiativeId (rekord kanoniczny niewidoczny)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await request(app)
          .post('/api/decisions')
          .set('Authorization', authorization)
          .send({ title: 'E3 pkt3 decision', initiativeId });
        expect(response.status, JSON.stringify(response.body)).toBe(400);
        expect(response.body?.field).toBe('initiativeId');
      });

      it('ON: initiativeExists — rekord kanoniczny nie blokuje na polu initiativeId', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const response = await request(app)
          .post('/api/decisions')
          .set('Authorization', authorization)
          .send({ title: 'E3 pkt3 decision', initiativeId });
        expect(response.body?.field).not.toBe('initiativeId');
      });

      it('obca organizacja: 400 initiativeId przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          const response = await request(app)
            .post('/api/decisions')
            .set('Authorization', foreignAuthorization)
            .send({ title: 'E3 pkt3 decision foreign', initiativeId });
          expect(response.status, JSON.stringify(response.body)).toBe(400);
          expect(response.body?.field).toBe('initiativeId');
        }
      });
    });

    // finance-value.routes.ts — POST /post-investment-reviews. Full success
    // requires a real baseline model + actuals we deliberately don't build
    // (out of scope for an existence-gate test) — instead we assert on the
    // response `code` specifically, which distinguishes "blocked by OUR
    // gate" (INITIATIVE_NOT_FOUND) from "blocked further downstream by
    // something else" (any other code, e.g. from createPostInvestmentReview
    // rejecting the fake baselineModelId).
    describe('finance-value.routes.ts — POST /api/v8/finance/value-tracking/post-investment-reviews', () => {
      const body = {
        actualIds: ['nonexistent-actual'],
        baselineModelId: 'nonexistent-baseline-model',
        baselineExpectedVersion: 1,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: '2026-01-01',
      };
      it('OFF: zastana query — 404 INITIATIVE_NOT_FOUND (rekord kanoniczny niewidoczny)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await request(app)
          .post('/api/v8/finance/value-tracking/post-investment-reviews')
          .set('Authorization', authorization)
          .set('Idempotency-Key', `e3pkt3-off-${randomUUID()}`)
          .send({ ...body, initiativeId });
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body?.code).toBe('INITIATIVE_NOT_FOUND');
      });

      it('ON: initiativeExists — nie blokuje na INITIATIVE_NOT_FOUND', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const response = await request(app)
          .post('/api/v8/finance/value-tracking/post-investment-reviews')
          .set('Authorization', authorization)
          .set('Idempotency-Key', `e3pkt3-on-${randomUUID()}`)
          .send({ ...body, initiativeId });
        expect(response.body?.code).not.toBe('INITIATIVE_NOT_FOUND');
      });

      it('obca organizacja: 404 INITIATIVE_NOT_FOUND przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          const response = await request(app)
            .post('/api/v8/finance/value-tracking/post-investment-reviews')
            .set('Authorization', foreignAuthorization)
            .set('Idempotency-Key', `e3pkt3-foreign-${flag}-${randomUUID()}`)
            .send({ ...body, initiativeId });
          expect(response.status, JSON.stringify(response.body)).toBe(404);
          expect(response.body?.code).toBe('INITIATIVE_NOT_FOUND');
        }
      });
    });

    // interview-insights.routes.ts — POST .../handoff (target_initiative_id,
    // link mode). Fixture built directly through the real (unmocked)
    // interviewInsightFindingsService functions — insight row inserted
    // directly (no FK on interview_insight_findings, verified against
    // 753_p10_interview_insight_artifact.sql), finding/evidence/readback
    // created through the real service so canPublishFinding + the readback
    // gate both pass and the ONLY thing left blocking is our initiativeId
    // check.
    describe('interview-insights.routes.ts — POST .../insights/:insightId/findings/:findingId/handoff', () => {
      const insightId = `insight-e3pkt3-${randomUUID()}`;
      let findingId: string;

      beforeAll(async () => {
        const {
          addFinding,
          addEvidencePointer,
          updateFindingReadback,
        } = await import('../../services/v8/interviewInsightFindingsService.js');
        await sql.query(
          `INSERT INTO interview_insights(id, organization_id, title, prompt_type, status, created_by)
           VALUES ($1, $2, 'E3 pkt3 insight', 'summary', 'completed', $3)`,
          [insightId, organizationId, userId]
        );
        const created = await addFinding(
          insightId,
          {
            finding_statement: 'E3 pkt3 finding statement',
            confidence_level: 'high',
            limits: 'E3 pkt3 limits',
            next_action: 'E3 pkt3 next action',
          },
          { organizationId, actorUserId: userId }
        );
        expect(created.error, JSON.stringify(created)).toBeUndefined();
        findingId = created.finding!.id;
        const pointer = await addEvidencePointer(
          insightId,
          findingId,
          { type: 'attachment', sourceRef: 'evidence://e3pkt3', sourceFingerprint: 'fp-e3pkt3' },
          userId
        );
        expect(pointer.error, JSON.stringify(pointer)).toBeUndefined();
        const readback = await updateFindingReadback(
          insightId,
          findingId,
          { readback_status: 'confirmed_by_client', readback_summary: 'Client confirmed E3 pkt3.' },
          userId
        );
        expect(readback.error, JSON.stringify(readback)).toBeUndefined();
      }, 30_000);

      it('OFF: zastana query — 404 P10_TARGET_INITIATIVE_NOT_FOUND', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const response = await request(app)
          .post(`/api/v8/interview/insights/${insightId}/findings/${findingId}/handoff`)
          .set('Authorization', authorization)
          .send({ target_initiative_id: initiativeId });
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body?.code).toBe('P10_TARGET_INITIATIVE_NOT_FOUND');
      });

      it('ON: initiativeExists — nie blokuje na P10_TARGET_INITIATIVE_NOT_FOUND', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const response = await request(app)
          .post(`/api/v8/interview/insights/${insightId}/findings/${findingId}/handoff`)
          .set('Authorization', authorization)
          .send({ target_initiative_id: initiativeId });
        expect(response.body?.code).not.toBe('P10_TARGET_INITIATIVE_NOT_FOUND');
      });

      it('obca organizacja: 404 przy ON i OFF (blokuje wcześniej — insight sam nie należy do obcej org — ale tenant izolacja trzyma)', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          const response = await request(app)
            .post(`/api/v8/interview/insights/${insightId}/findings/${findingId}/handoff`)
            .set('Authorization', foreignAuthorization)
            .send({ target_initiative_id: initiativeId });
          // The insight itself belongs to `organizationId`, so the route's
          // OWN insight-ownership check ('Insight not found') fires before
          // our target_initiative_id gate is ever reached — a stricter,
          // earlier 404 than P10_TARGET_INITIATIVE_NOT_FOUND. Either way the
          // foreign org never sees the canonical initiative: 404 both ON/OFF.
          expect(response.status, JSON.stringify(response.body)).toBe(404);
        }
      });
    });

    // ------------------------------------------------------------------
    // Service files without a light HTTP entry point for the exact gate —
    // called directly against the real Postgres fixture (task contract:
    // "dla serwisów bez trasy — test jednostkowy serwisu na realnym PG").
    // ------------------------------------------------------------------

    describe('financialModelingService.ts — createModel (cross-org FK-injection guard)', () => {
      const createdModelIds: string[] = [];
      afterAll(async () => {
        if (createdModelIds.length) {
          await sql.query(`DELETE FROM financial_models WHERE id = ANY($1)`, [createdModelIds]);
        }
      });

      it('OFF: zastana query — throws (rekord kanoniczny niewidoczny)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        await expect(
          createModel({
            organizationId,
            initiativeId,
            name: 'E3 pkt3 model OFF',
            startDate: '2026-01-01',
            createdBy: userId,
          })
        ).rejects.toThrow('Source initiative not found');
      });

      it('ON: initiativeExists — nie rzuca, model powstaje', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const modelId = await createModel({
          organizationId,
          initiativeId,
          name: 'E3 pkt3 model ON',
          startDate: '2026-01-01',
          createdBy: userId,
        });
        expect(modelId).toBeTruthy();
        createdModelIds.push(modelId);
      });

      it('obca organizacja: throws przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          await expect(
            createModel({
              organizationId: foreignOrganizationId,
              initiativeId,
              name: `E3 pkt3 model foreign ${flag}`,
              startDate: '2026-01-01',
              createdBy: foreignUserId,
            })
          ).rejects.toThrow('Source initiative not found');
        }
      });
    });

    describe('initiativeClosureService.ts — addEvidence (FOR UPDATE lock kept, canonical fallback added)', () => {
      const closureRequestId = `closure-req-e3pkt3-${randomUUID()}`;

      it('OFF: zastana query (FOR UPDATE) — ClosureGateFailure INITIATIVE_NOT_FOUND', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        await expect(
          addEvidence({
            orgId: organizationId,
            initiativeId,
            closureRequestId,
            actorId: userId,
            evidenceType: 'task',
            evidenceRefId: randomUUID(),
          })
        ).rejects.toMatchObject({ code: 'INITIATIVE_NOT_FOUND' });
      });

      it('ON: fallback initiativeExists — przechodzi bramkę (pada dalej na CLOSURE_REQUEST_NOT_FOUND, nie na naszej)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        await expect(
          addEvidence({
            orgId: organizationId,
            initiativeId,
            closureRequestId,
            actorId: userId,
            evidenceType: 'task',
            evidenceRefId: randomUUID(),
          })
        ).rejects.toMatchObject({ code: 'CLOSURE_REQUEST_NOT_FOUND' });
      });

      it('obca organizacja: INITIATIVE_NOT_FOUND przy ON i OFF (tenant isolation, nie CLOSURE_REQUEST_NOT_FOUND)', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          await expect(
            addEvidence({
              orgId: foreignOrganizationId,
              initiativeId,
              closureRequestId,
              actorId: foreignUserId,
              evidenceType: 'task',
              evidenceRefId: randomUUID(),
            })
          ).rejects.toMatchObject({ code: 'INITIATIVE_NOT_FOUND' });
        }
      });
    });

    describe('interviewEnterpriseService.ts — promoteFindingToInitiative', () => {
      it('OFF: zastana query — InterviewDistributionError INITIATIVE_NOT_FOUND', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        await expect(
          interviewEnterpriseService.promoteFindingToInitiative(organizationId, randomUUID(), initiativeId)
        ).rejects.toMatchObject({ code: 'INITIATIVE_NOT_FOUND' });
      });

      it('ON: initiativeExists — nie rzuca (finding nie istnieje -> zwraca false, nie blokuje na bramce)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        await expect(
          interviewEnterpriseService.promoteFindingToInitiative(organizationId, randomUUID(), initiativeId)
        ).resolves.toBe(false);
      });

      it('obca organizacja: INITIATIVE_NOT_FOUND przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          await expect(
            interviewEnterpriseService.promoteFindingToInitiative(
              foreignOrganizationId,
              randomUUID(),
              initiativeId
            )
          ).rejects.toMatchObject({ code: 'INITIATIVE_NOT_FOUND' });
        }
      });
    });

    describe('planningPortfolioReadService.ts — getInitiativeTaskDependenciesRead', () => {
      const fromTaskId = `e3pkt3-task-from-${randomUUID()}`;
      const toTaskId = `e3pkt3-task-to-${randomUUID()}`;
      const depId = `e3pkt3-dep-${randomUUID()}`;

      beforeAll(async () => {
        await sql.query(
          `INSERT INTO tasks(id, organization_id, initiative_id, title, status, priority)
           VALUES ($1,$2,$3,'E3 pkt3 task from','todo','medium'),
                  ($4,$2,$3,'E3 pkt3 task to','todo','medium')`,
          [fromTaskId, organizationId, initiativeId, toTaskId]
        );
        await sql.query(
          `INSERT INTO task_dependencies(id, from_task_id, to_task_id, dependency_type)
           VALUES ($1,$2,$3,'finish_to_start')`,
          [depId, fromTaskId, toTaskId]
        );
      }, 30_000);

      it('OFF: zastana query — [] (rekord kanoniczny niewidoczny, bramka wraca wcześnie)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        const rows = await getInitiativeTaskDependenciesRead(initiativeId, organizationId);
        expect(rows).toEqual([]);
      });

      it('ON: initiativeExists — zależność jest widoczna (dowód, że bramka NIE wraca wcześnie)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        const rows = await getInitiativeTaskDependenciesRead(initiativeId, organizationId);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]).toMatchObject({ id: depId });
      });

      it('obca organizacja: [] przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          const rows = await getInitiativeTaskDependenciesRead(initiativeId, foreignOrganizationId);
          expect(rows).toEqual([]);
        }
      });
    });

    describe("workCanvasService.ts — confirmTargetObjectReadBack('initiative', ...)", () => {
      it('OFF: zastana query ({ fallback: false }) — false (rekord kanoniczny niewidoczny)', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'false';
        await expect(confirmTargetObjectReadBack('initiative', initiativeId, organizationId)).resolves.toBe(
          false
        );
      });

      it('ON: initiativeExists — true', async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
        await expect(confirmTargetObjectReadBack('initiative', initiativeId, organizationId)).resolves.toBe(
          true
        );
      });

      it('obca organizacja: false przy ON i OFF', async () => {
        for (const flag of ['false', 'true'] as const) {
          process.env.ENABLE_INITIATIVE_UNIFIED_READ = flag;
          await expect(
            confirmTargetObjectReadBack('initiative', initiativeId, foreignOrganizationId)
          ).resolves.toBe(false);
        }
      });
    });
  }
);
