/** FIN-MVP-RECONCILIATION-001 — mounted signed-JWT DEC-FIN matrix. */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = `fin-recon-${Date.now().toString(36)}-`;
const ORG_A = `${P}org-a`;
const ORG_B = `${P}org-b`;
const OWNER = `${P}owner`;
const ADMIN = `${P}admin`;
const MEMBER = `${P}member-case-owner`;
const FIN_OWNER = `${P}explicit-fin-owner`;
const REVOKED = `${P}revoked`;
const FOREIGN = `${P}foreign`;
const INITIATIVE = `${P}initiative`;

function token(userId: string, organizationId: string, role: string): string {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, organizationId, organization_id: organizationId, role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

describe('FIN-MVP-RECONCILIATION mounted realPG auth/tenant matrix', () => {
  let db: pg.Client;
  let app: Express;
  let caseId: string;
  const linkIds: string[] = [];

  async function seedUser(userId: string, orgId: string, role: string, membershipStatus = 'ACTIVE') {
    await db.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'x',$4,'active','Fin','Recon',now())`,
      [userId, orgId, `${userId}@test.local`, role]
    );
    await db.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [`${P}membership-${userId}`, orgId, userId, role === 'USER' ? 'MEMBER' : role, membershipStatus]
    );
  }

  beforeAll(async () => {
    await assertJwtSecretHermetic();
    requireLocalDbUrl();
    db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await db.query(`INSERT INTO organizations (id,name,plan,status) VALUES ($1,'FIN A','enterprise','active'),($2,'FIN B','enterprise','active')`, [ORG_A, ORG_B]);
    await seedUser(OWNER, ORG_A, 'OWNER');
    await seedUser(ADMIN, ORG_A, 'ADMIN');
    await seedUser(MEMBER, ORG_A, 'USER');
    await seedUser(FIN_OWNER, ORG_A, 'USER');
    await seedUser(REVOKED, ORG_A, 'USER', 'REVOKED');
    await seedUser(FOREIGN, ORG_B, 'OWNER');
    await db.query(`INSERT INTO initiatives (id,organization_id,name) VALUES ($1,$2,'FIN reconciliation')`, [INITIATIVE, ORG_A]);
    await db.query(
      `INSERT INTO rvn_platform_visibility_policies
       (organization_id,domain,policy_version,visibility_mode,is_active,created_by)
       VALUES ($1,'roi',1,'OPEN_ORG',true,$2)`,
      [ORG_A, OWNER]
    );
    await db.query(
      `INSERT INTO rvn_finance_reconciliation_owner_grants (organization_id,user_id,granted_by)
       VALUES ($1,$2,$3)`,
      [ORG_A, FIN_OWNER, OWNER]
    );

    const caseCommands = await import('../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    const linkCommands = await import('../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
    const createdCase = await caseCommands.createRoiCase({
      organizationId: ORG_A,
      initiativeId: INITIATIVE,
      title: 'DEC-FIN mounted case',
      ownerUserId: MEMBER,
      currency: 'PLN',
      createdBy: OWNER,
      actorEffectiveRole: 'OWNER',
      idempotencyKey: `${P}case`,
    });
    caseId = createdCase.result.case.caseId;
    for (let index = 0; index < 3; index += 1) {
      const link = await linkCommands.createRoiFinanceLink({
        caseId,
        organizationId: ORG_A,
        financeArtifactType: 'business_case',
        financeArtifactId: `${P}artifact-${index}`,
        financeVersionId: `${P}version-${index}`,
        source: 'finance_v3',
        asOf: new Date().toISOString(),
        linkPurpose: 'actual_reconciliation',
        actorUserId: OWNER,
        actorEffectiveRole: 'OWNER',
        idempotencyKey: `${P}link-${index}`,
        access: { capabilities: ['*'], platformRole: null },
      });
      linkIds.push(link.result.linkId);
    }

    const roiRouter = (await import('../../server/src/routes/resultsVnext/roi.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/vnext/results/roi', roiRouter);
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.query(`DELETE FROM rvn_finance_reconciliation_owner_grants WHERE organization_id = $1`, [ORG_A]);
    await db.query(`SET session_replication_role = replica`);
    await db.query(`DELETE FROM rvn_finance_reconciliation_decisions WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = $1`, [ORG_A]);
    await db.query(`SET session_replication_role = origin`);
    await db.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_id=$1`, [caseId]);
    await db.query(`DELETE FROM rvn_platform_obligations WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_baselines WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_cases WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM initiatives WHERE id=$1`, [INITIATIVE]);
    await db.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[OWNER, ADMIN, MEMBER, FIN_OWNER, REVOKED, FOREIGN]]);
    await db.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]);
    await db.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  }, 30_000);

  async function openAsMember(linkId: string, key: string) {
    return request(app)
      .post(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations`)
      .set('Authorization', `Bearer ${token(MEMBER, ORG_A, 'USER')}`)
      .send({ financeLinkId: linkId, reconciliationKind: 'proposal', roiValue: 100, financeValue: 106, idempotencyKey: key });
  }

  it('member responsible may propose but cannot self/terminal resolve; OWNER may resolve', async () => {
    const opened = await openAsMember(linkIds[0]!, `${P}open-owner`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    const self = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(MEMBER, ORG_A, 'USER')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}self` });
    expect(self.status).toBe(403);

    const owner = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(OWNER, ORG_A, 'OWNER')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}owner-resolve` });
    expect(owner.status).toBe(200);
    expect(owner.body.financeReconciliation.resolvedBy).toBe(OWNER);
  });

  it('explicit Finance-owner capability resolves; foreign and revoked identities fail closed', async () => {
    const opened = await openAsMember(linkIds[1]!, `${P}open-explicit`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    for (const [actor, org, role] of [[FOREIGN, ORG_B, 'OWNER'], [REVOKED, ORG_A, 'USER']] as const) {
      const denied = await request(app)
        .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
        .set('Authorization', `Bearer ${token(actor, org, role)}`)
        .send({ expectedVersion: reconciliation.rowVersion, status: 'accepted_divergence', idempotencyKey: `${P}deny-${actor}` });
      expect([403, 404]).toContain(denied.status);
    }
    const explicit = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(FIN_OWNER, ORG_A, 'USER')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'accepted_divergence', idempotencyKey: `${P}explicit` });
    expect(explicit.status).toBe(200);
    expect(explicit.body.financeReconciliation.resolvedBy).toBe(FIN_OWNER);
  });

  it('ADMIN wildcard resolves and cold SQL readback preserves the proposal/policy stamp', async () => {
    const opened = await openAsMember(linkIds[2]!, `${P}open-admin`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    const admin = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(ADMIN, ORG_A, 'ADMIN')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}admin` });
    expect(admin.status).toBe(200);
    const cold = await db.query(
      `SELECT reconciliation_kind, decision_policy_version, decision_policy_digest, roi_value, finance_value, resolved_by
         FROM rvn_roi_finance_reconciliations WHERE reconciliation_id=$1`,
      [reconciliation.reconciliationId]
    );
    expect(cold.rows[0]).toMatchObject({
      reconciliation_kind: 'proposal',
      decision_policy_version: 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
      decision_policy_digest: 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
      resolved_by: ADMIN,
    });
    expect(Number(cold.rows[0].roi_value)).toBe(100);
    expect(Number(cold.rows[0].finance_value)).toBe(106);
  });
});
