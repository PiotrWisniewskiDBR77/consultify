/** RES-MVP-VISIBILITY-001 — mounted DEC-RES internal-beta envelope. */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg, { type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import { createResultsInternalBetaVisibilityMiddleware } from '../../server/src/middleware/resultsInternalBetaVisibility.middleware.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

describe.skipIf(!enabled)('mounted Results internal-beta visibility', () => {
  const prefix = `res-vis-${randomUUID()}`;
  const orgA = `${prefix}-org-a`;
  const orgB = `${prefix}-org-b`;
  const owner = `${prefix}-owner`;
  const admin = `${prefix}-admin`;
  const member = `${prefix}-member`;
  const consultant = `${prefix}-consultant`;
  const revoked = `${prefix}-revoked`;
  const foreignOwner = `${prefix}-foreign-owner`;
  const missing = `${prefix}-missing`;
  const kpiId = randomUUID();
  const kpiVersionId = randomUUID();
  let db: pg.Client;
  let app: Express;
  let priorVisibilityTestMode: string | undefined;

  const token = (userId: string, organizationId: string, role = 'OWNER', extra = {}) =>
    jwt.sign(
      { id: userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role, ...extra },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  beforeAll(async () => {
    priorVisibilityTestMode = process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE;
    process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE = 'enforce';
    db = new pg.Client({ connectionString: DATABASE_URL });
    await db.connect();
    await db.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [orgA, orgB]
    );
    for (const [userId, organizationId, role, membershipStatus] of [
      [owner, orgA, 'OWNER', 'ACTIVE'],
      [admin, orgA, 'ADMIN', 'ACTIVE'],
      [member, orgA, 'MEMBER', 'ACTIVE'],
      [consultant, orgA, 'CONSULTANT', 'ACTIVE'],
      [revoked, orgA, 'OWNER', 'REVOKED'],
      [foreignOwner, orgB, 'OWNER', 'ACTIVE'],
    ] as const) {
      await db.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x',$4,'active')`,
        [userId, organizationId, `${userId}@test.invalid`, role]
      );
      await db.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), organizationId, userId, role, membershipStatus]
      );
    }
    const policy = await db.query<{ policy_id: string }>(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id,domain,policy_version,visibility_mode,is_active,created_by)
       VALUES($1,'kpi',1,'OPEN_ORG',true,$2) RETURNING policy_id`,
      [orgA, owner]
    );
    await db.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
       VALUES($1,$2,'RES-VISIBILITY','active',$3,$3)`,
      [kpiId, orgA, owner]
    );
    await db.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id,kpi_id,organization_id,version_number,name,target_geometry,
          target_min,approval_status,created_by,effective_from)
       VALUES($1,$2,$3,1,'Results visibility fixture','threshold_min',1,'approved',$4,now())`,
      [kpiVersionId, kpiId, orgA, owner]
    );
    await db.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2`,
      [kpiVersionId, kpiId]
    );
    await db.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
       VALUES('kpi',$1,$2,'OPEN_ORG',$3,$4)`,
      [kpiId, orgA, policy.rows[0]!.policy_id, owner]
    );

    const [
      { default: kpi },
      { default: kpiDeviation },
      { default: kpiScorecard },
      kpiPerspectivesModule,
      { default: kpiLegacy },
      { default: roi },
      { default: roiPerspectives },
      { default: roiLegacy },
      { default: okr },
      { default: okrLegacy },
    ] = await Promise.all([
      import('../../server/src/routes/resultsVnext/kpi.routes.js'),
      import('../../server/src/routes/resultsVnext/kpiDeviation.routes.js'),
      import('../../server/src/routes/resultsVnext/kpiScorecard.routes.js'),
      import('../../server/src/routes/resultsVnext/kpiPerspectives.routes.js'),
      import('../../server/src/routes/resultsVnext/kpiLegacyArchive.routes.js'),
      import('../../server/src/routes/resultsVnext/roi.routes.js'),
      import('../../server/src/routes/resultsVnext/roiPerspectives.routes.js'),
      import('../../server/src/routes/resultsVnext/roiLegacyArchive.routes.js'),
      import('../../server/src/routes/resultsVnext/okr.routes.js'),
      import('../../server/src/routes/resultsVnext/okrLegacyArchive.routes.js'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/kpi-deviation', kpiDeviation);
    app.use('/kpi-scorecards', kpiScorecard);
    app.use('/kpi-perspectives', kpiPerspectivesModule.default);
    app.use('/initiatives', kpiPerspectivesModule.initiativesKpiImpactsRouter);
    app.use('/kpi-legacy', kpiLegacy);
    app.use('/kpi', kpi);
    app.use('/roi-perspectives', roiPerspectives);
    app.use('/roi-legacy', roiLegacy);
    app.use('/roi', roi);
    app.use('/okr-legacy', okrLegacy);
    app.use('/okr', okr);
  }, 60_000);

  afterAll(async () => {
    if (priorVisibilityTestMode === undefined) {
      delete process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE;
    } else {
      process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE = priorVisibilityTestMode;
    }
    if (!db) return;
    await db.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id=$1`, [orgA]);
    await db.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id=NULL WHERE kpi_id=$1`, [kpiId]);
    await db.query(`DELETE FROM rvn_kpi_definition_versions WHERE kpi_id=$1`, [kpiId]);
    await db.query(`DELETE FROM rvn_kpi_definitions WHERE kpi_id=$1`, [kpiId]);
    await db.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id=$1`, [orgA]);
    await db.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await db.query(`DELETE FROM users WHERE id=ANY($1)`, [[owner, admin, member, consultant, revoked, foreignOwner]]);
    await db.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await db.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const authGet = (path: string, bearer: string) =>
    request(app).get(path).set('Authorization', `Bearer ${bearer}`);

  it('admits authoritative active OWNER and ADMIN on real KPI/ROI/OKR reads', async () => {
    const ownerKpi = await authGet('/kpi', token(owner, orgA, 'MEMBER'));
    expect(ownerKpi.status, JSON.stringify(ownerKpi.body)).toBe(200);
    expect(ownerKpi.body.kpis).toHaveLength(1);
    expect(ownerKpi.body.kpis[0].kpiId).toBe(kpiId);

    const adminRoi = await authGet('/roi/cases', token(admin, orgA, 'GUEST'));
    expect(adminRoi.status, JSON.stringify(adminRoi.body)).toBe(200);
    expect(adminRoi.body.cases).toEqual([]);

    const ownerOkr = await authGet('/okr/programs', token(owner, orgA, 'USER'));
    expect(ownerOkr.status, JSON.stringify(ownerOkr.body)).toBe(200);
    expect(ownerOkr.body.programs).toEqual([]);
  });

  it('denies lower roles before every one of the eleven production router instances', async () => {
    const paths = [
      '/kpi-deviation/__visibility_probe__',
      '/kpi-scorecards/__visibility_probe__',
      '/kpi-perspectives/__visibility_probe__',
      '/initiatives/__visibility_probe__',
      '/kpi-legacy/__visibility_probe__',
      '/kpi/__visibility_probe__',
      '/roi-perspectives/__visibility_probe__',
      '/roi-legacy/__visibility_probe__',
      '/roi/__visibility_probe__',
      '/okr-legacy/__visibility_probe__',
      '/okr/__visibility_probe__',
    ];
    for (const actor of [member, consultant]) {
      for (const path of paths) {
        const denied = await authGet(path, token(actor, orgA, 'OWNER', { isSuperAdmin: true }));
        expect(denied.status, `${actor} ${path}: ${JSON.stringify(denied.body)}`).toBe(403);
        expect(denied.body.code).toBe('RESULTS_INTERNAL_BETA_VISIBILITY_DENIED');
      }
    }
  });

  it('rechecks revoked, missing and foreign memberships and ignores body tenant spoofing', async () => {
    for (const [bearer, expectedCode] of [
      [token(revoked, orgA), 'ORG_MEMBERSHIP_REVOKED'],
      [token(missing, orgA), 'ORG_MEMBERSHIP_REVOKED'],
    ] as const) {
      const denied = await authGet('/kpi', bearer);
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe(expectedCode);
    }
    const foreignClaimSpoof = await authGet('/kpi', token(foreignOwner, orgA));
    expect(foreignClaimSpoof.status).toBe(200);
    expect(foreignClaimSpoof.body.kpis).toEqual([]);
    const spoof = await request(app)
      .post('/roi/__visibility_probe__')
      .set('Authorization', `Bearer ${token(member, orgA)}`)
      .send({ organizationId: orgB, organization_id: orgB });
    expect(spoof.status).toBe(403);
    expect(spoof.body.code).toBe('RESULTS_INTERNAL_BETA_VISIBILITY_DENIED');

    await db.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgA, owner]
    );
    expect((await authGet('/kpi', token(owner, orgA))).status).toBe(403);
  });

  it('fails closed when the authoritative membership store is unavailable', async () => {
    const unavailable = express();
    unavailable.use((req, _res, next) => {
      (req as typeof req & { user: object }).user = { id: owner, organizationId: orgA };
      next();
    });
    unavailable.use(
      createResultsInternalBetaVisibilityMiddleware({
        acquireClient: async () => {
          throw new Error('membership-store-unavailable');
        },
      })
    );
    unavailable.get('/results', (_req, res) => res.status(200).json({ leaked: true }));
    const response = await request(unavailable).get('/results');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: 'Results access unavailable',
      code: 'RESULTS_INTERNAL_BETA_VISIBILITY_UNAVAILABLE',
    });
  });
});
