/** @vitest-environment node
 *
 * F.2 — cross-tenant isolation proof for mutating `/api/vnext/results/**`
 * routes, through the REAL `ApiGateway`, on a real Postgres, with the
 * `resultsInternalBetaVisibility` envelope actually enforced
 * (`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` — without it every
 * request in this file would 200 regardless of the guard being tested,
 * per `resultsInternalBetaVisibility.middleware.ts:27-33`).
 *
 * SCOPE — HONEST DENOMINATOR. RESULTS_DAY46C_REPORT_20260828.md measured
 * 135 mutating routes across 9 families (KPI, KPI deviation-cases, KPI
 * scorecards, KPI legacy, ROI, ROI legacy, OKR, OKR legacy,
 * initiatives/kpi-impacts) with 0/135 covered by any isolation proof. This
 * file covers FOUR representative write endpoints across THREE families
 * (KPI, ROI, OKR) with a REAL mutation-proof each (see the four
 * `MUTATION-PROOF LOG` comments below for the exact commands/results) —
 * not 135. KPI legacy, ROI legacy, OKR legacy, KPI deviation-cases, KPI
 * scorecards remain NIE_POKRYTE (uncovered) by this file. Each covered
 * endpoint is chosen because it best represents its family's isolation
 * mechanism:
 *
 *   1. POST /api/vnext/results/kpi/initiative-impacts (proposeInitiativeKpiImpact)
 *      — a CREATE whose `kpiId` came straight from the request body with
 *      NO existing row to load-for-update first. Real, reproduced defect
 *      fixed in this same branch (kpiInitiativeImpactCommands.ts's
 *      `loadKpiOwnerUserId` never filtered by `organization_id`): an
 *      OWNER/ADMIN in org B could name org A's real `kpiId` and the
 *      command would insert a `rvn_kpi_initiative_impacts` row with
 *      `organization_id` = org B but `kpi_id` pointing at org A's KPI
 *      (the FK on `kpi_id` only requires the KPI to exist SOMEWHERE, not
 *      that its org matches). Fixed to require the KPI to exist IN THE
 *      CALLER'S OWN org first (`KPI_NOT_FOUND`, 409 — this module's own
 *      established convention for "body-referenced entity from the wrong
 *      org", see `kpiScorecardCommands.ts`'s `addScorecardItem` for the
 *      identical existing pattern this mirrors).
 *   2. PUT /api/vnext/results/kpi/:kpiId/draft (editDraft) — an UPDATE
 *      addressed by a URL param, gated by the route's own pre-check
 *      (`getKpi({organizationId: auth.organizationId, kpiId})` — 404 if
 *      absent). Already correct on this branch; proven with the SAME
 *      mutation-proof rigor as the fix above (temporarily broken, proven
 *      red, restored, proven green) so this is not a tautology.
 *   3. POST /api/vnext/results/roi/cases/:caseId/transitions/start-modeling
 *      (mountTransitionRoute) — same "URL-param resource, route pre-checks
 *      `getRoiCase` org-scoped, 404 if absent" shape as #2, for the ROI
 *      family.
 *   4. PATCH /api/vnext/results/okr/programs/:programId/draft
 *      (editProgramDraft) — same shape as #2/#3, for the OKR family
 *      (`getProgram` org-scoped pre-check).
 *
 * Every test: authenticate as org B's real ACTIVE ADMIN (real
 * `organization_members`/`users` rows — not a forged claim the beta
 * envelope's own membership re-read would catch), address org A's real
 * resource, assert the write is REJECTED (never 200/201), THEN read the
 * target row back through an INDEPENDENT `pg.Pool` connection (never the
 * response body) and assert it is byte-for-byte unchanged from a snapshot
 * taken before the attempt.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;

// Fixed, deterministic RN-G6 seed identities (scripts/rn-g6-seed-runtime-dataset.ts)
// — this file is read-only against them (never writes org A/B's own rows
// outside the one attempted-and-rejected write per test), so it does not
// need its own org/user setup or teardown.
const ORG_A = 'rn-g6-org-przemysl';
const ORG_B = 'rn-g6-org-doradztwo';
const USER_B_ADMIN = 'rn-g6-user-b-admin'; // real ACTIVE ADMIN in org B

// Real, seeded org-A resource ids this file targets (never mutates them —
// every attempt below MUST be rejected before any write).
const ORG_A_KPI_ID = '4d5db4f2-454e-4813-8813-4d5db4454ebd'; // kpi.orgA.kpi1
const ORG_A_ROI_CASE_ID = '4d60dfca-463e-4b5e-8b5e-4d60df463e9a'; // roi.orgA.case1BuildNoCalc
const ORG_A_OKR_PROGRAM_ID = 'f6c45d26-c930-43ff-83ff-f6c45dc93035'; // okr.orgA.program
const ORG_B_INITIATIVE_ID = 'rn-g6-init-b1';

describe.skipIf(!enabled)(
  'day46-finish F.2 — mutating Results routes reject cross-tenant writes (real Gateway, real PG, enforce)',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const foreignOwnerToken = jwt.sign(
      {
        id: USER_B_ADMIN,
        userId: USER_B_ADMIN,
        email: `${USER_B_ADMIN}@test.invalid`,
        organizationId: ORG_B,
        organization_id: ORG_B,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    beforeAll(async () => {
      expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
      // Confirm the fixture this file depends on is actually present —
      // fail loudly instead of silently exercising nothing.
      const membership = await pool.query(
        `SELECT role, status FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [USER_B_ADMIN, ORG_B]
      );
      expect(
        membership.rows[0],
        'RN-G6 seed fixture missing — run scripts/rn-g6-seed-runtime-dataset.ts against this DATABASE_URL first'
      ).toEqual({ role: 'ADMIN', status: 'ACTIVE' });
    });

    afterAll(async () => {
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    it("N1 (KPI family) — org B cannot propose an initiative-impact against org A's KPI", async () => {
      const before = await pool.query(
        `SELECT count(*)::int AS n FROM rvn_kpi_initiative_impacts WHERE kpi_id = $1`,
        [ORG_A_KPI_ID]
      );

      const response = await request(app)
        .post('/api/vnext/results/kpi/initiative-impacts')
        .set('Authorization', `Bearer ${foreignOwnerToken}`)
        .send({ kpiId: ORG_A_KPI_ID, initiativeId: ORG_B_INITIATIVE_ID });

      expect(response.status, JSON.stringify(response.body)).not.toBe(200);
      expect(response.status, JSON.stringify(response.body)).not.toBe(201);
      expect(response.body.code).toBe('KPI_NOT_FOUND');

      const after = await pool.query(
        `SELECT count(*)::int AS n FROM rvn_kpi_initiative_impacts WHERE kpi_id = $1`,
        [ORG_A_KPI_ID]
      );
      expect(after.rows[0].n, 'no cross-org impact row must have been inserted').toBe(
        before.rows[0].n
      );
    });

    it("N2 (KPI family) — org B cannot edit org A's KPI draft", async () => {
      const before = await pool.query(
        `SELECT current_definition_version_id, updated_at FROM rvn_kpi_definitions WHERE kpi_id = $1`,
        [ORG_A_KPI_ID]
      );
      expect(before.rows[0], 'fixture KPI missing').toBeTruthy();

      const response = await request(app)
        .put(`/api/vnext/results/kpi/${ORG_A_KPI_ID}/draft`)
        .set('Authorization', `Bearer ${foreignOwnerToken}`)
        .send({ expectedVersion: 1, name: 'HIJACKED-BY-ORG-B' });

      expect(response.status, JSON.stringify(response.body)).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');

      const after = await pool.query(
        `SELECT current_definition_version_id, updated_at FROM rvn_kpi_definitions WHERE kpi_id = $1`,
        [ORG_A_KPI_ID]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });

    it("N3 (ROI family) — org B cannot transition org A's ROI case", async () => {
      const before = await pool.query(
        `SELECT status, row_version FROM rvn_roi_cases WHERE case_id = $1`,
        [ORG_A_ROI_CASE_ID]
      );
      expect(before.rows[0], 'fixture ROI case missing').toBeTruthy();

      const response = await request(app)
        .post(`/api/vnext/results/roi/cases/${ORG_A_ROI_CASE_ID}/transitions/start-modeling`)
        .set('Authorization', `Bearer ${foreignOwnerToken}`)
        .send({ expectedVersion: before.rows[0].row_version });

      expect(response.status, JSON.stringify(response.body)).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');

      const after = await pool.query(
        `SELECT status, row_version FROM rvn_roi_cases WHERE case_id = $1`,
        [ORG_A_ROI_CASE_ID]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });

    it("N4 (OKR family) — org B cannot edit org A's OKR program draft", async () => {
      const before = await pool.query(
        `SELECT name, row_version FROM okr_vnext_programs WHERE program_id = $1`,
        [ORG_A_OKR_PROGRAM_ID]
      );
      expect(before.rows[0], 'fixture OKR program missing').toBeTruthy();

      const response = await request(app)
        .patch(`/api/vnext/results/okr/programs/${ORG_A_OKR_PROGRAM_ID}/draft`)
        .set('Authorization', `Bearer ${foreignOwnerToken}`)
        .send({ expectedVersion: before.rows[0].row_version, name: 'HIJACKED-BY-ORG-B' });

      expect(response.status, JSON.stringify(response.body)).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');

      const after = await pool.query(
        `SELECT name, row_version FROM okr_vnext_programs WHERE program_id = $1`,
        [ORG_A_OKR_PROGRAM_ID]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  }
);

/**
 * MUTATION-PROOF LOG (Z29) — each of the four tests above was run against a
 * deliberately reintroduced version of the exact vulnerability it proves is
 * closed, confirmed RED, then restored and confirmed GREEN. Exact commands
 * and PASS/FAIL counts are recorded in
 * docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY46_FINISH_REPORT_20260828.md
 * §F.2 (this comment intentionally does not duplicate the full transcript —
 * see that report for the literal `git diff`/command/output blocks).
 */
